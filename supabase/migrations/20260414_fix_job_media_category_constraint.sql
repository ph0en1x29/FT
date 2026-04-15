-- Migration: Add 'rejection_proof' to job_media_category_check constraint
-- Purpose: Fix job rejection failure — rejectionPhotoUpload.ts inserts
--          category='rejection_proof' but the CHECK constraint didn't include it.
-- Date: 2026-04-14
-- Environment: Production-safe, idempotent

BEGIN;

-- Drop old constraint and recreate with 'rejection_proof' included
ALTER TABLE job_media DROP CONSTRAINT IF EXISTS job_media_category_check;

ALTER TABLE job_media
ADD CONSTRAINT job_media_category_check
CHECK (category IN ('before','after','spare_part','condition','evidence','other','rejection_proof'));

-- Update column comment to reflect new value
COMMENT ON COLUMN job_media.category IS
  'Photo category: before, after, spare_part, condition, evidence, other, rejection_proof';

COMMIT;
