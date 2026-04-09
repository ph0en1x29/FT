-- 20260409_add_job_media_is_archived.sql
--
-- Adds an is_archived flag to job_media so the archival compression script
-- (scripts/archive-old-photos.mjs) can track which photos have already been
-- recompressed. Photos on completed jobs older than 30 days are eligible for
-- aggressive compression (1024px, 40% JPEG quality) to reclaim storage.

BEGIN;

ALTER TABLE public.job_media
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

-- Partial index: the archival script queries WHERE is_archived = false.
-- Once a photo is archived, it drops out of the index.
CREATE INDEX IF NOT EXISTS idx_job_media_archive_candidates
ON public.job_media (is_archived)
WHERE is_archived = false;

COMMENT ON COLUMN public.job_media.is_archived IS
  'True after the archival script has recompressed this photo to save storage. See scripts/archive-old-photos.mjs.';

-- Post-apply sanity check
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_media' AND column_name = 'is_archived'
  ) THEN
    RAISE EXCEPTION 'is_archived column not added to job_media';
  END IF;
END $$;

COMMIT;
