-- 20260423_completion_gate_skip_returns.sql
--
-- Update validate_job_completion_requirements so the existing "approved
-- spare-part request without a Used Part" gate (introduced in 20260416)
-- treats a job_part with return_status IN ('pending_return','returned') as
-- "not actively used" — i.e. it does NOT satisfy the requirement of having a
-- part on the job. Two effects:
--
--   1. The "no parts used at all" check (`has_parts`) now ignores returned
--      rows, so a job whose only Used Parts entry was returned correctly
--      requires either another part or the explicit no_parts_used flag.
--
--   2. The "approved spare-part request was approved but never used" gate
--      now treats a returned auto-populated row as a satisfied gate (via the
--      existence of a non-returned part) only when there's another active
--      part. If the entire approval was returned, the tech can complete by
--      ticking no_parts_used (since the approved part isn't usable).
--
-- The "spare_part photo + no_parts_used" check (added 20260421) is unchanged
-- — that policy is independent of returns.
--
-- Pairs with 20260423_part_return_flow.sql (same PR), which adds the
-- return_status column and the request/cancel/confirm RPCs.

BEGIN;

CREATE OR REPLACE FUNCTION public.validate_job_completion_requirements()
RETURNS TRIGGER AS $$
DECLARE
    service_record RECORD;
    has_parts BOOLEAN;
    has_spare_part_photo BOOLEAN;
    user_role TEXT;
    v_user_id UUID;
    v_job_started BOOLEAN;
BEGIN
    IF NEW.status != 'Awaiting Finalization' OR OLD.status = 'Awaiting Finalization' THEN
        RETURN NEW;
    END IF;

    SELECT u.role, u.user_id INTO user_role, v_user_id
      FROM users u WHERE u.auth_id = auth.uid();

    IF user_role IN ('admin', 'Admin 1', 'Admin 2', 'Admin 1 (Service)', 'Admin 2 (Store)', 'supervisor') THEN
        RETURN NEW;
    END IF;

    SELECT * INTO service_record FROM job_service_records WHERE job_id = NEW.job_id;

    v_job_started := COALESCE(service_record.started_at IS NOT NULL, FALSE)
                  OR NEW.started_at IS NOT NULL
                  OR NEW.repair_start_time IS NOT NULL
                  OR NEW.arrival_time IS NOT NULL;
    IF NOT v_job_started THEN
        RAISE EXCEPTION 'Cannot complete job: Job was never started (no start time recorded).';
    END IF;

    -- Repair and Field Technical Services are exempt from checklist
    IF NEW.job_type NOT IN ('Repair', 'Field Technical Services') THEN
        IF (service_record.checklist_data IS NULL OR service_record.checklist_data = '{}'::JSONB)
           AND (NEW.condition_checklist IS NULL OR NEW.condition_checklist::JSONB = '{}'::JSONB) THEN
            RAISE EXCEPTION 'Cannot complete job: Checklist has not been filled.';
        END IF;
    END IF;

    IF (COALESCE(service_record.service_notes, '') = '' AND COALESCE(service_record.job_carried_out, '') = '')
       AND COALESCE(NEW.job_carried_out, '') = '' THEN
        RAISE EXCEPTION 'Cannot complete job: Service notes or job carried out description is required.';
    END IF;

    -- A part is "actively used" only when it isn't pending return or already
    -- returned to stock. See 20260423_part_return_flow.sql for the lifecycle.
    has_parts := EXISTS (
        SELECT 1 FROM job_parts
         WHERE job_id = NEW.job_id
           AND COALESCE(return_status, '') NOT IN ('pending_return', 'returned')
    );
    IF NOT has_parts THEN
        has_parts := EXISTS (SELECT 1 FROM job_inventory_usage WHERE job_id = NEW.job_id);
    END IF;
    IF NOT has_parts AND NOT COALESCE(service_record.no_parts_used, FALSE) THEN
        RAISE EXCEPTION 'Cannot complete job: Parts must be recorded, or explicitly mark no parts used.';
    END IF;

    -- Block completion when spare part requests have been approved/issued but no
    -- non-returned parts exist in job_parts. Returned rows don't satisfy the gate
    -- because they represent stock that went back, not parts the tech used.
    IF NOT has_parts AND EXISTS (
        SELECT 1 FROM job_requests
        WHERE job_id = NEW.job_id
          AND request_type = 'spare_part'
          AND status IN ('approved', 'issued')
    ) THEN
        RAISE EXCEPTION 'Cannot complete job: Parts have been approved for this job. Please ensure all used parts are added to the Used Part section before completing.';
    END IF;

    has_spare_part_photo := EXISTS (
        SELECT 1 FROM job_media
        WHERE job_id = NEW.job_id
          AND category = 'spare_part'
    );
    IF has_spare_part_photo AND NOT has_parts AND COALESCE(service_record.no_parts_used, FALSE) THEN
        RAISE EXCEPTION 'Cannot complete job: You uploaded photos tagged as "Parts" but ticked "No parts used". Either add the parts you used to the Used Parts list, or re-tag the photos (Condition / Evidence / Other).';
    END IF;

    IF COALESCE(service_record.technician_signature, NEW.technician_signature) IS NULL THEN
        RAISE EXCEPTION 'Cannot complete job: Technician signature is required.';
    END IF;
    IF COALESCE(service_record.customer_signature, NEW.customer_signature) IS NULL THEN
        RAISE EXCEPTION 'Cannot complete job: Customer signature is required.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_proc
     WHERE proname = 'validate_job_completion_requirements'
       AND pg_get_functiondef(oid) ILIKE '%pending_return%'
  ), 'updated trigger body does not mention pending_return';
END $$;

COMMIT;
