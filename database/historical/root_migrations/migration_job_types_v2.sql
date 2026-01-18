-- Migration: Update Job Types (Remove Accident, Add Slot-In and Courier)
-- Run this in Supabase SQL Editor
-- Date: 2026-01-14

-- ============================================
-- 1. Convert existing Accident jobs to Repair
-- ============================================
UPDATE jobs
SET job_type = 'Repair'
WHERE job_type = 'Accident';

-- ============================================
-- 2. Drop old constraint and add new one
-- ============================================
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_job_type_check;

ALTER TABLE jobs
ADD CONSTRAINT jobs_job_type_check
CHECK (job_type IN ('Service', 'Repair', 'Checking', 'Slot-In', 'Courier'));

-- ============================================
-- 3. Add Slot-In specific tracking fields
-- ============================================
-- SLA tracking: Time from job creation to technician assignment + acknowledgement
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS sla_target_minutes INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS sla_met BOOLEAN,
ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS acknowledged_by_id UUID REFERENCES users(user_id),
ADD COLUMN IF NOT EXISTS acknowledged_by_name TEXT;

-- Slot-In to Repair conversion tracking
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS converted_from_job_id UUID REFERENCES jobs(job_id),
ADD COLUMN IF NOT EXISTS converted_to_job_id UUID REFERENCES jobs(job_id),
ADD COLUMN IF NOT EXISTS conversion_reason TEXT,
ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS converted_by_id UUID REFERENCES users(user_id),
ADD COLUMN IF NOT EXISTS converted_by_name TEXT;

-- ============================================
-- 4. Add Courier/Collection specific fields
-- ============================================
-- POD (Proof of Delivery) tracking
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS courier_type TEXT, -- 'delivery' or 'collection'
ADD COLUMN IF NOT EXISTS courier_items JSONB DEFAULT '[]'::jsonb, -- List of items
ADD COLUMN IF NOT EXISTS pod_photo_ids TEXT[], -- Photo IDs for POD
ADD COLUMN IF NOT EXISTS pod_timestamp TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS pod_notes TEXT;

-- Add constraint for courier_type
ALTER TABLE jobs
ADD CONSTRAINT jobs_courier_type_check
CHECK (courier_type IS NULL OR courier_type IN ('delivery', 'collection', 'both'));

-- ============================================
-- 5. Create function to calculate SLA status
-- ============================================
CREATE OR REPLACE FUNCTION calculate_slot_in_sla()
RETURNS TRIGGER AS $$
BEGIN
  -- Only for Slot-In jobs
  IF NEW.job_type = 'Slot-In' AND NEW.acknowledged_at IS NOT NULL AND NEW.sla_target_minutes IS NOT NULL THEN
    NEW.sla_met := (EXTRACT(EPOCH FROM (NEW.acknowledged_at - NEW.created_at)) / 60) <= NEW.sla_target_minutes;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_calculate_slot_in_sla ON jobs;
CREATE TRIGGER trigger_calculate_slot_in_sla
  BEFORE UPDATE ON jobs
  FOR EACH ROW
  WHEN (NEW.job_type = 'Slot-In')
  EXECUTE FUNCTION calculate_slot_in_sla();

-- ============================================
-- 6. Create index for SLA tracking
-- ============================================
CREATE INDEX IF NOT EXISTS idx_jobs_slot_in_sla
ON jobs(job_type, sla_met, created_at)
WHERE job_type = 'Slot-In';

CREATE INDEX IF NOT EXISTS idx_jobs_courier_type
ON jobs(courier_type)
WHERE job_type = 'Courier';

-- ============================================
-- 7. Create view for Slot-In SLA dashboard
-- ============================================
CREATE OR REPLACE VIEW slot_in_sla_metrics AS
SELECT
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as total_slot_in_jobs,
  COUNT(*) FILTER (WHERE sla_met = true) as jobs_within_sla,
  COUNT(*) FILTER (WHERE sla_met = false) as jobs_missed_sla,
  ROUND(
    (COUNT(*) FILTER (WHERE sla_met = true)::numeric / NULLIF(COUNT(*), 0) * 100), 2
  ) as sla_compliance_rate,
  AVG(EXTRACT(EPOCH FROM (acknowledged_at - created_at)) / 60) as avg_response_minutes
FROM jobs
WHERE job_type = 'Slot-In'
  AND acknowledged_at IS NOT NULL
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

-- ============================================
-- 8. Create job_type_change_requests table
-- ============================================
CREATE TABLE IF NOT EXISTS job_type_change_requests (
  request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
  original_type TEXT NOT NULL,
  requested_type TEXT NOT NULL,
  justification TEXT NOT NULL,

  -- Request tracking
  requested_by_id UUID NOT NULL REFERENCES users(user_id),
  requested_by_name TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Approval/Rejection
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by_id UUID REFERENCES users(user_id),
  reviewed_by_name TEXT,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for job type change requests
CREATE INDEX IF NOT EXISTS idx_job_type_change_requests_job_id
ON job_type_change_requests(job_id);

CREATE INDEX IF NOT EXISTS idx_job_type_change_requests_status
ON job_type_change_requests(status);

CREATE INDEX IF NOT EXISTS idx_job_type_change_requests_pending
ON job_type_change_requests(status, requested_at)
WHERE status = 'pending';

-- ============================================
-- 9. Create job_type_change_log table
-- ============================================
CREATE TABLE IF NOT EXISTS job_type_change_log (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
  old_type TEXT NOT NULL,
  new_type TEXT NOT NULL,
  change_reason TEXT NOT NULL,
  changed_by_id UUID NOT NULL REFERENCES users(user_id),
  changed_by_name TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by_id UUID REFERENCES users(user_id),
  approved_by_name TEXT
);

-- Create index for job type change log
CREATE INDEX IF NOT EXISTS idx_job_type_change_log_job_id
ON job_type_change_log(job_id);

-- ============================================
-- 10. Add notification type for job type changes
-- ============================================
-- (Notification types are usually handled in application code)

-- ============================================
-- 11. Add ownership field to forklifts table
-- ============================================
-- Ownership determines Van Stock approval requirements
ALTER TABLE forklifts
ADD COLUMN IF NOT EXISTS ownership TEXT DEFAULT 'company';

-- Add constraint for valid ownership values
ALTER TABLE forklifts
ADD CONSTRAINT forklifts_ownership_check
CHECK (ownership IN ('company', 'customer'));

-- Create index for ownership-based queries
CREATE INDEX IF NOT EXISTS idx_forklifts_ownership
ON forklifts(ownership);

-- ============================================
-- ROLLBACK COMMANDS (if needed):
-- ============================================
-- DROP VIEW IF EXISTS slot_in_sla_metrics;
-- DROP TRIGGER IF EXISTS trigger_calculate_slot_in_sla ON jobs;
-- DROP FUNCTION IF EXISTS calculate_slot_in_sla();
-- DROP INDEX IF EXISTS idx_jobs_slot_in_sla;
-- DROP INDEX IF EXISTS idx_jobs_courier_type;
-- ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_courier_type_check;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS sla_target_minutes;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS sla_met;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS acknowledged_at;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS acknowledged_by_id;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS acknowledged_by_name;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS converted_from_job_id;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS converted_to_job_id;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS conversion_reason;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS converted_at;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS converted_by_id;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS converted_by_name;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS courier_type;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS courier_items;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS pod_photo_ids;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS pod_timestamp;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS pod_notes;
-- ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_job_type_check;
-- ALTER TABLE jobs ADD CONSTRAINT jobs_job_type_check CHECK (job_type IN ('Service', 'Repair', 'Checking', 'Accident'));
-- UPDATE jobs SET job_type = 'Accident' WHERE converted_from_job_id IS NOT NULL; -- Partial rollback
-- ALTER TABLE forklifts DROP CONSTRAINT IF EXISTS forklifts_ownership_check;
-- ALTER TABLE forklifts DROP COLUMN IF EXISTS ownership;
-- DROP INDEX IF EXISTS idx_forklifts_ownership;
-- DROP TABLE IF EXISTS job_type_change_log;
-- DROP TABLE IF EXISTS job_type_change_requests;

COMMIT;
