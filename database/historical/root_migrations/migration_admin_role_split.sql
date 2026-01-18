-- Migration: Admin Role Split (Admin 1 Service + Admin 2 Store)
-- Run this in Supabase SQL Editor
-- Date: 2026-01-14

-- ============================================
-- 1. Update users table role constraint
-- ============================================
-- Drop existing constraint if any
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Add new constraint with additional admin roles
ALTER TABLE users
ADD CONSTRAINT users_role_check
CHECK (role IN ('admin', 'admin_service', 'admin_store', 'supervisor', 'technician', 'accountant'));

-- ============================================
-- 2. Add dual admin confirmation fields to jobs table
-- ============================================

-- Admin 2 (Store) - Parts confirmation
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS parts_confirmed_by_id UUID REFERENCES users(user_id),
ADD COLUMN IF NOT EXISTS parts_confirmed_by_name TEXT,
ADD COLUMN IF NOT EXISTS parts_confirmed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS parts_confirmation_notes TEXT,
ADD COLUMN IF NOT EXISTS parts_confirmation_skipped BOOLEAN DEFAULT FALSE;

-- Admin 1 (Service) - Job completion confirmation
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS job_confirmed_by_id UUID REFERENCES users(user_id),
ADD COLUMN IF NOT EXISTS job_confirmed_by_name TEXT,
ADD COLUMN IF NOT EXISTS job_confirmed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS job_confirmation_notes TEXT;

-- Escalation tracking
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS parts_escalated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS parts_escalated_to_id UUID REFERENCES users(user_id),
ADD COLUMN IF NOT EXISTS parts_escalated_to_name TEXT;

-- ============================================
-- 3. Create indexes for confirmation queries
-- ============================================
CREATE INDEX IF NOT EXISTS idx_jobs_parts_confirmation
ON jobs(parts_confirmed_at)
WHERE parts_confirmed_at IS NULL AND parts_confirmation_skipped = FALSE;

CREATE INDEX IF NOT EXISTS idx_jobs_job_confirmation
ON jobs(job_confirmed_at)
WHERE job_confirmed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_awaiting_parts_confirmation
ON jobs(status, parts_confirmed_at, created_at)
WHERE status = 'Awaiting Finalization' AND parts_confirmed_at IS NULL;

-- ============================================
-- 4. Create view for pending confirmations
-- ============================================
CREATE OR REPLACE VIEW pending_parts_confirmations AS
SELECT
  j.job_id,
  j.title,
  j.status,
  j.created_at,
  j.completed_at,
  j.assigned_technician_name,
  c.name as customer_name,
  f.serial_number as forklift_serial,
  COALESCE(
    (SELECT SUM(quantity) FROM job_parts WHERE job_id = j.job_id), 0
  ) as total_parts_used,
  EXTRACT(EPOCH FROM (NOW() - COALESCE(j.completed_at, j.created_at))) / 3600 as hours_since_completion,
  CASE
    WHEN EXTRACT(EPOCH FROM (NOW() - COALESCE(j.completed_at, j.created_at))) / 3600 > 24
    THEN TRUE
    ELSE FALSE
  END as needs_escalation
FROM jobs j
LEFT JOIN customers c ON j.customer_id = c.customer_id
LEFT JOIN forklifts f ON j.forklift_id = f.forklift_id
WHERE j.status = 'Awaiting Finalization'
  AND j.parts_confirmed_at IS NULL
  AND j.parts_confirmation_skipped = FALSE
  AND j.deleted_at IS NULL
ORDER BY hours_since_completion DESC;

-- ============================================
-- 5. Create function to auto-skip parts confirmation if no parts used
-- ============================================
CREATE OR REPLACE FUNCTION check_parts_confirmation_needed()
RETURNS TRIGGER AS $$
DECLARE
  parts_count INTEGER;
BEGIN
  -- Only check when status changes to Awaiting Finalization
  IF NEW.status = 'Awaiting Finalization' AND OLD.status != 'Awaiting Finalization' THEN
    -- Count parts used in this job
    SELECT COALESCE(SUM(quantity), 0) INTO parts_count
    FROM job_parts
    WHERE job_id = NEW.job_id;

    -- If no parts used, skip Admin 2 confirmation
    IF parts_count = 0 THEN
      NEW.parts_confirmation_skipped := TRUE;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_check_parts_confirmation ON jobs;
CREATE TRIGGER trigger_check_parts_confirmation
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION check_parts_confirmation_needed();

-- ============================================
-- 6. Create function to check 24-hour escalation
-- ============================================
CREATE OR REPLACE FUNCTION escalate_pending_confirmations()
RETURNS INTEGER AS $$
DECLARE
  escalated_count INTEGER := 0;
  supervisor_id UUID;
  supervisor_name TEXT;
BEGIN
  -- Get first available supervisor
  SELECT user_id, name INTO supervisor_id, supervisor_name
  FROM users
  WHERE role = 'supervisor' AND is_active = TRUE
  LIMIT 1;

  -- Escalate jobs pending > 24 hours
  UPDATE jobs
  SET
    parts_escalated_at = NOW(),
    parts_escalated_to_id = supervisor_id,
    parts_escalated_to_name = supervisor_name
  WHERE status = 'Awaiting Finalization'
    AND parts_confirmed_at IS NULL
    AND parts_confirmation_skipped = FALSE
    AND parts_escalated_at IS NULL
    AND EXTRACT(EPOCH FROM (NOW() - COALESCE(completed_at, created_at))) / 3600 > 24;

  GET DIAGNOSTICS escalated_count = ROW_COUNT;

  RETURN escalated_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. Add notification types for admin workflow
-- ============================================
-- (Handled in application code - NotificationType enum)

-- ============================================
-- 8. Create helper function to check admin type
-- ============================================
CREATE OR REPLACE FUNCTION is_admin_type(user_role TEXT, admin_type TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- 'admin' role can act as either admin type
  IF user_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  -- Specific admin roles
  IF admin_type = 'service' AND user_role = 'admin_service' THEN
    RETURN TRUE;
  END IF;

  IF admin_type = 'store' AND user_role = 'admin_store' THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROLLBACK COMMANDS (if needed):
-- ============================================
-- DROP FUNCTION IF EXISTS is_admin_type(TEXT, TEXT);
-- DROP FUNCTION IF EXISTS escalate_pending_confirmations();
-- DROP FUNCTION IF EXISTS check_parts_confirmation_needed();
-- DROP TRIGGER IF EXISTS trigger_check_parts_confirmation ON jobs;
-- DROP VIEW IF EXISTS pending_parts_confirmations;
-- DROP INDEX IF EXISTS idx_jobs_awaiting_parts_confirmation;
-- DROP INDEX IF EXISTS idx_jobs_job_confirmation;
-- DROP INDEX IF EXISTS idx_jobs_parts_confirmation;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS parts_escalated_to_name;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS parts_escalated_to_id;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS parts_escalated_at;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS job_confirmation_notes;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS job_confirmed_at;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS job_confirmed_by_name;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS job_confirmed_by_id;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS parts_confirmation_skipped;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS parts_confirmation_notes;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS parts_confirmed_at;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS parts_confirmed_by_name;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS parts_confirmed_by_id;
-- ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
-- ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'supervisor', 'technician', 'accountant'));

COMMIT;
