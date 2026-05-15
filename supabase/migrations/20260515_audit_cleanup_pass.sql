-- 20260515_audit_cleanup_pass.sql
--
-- Cleanup pass driven by a 3-reviewer audit of this morning's S-01044 +
-- AQUA bulk-sign fixes. Two issues we introduced needed correction:
--
--   1. `check_job_completion_readiness` was silently changed from
--      SECURITY INVOKER → SECURITY DEFINER in the bulk-sign readiness
--      fix. The original (20260507_completion_evaluator_and_readiness_rpc.sql)
--      was INVOKER. No justification was given for the privilege change.
--      `evaluate_job_completion` is already SECURITY DEFINER, so the
--      readiness wrapper doesn't need DEFINER itself. Restore INVOKER.
--
--   2. `rpc_return_part_to_store` non-liquid branch left
--      `v_new_van_container` and `v_new_van_bulk` unset, which then got
--      written as NULL into `inventory_movements.van_container_qty_after`
--      and `van_bulk_qty_after`. The legacy RPC populated those columns
--      (with the field-name-wrong-but-non-NULL `v_new_van_qty::INTEGER`).
--      This is a backwards-compatibility regression for non-liquid
--      returns. Initialize the locals in the non-liquid branch.
--
-- Both fixes are minimal — they restore the prior semantics without
-- otherwise changing behavior.

BEGIN;

-- ════════════════════════════════════════════════════════════════════
-- 1. Restore SECURITY INVOKER on check_job_completion_readiness
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.check_job_completion_readiness(p_job_ids uuid[])
RETURNS TABLE(job_id uuid, can_complete boolean, blocker text)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER       -- ← restored from DEFINER (was original)
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_role        TEXT;
    v_row         public.jobs;
    v_blocker     TEXT;
    v_sig_stub    JSONB := jsonb_build_object(
                             'signed_by_name', '__readiness_preview__',
                             'signed_at', NOW()::TEXT,
                             'signature_url', ''
                           );
BEGIN
    SELECT u.role INTO v_role FROM users u WHERE u.auth_id = auth.uid();

    FOR v_row IN
        SELECT * FROM jobs WHERE jobs.job_id = ANY(p_job_ids) AND jobs.deleted_at IS NULL
    LOOP
        -- Synthesise the post-bulk-sign row state so the readiness preview
        -- matches what rpc_bulk_complete_jobs will actually accept. The
        -- signature stubs are placeholders to defeat Gates 7/8 in
        -- evaluate_job_completion. The function is STABLE — never writes —
        -- so the stub can never leak to the table.
        v_row.technician_signature := COALESCE(v_row.technician_signature, v_sig_stub);
        v_row.customer_signature   := COALESCE(v_row.customer_signature, v_sig_stub);

        v_blocker := evaluate_job_completion(v_row, v_role);
        job_id := v_row.job_id;
        can_complete := v_blocker IS NULL;
        blocker := v_blocker;
        RETURN NEXT;
    END LOOP;
END;
$function$;

-- ════════════════════════════════════════════════════════════════════
-- 2. Fix rpc_return_part_to_store non-liquid audit-column nulls
--    The non-liquid branch fell through to the INSERT into
--    inventory_movements with v_new_van_container / v_new_van_bulk
--    unassigned (NULL). Legacy populated those columns. Initialize them
--    in the non-liquid branch so the audit log stays consistent.
-- ════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.rpc_return_part_to_store(
  p_van_stock_item_id uuid,
  p_quantity          numeric,
  p_performed_by      uuid,
  p_performed_by_name text,
  p_reason            text
)
RETURNS van_stock_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller_role     TEXT;
  v_item            van_stock_items;
  v_part            RECORD;
  v_new_van_qty     NUMERIC;
  v_new_store_qty   INTEGER;
  v_updated_item    van_stock_items;

  -- Liquid bookkeeping (also used as audit-column source for solids)
  v_is_liquid          BOOLEAN;
  v_van_avail          NUMERIC;
  v_new_van_container  INTEGER;
  v_new_van_bulk       NUMERIC;
  v_containers_broken  INTEGER;
  v_deficit            NUMERIC;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'A reason is required for van stock returns';
  END IF;

  SELECT role INTO v_caller_role
    FROM users
   WHERE auth_id = auth.uid();

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('admin', 'admin_service', 'admin_store', 'supervisor') THEN
    RAISE EXCEPTION 'Only store admins or supervisors can return stock from a van (role=%)', COALESCE(v_caller_role, 'unknown');
  END IF;

  SELECT * INTO v_item
    FROM van_stock_items
   WHERE item_id = p_van_stock_item_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Van stock item % not found', p_van_stock_item_id;
  END IF;

  SELECT part_id, part_name, is_liquid,
         stock_quantity, container_quantity, container_size, bulk_quantity
    INTO v_part
    FROM parts
   WHERE part_id = v_item.part_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Central part row % not found (orphaned van item)', v_item.part_id;
  END IF;

  v_is_liquid := COALESCE(v_part.is_liquid, FALSE);

  IF v_is_liquid THEN
    v_van_avail := (COALESCE(v_item.container_quantity, 0) * COALESCE(v_part.container_size, 0))
                 + COALESCE(v_item.bulk_quantity, 0);

    IF v_van_avail < p_quantity THEN
      RAISE EXCEPTION 'Van has only %L of liquid part "%", cannot return %L',
        v_van_avail, v_part.part_name, p_quantity;
    END IF;

    IF COALESCE(v_item.bulk_quantity, 0) >= p_quantity THEN
      v_new_van_container := COALESCE(v_item.container_quantity, 0);
      v_new_van_bulk      := COALESCE(v_item.bulk_quantity, 0) - p_quantity;
      v_containers_broken := 0;
    ELSE
      v_deficit := p_quantity - COALESCE(v_item.bulk_quantity, 0);
      IF COALESCE(v_part.container_size, 0) <= 0 THEN
        RAISE EXCEPTION 'Cannot return %L of liquid part "%": insufficient van bulk (%L) and container_size is not configured',
          p_quantity, v_part.part_name, COALESCE(v_item.bulk_quantity, 0);
      END IF;
      v_containers_broken := CEIL(v_deficit / v_part.container_size)::INTEGER;
      v_new_van_container := COALESCE(v_item.container_quantity, 0) - v_containers_broken;
      v_new_van_bulk      := (v_containers_broken * v_part.container_size) - v_deficit;
    END IF;

    UPDATE van_stock_items
       SET quantity           = 0,
           container_quantity = v_new_van_container,
           bulk_quantity      = v_new_van_bulk,
           updated_at         = NOW()
     WHERE item_id = p_van_stock_item_id
     RETURNING * INTO v_updated_item;

    v_new_van_qty := v_new_van_bulk;
  ELSE
    -- Non-liquid path
    IF COALESCE(v_item.quantity, 0) < p_quantity THEN
      RAISE EXCEPTION 'Van only has % of this part, cannot return %',
        COALESCE(v_item.quantity, 0), p_quantity;
    END IF;
    v_new_van_qty := v_item.quantity - p_quantity;

    -- Initialize audit locals so the INSERT below doesn't write NULL into
    -- van_container_qty_after / van_bulk_qty_after for the non-liquid path
    -- (regression-fix for the 20260515_return_to_store_liquid_support pass).
    v_new_van_container := COALESCE(v_item.container_quantity, 0);
    v_new_van_bulk      := COALESCE(v_item.bulk_quantity, 0);
    v_containers_broken := 0;

    UPDATE van_stock_items
       SET quantity   = v_new_van_qty,
           updated_at = NOW()
     WHERE item_id = p_van_stock_item_id
     RETURNING * INTO v_updated_item;
  END IF;

  -- Increment central stock
  IF v_is_liquid THEN
    UPDATE parts
       SET bulk_quantity = COALESCE(bulk_quantity, 0) + p_quantity,
           updated_at    = NOW()
     WHERE part_id = v_item.part_id;
    v_new_store_qty := COALESCE(v_part.stock_quantity, 0);
  ELSE
    v_new_store_qty := COALESCE(v_part.stock_quantity, 0) + p_quantity::INTEGER;
    UPDATE parts
       SET stock_quantity = v_new_store_qty,
           updated_at     = NOW()
     WHERE part_id = v_item.part_id;
  END IF;

  -- Audit log — both branches now populate every *_after column.
  -- For non-liquids, van_container_qty_after carries the unchanged
  -- container_quantity (almost always 0), van_bulk_qty_after carries
  -- the unchanged bulk_quantity (almost always 0). Reads cleanly.
  INSERT INTO inventory_movements (
    part_id, movement_type,
    container_qty_change, bulk_qty_change,
    van_stock_id, van_stock_item_id,
    performed_by, performed_by_name,
    notes, adjustment_reason,
    store_container_qty_after, store_bulk_qty_after,
    van_container_qty_after,   van_bulk_qty_after
  ) VALUES (
    v_item.part_id, 'return_to_store',
    CASE WHEN v_is_liquid THEN 0 ELSE p_quantity::INTEGER END,
    CASE WHEN v_is_liquid THEN p_quantity ELSE 0 END,
    v_item.van_stock_id, p_van_stock_item_id,
    p_performed_by, p_performed_by_name,
    format('Returned %s of "%s" from van to store', p_quantity, v_part.part_name),
    p_reason,
    COALESCE(v_part.container_quantity, 0)::INTEGER,
    CASE WHEN v_is_liquid THEN COALESCE(v_part.bulk_quantity, 0) + p_quantity
         ELSE COALESCE(v_part.bulk_quantity, 0) END,
    v_new_van_container,
    v_new_van_bulk
  );

  RETURN v_updated_item;
END;
$function$;

-- Post-apply sanity checks
DO $$
DECLARE
  v_secdef BOOLEAN;
  v_volat  CHAR;
BEGIN
  SELECT prosecdef, provolatile
    INTO v_secdef, v_volat
    FROM pg_proc WHERE proname = 'check_job_completion_readiness';
  IF v_secdef THEN
    RAISE EXCEPTION 'check_job_completion_readiness is still SECURITY DEFINER';
  END IF;
  IF v_volat <> 's' THEN
    RAISE EXCEPTION 'check_job_completion_readiness should be STABLE (got %)', v_volat;
  END IF;
  RAISE NOTICE 'check_job_completion_readiness restored to SECURITY INVOKER STABLE.';
END $$;

COMMIT;
