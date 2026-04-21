-- 20260421_block_completion_with_spare_part_photo_conflict.sql
--
-- Problem: technicians were uploading photos tagged with category='spare_part'
-- ("Parts" in the UI picker) while ticking "No parts were used" on the job
-- and completing it — logically contradictory. Audit of the live DB on
-- 2026-04-21 showed 36 historical Completed / Awaiting Finalization jobs
-- matching this pattern plus 1 In Progress job (JOB-260406-001) at the time
-- of this migration. The pattern pollutes service history and bypasses the
-- intent of the parts-declaration gate.
--
-- Fix: extend public.validate_job_completion_requirements to refuse the
-- transition into 'Awaiting Finalization' whenever the job has any
-- job_media row with category='spare_part' AND no_parts_used is true AND
-- no rows exist in job_parts / job_inventory_usage. The tech must either
-- add the parts to the Used Parts list or re-tag the photos to a different
-- category (Condition / Evidence / Other) that doesn't imply parts usage.
--
-- Layering contract (see CLAUDE.md "Job-type validation layering"):
--   UI   — handleStatusChange in pages/JobDetail/hooks/useJobActions.ts
--          mirrors this check with a friendly toast listing the exact fix.
--   DB   — this trigger is authoritative.
--
-- Admins/supervisors bypass all completion gates at line 52 of the trigger
-- (unchanged), so this rule only applies to technician submissions.

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

    has_parts := EXISTS (SELECT 1 FROM job_parts WHERE job_id = NEW.job_id);
    IF NOT has_parts THEN
        has_parts := EXISTS (SELECT 1 FROM job_inventory_usage WHERE job_id = NEW.job_id);
    END IF;
    IF NOT has_parts AND NOT COALESCE(service_record.no_parts_used, FALSE) THEN
        RAISE EXCEPTION 'Cannot complete job: Parts must be recorded, or explicitly mark no parts used.';
    END IF;

    -- Block completion when spare part requests have been approved/issued but no
    -- parts exist in job_parts. Prevents bypassing via "no parts used" toggle.
    IF NOT has_parts AND EXISTS (
        SELECT 1 FROM job_requests
        WHERE job_id = NEW.job_id
          AND request_type = 'spare_part'
          AND status IN ('approved', 'issued')
    ) THEN
        RAISE EXCEPTION 'Cannot complete job: Parts have been approved for this job. Please ensure all used parts are added to the Used Part section before completing.';
    END IF;

    -- NEW (2026-04-21): block completion when the tech has uploaded photos
    -- tagged as "Parts" (category='spare_part') but also ticked "No parts used"
    -- with zero parts declared. Either the photos are mis-tagged or the parts
    -- weren't declared — tech must reconcile before completing.
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

-- Post-apply sanity check
DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'validate_job_completion_requirements'
  ), 'validate_job_completion_requirements function missing';
  -- Confirm the new check text is present in the function body
  ASSERT EXISTS (
    SELECT 1 FROM pg_proc
     WHERE proname = 'validate_job_completion_requirements'
       AND pg_get_functiondef(oid) ILIKE '%uploaded photos tagged as "Parts"%'
  ), 'new spare_part photo conflict check not found in trigger body';
END $$;

COMMIT;
