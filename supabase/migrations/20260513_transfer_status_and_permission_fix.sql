-- 20260513_transfer_status_and_permission_fix.sql
--
-- Problem
-- -------
-- transferJobToTechnician() sets the parent job's status to
-- 'Incomplete - Reassigned'. Two DB-level gaps cause this to fail for
-- admin_service users, leaving an orphan clone in the database:
--
--   1. jobs_status_check CHECK constraint does not include
--      'Incomplete - Reassigned' (nor several other statuses the app uses).
--   2. get_status_order() returns -1 for unknown statuses, so the trigger
--      misclassifies the transition as backward.
--   3. validate_job_status_transition backward whitelist only allows
--      admin/supervisor — admin_service (service coordinators) are blocked.
--
-- Additionally, five statuses defined in the TypeScript JobStatus enum are
-- absent from both the CHECK constraint and get_status_order():
--   - Incomplete - Reassigned
--   - Pending Parts
--   - Completed Awaiting Acknowledgement
--   - Disputed
--   - Cancelled
-- This migration registers ALL of them to prevent the same class of bug
-- from recurring.
--
-- Fix
-- ---
-- 1. Widen jobs_status_check to include every valid status.
-- 2. Register all statuses in get_status_order() with appropriate indices.
-- 3. Add a scoped transfer guard in validate_job_status_transition that
--    allows admin/supervisor/admin_service to set 'Incomplete - Reassigned'
--    (follows the existing technician-rejection whitelist pattern).

BEGIN;

-- ══════════════════════════════════════════════════════════════════════
-- 1. Widen the CHECK constraint to include ALL valid statuses
-- ══════════════════════════════════════════════════════════════════════
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_status_check
  CHECK (status = ANY (ARRAY[
    'New'::text,
    'Assigned'::text,
    'In Progress'::text,
    'Incomplete - Continuing'::text,
    'Incomplete - Reassigned'::text,
    'Pending Parts'::text,
    'Awaiting Finalization'::text,
    'Completed'::text,
    'Completed Awaiting Acknowledgement'::text,
    'Disputed'::text,
    'Cancelled'::text
  ]));

-- ══════════════════════════════════════════════════════════════════════
-- 2. Register ALL statuses in get_status_order()
--
--    Index design:
--      Cancelled       → -1  (going TO it = backward = admin-only)
--      New             →  0
--      Assigned        →  1
--      In Progress     →  2  (lateral peers below)
--      Incomplete - Continuing  →  2
--      Incomplete - Reassigned  →  2
--      Pending Parts            →  2
--      Awaiting Finalization    →  3
--      Completed                →  4
--      Completed Awaiting Ack   →  4
--      Disputed                 →  5
--
--    ELSE returns -99 (defensive — any future unregistered status will
--    be classified as deep-backward, requiring admin to proceed).
-- ══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION get_status_order(status_val TEXT)
RETURNS INTEGER AS $$
BEGIN
    RETURN CASE status_val
        WHEN 'Cancelled'                          THEN -1
        WHEN 'New'                                THEN 0
        WHEN 'Assigned'                           THEN 1
        WHEN 'In Progress'                        THEN 2
        WHEN 'Incomplete - Continuing'            THEN 2
        WHEN 'Incomplete - Reassigned'            THEN 2
        WHEN 'Pending Parts'                      THEN 2
        WHEN 'Awaiting Finalization'              THEN 3
        WHEN 'Completed'                          THEN 4
        WHEN 'Completed Awaiting Acknowledgement' THEN 4
        WHEN 'Disputed'                           THEN 5
        ELSE -99
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ══════════════════════════════════════════════════════════════════════
-- 3. Update validate_job_status_transition with transfer guard
--
--    The guard is placed BEFORE the forward/backward index checks so it
--    RETURN NEW early — identical pattern to the existing technician-
--    rejection whitelist (Assigned → New when rejection metadata is set).
--
--    Scoped to: NEW.status = 'Incomplete - Reassigned' AND the transfer
--    metadata (reassigned_by_id) is being set. Only admin, supervisor,
--    and admin_service are allowed.
-- ══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.validate_job_status_transition()
RETURNS TRIGGER AS $$
DECLARE
    user_role TEXT;
    current_idx INTEGER;
    new_idx INTEGER;
BEGIN
    -- Get current user's role
    SELECT role INTO user_role FROM users WHERE user_id = auth.uid();

    -- Skip validation for system/service role operations
    IF user_role IS NULL THEN
        BEGIN
            IF current_setting('request.jwt.claims', true)::json->>'role' = 'service_role' THEN
                RETURN NEW;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END IF;

    -- If status hasn't changed, allow
    IF OLD.status = NEW.status OR (TG_OP = 'INSERT') THEN
        RETURN NEW;
    END IF;

    -- ── Transfer guard (scoped): admin roles can set Incomplete - Reassigned
    --    when reassignment metadata is present. Early-return before the
    --    forward/backward index logic so it cannot be blocked by generic checks.
    IF NEW.status = 'Incomplete - Reassigned' AND OLD.status != 'Incomplete - Reassigned' THEN
        IF user_role NOT IN ('admin', 'supervisor', 'admin_service') THEN
            RAISE EXCEPTION 'Only admin, supervisor, or service coordinator can transfer jobs. User role: %', user_role;
        END IF;
        RETURN NEW;
    END IF;

    -- Status order: New(0) → Assigned(1) → In Progress(2) → Awaiting Finalization(3) → Completed(4)
    current_idx := get_status_order(OLD.status);
    new_idx := get_status_order(NEW.status);

    -- Forward transitions
    IF new_idx > current_idx THEN
        IF new_idx - current_idx > 1 AND user_role != 'admin' THEN
            RAISE EXCEPTION 'Cannot skip status steps. Move from "%" to "%" is not allowed.', OLD.status, NEW.status;
        END IF;

        IF user_role = 'technician' THEN
            IF NOT (
                (OLD.status = 'Assigned' AND NEW.status = 'In Progress') OR
                (OLD.status = 'In Progress' AND NEW.status = 'Awaiting Finalization')
            ) THEN
                RAISE EXCEPTION 'Technician can only move jobs from Assigned to In Progress, or In Progress to Awaiting Finalization';
            END IF;
        END IF;

        IF user_role = 'accountant' THEN
            IF NOT (OLD.status = 'Awaiting Finalization' AND NEW.status = 'Completed') THEN
                RAISE EXCEPTION 'Accountant can only move jobs from Awaiting Finalization to Completed';
            END IF;
        END IF;

        RETURN NEW;
    END IF;

    -- Backward transitions: only admin/supervisor allowed, with one tightly-scoped exception:
    -- a technician rejecting their own currently-assigned job (Assigned -> New). The rejection
    -- workflow sets technician_rejected_at and clears assigned_technician_id, so we identify it
    -- by those NEW values plus the OLD assignment matching the caller.
    IF new_idx < current_idx THEN
        IF user_role = 'technician'
           AND OLD.status = 'Assigned'
           AND NEW.status = 'New'
           AND OLD.assigned_technician_id = auth.uid()
           AND NEW.technician_rejected_at IS NOT NULL
           AND NEW.assigned_technician_id IS NULL THEN
            RETURN NEW;
        END IF;

        IF user_role NOT IN ('admin', 'supervisor') THEN
            RAISE EXCEPTION 'Only admin or supervisor can move jobs backward. User role: %', user_role;
        END IF;

        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ══════════════════════════════════════════════════════════════════════
-- Post-apply sanity checks
-- ══════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  -- New statuses registered correctly
  IF get_status_order('Incomplete - Reassigned') != 2 THEN
    RAISE EXCEPTION 'FAIL: Incomplete - Reassigned should be 2, got %', get_status_order('Incomplete - Reassigned');
  END IF;
  IF get_status_order('Pending Parts') != 2 THEN
    RAISE EXCEPTION 'FAIL: Pending Parts should be 2, got %', get_status_order('Pending Parts');
  END IF;
  IF get_status_order('Completed Awaiting Acknowledgement') != 4 THEN
    RAISE EXCEPTION 'FAIL: Completed Awaiting Acknowledgement should be 4';
  END IF;
  IF get_status_order('Disputed') != 5 THEN
    RAISE EXCEPTION 'FAIL: Disputed should be 5';
  END IF;
  IF get_status_order('Cancelled') != -1 THEN
    RAISE EXCEPTION 'FAIL: Cancelled should be -1';
  END IF;
  -- Existing statuses unchanged
  IF get_status_order('In Progress') != 2 THEN
    RAISE EXCEPTION 'REGRESSION: In Progress should still be 2';
  END IF;
  IF get_status_order('Incomplete - Continuing') != 2 THEN
    RAISE EXCEPTION 'REGRESSION: Incomplete - Continuing should still be 2';
  END IF;
  -- Unknown status returns -99
  IF get_status_order('BOGUS_STATUS') != -99 THEN
    RAISE EXCEPTION 'FAIL: Unknown status should return -99';
  END IF;
END $$;

COMMIT;
