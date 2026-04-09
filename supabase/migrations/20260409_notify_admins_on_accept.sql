-- 20260409_notify_admins_on_accept.sql
--
-- Problem: the technician-accept flow was taking 1.5-3 seconds because the
-- client-side `acceptJobAssignment` sequentially (a) fetched admin+supervisor
-- users, (b) ran a 5-minute dedup COUNT per admin, (c) inserted a notification
-- per admin — all serialized with `await` inside a `for` loop — and finally
-- the JobBoard page did a full refetch of every job with every embed. The
-- user felt this as "the whole FT page is slow after accept".
--
-- Fix (the DB side): move admin-notification fan-out into a Postgres trigger
-- that fires when jobs.technician_accepted_at transitions from NULL to NOT
-- NULL. Zero client round-trips, fans out inside the same transaction as the
-- accept UPDATE, no dedup race. The client side drops its notification loop.
--
-- Safety: AFTER UPDATE, only fires when the transition is NULL -> NOT NULL
-- (so reassignments and repeat writes don't retrigger). Inserts into
-- notifications via a single INSERT ... SELECT from users, which is atomic
-- and indexed. The trigger uses SECURITY DEFINER so it can bypass RLS on
-- the users table for the admin lookup — the inserted notifications are
-- still RLS-checked on read by each user's own policy.

BEGIN;

CREATE OR REPLACE FUNCTION public.notify_admins_on_job_accept()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only act on NULL -> NOT NULL transition of technician_accepted_at
  IF NEW.technician_accepted_at IS NOT NULL
     AND (OLD.technician_accepted_at IS NULL OR OLD.technician_accepted_at IS DISTINCT FROM NEW.technician_accepted_at)
     AND OLD.technician_accepted_at IS NULL
  THEN
    INSERT INTO public.notifications
      (user_id, type, title, message, reference_type, reference_id, priority)
    SELECT
      u.user_id,
      'job_updated',
      'Job Accepted',
      COALESCE(NEW.assigned_technician_name, 'Technician') || ' accepted job "' || COALESCE(NEW.title, '') || '".',
      'job',
      NEW.job_id,
      'normal'
    FROM public.users u
    WHERE u.role IN ('admin', 'supervisor')
      AND u.is_active = TRUE;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admins_on_accept ON public.jobs;

CREATE TRIGGER trg_notify_admins_on_accept
  AFTER UPDATE OF technician_accepted_at ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admins_on_job_accept();

COMMENT ON FUNCTION public.notify_admins_on_job_accept IS
  'Fans out admin/supervisor notifications when a technician accepts an assigned job. Replaces the client-side sequential loop in acceptJobAssignment for performance (see 2026-04-09 WORK_LOG).';

-- Post-apply sanity check
DO $$
DECLARE
  fn_exists BOOLEAN;
  trg_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'notify_admins_on_job_accept'
  ) INTO fn_exists;
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_notify_admins_on_accept'
  ) INTO trg_exists;
  IF NOT fn_exists THEN RAISE EXCEPTION 'function notify_admins_on_job_accept not created'; END IF;
  IF NOT trg_exists THEN RAISE EXCEPTION 'trigger trg_notify_admins_on_accept not created'; END IF;
END $$;

COMMIT;
