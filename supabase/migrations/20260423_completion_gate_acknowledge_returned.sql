-- 20260423_completion_gate_acknowledge_returned.sql
--
-- Fix to 20260423_completion_gate_skip_returns.sql earlier today.
--
-- The "approved spare-part request was approved but no Used Part row exists"
-- check was using the same has_parts variable that filters out
-- pending_return / returned rows. That means a job whose ONLY approved part
-- was returned (the exact scenario the return flow exists to handle) still
-- got blocked by the trigger, even though the technician had acknowledged
-- the approval by pressing Return on the auto-populated row.
--
-- The UI check in useJobActions.ts:handleStatusChange already allows the
-- "tick no_parts_used + every approved part is returning" path. This
-- migration aligns the DB trigger with that UI contract by gating the
-- approved-spare-part check on whether ANY job_parts row exists for the
-- job (regardless of return_status). Auto-populate happens at admin
-- approval, so the row is always present unless an admin manually deleted
-- it; flagging the row for return doesn't make it disappear.
--
-- has_parts (filters out returned) is still the right predicate for the
-- "no parts declared at all" check — a job with only returned parts must
-- still tick no_parts_used or add another part.

BEGIN;

CREATE OR REPLACE FUNCTION public.validate_job_completion_requirements()
RETURNS TRIGGER AS $$
DECLARE
    service_record RECORD;
    has_parts BOOLEAN;             -- excludes pending_return / returned
    has_any_parts_row BOOLEAN;     -- includes returned (acknowledgment)
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

    -- Approved spare-part request was acknowledged when ANY job_parts row
    -- exists for this job — even a returned row counts because the tech
    -- pressed Return on it (which is a deliberate acknowledgment of the
    -- approval). Only fire when the row is genuinely missing (admin deleted
    -- it, or auto-populate failed).
    has_any_parts_row := EXISTS (SELECT 1 FROM job_parts WHERE job_id = NEW.job_id);
    IF NOT has_any_parts_row AND EXISTS (
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
       AND pg_get_functiondef(oid) ILIKE '%has_any_parts_row%'
  ), 'updated trigger body does not mention has_any_parts_row';
END $$;

COMMIT;
