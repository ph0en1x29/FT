-- 20260409_enforce_before_photo_on_start.sql
--
-- Problem: technicians were able to start jobs without any "before condition"
-- photos. The BT-RT job (JOB-260409-014, started 2026-04-09 03:32 UTC) was
-- found In Progress with zero job_media rows of category='before' — the only
-- 2 media rows were 'after' photos uploaded a minute later.
--
-- Root cause: the before-photo requirement was enforced only by a disabled
-- HTML button in StartJobModal (client-side React state), and the photo
-- upload ran AFTER the startJobWithCondition UPDATE had already committed
-- the status change to 'In Progress'. Any failure/navigation/bypass between
-- the status change and the upload loop left the job In Progress with no
-- before photos.
--
-- Fix (DB side): BEFORE UPDATE trigger on public.jobs that refuses to let
-- status transition from 'New' or 'Assigned' to 'In Progress' unless at
-- least one job_media row with category='before' already exists for that
-- job. This is the server-side half of Option A; the client-side half
-- (reorder: upload before photos first, THEN call startJobWithCondition)
-- is implemented in pages/JobDetail/hooks/useJobActions.ts in the same
-- session.
--
-- Defense in depth rationale: the DB trigger means no future client path,
-- direct PostgREST call, or Supabase Studio manual edit can start a job
-- without the photo — not just the one UI flow we know about today.

BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_before_photo_on_start()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only guard the specific transition into 'In Progress' from a pre-start state.
  -- Other transitions (e.g., In Progress -> Awaiting Finalization, reassign flows
  -- that toggle fields without changing status) are unaffected.
  IF NEW.status = 'In Progress'
     AND OLD.status IS DISTINCT FROM NEW.status
     AND OLD.status IN ('New', 'Assigned')
  THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.job_media
      WHERE job_id = NEW.job_id
        AND category = 'before'
    ) THEN
      RAISE EXCEPTION
        'Cannot start job %: at least one before condition photo is required.',
        NEW.job_number
        USING ERRCODE = 'P0001',
              HINT = 'Upload at least one job_media row with category=''before'' for this job before transitioning status to ''In Progress''.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_before_photo_on_start ON public.jobs;

CREATE TRIGGER trg_enforce_before_photo_on_start
  BEFORE UPDATE OF status ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_before_photo_on_start();

COMMENT ON FUNCTION public.enforce_before_photo_on_start IS
  'Refuses to transition jobs.status to ''In Progress'' from ''New''/''Assigned'' unless at least one job_media row with category=''before'' exists for the job. Defense in depth for the before-photo requirement (see 2026-04-09 WORK_LOG).';

-- Post-apply sanity check
DO $$
DECLARE
  fn_exists BOOLEAN;
  trg_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'enforce_before_photo_on_start'
  ) INTO fn_exists;
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_enforce_before_photo_on_start'
  ) INTO trg_exists;
  IF NOT fn_exists THEN RAISE EXCEPTION 'function enforce_before_photo_on_start not created'; END IF;
  IF NOT trg_exists THEN RAISE EXCEPTION 'trigger trg_enforce_before_photo_on_start not created'; END IF;
END $$;

COMMIT;
