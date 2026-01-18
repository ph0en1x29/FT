-- =============================================
-- Migration: Enhanced Escalation Tracking
-- Date: 2026-01-05
-- Purpose: Add acknowledgement and notes for escalated jobs
-- =============================================

-- Step 1: Add escalation tracking columns to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS escalation_acknowledged_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS escalation_acknowledged_by UUID REFERENCES users(user_id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS escalation_notes TEXT;

-- Step 2: Index for quick lookup of unacknowledged escalations
CREATE INDEX IF NOT EXISTS idx_jobs_unacknowledged_escalations 
ON jobs(escalation_triggered_at) 
WHERE escalation_triggered_at IS NOT NULL 
  AND escalation_acknowledged_at IS NULL;

-- Step 3: Comments
COMMENT ON COLUMN jobs.escalation_acknowledged_at IS 'When admin acknowledged the escalation';
COMMENT ON COLUMN jobs.escalation_acknowledged_by IS 'Which admin acknowledged the escalation';
COMMENT ON COLUMN jobs.escalation_notes IS 'Admin notes about the escalation (reason for delay, action taken)';
