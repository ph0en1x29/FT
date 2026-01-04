-- Migration: Add category column to job_media table
-- Purpose: Enable photo categorization for ACWER workflow
-- Date: 2026-01-04
-- Environment: Production-safe, idempotent

-- Step 1: Add column (nullable first for safe migration)
ALTER TABLE job_media
ADD COLUMN IF NOT EXISTS category TEXT;

-- Step 2: Backfill existing rows
UPDATE job_media
SET category = 'other'
WHERE category IS NULL;

-- Step 3: Set default and NOT NULL constraint
ALTER TABLE job_media
ALTER COLUMN category SET DEFAULT 'other',
ALTER COLUMN category SET NOT NULL;

-- Step 4: Add CHECK constraint for valid values
-- Note: Use DO block for idempotency (skip if constraint exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'job_media_category_check'
  ) THEN
    ALTER TABLE job_media
    ADD CONSTRAINT job_media_category_check
    CHECK (category IN ('before','after','spare_part','condition','evidence','other'));
  END IF;
END $$;

-- Step 5: Add documentation
COMMENT ON COLUMN job_media.category IS
  'Photo category: before, after, spare_part, condition, evidence, other';

-- Step 6: Create index for filtering
CREATE INDEX IF NOT EXISTS idx_job_media_job_category
ON job_media(job_id, category);
