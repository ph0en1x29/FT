-- ==========================================================================
-- CUSTOMER FEEDBACK IMPLEMENTATION MIGRATION
-- Date: 2026-01-19
-- Description: Database changes for customer feedback implementation
-- ==========================================================================

-- ==========================================================================
-- 1. HOURMETER PERSISTENCE TRACKING
-- Tracks the first technician to record hourmeter on a job
-- ==========================================================================

-- Add columns for tracking first hourmeter recorder
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS first_hourmeter_recorded_by_id UUID REFERENCES users(user_id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS first_hourmeter_recorded_by_name TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS first_hourmeter_recorded_at TIMESTAMPTZ;

-- Create index for hourmeter tracking queries
CREATE INDEX IF NOT EXISTS idx_jobs_first_hourmeter_recorded_by
  ON jobs(first_hourmeter_recorded_by_id)
  WHERE first_hourmeter_recorded_by_id IS NOT NULL;

COMMENT ON COLUMN jobs.first_hourmeter_recorded_by_id IS 'User ID of the technician who first recorded hourmeter';
COMMENT ON COLUMN jobs.first_hourmeter_recorded_by_name IS 'Name of the technician who first recorded hourmeter';
COMMENT ON COLUMN jobs.first_hourmeter_recorded_at IS 'Timestamp when hourmeter was first recorded';


-- ==========================================================================
-- 2. PARTS CONFIRMATION ENFORCEMENT TRIGGER
-- Prevents job finalization if parts are used but not confirmed by Admin 2 (Store)
-- ==========================================================================

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS enforce_parts_confirmation ON jobs;
DROP FUNCTION IF EXISTS check_parts_confirmed_before_job_complete();

-- Create enforcement function
CREATE OR REPLACE FUNCTION check_parts_confirmed_before_job_complete()
RETURNS TRIGGER AS $$
BEGIN
  -- Only check when job is being marked as confirmed/completed
  IF NEW.job_confirmed_at IS NOT NULL AND OLD.job_confirmed_at IS NULL THEN
    -- Check if job has parts that need confirmation
    IF EXISTS (SELECT 1 FROM job_parts WHERE job_id = NEW.job_id)
       AND NEW.parts_confirmed_at IS NULL
       AND NEW.parts_confirmation_skipped IS NOT TRUE THEN
      RAISE EXCEPTION 'Parts must be confirmed by Admin 2 (Store) before job can be finalized. Parts verification pending.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger
CREATE TRIGGER enforce_parts_confirmation
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION check_parts_confirmed_before_job_complete();

COMMENT ON FUNCTION check_parts_confirmed_before_job_complete() IS
  'Ensures parts are confirmed by Admin 2 (Store) before job finalization';


-- ==========================================================================
-- 3. RLS POLICY FOR REQUEST EDITS
-- Allows technicians to update their own pending requests
-- ==========================================================================

-- Drop existing policy if it exists
DROP POLICY IF EXISTS job_requests_tech_update ON job_requests;

-- Create policy for technicians to update their own pending requests
CREATE POLICY job_requests_tech_update ON job_requests
  FOR UPDATE USING (
    -- Must be the original requester
    requested_by IN (SELECT user_id FROM users WHERE auth_id = auth.uid())
    -- Only pending requests can be edited
    AND status = 'pending'
  )
  WITH CHECK (
    -- Cannot change request ownership
    requested_by IN (SELECT user_id FROM users WHERE auth_id = auth.uid())
    -- Cannot change status through this policy
    AND status = 'pending'
  );

COMMENT ON POLICY job_requests_tech_update ON job_requests IS
  'Allows technicians to edit their own pending requests only';


-- ==========================================================================
-- 4. CHECKLIST STATE SUPPORT
-- Update jobs table to support new checklist state format (ok/not_ok)
-- Note: JSONB columns already support dynamic structure, no schema change needed
-- This comment documents the expected structure change:
-- Previous: { "item1": true, "item2": false }
-- New: { "item1": "ok", "item2": "not_ok", "item3": undefined }
-- ==========================================================================

COMMENT ON COLUMN jobs.condition_checklist IS
  'Condition checklist with binary states: "ok", "not_ok", or undefined. Supports backward compatibility with boolean values.';


-- ==========================================================================
-- 5. NOTIFICATION INDEXES FOR REAL-TIME PERFORMANCE
-- Optimize notification queries for dashboard display
-- ==========================================================================

-- Index for unread notifications by user
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, is_read)
  WHERE is_read = FALSE;

-- Index for recent notifications
CREATE INDEX IF NOT EXISTS idx_notifications_created_at
  ON notifications(user_id, created_at DESC);


-- ==========================================================================
-- VERIFICATION QUERIES
-- Run these after migration to verify success
-- ==========================================================================

-- Verify hourmeter columns exist
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'jobs' AND column_name LIKE 'first_hourmeter%';

-- Verify trigger exists
-- SELECT trigger_name FROM information_schema.triggers
-- WHERE trigger_name = 'enforce_parts_confirmation';

-- Verify RLS policy exists
-- SELECT policyname FROM pg_policies
-- WHERE tablename = 'job_requests' AND policyname = 'job_requests_tech_update';
