-- Migration: Field Technical Services job type + auto_populated parts + completion validation
-- Date: 2026-04-16
--
-- 1. Add 'Field Technical Services' to job_type constraint (new jobs only — existing
--    Minor Service / Courier jobs remain untouched)
-- 2. Add auto_populated boolean to job_parts (marks parts auto-added from approval)
-- 3. Exempt 'Field Technical Services' from checklist + hourmeter in completion trigger
-- 4. Block completion when approved spare part requests exist but Used Parts is empty

BEGIN;

-- ============================================
-- 1. Update job_type CHECK constraint
-- ============================================
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_job_type_check;

ALTER TABLE jobs
ADD CONSTRAINT jobs_job_type_check
CHECK (job_type IN (
  'Service', 'Full Service', 'Minor Service', 'Repair',
  'Checking', 'Slot-In', 'Courier', 'Field Technical Services'
));

-- ============================================
-- 2. Add auto_populated flag to job_parts
-- ============================================
ALTER TABLE job_parts
ADD COLUMN IF NOT EXISTS auto_populated BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN job_parts.auto_populated
  IS 'True when part was auto-added from an approved spare part request. Locked — technician cannot edit/remove.';

-- ============================================
-- 3+4. Update completion validation trigger
-- ============================================
CREATE OR REPLACE FUNCTION public.validate_job_completion_requirements()
RETURNS TRIGGER AS $$
DECLARE
    service_record RECORD;
    has_parts BOOLEAN;
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

    IF COALESCE(service_record.technician_signature, NEW.technician_signature) IS NULL THEN
        RAISE EXCEPTION 'Cannot complete job: Technician signature is required.';
    END IF;
    IF COALESCE(service_record.customer_signature, NEW.customer_signature) IS NULL THEN
        RAISE EXCEPTION 'Cannot complete job: Customer signature is required.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Sanity check
DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'job_parts' AND column_name = 'auto_populated'
  ), 'auto_populated column missing from job_parts';
END $$;

COMMIT;
