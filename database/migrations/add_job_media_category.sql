-- Migration: Add category column to job_media table
-- Purpose: Enable photo categorization for ACWER workflow
-- Date: 2026-01-04

-- Add category column with allowed values
ALTER TABLE job_media 
ADD COLUMN IF NOT EXISTS category TEXT 
CHECK (category IN ('before', 'after', 'spare_part', 'condition', 'evidence', 'other'));

-- Set default category for existing records
UPDATE job_media 
SET category = 'other' 
WHERE category IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN job_media.category IS 'Photo category: before, after, spare_part, condition, evidence, other';

-- Create index for filtering by category
CREATE INDEX IF NOT EXISTS idx_job_media_category ON job_media(category);
CREATE INDEX IF NOT EXISTS idx_job_media_job_category ON job_media(job_id, category);
