-- 20260517_van_stock_use_price_fallback.sql
--
-- Problem
-- -------
-- Client report (BATTERY 105D31L, part_code S-02498): "Van stock list shows
-- RM318.25, but the job card pulls the part in at RM0.00."
--
-- Root cause: `rpc_use_van_stock_part` snapshots the price into job_parts as:
--   sell_price_at_time = COALESCE(v_part.sell_price, 0)
--
-- For S-02498 (BATTERY 105D31L / 125D31L [COZZIE]) the parts row has:
--   cost_price = 318.25
--   sell_price = NULL
--
-- So COALESCE(NULL, 0) → 0 lands on the job_part. The legacy
-- `addPartToJob` path in services/jobInvoiceService.ts already uses the
-- correct fallback `part.sell_price ?? part.cost_price ?? 0`. This fix
-- aligns the RPC with that fallback chain so the job card pulls in
-- cost_price when sell_price is unset (which is common for newly-imported
-- parts where the markup hasn't been entered yet).
--
-- Fix: change `COALESCE(v_part.sell_price, 0)` →
-- `COALESCE(v_part.sell_price, v_part.cost_price, 0)`.
--
-- Surgical change: only the price-snapshot line. Everything else
-- (idempotency, decrement, audit log, approval gate) stays byte-identical.

CREATE OR REPLACE FUNCTION public.rpc_use_van_stock_part(p_item_id uuid, p_job_id uuid, p_quantity numeric, p_idempotency_key text, p_use_bulk boolean DEFAULT false, p_notes text DEFAULT NULL::text)
 RETURNS job_parts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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

  -- Idempotency
  SELECT * INTO v_existing_usage
    FROM van_stock_usage WHERE idempotency_key = p_idempotency_key LIMIT 1;
  IF FOUND THEN
    SELECT * INTO v_jp FROM job_parts WHERE job_part_id = v_existing_usage.job_part_id;
    IF FOUND THEN
      RETURN v_jp;
    END IF;
  END IF;

  -- Lock the van_stock_items row to serialize concurrent uses
  SELECT * INTO v_item FROM van_stock_items WHERE item_id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'rpc_use_van_stock_part: van_stock_item % not found', p_item_id;
  END IF;
  SELECT * INTO v_part FROM parts WHERE part_id = v_item.part_id;

  -- Decrement (atomic UPDATE-WHERE-RETURNING) per is_liquid branch
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

  -- Approval gate
  SELECT j.assigned_technician_id, j.assigned_technician_name, COALESCE(f.ownership, 'company')
    INTO v_tech_id, v_tech_name, v_owner
    FROM jobs j LEFT JOIN forklifts f ON f.forklift_id = j.forklift_id
   WHERE j.job_id = p_job_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'rpc_use_van_stock_part: job % not found', p_job_id;
  END IF;
  v_requires := (v_owner = 'customer');
  v_status   := CASE WHEN v_requires THEN 'pending' ELSE 'approved' END;

  -- Caller name
  IF v_caller IS NOT NULL THEN
    SELECT COALESCE(raw_user_meta_data->>'full_name', email) INTO v_caller_name
      FROM auth.users WHERE id = v_caller;
  END IF;

  -- 1) job_parts row — THE FIX:
  --    sell_price_at_time now falls back to cost_price when sell_price is NULL.
  --    Mirrors services/jobInvoiceService.ts addPartToJob (`sell_price ?? cost_price ?? 0`).
  INSERT INTO job_parts (
    job_id, part_id, part_name, quantity, sell_price_at_time, cost_price_at_time,
    from_van_stock, van_stock_item_id, auto_populated, is_external_purchase,
    deducted_at, deducted_by_id, deducted_by_name, created_at
  ) VALUES (
    p_job_id, v_part.part_id, v_part.part_name, p_quantity,
    COALESCE(v_part.sell_price, v_part.cost_price, 0),  -- ← FIX (was: COALESCE(v_part.sell_price, 0))
    COALESCE(v_part.cost_price, 0),
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
    p_notes
  );

  RETURN v_jp;
END;
$function$;

-- Post-apply sanity check
DO $$
DECLARE v_src TEXT;
BEGIN
  SELECT prosrc INTO v_src FROM pg_proc WHERE proname = 'rpc_use_van_stock_part';
  IF v_src NOT LIKE '%COALESCE(v_part.sell_price, v_part.cost_price, 0)%' THEN
    RAISE EXCEPTION 'Fix not applied: rpc_use_van_stock_part still missing cost_price fallback';
  END IF;
  RAISE NOTICE 'rpc_use_van_stock_part now falls back to cost_price when sell_price IS NULL.';
END $$;
