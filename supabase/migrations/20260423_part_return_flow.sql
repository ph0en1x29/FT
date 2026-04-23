-- 20260423_part_return_flow.sql
--
-- Tech-initiated part-return flow.
--
-- Background: when an admin approves a spare-part request, the part is
-- auto-populated into job_parts and the existing completion gate (introduced
-- in 20260416_field_technical_services_and_parts_validation.sql) refuses to
-- complete the job until the part appears in Used Parts. This breaks down
-- when the technician finds the approved part is the wrong model / damaged
-- on-site: they can't legitimately use it AND can't legitimately complete
-- the job. Client report 2026-04-22 ("FAIL LIAO").
--
-- New flow:
--   1. Tech taps "Return" on a Used Parts row, picks a reason (wrong model,
--      damaged, not compatible, other), submits  -> request_part_return RPC
--      sets return_status='pending_return'.
--   2. Tech can cancel a pending return before admin confirms it
--      -> cancel_part_return RPC reverts to NULL.
--   3. Admin sees the pending return in their queue (separate UI work),
--      receives the physical part, clicks Confirm -> confirm_part_return RPC
--      atomically: increments parts.stock_quantity (or container_quantity for
--      liquids), inserts an inventory_movements row with the new
--      'tech_return' movement_type, sets return_status='returned' and
--      records the confirming admin + timestamp.
--
-- The completion-gate trigger (next migration in this PR,
-- 20260423_completion_gate_skip_returns.sql) excludes pending_return /
-- returned rows so the job can complete once the tech has flagged the bad
-- part for return. Invoice/total computations in the JS layer also exclude
-- these rows so the customer isn't charged for parts that went back.
--
-- Layering contract (see CLAUDE.md "Job-type validation layering"):
--   UI    — Return button + Pending Return pill on the Used Parts row;
--           tech-side cancel; admin-side Confirm Return action.
--   Service - jobReturnService wraps the RPCs (no per-job-type branching).
--   DB    - this migration is authoritative for the workflow + audit.
--
-- The new enum value is committed in its own statement before the BEGIN
-- block so confirm_part_return can reference 'tech_return' safely. Postgres
-- forbids using a freshly-added enum value in the same transaction it was
-- added in.

ALTER TYPE inventory_movement_type ADD VALUE IF NOT EXISTS 'tech_return';

BEGIN;

-- ============================================================
-- 1. Schema: return-flow columns on job_parts
-- ============================================================

ALTER TABLE job_parts
  ADD COLUMN IF NOT EXISTS return_status TEXT,
  ADD COLUMN IF NOT EXISTS return_reason TEXT,
  ADD COLUMN IF NOT EXISTS return_requested_by UUID REFERENCES users(user_id),
  ADD COLUMN IF NOT EXISTS return_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS return_confirmed_by UUID REFERENCES users(user_id),
  ADD COLUMN IF NOT EXISTS return_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS return_notes TEXT;

ALTER TABLE job_parts DROP CONSTRAINT IF EXISTS job_parts_return_status_check;
ALTER TABLE job_parts
  ADD CONSTRAINT job_parts_return_status_check
  CHECK (return_status IS NULL OR return_status IN ('pending_return', 'returned'));

COMMENT ON COLUMN job_parts.return_status IS
  'NULL = part is in normal use. ''pending_return'' = tech initiated a return, awaiting admin confirm. ''returned'' = admin confirmed physical receipt and stock has been incremented back.';

COMMENT ON COLUMN job_parts.return_reason IS
  'Free-text or one of the standard reasons (wrong_model, damaged, not_compatible, other). Required when transitioning into pending_return.';

CREATE INDEX IF NOT EXISTS idx_job_parts_return_status
  ON job_parts (return_status)
  WHERE return_status IS NOT NULL;

-- ============================================================
-- 2. RPC: tech initiates a return
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
  v_part RECORD;
  v_updated job_parts;
BEGIN
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'A reason is required to return a part';
  END IF;

  SELECT user_id INTO v_user_id FROM users WHERE auth_id = auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Caller is not authenticated';
  END IF;

  SELECT * INTO v_part FROM job_parts WHERE job_part_id = p_job_part_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Part not found: %', p_job_part_id;
  END IF;

  IF v_part.return_status IS NOT NULL THEN
    RAISE EXCEPTION 'Part is already in return status: %', v_part.return_status;
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

COMMENT ON FUNCTION public.request_part_return IS
  'Technician marks a job_part as pending return (wrong model, damaged, etc.). Reason is mandatory. Caller must own the row at the application layer (RLS/UI) — this function does not enforce job ownership beyond the existing job_parts RLS policy. Idempotent only when called once: subsequent calls on a row already in return_status raise.';

-- ============================================================
-- 3. RPC: tech cancels a pending return (pre-admin-confirm)
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
  v_part RECORD;
  v_updated job_parts;
BEGIN
  SELECT * INTO v_part FROM job_parts WHERE job_part_id = p_job_part_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Part not found: %', p_job_part_id;
  END IF;

  IF v_part.return_status IS DISTINCT FROM 'pending_return' THEN
    RAISE EXCEPTION 'Cannot cancel: part is not in pending return state (current=%)',
      COALESCE(v_part.return_status, 'none');
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

COMMENT ON FUNCTION public.cancel_part_return IS
  'Technician undoes a pending return (e.g. realized the part does fit after all). Only valid while return_status=pending_return; refuses if admin has already confirmed (returned) or no return was pending.';

-- ============================================================
-- 4. RPC: admin confirms physical receipt -> restock + audit
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

  -- Restock + audit only when there's a master parts row to credit. If
  -- part_id is NULL (free-text part name with no master link, rare but
  -- possible historically) the return still succeeds and is logged via the
  -- job_parts.return_* columns, but no inventory_movements row is written
  -- because there is nothing to restock.
  IF v_part.part_id IS NOT NULL THEN
    SELECT part_id, part_name, stock_quantity, container_quantity,
           bulk_quantity, is_liquid
      INTO v_master FROM parts WHERE part_id = v_part.part_id FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Master part record missing for part_id=%', v_part.part_id;
    END IF;

    -- Mirror the deduction logic from jobInvoiceService.ts: liquids credit
    -- container_quantity (sealed containers go back to stock); non-liquids
    -- credit stock_quantity. Bulk-quantity returns (open chemical drums)
    -- aren't currently supported by the deduction path either, so we skip
    -- them here too — bulk return is the existing van->store flow.
    IF COALESCE(v_master.is_liquid, false) THEN
      v_new_container_qty := COALESCE(v_master.container_quantity, 0) + v_qty::INTEGER;
      UPDATE parts
         SET container_quantity = v_new_container_qty,
             updated_at = now()
       WHERE part_id = v_master.part_id;
      v_new_store_qty := COALESCE(v_master.stock_quantity, 0);
    ELSE
      v_new_store_qty := COALESCE(v_master.stock_quantity, 0) + v_qty::INTEGER;
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
      v_qty::INTEGER, 0,
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

COMMENT ON FUNCTION public.confirm_part_return IS
  'Admin confirms physical receipt of a pending-return part. Atomically: locks the master parts row, increments stock_quantity (non-liquid) or container_quantity (liquid), inserts an inventory_movements row with movement_type=tech_return, and marks job_parts.return_status=returned with the confirming admin + timestamp. Refuses unless the row is currently in pending_return state. Role-gated to admin / supervisor / store-admin variants.';

-- ============================================================
-- 5. Sanity checks
-- ============================================================

DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'job_parts' AND column_name = 'return_status'
  ), 'return_status column missing from job_parts';

  ASSERT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
     WHERE t.typname = 'inventory_movement_type' AND e.enumlabel = 'tech_return'
  ), 'tech_return value missing from inventory_movement_type';

  ASSERT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'request_part_return'
  ), 'request_part_return function missing';

  ASSERT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'cancel_part_return'
  ), 'cancel_part_return function missing';

  ASSERT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'confirm_part_return'
  ), 'confirm_part_return function missing';
END $$;

COMMIT;
