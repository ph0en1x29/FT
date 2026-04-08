-- Fix: repair jobs cannot be completed because validate_job_completion_requirements
-- enforces a condition checklist that is only meaningful for Service / Full Service /
-- Checking jobs. The frontend already exempts Repair (useJobActions.ts) and
-- getMissingMandatoryItems() returns [] for Repair, but the DB trigger does not, so
-- the technician's status update reaches the DB and is rejected with:
--   "Cannot complete job: Checklist has not been filled."
--
-- Fix: skip ONLY the checklist branch when job_type = 'Repair'. Every other
-- completion gate (started_at, service notes / job_carried_out, parts or
-- no_parts_used, technician signature, customer signature) is left intact.

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

    -- Repair jobs are exempt from the condition checklist requirement.
    -- The forklift condition checklist is only meaningful for inspection-type jobs
    -- (Service / Full Service / Checking). The frontend already enforces this
    -- exemption; this brings the DB trigger into agreement.
    IF NEW.job_type IS DISTINCT FROM 'Repair' THEN
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

    IF COALESCE(service_record.technician_signature, NEW.technician_signature) IS NULL THEN
        RAISE EXCEPTION 'Cannot complete job: Technician signature is required.';
    END IF;
    IF COALESCE(service_record.customer_signature, NEW.customer_signature) IS NULL THEN
        RAISE EXCEPTION 'Cannot complete job: Customer signature is required.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
