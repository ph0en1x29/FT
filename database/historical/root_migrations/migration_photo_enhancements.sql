-- Migration: Photo & Time Enhancements
-- Run this in Supabase SQL Editor
-- Date: 2026-01-14

-- ============================================
-- 1. Enhance job_media table with GPS and validation fields
-- ============================================

-- GPS Location fields
ALTER TABLE job_media
ADD COLUMN IF NOT EXISTS gps_latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS gps_longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS gps_accuracy DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS gps_captured_at TIMESTAMPTZ;

-- Timestamp validation fields
ALTER TABLE job_media
ADD COLUMN IF NOT EXISTS device_timestamp TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS server_timestamp TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS timestamp_mismatch BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS timestamp_mismatch_minutes INTEGER;

-- Photo source tracking
ALTER TABLE job_media
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'unknown' CHECK (source IN ('camera', 'gallery', 'unknown'));

-- Camera fallback fields
ALTER TABLE job_media
ADD COLUMN IF NOT EXISTS is_camera_fallback BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS fallback_description TEXT,
ADD COLUMN IF NOT EXISTS fallback_approved BOOLEAN,
ADD COLUMN IF NOT EXISTS fallback_approved_by_id UUID REFERENCES users(user_id),
ADD COLUMN IF NOT EXISTS fallback_approved_by_name TEXT,
ADD COLUMN IF NOT EXISTS fallback_approved_at TIMESTAMPTZ;

-- Timer automation fields
ALTER TABLE job_media
ADD COLUMN IF NOT EXISTS is_start_photo BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_end_photo BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS timer_triggered_at TIMESTAMPTZ;

-- Multi-day job tracking
ALTER TABLE job_media
ADD COLUMN IF NOT EXISTS job_day_number INTEGER DEFAULT 1;

-- Admin review fields
ALTER TABLE job_media
ADD COLUMN IF NOT EXISTS flagged_for_review BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS flagged_reason TEXT,
ADD COLUMN IF NOT EXISTS reviewed_by_id UUID REFERENCES users(user_id),
ADD COLUMN IF NOT EXISTS reviewed_by_name TEXT,
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS review_notes TEXT;

-- ============================================
-- 2. Create app_settings for photo configuration
-- ============================================
-- Insert default photo settings if not exists
INSERT INTO app_settings (setting_id, key, value, description)
VALUES
  (gen_random_uuid(), 'photo_require_gps', 'true', 'Require GPS coordinates on all job photos'),
  (gen_random_uuid(), 'photo_require_camera_only', 'true', 'Disable gallery uploads, camera only'),
  (gen_random_uuid(), 'photo_timestamp_tolerance_minutes', '5', 'Flag photos with timestamp mismatch > this value'),
  (gen_random_uuid(), 'photo_require_forklift_visible', 'true', 'Start photo must show full forklift'),
  (gen_random_uuid(), 'photo_require_hourmeter_visible', 'true', 'Start photo must show hourmeter reading'),
  (gen_random_uuid(), 'photo_require_serial_visible', 'true', 'Start photo must show serial number/plate')
ON CONFLICT DO NOTHING;

-- ============================================
-- 3. Create duration_alert_configs table
-- ============================================
CREATE TABLE IF NOT EXISTS duration_alert_configs (
  config_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL,
  warning_threshold_hours DECIMAL(4,2) NOT NULL,
  alert_threshold_hours DECIMAL(4,2) NOT NULL,
  notify_supervisor BOOLEAN DEFAULT TRUE,
  notify_admin BOOLEAN DEFAULT TRUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_type)
);

-- Insert default duration alert thresholds (from questionnaire)
INSERT INTO duration_alert_configs (job_type, warning_threshold_hours, alert_threshold_hours, notify_supervisor, notify_admin)
VALUES
  ('Service', 2.5, 3, TRUE, TRUE),
  ('Repair', 4, 5, TRUE, TRUE),
  ('Slot-In', 4, 5, TRUE, TRUE),
  ('Checking', 1.5, 2, TRUE, FALSE),
  ('Courier', 1, 1.5, FALSE, FALSE)
ON CONFLICT (job_type) DO UPDATE SET
  warning_threshold_hours = EXCLUDED.warning_threshold_hours,
  alert_threshold_hours = EXCLUDED.alert_threshold_hours,
  updated_at = NOW();

-- ============================================
-- 4. Create job_duration_alerts table (track sent alerts)
-- ============================================
CREATE TABLE IF NOT EXISTS job_duration_alerts (
  alert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('warning', 'exceeded')),
  threshold_hours DECIMAL(4,2) NOT NULL,
  actual_hours DECIMAL(6,2) NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_to_ids UUID[] NOT NULL,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by_id UUID REFERENCES users(user_id),
  notes TEXT
);

-- ============================================
-- 5. Create indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_job_media_gps ON job_media(gps_latitude, gps_longitude) WHERE gps_latitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_job_media_flagged ON job_media(flagged_for_review) WHERE flagged_for_review = TRUE;
CREATE INDEX IF NOT EXISTS idx_job_media_start_photo ON job_media(job_id, is_start_photo) WHERE is_start_photo = TRUE;
CREATE INDEX IF NOT EXISTS idx_job_media_end_photo ON job_media(job_id, is_end_photo) WHERE is_end_photo = TRUE;
CREATE INDEX IF NOT EXISTS idx_job_media_fallback_pending ON job_media(is_camera_fallback, fallback_approved) WHERE is_camera_fallback = TRUE AND fallback_approved IS NULL;
CREATE INDEX IF NOT EXISTS idx_job_duration_alerts_job ON job_duration_alerts(job_id);

-- ============================================
-- 6. Create trigger for timestamp validation
-- ============================================
CREATE OR REPLACE FUNCTION validate_photo_timestamp()
RETURNS TRIGGER AS $$
DECLARE
  v_tolerance INTEGER;
  v_diff_minutes INTEGER;
BEGIN
  -- Get tolerance from settings
  SELECT COALESCE(value::INTEGER, 5) INTO v_tolerance
  FROM app_settings
  WHERE key = 'photo_timestamp_tolerance_minutes';

  -- Calculate difference if device_timestamp provided
  IF NEW.device_timestamp IS NOT NULL THEN
    v_diff_minutes := ABS(EXTRACT(EPOCH FROM (NEW.server_timestamp - NEW.device_timestamp)) / 60)::INTEGER;
    NEW.timestamp_mismatch_minutes := v_diff_minutes;

    IF v_diff_minutes > v_tolerance THEN
      NEW.timestamp_mismatch := TRUE;
      NEW.flagged_for_review := TRUE;
      NEW.flagged_reason := COALESCE(NEW.flagged_reason, '') || 'Timestamp mismatch: ' || v_diff_minutes || ' minutes. ';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validate_photo_timestamp ON job_media;
CREATE TRIGGER trigger_validate_photo_timestamp
  BEFORE INSERT ON job_media
  FOR EACH ROW
  EXECUTE FUNCTION validate_photo_timestamp();

-- ============================================
-- 7. Create trigger for GPS validation
-- ============================================
CREATE OR REPLACE FUNCTION validate_photo_gps()
RETURNS TRIGGER AS $$
DECLARE
  v_require_gps BOOLEAN;
BEGIN
  -- Check if GPS is required
  SELECT COALESCE(value::BOOLEAN, TRUE) INTO v_require_gps
  FROM app_settings
  WHERE key = 'photo_require_gps';

  -- Flag if GPS missing and required
  IF v_require_gps AND NEW.gps_latitude IS NULL AND NEW.type = 'photo' THEN
    NEW.flagged_for_review := TRUE;
    NEW.flagged_reason := COALESCE(NEW.flagged_reason, '') || 'GPS coordinates missing. ';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validate_photo_gps ON job_media;
CREATE TRIGGER trigger_validate_photo_gps
  BEFORE INSERT ON job_media
  FOR EACH ROW
  EXECUTE FUNCTION validate_photo_gps();

-- ============================================
-- 8. Create trigger for photo-triggered timer
-- ============================================
CREATE OR REPLACE FUNCTION photo_trigger_timer()
RETURNS TRIGGER AS $$
BEGIN
  -- Start photo triggers job start time
  IF NEW.is_start_photo = TRUE AND NEW.category = 'before' THEN
    NEW.timer_triggered_at := NOW();

    -- Update job started_at if not already set
    UPDATE jobs
    SET started_at = NEW.timer_triggered_at,
        repair_start_time = NEW.timer_triggered_at
    WHERE job_id = NEW.job_id
      AND started_at IS NULL;
  END IF;

  -- End photo triggers job completion time
  IF NEW.is_end_photo = TRUE AND NEW.category = 'after' THEN
    NEW.timer_triggered_at := NOW();

    -- Update job repair_end_time
    UPDATE jobs
    SET repair_end_time = NEW.timer_triggered_at
    WHERE job_id = NEW.job_id
      AND repair_end_time IS NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_photo_timer ON job_media;
CREATE TRIGGER trigger_photo_timer
  BEFORE INSERT ON job_media
  FOR EACH ROW
  EXECUTE FUNCTION photo_trigger_timer();

-- ============================================
-- 9. Create function to check duration alerts
-- ============================================
CREATE OR REPLACE FUNCTION check_job_duration_alerts()
RETURNS INTEGER AS $$
DECLARE
  v_alert_count INTEGER := 0;
  v_job RECORD;
  v_config RECORD;
  v_hours_elapsed DECIMAL;
BEGIN
  -- Check all in-progress jobs
  FOR v_job IN
    SELECT j.job_id, j.job_type, j.started_at, j.assigned_technician_id
    FROM jobs j
    WHERE j.status = 'In Progress'
      AND j.started_at IS NOT NULL
      AND j.deleted_at IS NULL
  LOOP
    -- Get config for this job type
    SELECT * INTO v_config
    FROM duration_alert_configs
    WHERE job_type = v_job.job_type AND is_active = TRUE;

    IF v_config IS NOT NULL THEN
      v_hours_elapsed := EXTRACT(EPOCH FROM (NOW() - v_job.started_at)) / 3600;

      -- Check if exceeded threshold and no alert sent yet
      IF v_hours_elapsed >= v_config.alert_threshold_hours THEN
        IF NOT EXISTS (
          SELECT 1 FROM job_duration_alerts
          WHERE job_id = v_job.job_id AND alert_type = 'exceeded'
        ) THEN
          -- Send exceeded alert
          INSERT INTO job_duration_alerts (job_id, alert_type, threshold_hours, actual_hours, sent_to_ids)
          SELECT v_job.job_id, 'exceeded', v_config.alert_threshold_hours, v_hours_elapsed,
                 ARRAY(SELECT user_id FROM users WHERE role IN ('admin', 'admin_service', 'supervisor') AND is_active = TRUE);
          v_alert_count := v_alert_count + 1;
        END IF;
      -- Check if warning threshold and no warning sent yet
      ELSIF v_hours_elapsed >= v_config.warning_threshold_hours THEN
        IF NOT EXISTS (
          SELECT 1 FROM job_duration_alerts
          WHERE job_id = v_job.job_id AND alert_type = 'warning'
        ) THEN
          -- Send warning alert
          INSERT INTO job_duration_alerts (job_id, alert_type, threshold_hours, actual_hours, sent_to_ids)
          SELECT v_job.job_id, 'warning', v_config.warning_threshold_hours, v_hours_elapsed,
                 ARRAY(SELECT user_id FROM users WHERE role IN ('admin', 'admin_service', 'supervisor') AND is_active = TRUE);
          v_alert_count := v_alert_count + 1;
        END IF;
      END IF;
    END IF;
  END LOOP;

  RETURN v_alert_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 10. Create view for flagged photos
-- ============================================
CREATE OR REPLACE VIEW flagged_photos AS
SELECT
  jm.media_id,
  jm.job_id,
  j.title as job_title,
  j.assigned_technician_name,
  c.name as customer_name,
  jm.url,
  jm.category,
  jm.flagged_reason,
  jm.timestamp_mismatch,
  jm.timestamp_mismatch_minutes,
  jm.gps_latitude,
  jm.gps_longitude,
  jm.source,
  jm.is_camera_fallback,
  jm.fallback_description,
  jm.created_at,
  jm.reviewed_at,
  jm.reviewed_by_name
FROM job_media jm
JOIN jobs j ON jm.job_id = j.job_id
LEFT JOIN customers c ON j.customer_id = c.customer_id
WHERE jm.flagged_for_review = TRUE
  AND jm.reviewed_at IS NULL
ORDER BY jm.created_at DESC;

-- ============================================
-- 11. Create view for pending camera fallbacks
-- ============================================
CREATE OR REPLACE VIEW pending_camera_fallbacks AS
SELECT
  jm.media_id,
  jm.job_id,
  j.title as job_title,
  j.assigned_technician_name,
  jm.fallback_description,
  jm.created_at,
  jm.uploaded_by_name
FROM job_media jm
JOIN jobs j ON jm.job_id = j.job_id
WHERE jm.is_camera_fallback = TRUE
  AND jm.fallback_approved IS NULL
ORDER BY jm.created_at DESC;

-- ============================================
-- ROLLBACK COMMANDS (if needed):
-- ============================================
-- DROP VIEW IF EXISTS pending_camera_fallbacks;
-- DROP VIEW IF EXISTS flagged_photos;
-- DROP FUNCTION IF EXISTS check_job_duration_alerts();
-- DROP TRIGGER IF EXISTS trigger_photo_timer ON job_media;
-- DROP FUNCTION IF EXISTS photo_trigger_timer();
-- DROP TRIGGER IF EXISTS trigger_validate_photo_gps ON job_media;
-- DROP FUNCTION IF EXISTS validate_photo_gps();
-- DROP TRIGGER IF EXISTS trigger_validate_photo_timestamp ON job_media;
-- DROP FUNCTION IF EXISTS validate_photo_timestamp();
-- DROP TABLE IF EXISTS job_duration_alerts;
-- DROP TABLE IF EXISTS duration_alert_configs;
-- DELETE FROM app_settings WHERE key LIKE 'photo_%';
-- ALTER TABLE job_media DROP COLUMN IF EXISTS review_notes;
-- ALTER TABLE job_media DROP COLUMN IF EXISTS reviewed_at;
-- ALTER TABLE job_media DROP COLUMN IF EXISTS reviewed_by_name;
-- ALTER TABLE job_media DROP COLUMN IF EXISTS reviewed_by_id;
-- ALTER TABLE job_media DROP COLUMN IF EXISTS flagged_reason;
-- ALTER TABLE job_media DROP COLUMN IF EXISTS flagged_for_review;
-- ALTER TABLE job_media DROP COLUMN IF EXISTS job_day_number;
-- ALTER TABLE job_media DROP COLUMN IF EXISTS timer_triggered_at;
-- ALTER TABLE job_media DROP COLUMN IF EXISTS is_end_photo;
-- ALTER TABLE job_media DROP COLUMN IF EXISTS is_start_photo;
-- ALTER TABLE job_media DROP COLUMN IF EXISTS fallback_approved_at;
-- ALTER TABLE job_media DROP COLUMN IF EXISTS fallback_approved_by_name;
-- ALTER TABLE job_media DROP COLUMN IF EXISTS fallback_approved_by_id;
-- ALTER TABLE job_media DROP COLUMN IF EXISTS fallback_approved;
-- ALTER TABLE job_media DROP COLUMN IF EXISTS fallback_description;
-- ALTER TABLE job_media DROP COLUMN IF EXISTS is_camera_fallback;
-- ALTER TABLE job_media DROP COLUMN IF EXISTS source;
-- ALTER TABLE job_media DROP COLUMN IF EXISTS timestamp_mismatch_minutes;
-- ALTER TABLE job_media DROP COLUMN IF EXISTS timestamp_mismatch;
-- ALTER TABLE job_media DROP COLUMN IF EXISTS server_timestamp;
-- ALTER TABLE job_media DROP COLUMN IF EXISTS device_timestamp;
-- ALTER TABLE job_media DROP COLUMN IF EXISTS gps_captured_at;
-- ALTER TABLE job_media DROP COLUMN IF EXISTS gps_accuracy;
-- ALTER TABLE job_media DROP COLUMN IF EXISTS gps_longitude;
-- ALTER TABLE job_media DROP COLUMN IF EXISTS gps_latitude;

COMMIT;
