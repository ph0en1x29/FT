-- =============================================
-- Fix Customer Feedback Bugs
-- Created: 2026-02-02
-- 
-- Bug 1: "invalid input syntax for type boolean: 'ok'"
--   - validate_job_checklist() tried to cast 'ok' to boolean
--   - Checklist now uses 'ok'/'not_ok' strings
--
-- Bug 2: "Cannot complete job: Job was never started (started_at is null)"
--   - validate_job_completion_requirements() checks job_service_records.started_at
--   - But updateJobStatus() only sets jobs.started_at, not service record
-- =============================================

-- =============================================
-- FIX 1: validate_job_checklist - handle string states
-- =============================================
CREATE OR REPLACE FUNCTION validate_job_checklist()
RETURNS TRIGGER AS $$
DECLARE
  v_checklist_enforcement BOOLEAN;
  v_missing_items TEXT[];
  v_checklist JSONB;
  v_mandatory_items TEXT[] := ARRAY[
    'safety_horn', 'safety_lights', 'safety_beacon', 'safety_seatbelt',
    'safety_overhead_guard', 'safety_fire_extinguisher',
    'drive_service_brake', 'drive_parking_brake',
    'steering_wheel', 'steering_cylinder'
  ];
  v_item TEXT;
  v_item_value TEXT;
BEGIN
  -- Check if enforcement is enabled
  SELECT COALESCE(value::BOOLEAN, TRUE) INTO v_checklist_enforcement
  FROM app_settings
  WHERE key = 'checklist_enforcement_enabled';

  -- If no setting found or disabled, skip validation
  IF v_checklist_enforcement IS NULL OR NOT v_checklist_enforcement THEN
    RETURN NEW;
  END IF;

  -- Only validate when transitioning to Awaiting Finalization or Completed
  IF NEW.status NOT IN ('Awaiting Finalization', 'Completed') THEN
    RETURN NEW;
  END IF;

  -- Get checklist as JSONB
  v_checklist := to_jsonb(NEW.condition_checklist);

  IF v_checklist IS NULL THEN
    NEW.checklist_completed := FALSE;
    NEW.checklist_missing_items := v_mandatory_items;
    RETURN NEW;
  END IF;

  -- Check each mandatory item
  v_missing_items := ARRAY[]::TEXT[];
  FOREACH v_item IN ARRAY v_mandatory_items LOOP
    v_item_value := v_checklist->>v_item;
    
    -- Handle both formats:
    -- Old: true/false (JSONB extracts as 'true'/'false' strings)
    -- New: 'ok'/'not_ok'
    -- Item is INCOMPLETE if: null, empty, 'not_ok', or 'false'
    IF v_item_value IS NULL 
       OR v_item_value = '' 
       OR v_item_value = 'not_ok' 
       OR v_item_value = 'false' THEN
      v_missing_items := array_append(v_missing_items, v_item);
    END IF;
    -- 'ok' or 'true' = complete
  END LOOP;

  -- Update checklist status
  IF array_length(v_missing_items, 1) > 0 THEN
    NEW.checklist_completed := FALSE;
    NEW.checklist_missing_items := v_missing_items;
  ELSE
    NEW.checklist_completed := TRUE;
    NEW.checklist_missing_items := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Recreate trigger
DROP TRIGGER IF EXISTS trigger_validate_checklist ON jobs;
CREATE TRIGGER trigger_validate_checklist
  BEFORE UPDATE OF status ON jobs
  FOR EACH ROW
  WHEN (NEW.status IN ('Awaiting Finalization', 'Completed'))
  EXECUTE FUNCTION validate_job_checklist();

-- =============================================
-- FIX 2: validate_job_completion_requirements - check multiple sources
-- =============================================
CREATE OR REPLACE FUNCTION validate_job_completion_requirements()
RETURNS TRIGGER AS $$
DECLARE
    service_record RECORD;
    has_parts BOOLEAN;
    user_role TEXT;
    v_user_id UUID;
    v_job_started BOOLEAN;
BEGIN
    -- Only validate when moving TO 'Awaiting Finalization' status
    IF NEW.status != 'Awaiting Finalization' OR OLD.status = 'Awaiting Finalization' THEN
        RETURN NEW;
    END IF;
    
    -- Get user role (lookup by auth_id)
    SELECT u.role, u.user_id INTO user_role, v_user_id 
    FROM users u WHERE u.auth_id = auth.uid();
    
    -- Admin types can bypass all validation
    IF user_role IN ('admin', 'Admin 1', 'Admin 2', 'Admin 1 (Service)', 'Admin 2 (Store)', 'supervisor') THEN
        RETURN NEW;
    END IF;
    
    -- Get service record
    SELECT * INTO service_record 
    FROM job_service_records 
    WHERE job_id = NEW.job_id;
    
    -- Service record is optional for older jobs
    -- If it exists, use it; otherwise check job columns directly
    
    -- Check if job was started (any of these indicate start)
    v_job_started := COALESCE(
        service_record.started_at IS NOT NULL,
        FALSE
    ) OR NEW.started_at IS NOT NULL 
      OR NEW.repair_start_time IS NOT NULL
      OR NEW.arrival_time IS NOT NULL;
    
    IF NOT v_job_started THEN
        RAISE EXCEPTION 'Cannot complete job: Job was never started (no start time recorded).';
    END IF;
    
    -- Must have checklist filled (check both service record and job)
    IF (service_record.checklist_data IS NULL OR service_record.checklist_data = '{}'::JSONB)
       AND (NEW.condition_checklist IS NULL OR NEW.condition_checklist::JSONB = '{}'::JSONB) THEN
        RAISE EXCEPTION 'Cannot complete job: Checklist has not been filled.';
    END IF;
    
    -- Must have service notes OR job_carried_out (check both sources)
    IF (COALESCE(service_record.service_notes, '') = '' AND COALESCE(service_record.job_carried_out, '') = '')
       AND (COALESCE(NEW.service_notes, '') = '' AND COALESCE(NEW.job_carried_out, '') = '') THEN
        RAISE EXCEPTION 'Cannot complete job: Service notes or job carried out description is required.';
    END IF;
    
    -- Must have parts recorded OR marked as no_parts_used
    has_parts := EXISTS (SELECT 1 FROM job_parts WHERE job_id = NEW.job_id);
    IF NOT has_parts THEN
        has_parts := EXISTS (SELECT 1 FROM job_inventory_usage WHERE job_id = NEW.job_id);
    END IF;
    IF NOT has_parts AND NOT COALESCE(service_record.no_parts_used, FALSE) AND NOT COALESCE(NEW.no_parts_used, FALSE) THEN
        RAISE EXCEPTION 'Cannot complete job: Parts must be recorded, or explicitly mark "no parts used".';
    END IF;
    
    -- Must have technician signature
    IF COALESCE(service_record.technician_signature, NEW.technician_signature) IS NULL THEN
        RAISE EXCEPTION 'Cannot complete job: Technician signature is required.';
    END IF;
    
    -- Must have customer signature
    IF COALESCE(service_record.customer_signature, NEW.customer_signature) IS NULL THEN
        RAISE EXCEPTION 'Cannot complete job: Customer signature is required.';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate trigger
DROP TRIGGER IF EXISTS trg_validate_completion ON jobs;
CREATE TRIGGER trg_validate_completion
    BEFORE UPDATE ON jobs
    FOR EACH ROW
    WHEN (NEW.status = 'Awaiting Finalization' AND OLD.status != 'Awaiting Finalization')
    EXECUTE FUNCTION validate_job_completion_requirements();

-- =============================================
-- FIX 3: Backfill missing started_at in job_service_records
-- =============================================
UPDATE job_service_records jsr
SET 
    started_at = COALESCE(j.started_at, j.repair_start_time, j.arrival_time),
    updated_at = NOW()
FROM jobs j
WHERE jsr.job_id = j.job_id
  AND jsr.started_at IS NULL
  AND (j.started_at IS NOT NULL OR j.repair_start_time IS NOT NULL OR j.arrival_time IS NOT NULL);

-- Also sync repair times
UPDATE job_service_records jsr
SET 
    repair_start_time = COALESCE(jsr.repair_start_time, j.repair_start_time),
    repair_end_time = COALESCE(jsr.repair_end_time, j.repair_end_time),
    updated_at = NOW()
FROM jobs j
WHERE jsr.job_id = j.job_id
  AND (jsr.repair_start_time IS NULL OR jsr.repair_end_time IS NULL)
  AND (j.repair_start_time IS NOT NULL OR j.repair_end_time IS NOT NULL);

-- =============================================
-- FIX 4: Create trigger to auto-sync started_at to service records
-- =============================================
CREATE OR REPLACE FUNCTION sync_job_started_to_service_record()
RETURNS TRIGGER AS $$
BEGIN
    -- When job.started_at is set, sync to service record
    IF NEW.started_at IS NOT NULL AND (OLD.started_at IS NULL OR OLD.started_at != NEW.started_at) THEN
        UPDATE job_service_records
        SET 
            started_at = COALESCE(started_at, NEW.started_at),
            repair_start_time = COALESCE(repair_start_time, NEW.repair_start_time),
            updated_at = NOW()
        WHERE job_id = NEW.job_id;
    END IF;
    
    -- Sync repair times
    IF NEW.repair_start_time IS NOT NULL AND OLD.repair_start_time IS DISTINCT FROM NEW.repair_start_time THEN
        UPDATE job_service_records
        SET repair_start_time = NEW.repair_start_time, updated_at = NOW()
        WHERE job_id = NEW.job_id AND repair_start_time IS NULL;
    END IF;
    
    IF NEW.repair_end_time IS NOT NULL AND OLD.repair_end_time IS DISTINCT FROM NEW.repair_end_time THEN
        UPDATE job_service_records
        SET repair_end_time = NEW.repair_end_time, updated_at = NOW()
        WHERE job_id = NEW.job_id AND repair_end_time IS NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_sync_job_times ON jobs;
CREATE TRIGGER trg_sync_job_times
    AFTER UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION sync_job_started_to_service_record();
