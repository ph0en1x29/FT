-- 2026-05-07 — PR 2: atomic van-stock usage RPC + drop the dual-deduction trigger.
-- Client report (Shin, 5/6 4:03 AM): JOB-260506-021 REAR HUB SCREW used 3 but deducted 6.
-- Client report (Shin, 5/6 6:05 AM): JOB-260506-034 OIL FILTER 1631 deducted but not in
-- Parts Used.
--
-- Root cause: useJobPartsHandlers.handleUseVanStockPart calls vanStockUsageService.useVanStockPart
-- (decrement + usage + movement) THEN addPartToJob (insert job_parts). The job_parts insert
-- triggers `trigger_deduct_van_stock` which decrements + inserts another usage row. Result:
-- double-deduct (Bug 4). If addPartToJob throws after the first call commits, the decrement
-- has already landed and is never reversed (Bug 5).
--
-- Strategy:
--  • New RPC `rpc_use_van_stock_part` does the full workflow atomically:
--      decrement (or container/bulk for liquids)
--      → insert van_stock_usage with approval gate from forklifts.ownership
--      → insert inventory_movements
--      → insert job_parts with from_van_stock=TRUE
--    Single Postgres transaction. Idempotent via idempotency_key on van_stock_usage.
--  • Drop trigger_deduct_van_stock + function deduct_van_stock in same migration so
--    addPartToJob no longer double-fires when the RPC inserts job_parts.
--    (NOTE: the old service path `addPartToJob` is still called for warehouse/main-store
--    parts where from_van_stock=FALSE — the trigger only fires when from_van_stock=TRUE,
--    so dropping it has no effect on non-van paths.)

BEGIN;
SET LOCAL statement_timeout = '60s';

-- 2.1 Idempotency on van_stock_usage
ALTER TABLE van_stock_usage
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_van_stock_usage_idem
  ON van_stock_usage(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 2.2 The atomic RPC
CREATE OR REPLACE FUNCTION public.rpc_use_van_stock_part(
  p_item_id          UUID,
  p_job_id           UUID,
  p_quantity         NUMERIC,
  p_idempotency_key  TEXT,
  p_use_bulk         BOOLEAN DEFAULT FALSE,
  p_notes            TEXT    DEFAULT NULL
) RETURNS job_parts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_usage van_stock_usage%ROWTYPE;
  v_jp             job_parts%ROWTYPE;
  v_item           van_stock_items%ROWTYPE;
  v_part           parts%ROWTYPE;
  v_owner          TEXT;
  v_tech_id        UUID;
  v_tech_name      TEXT;
  v_requires       BOOLEAN;
  v_status         TEXT;
  v_caller         UUID := auth.uid();
  v_caller_name    TEXT;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'rpc_use_van_stock_part: quantity must be > 0 (got %)', p_quantity;
  END IF;
  IF p_idempotency_key IS NULL OR LENGTH(p_idempotency_key) < 8 THEN
    RAISE EXCEPTION 'rpc_use_van_stock_part: idempotency_key required (>= 8 chars)';
  END IF;

  -- Idempotency: if a usage row already exists for this key, return its job_parts row.
  SELECT * INTO v_existing_usage
    FROM van_stock_usage WHERE idempotency_key = p_idempotency_key LIMIT 1;
  IF FOUND THEN
    SELECT * INTO v_jp FROM job_parts WHERE job_part_id = v_existing_usage.job_part_id;
    IF FOUND THEN
      RETURN v_jp;
    END IF;
    -- usage row exists but no job_parts (rare: prior partial run). Fall through to retry.
  END IF;

  -- Lock the van_stock_items row first to serialize concurrent uses on the same SKU.
  SELECT * INTO v_item FROM van_stock_items WHERE item_id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'rpc_use_van_stock_part: van_stock_item % not found', p_item_id;
  END IF;
  SELECT * INTO v_part FROM parts WHERE part_id = v_item.part_id;

  -- Decrement (atomic UPDATE-WHERE-RETURNING) per is_liquid branch.
  IF v_part.is_liquid THEN
    IF p_use_bulk THEN
      UPDATE van_stock_items
         SET bulk_quantity = bulk_quantity - p_quantity,
             last_used_at  = NOW(),
             updated_at    = NOW()
       WHERE item_id = p_item_id
         AND COALESCE(bulk_quantity, 0) >= p_quantity
       RETURNING * INTO v_item;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Insufficient bulk stock for item %', p_item_id;
      END IF;
    ELSE
      -- Consume one container.
      UPDATE van_stock_items
         SET container_quantity = container_quantity - 1,
             last_used_at  = NOW(),
             updated_at    = NOW()
       WHERE item_id = p_item_id
         AND COALESCE(container_quantity, 0) >= 1
       RETURNING * INTO v_item;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Insufficient container stock for item %', p_item_id;
      END IF;
    END IF;
    -- Liquids: never touch quantity column (route_liquid_to_bulk_quantity guards it).
  ELSE
    UPDATE van_stock_items
       SET quantity     = quantity - p_quantity,
           last_used_at = NOW(),
           updated_at   = NOW()
     WHERE item_id  = p_item_id
       AND quantity >= p_quantity
     RETURNING * INTO v_item;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient stock for item % (need %, have %)',
                      p_item_id, p_quantity,
                      (SELECT quantity FROM van_stock_items WHERE item_id = p_item_id);
    END IF;
  END IF;

  -- Read the assigned tech + ownership for the approval gate (mirrors old trigger).
  SELECT j.assigned_technician_id, j.assigned_technician_name, COALESCE(f.ownership, 'company')
    INTO v_tech_id, v_tech_name, v_owner
    FROM jobs j LEFT JOIN forklifts f ON f.forklift_id = j.forklift_id
   WHERE j.job_id = p_job_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'rpc_use_van_stock_part: job % not found', p_job_id;
  END IF;
  v_requires := (v_owner = 'customer');
  v_status   := CASE WHEN v_requires THEN 'pending' ELSE 'approved' END;

  -- Caller name (best-effort; falls back to assigned tech).
  IF v_caller IS NOT NULL THEN
    SELECT COALESCE(raw_user_meta_data->>'full_name', email) INTO v_caller_name
      FROM auth.users WHERE id = v_caller LIMIT 1;
  END IF;

  -- 1) job_parts row
  INSERT INTO job_parts (
    job_id, part_id, part_name, quantity, sell_price_at_time, cost_price_at_time,
    from_van_stock, van_stock_item_id, auto_populated, is_external_purchase,
    deducted_at, deducted_by_id, deducted_by_name, created_at
  ) VALUES (
    p_job_id, v_part.part_id, v_part.part_name, p_quantity,
    COALESCE(v_part.sell_price, 0), COALESCE(v_part.cost_price, 0),
    TRUE, p_item_id, FALSE, FALSE,
    NOW(), COALESCE(v_caller, v_tech_id), COALESCE(v_caller_name, v_tech_name, 'system'),
    NOW()
  ) RETURNING * INTO v_jp;

  -- 2) van_stock_usage row (with idempotency key)
  INSERT INTO van_stock_usage (
    van_stock_item_id, job_id, job_part_id, quantity_used,
    used_by_id, used_by_name, used_at,
    requires_approval, approval_status, idempotency_key
  ) VALUES (
    p_item_id, p_job_id, v_jp.job_part_id, p_quantity,
    COALESCE(v_caller, v_tech_id), COALESCE(v_caller_name, v_tech_name, 'system'), NOW(),
    v_requires, v_status, p_idempotency_key
  );

  -- 3) inventory_movements row
  INSERT INTO inventory_movements (
    part_id, movement_type, container_qty_change, bulk_qty_change,
    job_id, van_stock_item_id, performed_by, performed_by_name, performed_at, notes
  ) VALUES (
    v_part.part_id, 'use_internal',
    CASE WHEN v_part.is_liquid AND NOT p_use_bulk THEN -1 WHEN NOT v_part.is_liquid THEN -p_quantity::INTEGER ELSE 0 END,
    CASE WHEN v_part.is_liquid AND p_use_bulk THEN -p_quantity ELSE NULL END,
    p_job_id, p_item_id,
    COALESCE(v_caller, v_tech_id), COALESCE(v_caller_name, v_tech_name, 'system'), NOW(),
    COALESCE(p_notes, 'Used ' || p_quantity || ' from van stock' || CASE WHEN v_part.is_liquid THEN ' (liquid' || (CASE WHEN p_use_bulk THEN ' bulk' ELSE ' container' END) || ')' ELSE ' (non-liquid)' END)
  );

  RETURN v_jp;
END $$;
COMMENT ON FUNCTION public.rpc_use_van_stock_part IS
  'Atomic van-stock consumption: decrement + usage + movement + job_parts in one transaction. '
  'Idempotent via idempotency_key. Customer-fleet approval gate ported from former '
  'trigger_deduct_van_stock. PR 2 2026-05-07.';

-- 2.3 Drop the dual-deduction trigger and its function.
DROP TRIGGER IF EXISTS trigger_deduct_van_stock ON job_parts;
DROP FUNCTION IF EXISTS public.deduct_van_stock();

-- 2.4 Smoke test: confirm RPC exists and trigger is gone.
DO $$
DECLARE has_rpc BOOLEAN; has_trg BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname='rpc_use_van_stock_part') INTO has_rpc;
  SELECT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trigger_deduct_van_stock') INTO has_trg;
  IF NOT has_rpc THEN RAISE EXCEPTION 'RPC missing'; END IF;
  IF has_trg     THEN RAISE EXCEPTION 'Old trigger still exists'; END IF;
END $$;

-- 2.5 Permissions: technicians and admins call the RPC.
GRANT EXECUTE ON FUNCTION public.rpc_use_van_stock_part(UUID, UUID, NUMERIC, TEXT, BOOLEAN, TEXT) TO authenticated;

COMMIT;
