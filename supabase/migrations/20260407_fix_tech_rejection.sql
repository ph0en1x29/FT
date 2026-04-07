-- Fix: technician job rejection blocked by validate_job_status_transition trigger
--
-- Problem
-- -------
-- rejectJobAssignment() sets jobs.status from 'Assigned' (idx 1) to 'New' (idx 0).
-- The trigger validate_job_status_transition rejects ALL backward transitions for
-- non-admin/non-supervisor users with the error:
--   "Only admin or supervisor can move jobs backward. User role: technician"
--
-- This blocks the legitimate technician-rejection workflow that the application is
-- explicitly designed to support (technician_rejected_at, technician_rejection_reason).
--
-- Fix
-- ---
-- CREATE OR REPLACE the function with one additional whitelist branch that allows
-- a technician to move THEIR OWN currently-assigned job from 'Assigned' to 'New'
-- when technician_rejected_at is being set. All other backward transitions remain
-- blocked exactly as before.
--
-- Also: add jobs.technician_rejection_photo_id (FK to job_media) so the rejection
-- photo proof captured by the technician on-site can be linked to the job for admin
-- review. The column is nullable; existing rejections (and any rejection done before
-- the photo requirement is enforced in the UI) remain valid.

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS technician_rejection_photo_id UUID
    REFERENCES public.job_media(media_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.jobs.technician_rejection_photo_id IS
  'On-site photo proof captured when a technician rejects a job assignment. References job_media.media_id.';

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
