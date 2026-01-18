-- Migration: Fleet Status & Dashboard Enhancements
-- Run this in Supabase SQL Editor
-- Date: 2026-01-15

-- ============================================
-- 1. Update forklifts table status constraint for new statuses
-- ============================================
-- Drop existing constraint if any
ALTER TABLE forklifts DROP CONSTRAINT IF EXISTS forklifts_status_check;

-- Add new constraint with all fleet statuses
ALTER TABLE forklifts
ADD CONSTRAINT forklifts_status_check
CHECK (status IN (
  'Available',
  'Rented Out',
  'In Service',
  'Service Due',
  'Awaiting Parts',
  'Out of Service',
  'Reserved',
  -- Legacy statuses for backwards compatibility
  'Active',
  'Under Maintenance',
  'Inactive'
));

-- ============================================
-- 2. Add awaiting_parts tracking to jobs
-- ============================================
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS awaiting_parts BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS awaiting_parts_since TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS awaiting_parts_reason TEXT;

-- ============================================
-- 3. Create trigger to auto-update forklift status
-- ============================================
CREATE OR REPLACE FUNCTION update_forklift_status_from_job()
RETURNS TRIGGER AS $$
BEGIN
  -- When job starts (In Progress), mark forklift as In Service
  IF NEW.status = 'In Progress' AND OLD.status != 'In Progress' THEN
    UPDATE forklifts
    SET status = 'In Service',
        updated_at = NOW()
    WHERE forklift_id = NEW.forklift_id;
  END IF;

  -- When job is awaiting parts
  IF NEW.awaiting_parts = TRUE AND (OLD.awaiting_parts IS NULL OR OLD.awaiting_parts = FALSE) THEN
    UPDATE forklifts
    SET status = 'Awaiting Parts',
        updated_at = NOW()
    WHERE forklift_id = NEW.forklift_id;
  END IF;

  -- When job completes, check if forklift should return to Available
  IF NEW.status IN ('Completed', 'Awaiting Finalization') AND OLD.status = 'In Progress' THEN
    -- Only update if no other active jobs on this forklift
    IF NOT EXISTS (
      SELECT 1 FROM jobs
      WHERE forklift_id = NEW.forklift_id
        AND job_id != NEW.job_id
        AND status IN ('Assigned', 'In Progress')
        AND deleted_at IS NULL
    ) THEN
      -- Check if service is due
      IF EXISTS (
        SELECT 1 FROM forklifts f
        WHERE f.forklift_id = NEW.forklift_id
          AND (
            (f.next_service_due IS NOT NULL AND f.next_service_due <= CURRENT_DATE + INTERVAL '7 days')
            OR (f.next_service_hourmeter IS NOT NULL AND f.hourmeter >= f.next_service_hourmeter - 50)
          )
      ) THEN
        UPDATE forklifts
        SET status = 'Service Due',
            updated_at = NOW()
        WHERE forklift_id = NEW.forklift_id;
      ELSE
        UPDATE forklifts
        SET status = 'Available',
            updated_at = NOW()
        WHERE forklift_id = NEW.forklift_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_forklift_status ON jobs;
CREATE TRIGGER trigger_update_forklift_status
  AFTER UPDATE OF status, awaiting_parts ON jobs
  FOR EACH ROW
  WHEN (NEW.forklift_id IS NOT NULL)
  EXECUTE FUNCTION update_forklift_status_from_job();

-- ============================================
-- 4. Create fleet dashboard view
-- ============================================
CREATE OR REPLACE VIEW fleet_dashboard_summary AS
SELECT
  COUNT(*) as total_fleet_count,
  COUNT(*) FILTER (WHERE status = 'Available' OR status = 'Active') as available_count,
  COUNT(*) FILTER (WHERE status = 'Rented Out') as rented_out_count,
  COUNT(*) FILTER (WHERE status = 'In Service' OR status = 'Under Maintenance') as in_service_count,
  COUNT(*) FILTER (WHERE status = 'Service Due') as service_due_count,
  COUNT(*) FILTER (WHERE status = 'Awaiting Parts') as awaiting_parts_count,
  COUNT(*) FILTER (WHERE status = 'Out of Service' OR status = 'Inactive') as out_of_service_count,
  COUNT(*) FILTER (WHERE status = 'Reserved') as reserved_count,
  COUNT(*) FILTER (
    WHERE next_service_due IS NOT NULL
      AND next_service_due <= CURRENT_DATE + INTERVAL '7 days'
  ) as service_due_this_week
FROM forklifts;

-- ============================================
-- 5. Create jobs completed this month view
-- ============================================
CREATE OR REPLACE VIEW jobs_monthly_summary AS
SELECT
  DATE_TRUNC('month', completed_at) as month,
  COUNT(*) as jobs_completed,
  AVG(EXTRACT(EPOCH FROM (repair_end_time - repair_start_time)) / 3600) as avg_duration_hours
FROM jobs
WHERE status IN ('Completed', 'Awaiting Finalization')
  AND completed_at IS NOT NULL
  AND deleted_at IS NULL
GROUP BY DATE_TRUNC('month', completed_at)
ORDER BY month DESC;

-- ============================================
-- 6. Create most active forklifts view
-- ============================================
CREATE OR REPLACE VIEW most_active_forklifts AS
SELECT
  f.forklift_id,
  f.serial_number,
  f.make,
  f.model,
  COUNT(j.job_id) as job_count,
  SUM(EXTRACT(EPOCH FROM (j.repair_end_time - j.repair_start_time)) / 3600) as total_hours
FROM forklifts f
LEFT JOIN jobs j ON f.forklift_id = j.forklift_id
  AND j.status IN ('Completed', 'Awaiting Finalization')
  AND j.deleted_at IS NULL
  AND j.completed_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY f.forklift_id, f.serial_number, f.make, f.model
ORDER BY job_count DESC
LIMIT 10;

-- ============================================
-- 7. Migrate legacy statuses to new ones
-- ============================================
-- Update Active to Available
UPDATE forklifts
SET status = 'Available'
WHERE status = 'Active';

-- Update Under Maintenance to In Service
UPDATE forklifts
SET status = 'In Service'
WHERE status = 'Under Maintenance';

-- Update Inactive to Out of Service
UPDATE forklifts
SET status = 'Out of Service'
WHERE status = 'Inactive';

-- ============================================
-- 8. Create function to get fleet dashboard metrics
-- ============================================
CREATE OR REPLACE FUNCTION get_fleet_dashboard_metrics()
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_fleet_count', total_fleet_count,
    'units_by_status', jsonb_build_object(
      'available', available_count,
      'rented_out', rented_out_count,
      'in_service', in_service_count,
      'service_due', service_due_count,
      'awaiting_parts', awaiting_parts_count,
      'out_of_service', out_of_service_count,
      'reserved', reserved_count
    ),
    'service_due_this_week', service_due_this_week,
    'jobs_completed_this_month', (
      SELECT COALESCE(jobs_completed, 0)
      FROM jobs_monthly_summary
      WHERE month = DATE_TRUNC('month', CURRENT_DATE)
    ),
    'average_job_duration_hours', (
      SELECT COALESCE(avg_duration_hours, 0)
      FROM jobs_monthly_summary
      WHERE month = DATE_TRUNC('month', CURRENT_DATE)
    )
  ) INTO v_result
  FROM fleet_dashboard_summary;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROLLBACK COMMANDS (if needed):
-- ============================================
-- DROP FUNCTION IF EXISTS get_fleet_dashboard_metrics();
-- DROP VIEW IF EXISTS most_active_forklifts;
-- DROP VIEW IF EXISTS jobs_monthly_summary;
-- DROP VIEW IF EXISTS fleet_dashboard_summary;
-- DROP TRIGGER IF EXISTS trigger_update_forklift_status ON jobs;
-- DROP FUNCTION IF EXISTS update_forklift_status_from_job();
-- ALTER TABLE jobs DROP COLUMN IF EXISTS awaiting_parts_reason;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS awaiting_parts_since;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS awaiting_parts;
-- ALTER TABLE forklifts DROP CONSTRAINT IF EXISTS forklifts_status_check;

COMMIT;
