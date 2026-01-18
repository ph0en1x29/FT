-- Migration: Hourmeter Amendment & Checklist Enforcement
-- Run this in Supabase SQL Editor
-- Date: 2026-01-14

-- ============================================
-- 1. Add hourmeter validation fields to jobs table
-- ============================================
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS hourmeter_previous INTEGER,
ADD COLUMN IF NOT EXISTS hourmeter_flag_reasons TEXT[],
ADD COLUMN IF NOT EXISTS hourmeter_flagged BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS hourmeter_amendment_id UUID,
ADD COLUMN IF NOT EXISTS hourmeter_validated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS hourmeter_validated_by_id UUID REFERENCES users(user_id),
ADD COLUMN IF NOT EXISTS hourmeter_validated_by_name TEXT;

-- Checklist enforcement fields
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS checklist_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS checklist_missing_items TEXT[],
ADD COLUMN IF NOT EXISTS checklist_used_check_all BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS checklist_check_all_confirmed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS checklist_validated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS checklist_validated_by_id UUID REFERENCES users(user_id),
ADD COLUMN IF NOT EXISTS checklist_validated_by_name TEXT;

-- ============================================
-- 2. Create hourmeter_amendments table
-- ============================================
CREATE TABLE IF NOT EXISTS hourmeter_amendments (
  amendment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
  forklift_id UUID NOT NULL REFERENCES forklifts(forklift_id),

  -- Original and amended values
  original_reading INTEGER NOT NULL,
  amended_reading INTEGER NOT NULL,

  -- Request tracking
  reason TEXT NOT NULL,
  flag_reasons TEXT[],
  requested_by_id UUID NOT NULL REFERENCES users(user_id),
  requested_by_name TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Approval (only Admin 1 - Service can approve)
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by_id UUID REFERENCES users(user_id),
  reviewed_by_name TEXT,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 3. Create hourmeter_history table
-- ============================================
CREATE TABLE IF NOT EXISTS hourmeter_history (
  entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forklift_id UUID NOT NULL REFERENCES forklifts(forklift_id) ON DELETE CASCADE,
  job_id UUID REFERENCES jobs(job_id),

  -- Reading details
  reading INTEGER NOT NULL,
  previous_reading INTEGER,
  hours_since_last INTEGER,

  -- Validation flags
  flag_reasons TEXT[],
  was_amended BOOLEAN DEFAULT FALSE,
  amendment_id UUID REFERENCES hourmeter_amendments(amendment_id),

  -- Recording info
  recorded_by_id UUID NOT NULL REFERENCES users(user_id),
  recorded_by_name TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Source
  source TEXT NOT NULL CHECK (source IN ('job_start', 'job_end', 'amendment', 'audit', 'manual'))
);

-- ============================================
-- 4. Create hourmeter_validation_configs table
-- ============================================
CREATE TABLE IF NOT EXISTS hourmeter_validation_configs (
  config_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Thresholds (configurable per questionnaire)
  warning_threshold_hours INTEGER DEFAULT 100,
  alert_threshold_hours INTEGER DEFAULT 500,
  lower_reading_action TEXT DEFAULT 'flag' CHECK (lower_reading_action IN ('flag', 'block', 'allow')),

  -- Daily usage patterns (for anomaly detection)
  expected_daily_usage_hours INTEGER DEFAULT 8,
  usage_variance_tolerance INTEGER DEFAULT 50,

  -- Amendment rules
  require_approval_for_all BOOLEAN DEFAULT FALSE,
  auto_approve_minor_corrections BOOLEAN DEFAULT TRUE,
  minor_correction_threshold INTEGER DEFAULT 2,

  -- Active status
  is_active BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by_id UUID REFERENCES users(user_id),
  updated_by_name TEXT
);

-- Insert default configuration
INSERT INTO hourmeter_validation_configs (
  config_id,
  warning_threshold_hours,
  alert_threshold_hours,
  lower_reading_action,
  expected_daily_usage_hours,
  usage_variance_tolerance,
  require_approval_for_all,
  auto_approve_minor_corrections,
  minor_correction_threshold,
  is_active
) VALUES (
  gen_random_uuid(),
  100,   -- Warn if jump > 100 hours
  500,   -- Alert if jump > 500 hours
  'flag', -- Flag but don't block lower readings
  8,      -- Assume 8 hours/day average
  50,     -- 50% variance tolerance
  FALSE,  -- Don't require approval for all amendments
  TRUE,   -- Auto-approve minor corrections
  2,      -- Auto-approve ≤2 hour differences
  TRUE
) ON CONFLICT DO NOTHING;

-- ============================================
-- 5. Add mandatory checklist items to app_settings
-- ============================================
INSERT INTO app_settings (setting_id, key, value, description)
VALUES
  (gen_random_uuid(), 'checklist_enforcement_enabled', 'true', 'Block job completion if mandatory checklist items not checked'),
  (gen_random_uuid(), 'checklist_check_all_confirmation', 'true', 'Require confirmation after using Check All button'),
  (gen_random_uuid(), 'hourmeter_mandatory', 'true', 'Require hourmeter reading for job completion'),
  (gen_random_uuid(), 'hourmeter_amendment_admin_only', 'true', 'Only Admin (Service) can approve hourmeter amendments')
ON CONFLICT DO NOTHING;

-- ============================================
-- 6. Create indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_hourmeter_amendments_job ON hourmeter_amendments(job_id);
CREATE INDEX IF NOT EXISTS idx_hourmeter_amendments_forklift ON hourmeter_amendments(forklift_id);
CREATE INDEX IF NOT EXISTS idx_hourmeter_amendments_status ON hourmeter_amendments(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_hourmeter_history_forklift ON hourmeter_history(forklift_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_hourmeter_flagged ON jobs(hourmeter_flagged) WHERE hourmeter_flagged = TRUE;
CREATE INDEX IF NOT EXISTS idx_jobs_checklist_incomplete ON jobs(checklist_completed) WHERE checklist_completed = FALSE;

-- ============================================
-- 7. Create trigger for hourmeter validation
-- ============================================
CREATE OR REPLACE FUNCTION validate_hourmeter_reading()
RETURNS TRIGGER AS $$
DECLARE
  v_last_reading INTEGER;
  v_config RECORD;
  v_hours_diff INTEGER;
  v_flag_reasons TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Only validate if hourmeter_reading is provided
  IF NEW.hourmeter_reading IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get the last hourmeter reading for this forklift
  SELECT hourmeter INTO v_last_reading
  FROM forklifts
  WHERE forklift_id = NEW.forklift_id;

  -- Get validation config
  SELECT * INTO v_config
  FROM hourmeter_validation_configs
  WHERE is_active = TRUE
  LIMIT 1;

  IF v_config IS NULL THEN
    RETURN NEW;
  END IF;

  -- Store previous reading for reference
  NEW.hourmeter_previous := v_last_reading;

  -- Check if reading is lower than previous
  IF v_last_reading IS NOT NULL AND NEW.hourmeter_reading < v_last_reading THEN
    v_flag_reasons := array_append(v_flag_reasons, 'lower_than_previous');
  END IF;

  -- Check for excessive jump
  IF v_last_reading IS NOT NULL THEN
    v_hours_diff := NEW.hourmeter_reading - v_last_reading;

    IF v_hours_diff > v_config.alert_threshold_hours THEN
      v_flag_reasons := array_append(v_flag_reasons, 'excessive_jump');
    ELSIF v_hours_diff > v_config.warning_threshold_hours THEN
      v_flag_reasons := array_append(v_flag_reasons, 'pattern_mismatch');
    END IF;
  END IF;

  -- Set flag if any issues found
  IF array_length(v_flag_reasons, 1) > 0 THEN
    NEW.hourmeter_flagged := TRUE;
    NEW.hourmeter_flag_reasons := v_flag_reasons;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validate_hourmeter ON jobs;
CREATE TRIGGER trigger_validate_hourmeter
  BEFORE INSERT OR UPDATE OF hourmeter_reading ON jobs
  FOR EACH ROW
  WHEN (NEW.hourmeter_reading IS NOT NULL)
  EXECUTE FUNCTION validate_hourmeter_reading();

-- ============================================
-- 8. Create trigger to update forklift hourmeter
-- ============================================
CREATE OR REPLACE FUNCTION update_forklift_hourmeter()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update forklift if hourmeter reading is provided and not flagged
  IF NEW.hourmeter_reading IS NOT NULL
     AND NEW.forklift_id IS NOT NULL
     AND (NEW.hourmeter_flagged IS NULL OR NEW.hourmeter_flagged = FALSE) THEN

    -- Update forklift's hourmeter
    UPDATE forklifts
    SET hourmeter = NEW.hourmeter_reading,
        updated_at = NOW()
    WHERE forklift_id = NEW.forklift_id
      AND (hourmeter IS NULL OR hourmeter < NEW.hourmeter_reading);

    -- Record in history
    INSERT INTO hourmeter_history (
      forklift_id, job_id, reading, previous_reading, hours_since_last,
      flag_reasons, was_amended, recorded_by_id, recorded_by_name, source
    )
    VALUES (
      NEW.forklift_id,
      NEW.job_id,
      NEW.hourmeter_reading,
      NEW.hourmeter_previous,
      CASE WHEN NEW.hourmeter_previous IS NOT NULL
           THEN NEW.hourmeter_reading - NEW.hourmeter_previous
           ELSE NULL END,
      NEW.hourmeter_flag_reasons,
      FALSE,
      COALESCE(NEW.started_by_id, NEW.assigned_technician_id),
      COALESCE(NEW.started_by_name, NEW.assigned_technician_name),
      'job_start'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_forklift_hourmeter ON jobs;
CREATE TRIGGER trigger_update_forklift_hourmeter
  AFTER INSERT OR UPDATE OF hourmeter_reading ON jobs
  FOR EACH ROW
  WHEN (NEW.hourmeter_reading IS NOT NULL AND NEW.forklift_id IS NOT NULL)
  EXECUTE FUNCTION update_forklift_hourmeter();

-- ============================================
-- 9. Create function to validate checklist
-- ============================================
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
BEGIN
  -- Check if enforcement is enabled
  SELECT COALESCE(value::BOOLEAN, TRUE) INTO v_checklist_enforcement
  FROM app_settings
  WHERE key = 'checklist_enforcement_enabled';

  IF NOT v_checklist_enforcement THEN
    RETURN NEW;
  END IF;

  -- Only validate when transitioning to Awaiting Finalization or Completed
  IF NEW.status NOT IN ('Awaiting Finalization', 'Completed') THEN
    RETURN NEW;
  END IF;

  -- Get checklist as JSONB
  v_checklist := to_jsonb(NEW.condition_checklist);

  IF v_checklist IS NULL THEN
    -- No checklist provided - flag as incomplete
    NEW.checklist_completed := FALSE;
    NEW.checklist_missing_items := v_mandatory_items;
    RETURN NEW;
  END IF;

  -- Check each mandatory item
  v_missing_items := ARRAY[]::TEXT[];
  FOREACH v_item IN ARRAY v_mandatory_items LOOP
    IF NOT COALESCE((v_checklist->>v_item)::BOOLEAN, FALSE) THEN
      v_missing_items := array_append(v_missing_items, v_item);
    END IF;
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validate_checklist ON jobs;
CREATE TRIGGER trigger_validate_checklist
  BEFORE UPDATE OF status ON jobs
  FOR EACH ROW
  WHEN (NEW.status IN ('Awaiting Finalization', 'Completed'))
  EXECUTE FUNCTION validate_job_checklist();

-- ============================================
-- 10. Create view for pending hourmeter amendments
-- ============================================
CREATE OR REPLACE VIEW pending_hourmeter_amendments AS
SELECT
  ha.amendment_id,
  ha.job_id,
  j.title as job_title,
  ha.forklift_id,
  f.serial_number as forklift_serial,
  f.make as forklift_make,
  f.model as forklift_model,
  ha.original_reading,
  ha.amended_reading,
  ha.amended_reading - ha.original_reading as difference,
  ha.reason,
  ha.flag_reasons,
  ha.requested_by_name,
  ha.requested_at,
  EXTRACT(EPOCH FROM (NOW() - ha.requested_at)) / 3600 as hours_pending
FROM hourmeter_amendments ha
JOIN jobs j ON ha.job_id = j.job_id
JOIN forklifts f ON ha.forklift_id = f.forklift_id
WHERE ha.status = 'pending'
ORDER BY ha.requested_at ASC;

-- ============================================
-- 11. Create view for flagged hourmeter readings
-- ============================================
CREATE OR REPLACE VIEW flagged_hourmeter_readings AS
SELECT
  j.job_id,
  j.title,
  j.status,
  j.assigned_technician_name,
  f.serial_number as forklift_serial,
  j.hourmeter_reading,
  j.hourmeter_previous,
  j.hourmeter_reading - COALESCE(j.hourmeter_previous, 0) as hours_difference,
  j.hourmeter_flag_reasons,
  j.created_at
FROM jobs j
JOIN forklifts f ON j.forklift_id = f.forklift_id
WHERE j.hourmeter_flagged = TRUE
  AND j.hourmeter_amendment_id IS NULL
  AND j.deleted_at IS NULL
ORDER BY j.created_at DESC;

-- ============================================
-- 12. Create function to apply hourmeter amendment
-- ============================================
CREATE OR REPLACE FUNCTION apply_hourmeter_amendment(
  p_amendment_id UUID,
  p_approved_by_id UUID,
  p_approved_by_name TEXT,
  p_approve BOOLEAN,
  p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_amendment RECORD;
BEGIN
  -- Get amendment details
  SELECT * INTO v_amendment
  FROM hourmeter_amendments
  WHERE amendment_id = p_amendment_id AND status = 'pending';

  IF v_amendment IS NULL THEN
    RAISE EXCEPTION 'Amendment not found or already processed';
  END IF;

  IF p_approve THEN
    -- Update amendment status
    UPDATE hourmeter_amendments
    SET status = 'approved',
        reviewed_by_id = p_approved_by_id,
        reviewed_by_name = p_approved_by_name,
        reviewed_at = NOW(),
        review_notes = p_notes,
        updated_at = NOW()
    WHERE amendment_id = p_amendment_id;

    -- Update job with amended reading
    UPDATE jobs
    SET hourmeter_reading = v_amendment.amended_reading,
        hourmeter_flagged = FALSE,
        hourmeter_flag_reasons = NULL,
        hourmeter_amendment_id = p_amendment_id,
        hourmeter_validated_at = NOW(),
        hourmeter_validated_by_id = p_approved_by_id,
        hourmeter_validated_by_name = p_approved_by_name
    WHERE job_id = v_amendment.job_id;

    -- Update forklift hourmeter
    UPDATE forklifts
    SET hourmeter = v_amendment.amended_reading,
        updated_at = NOW()
    WHERE forklift_id = v_amendment.forklift_id;

    -- Record in history
    INSERT INTO hourmeter_history (
      forklift_id, job_id, reading, previous_reading,
      was_amended, amendment_id, recorded_by_id, recorded_by_name, source
    )
    VALUES (
      v_amendment.forklift_id,
      v_amendment.job_id,
      v_amendment.amended_reading,
      v_amendment.original_reading,
      TRUE,
      p_amendment_id,
      p_approved_by_id,
      p_approved_by_name,
      'amendment'
    );
  ELSE
    -- Reject amendment
    UPDATE hourmeter_amendments
    SET status = 'rejected',
        reviewed_by_id = p_approved_by_id,
        reviewed_by_name = p_approved_by_name,
        reviewed_at = NOW(),
        review_notes = p_notes,
        updated_at = NOW()
    WHERE amendment_id = p_amendment_id;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROLLBACK COMMANDS (if needed):
-- ============================================
-- DROP FUNCTION IF EXISTS apply_hourmeter_amendment(UUID, UUID, TEXT, BOOLEAN, TEXT);
-- DROP VIEW IF EXISTS flagged_hourmeter_readings;
-- DROP VIEW IF EXISTS pending_hourmeter_amendments;
-- DROP TRIGGER IF EXISTS trigger_validate_checklist ON jobs;
-- DROP FUNCTION IF EXISTS validate_job_checklist();
-- DROP TRIGGER IF EXISTS trigger_update_forklift_hourmeter ON jobs;
-- DROP FUNCTION IF EXISTS update_forklift_hourmeter();
-- DROP TRIGGER IF EXISTS trigger_validate_hourmeter ON jobs;
-- DROP FUNCTION IF EXISTS validate_hourmeter_reading();
-- DELETE FROM app_settings WHERE key IN ('checklist_enforcement_enabled', 'checklist_check_all_confirmation', 'hourmeter_mandatory', 'hourmeter_amendment_admin_only');
-- DROP TABLE IF EXISTS hourmeter_validation_configs;
-- DROP TABLE IF EXISTS hourmeter_history;
-- DROP TABLE IF EXISTS hourmeter_amendments;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS checklist_validated_by_name;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS checklist_validated_by_id;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS checklist_validated_at;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS checklist_check_all_confirmed;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS checklist_used_check_all;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS checklist_missing_items;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS checklist_completed;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS hourmeter_validated_by_name;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS hourmeter_validated_by_id;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS hourmeter_validated_at;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS hourmeter_amendment_id;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS hourmeter_flagged;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS hourmeter_flag_reasons;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS hourmeter_previous;

COMMIT;
