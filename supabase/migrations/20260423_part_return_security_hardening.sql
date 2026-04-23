-- 20260423_part_return_security_hardening.sql
--
-- Hardening pass for the part-return RPCs introduced earlier today in
-- 20260423_part_return_flow.sql. A 3-round adversarial review found:
--
--   1. request_part_return / cancel_part_return only checked auth.uid() != null
--      — any technician could mutate any job's parts, including jobs they
--      weren't assigned to. cancel_part_return additionally allowed cross-user
--      cancellation (tech A undoes tech B's pending return).
--
--   2. confirm_part_return had no quantity > 0 guard. Combined with the
--      permissive UPDATE policy on job_parts, an attacker could set
--      quantity=-N and confirm to *decrement* central stock.
--
--   3. Nothing prevented DELETE of a job_parts row already in pending_return
--      state. The row would vanish, the audit trail would be orphaned, and
--      the master parts.stock_quantity would never see the credit.
--
-- This migration:
--   * Adds an assigned-tech / admin scoping check to request_part_return
--     and a requester-or-admin scoping check to cancel_part_return.
--   * Adds quantity-must-be-positive guards to all three RPCs (defensive).
--   * Adds a CHECK (quantity > 0) on job_parts (verified live: 0 violations).
--   * Adds a BEFORE DELETE trigger blocking deletion of pending_return rows.
--
-- Pairs with 20260423_part_return_flow.sql (RPC + columns) and
-- 20260423_completion_gate_skip_returns.sql / _acknowledge_returned.sql
-- (trigger updates).

BEGIN;

-- ============================================================
-- 1. Hard constraint: quantity must be positive
-- ============================================================

ALTER TABLE job_parts DROP CONSTRAINT IF EXISTS job_parts_quantity_positive_check;
ALTER TABLE job_parts
  ADD CONSTRAINT job_parts_quantity_positive_check
  CHECK (quantity > 0);

-- ============================================================
-- 2. BEFORE DELETE guard on pending-return rows
-- ============================================================

CREATE OR REPLACE FUNCTION public.guard_job_parts_pending_return_delete()
RETURNS TRIGGER AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  IF OLD.return_status = 'pending_return' THEN
    -- Even admins shouldn't silently delete a pending-return row — they should
    -- cancel it (which audits) or wait for the tech to bring it back.
    SELECT role INTO v_caller_role FROM users WHERE auth_id = auth.uid();
    RAISE EXCEPTION 'Cannot delete a job_parts row that is in pending_return state. Cancel the return first (cancel_part_return RPC) or confirm receipt (confirm_part_return RPC). Caller role: %.',
      COALESCE(v_caller_role, 'unknown');
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_guard_job_parts_pending_return_delete ON job_parts;
CREATE TRIGGER trg_guard_job_parts_pending_return_delete
  BEFORE DELETE ON job_parts
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_job_parts_pending_return_delete();

-- ============================================================
-- 3. request_part_return — scope to assigned tech / admin
-- ============================================================

CREATE OR REPLACE FUNCTION public.request_part_return(
  p_job_part_id UUID,
  p_reason TEXT
)
RETURNS job_parts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_part RECORD;
  v_authorized BOOLEAN;
  v_updated job_parts;
BEGIN
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'A reason is required to return a part';
  END IF;

  SELECT user_id, role INTO v_user_id, v_user_role
    FROM users WHERE auth_id = auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Caller is not authenticated';
  END IF;

  SELECT * INTO v_part FROM job_parts WHERE job_part_id = p_job_part_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Part not found: %', p_job_part_id;
  END IF;

  -- Defensive: a row created with bad data can't be returned.
  IF COALESCE(v_part.quantity, 0) <= 0 THEN
    RAISE EXCEPTION 'Cannot return a part with non-positive quantity (qty=%)', v_part.quantity;
  END IF;

  IF v_part.return_status IS NOT NULL THEN
    RAISE EXCEPTION 'Part is already in return status: %', v_part.return_status;
  END IF;

  -- Scoping: the caller must be (a) the assigned technician, (b) an active
  -- helper on the job, or (c) an admin / supervisor. Otherwise reject — a
  -- random tech browsing job_parts cannot strip parts off other jobs.
  v_authorized := v_user_role IN (
    'admin', 'admin_service', 'admin_store',
    'Admin 1', 'Admin 2', 'Admin 1 (Service)', 'Admin 2 (Store)',
    'supervisor'
  ) OR EXISTS (
    SELECT 1 FROM jobs j
     WHERE j.job_id = v_part.job_id
       AND (j.assigned_technician_id = v_user_id OR j.helper_technician_id = v_user_id)
  ) OR EXISTS (
    SELECT 1 FROM job_assignments ja
     WHERE ja.job_id = v_part.job_id
       AND ja.technician_id = v_user_id
       AND ja.is_active = true
  );

  IF NOT v_authorized THEN
    RAISE EXCEPTION 'Not authorized to request a return on this job (caller=% role=%)',
      v_user_id, COALESCE(v_user_role, 'unknown');
  END IF;

  UPDATE job_parts
     SET return_status        = 'pending_return',
         return_reason        = trim(p_reason),
         return_requested_by  = v_user_id,
         return_requested_at  = now()
   WHERE job_part_id = p_job_part_id
   RETURNING * INTO v_updated;

  RETURN v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_part_return(UUID, TEXT) TO authenticated;

-- ============================================================
-- 4. cancel_part_return — restrict to requester / assigned tech / admin
-- ============================================================

CREATE OR REPLACE FUNCTION public.cancel_part_return(
  p_job_part_id UUID
)
RETURNS job_parts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_role TEXT;
  v_part RECORD;
  v_authorized BOOLEAN;
  v_updated job_parts;
BEGIN
  SELECT user_id, role INTO v_user_id, v_user_role
    FROM users WHERE auth_id = auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Caller is not authenticated';
  END IF;

  SELECT * INTO v_part FROM job_parts WHERE job_part_id = p_job_part_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Part not found: %', p_job_part_id;
  END IF;

  IF v_part.return_status IS DISTINCT FROM 'pending_return' THEN
    RAISE EXCEPTION 'Cannot cancel: part is not in pending return state (current=%)',
      COALESCE(v_part.return_status, 'none');
  END IF;

  -- Authorize: the original requester, the assigned technician on the job,
  -- or an admin/supervisor. Other authenticated users cannot un-do someone
  -- else's pending return.
  v_authorized := v_user_role IN (
    'admin', 'admin_service', 'admin_store',
    'Admin 1', 'Admin 2', 'Admin 1 (Service)', 'Admin 2 (Store)',
    'supervisor'
  ) OR v_part.return_requested_by = v_user_id
    OR EXISTS (
    SELECT 1 FROM jobs j
     WHERE j.job_id = v_part.job_id
       AND (j.assigned_technician_id = v_user_id OR j.helper_technician_id = v_user_id)
  );

  IF NOT v_authorized THEN
    RAISE EXCEPTION 'Not authorized to cancel this return (caller=% role=%)',
      v_user_id, COALESCE(v_user_role, 'unknown');
  END IF;

  UPDATE job_parts
     SET return_status        = NULL,
         return_reason        = NULL,
         return_requested_by  = NULL,
         return_requested_at  = NULL
   WHERE job_part_id = p_job_part_id
   RETURNING * INTO v_updated;

  RETURN v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_part_return(UUID) TO authenticated;

-- ============================================================
-- 5. confirm_part_return — quantity guard + safer integer cast
-- ============================================================

CREATE OR REPLACE FUNCTION public.confirm_part_return(
  p_job_part_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS job_parts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role TEXT;
  v_user_id UUID;
  v_user_name TEXT;
  v_part RECORD;
  v_master RECORD;
  v_qty NUMERIC;
  v_qty_int INTEGER;
  v_new_store_qty INTEGER;
  v_new_container_qty INTEGER;
  v_updated job_parts;
BEGIN
  SELECT u.role, u.user_id, COALESCE(u.full_name, u.name)
    INTO v_caller_role, v_user_id, v_user_name
    FROM users u WHERE u.auth_id = auth.uid();

  IF v_caller_role IS NULL OR v_caller_role NOT IN (
       'admin', 'admin_service', 'admin_store',
       'Admin 1', 'Admin 2', 'Admin 1 (Service)', 'Admin 2 (Store)',
       'supervisor'
     ) THEN
    RAISE EXCEPTION 'Only admins or supervisors can confirm a part return (role=%)',
      COALESCE(v_caller_role, 'unknown');
  END IF;

  SELECT * INTO v_part FROM job_parts WHERE job_part_id = p_job_part_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Part not found: %', p_job_part_id;
  END IF;

  IF v_part.return_status IS DISTINCT FROM 'pending_return' THEN
    RAISE EXCEPTION 'Cannot confirm: part is not in pending return state (current=%)',
      COALESCE(v_part.return_status, 'none');
  END IF;

  v_qty := v_part.quantity;
  IF v_qty IS NULL OR v_qty <= 0 THEN
    RAISE EXCEPTION 'Cannot confirm a return for non-positive quantity (qty=%)', v_qty;
  END IF;

  -- Use ROUND for the integer projection so 4.7 liquid containers credit 5,
  -- not 4 (truncation in the original code under-credited fractional returns).
  v_qty_int := ROUND(v_qty)::INTEGER;
  IF v_qty_int <= 0 THEN
    -- Sub-unit return (e.g. 0.3L) — refuse rather than write a 0-value
    -- audit row that confuses the inventory ledger.
    RAISE EXCEPTION 'Return quantity rounds to 0 unit (qty=%); record this credit manually via inventory adjustment instead', v_qty;
  END IF;

  IF v_part.part_id IS NOT NULL THEN
    SELECT part_id, part_name, stock_quantity, container_quantity,
           bulk_quantity, is_liquid
      INTO v_master FROM parts WHERE part_id = v_part.part_id FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Master part record missing for part_id=%', v_part.part_id;
    END IF;

    IF COALESCE(v_master.is_liquid, false) THEN
      v_new_container_qty := COALESCE(v_master.container_quantity, 0) + v_qty_int;
      UPDATE parts
         SET container_quantity = v_new_container_qty,
             updated_at = now()
       WHERE part_id = v_master.part_id;
      v_new_store_qty := COALESCE(v_master.stock_quantity, 0);
    ELSE
      v_new_store_qty := COALESCE(v_master.stock_quantity, 0) + v_qty_int;
      UPDATE parts
         SET stock_quantity = v_new_store_qty,
             updated_at = now()
       WHERE part_id = v_master.part_id;
      v_new_container_qty := COALESCE(v_master.container_quantity, 0);
    END IF;

    INSERT INTO inventory_movements (
      part_id, movement_type,
      container_qty_change, bulk_qty_change,
      job_id, performed_by, performed_by_name, notes,
      store_container_qty_after, store_bulk_qty_after
    ) VALUES (
      v_master.part_id, 'tech_return',
      v_qty_int, 0,
      v_part.job_id, v_user_id, v_user_name,
      format(
        'Tech return confirmed: %s of "%s" — reason: %s',
        v_qty, v_master.part_name,
        COALESCE(NULLIF(trim(v_part.return_reason), ''), 'unspecified')
      ),
      CASE WHEN COALESCE(v_master.is_liquid, false)
           THEN v_new_container_qty
           ELSE v_new_store_qty
      END,
      COALESCE(v_master.bulk_quantity, 0)
    );
  END IF;

  UPDATE job_parts
     SET return_status        = 'returned',
         return_confirmed_by  = v_user_id,
         return_confirmed_at  = now(),
         return_notes         = NULLIF(trim(COALESCE(p_notes, '')), '')
   WHERE job_part_id = p_job_part_id
   RETURNING * INTO v_updated;

  RETURN v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_part_return(UUID, TEXT) TO authenticated;

-- ============================================================
-- 6. Sanity asserts
-- ============================================================

DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'job_parts_quantity_positive_check'
  ), 'job_parts_quantity_positive_check missing';

  ASSERT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgname = 'trg_guard_job_parts_pending_return_delete'
  ), 'guard_job_parts_pending_return_delete trigger missing';

  ASSERT EXISTS (
    SELECT 1 FROM pg_proc
     WHERE proname = 'request_part_return'
       AND pg_get_functiondef(oid) ILIKE '%v_authorized%'
  ), 'request_part_return scoping not applied';

  ASSERT EXISTS (
    SELECT 1 FROM pg_proc
     WHERE proname = 'cancel_part_return'
       AND pg_get_functiondef(oid) ILIKE '%v_authorized%'
  ), 'cancel_part_return scoping not applied';

  ASSERT EXISTS (
    SELECT 1 FROM pg_proc
     WHERE proname = 'confirm_part_return'
       AND pg_get_functiondef(oid) ILIKE '%v_qty_int%'
  ), 'confirm_part_return quantity guard not applied';
END $$;

COMMIT;
