-- 20260409_increase_photo_bucket_limit.sql
--
-- Problem: technicians could not start jobs despite taking before-condition
-- photos because the `job-photos` storage bucket had a 5 MB file_size_limit.
-- Modern phone cameras produce 6-12 MB JPEGs at native resolution, so the
-- upload silently failed in Gate 2 of handleStartJobWithCondition, surfacing
-- as "Photo upload failed — Could not upload before photos. Job NOT started."
--
-- Fix: bump file_size_limit to 20 MB (safety net) and add HEIC/HEIF to
-- allowed_mime_types (iPhones). The client now also compresses photos before
-- upload (Canvas API, 2048px max, 75% JPEG quality → ~1-2 MB), so this
-- limit should rarely be hit.

BEGIN;

UPDATE storage.buckets
SET file_size_limit   = 20971520,                    -- 20 MB
    allowed_mime_types = ARRAY[
      'image/jpeg','image/png','image/webp','image/gif',
      'image/heic','image/heif'
    ]
WHERE id = 'job-photos';

-- Post-apply sanity check
DO $$
DECLARE
  lim BIGINT;
BEGIN
  SELECT file_size_limit INTO lim FROM storage.buckets WHERE id = 'job-photos';
  IF lim IS NULL OR lim < 20971520 THEN
    RAISE EXCEPTION 'job-photos bucket limit not updated (got %)', lim;
  END IF;
END $$;

COMMIT;
