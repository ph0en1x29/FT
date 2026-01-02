-- Migration: Add Job Type and Photo Upload Tracking
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. Add job_type column to jobs table
-- ============================================
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS job_type TEXT DEFAULT 'Service';

-- Add check constraint for valid job types
ALTER TABLE jobs
ADD CONSTRAINT jobs_job_type_check 
CHECK (job_type IN ('Service', 'Repair', 'Checking', 'Accident'));

-- ============================================
-- 2. Add upload tracking columns to job_media
-- ============================================
ALTER TABLE job_media
ADD COLUMN IF NOT EXISTS uploaded_by_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS uploaded_by_name TEXT;

-- ============================================
-- 3. Create index for faster job type filtering
-- ============================================
CREATE INDEX IF NOT EXISTS idx_jobs_job_type ON jobs(job_type);

-- ============================================
-- 4. Update existing jobs to have default job_type
-- ============================================
UPDATE jobs 
SET job_type = 'Service' 
WHERE job_type IS NULL;

-- ============================================
-- 5. Example: View jobs by type
-- ============================================
-- SELECT * FROM jobs WHERE job_type = 'Repair' ORDER BY created_at DESC;

-- ============================================
-- ROLLBACK COMMANDS (if needed):
-- ============================================
-- ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_job_type_check;
-- ALTER TABLE jobs DROP COLUMN IF EXISTS job_type;
-- ALTER TABLE job_media DROP COLUMN IF EXISTS uploaded_by_id;
-- ALTER TABLE job_media DROP COLUMN IF EXISTS uploaded_by_name;
-- DROP INDEX IF EXISTS idx_jobs_job_type;

COMMIT;
