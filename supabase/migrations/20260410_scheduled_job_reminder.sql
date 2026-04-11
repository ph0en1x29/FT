-- Scheduled-job reminder — 7:30 AM Malaysia Time technician notification
--
-- Problem
-- -------
-- Admins can set a scheduled_date on a job (TIMESTAMPTZ, already existed on the
-- jobs table but was never consumed by anything). The 2026-04-10 release started
-- populating it from the Create Job form and added an admin-only "Change date"
-- control on the JobDetail page. We now need a scheduled dispatcher that:
--   1. Finds jobs whose scheduled_date has arrived.
--   2. Sends exactly one in-app notification to the assigned technician.
--   3. Does not double-send if the cron runs again.
--   4. Does not fire for unassigned jobs, deleted jobs, or jobs that have already
--      moved past the "unstarted" states (New/Assigned).
--
-- The Create Job form stores scheduled_date as "07:30 Malaysia Time on the picked
-- calendar day" using an ISO string with the +08:00 offset (see
-- components/DatePicker.ts::toMalaysia730ISO). That means the UTC column value
-- naturally lines up with the moment the notification should fire, and a cron
-- running every 5 minutes will pick it up within 5 minutes of 07:30 MYT.
--
-- An existing pg_cron job (escalation-checks, every 5 minutes, scheduled in
-- 20260211_escalation_cron.sql) invokes run_escalation_checks(). We hook into
-- that same function rather than creating a new cron entry, so there is one
-- dispatcher to operate and one place to audit timing.
--
-- Fix
-- ---
-- 1. Add jobs.scheduled_reminder_sent_at TIMESTAMPTZ — nullable. NULL = reminder
--    is still pending (or no schedule), NOT NULL = reminder has fired.
-- 2. New function send_scheduled_job_reminders() inserts notifications for
--    eligible jobs and stamps scheduled_reminder_sent_at = NOW(). A 24h lookback
--    guard prevents historical rows from burst-firing on the first cron tick
--    after deploy.
-- 3. Trigger trg_clear_scheduled_reminder_on_date_change resets
--    scheduled_reminder_sent_at whenever scheduled_date is rewritten, so a
--    rescheduled job re-arms cleanly. (Clearing it when the date is set to NULL
--    is harmless — the worker just ignores NULL dates.)
-- 4. run_escalation_checks() amended to call the new worker, returning its count
--    alongside the existing overdue + slot-in + no-response counts.
-- 5. No change to pg_cron — the existing escalation-checks schedule picks it up
--    via the new run_escalation_checks() body.

-- =====================================================================
-- 1. Column
-- =====================================================================

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS scheduled_reminder_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.jobs.scheduled_reminder_sent_at IS
  'Timestamp when the 7:30 AM Malaysia Time scheduled-job reminder was dispatched by send_scheduled_job_reminders(). NULL = not yet sent (or no schedule). Cleared by trg_clear_scheduled_reminder_on_date_change whenever scheduled_date is rewritten, so a rescheduled job re-arms.';

-- Index the eligibility predicate to keep the cron cheap. Partial index —
-- only rows awaiting a reminder take up space.
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_reminder_pending
  ON public.jobs (scheduled_date)
  WHERE scheduled_reminder_sent_at IS NULL
    AND scheduled_date IS NOT NULL;

-- =====================================================================
-- 2. Worker function — send reminders for jobs whose time has arrived
-- =====================================================================

CREATE OR REPLACE FUNCTION public.send_scheduled_job_reminders()
RETURNS INTEGER AS $$
DECLARE
  sent_count INTEGER := 0;
  job_record RECORD;
  tech_id UUID;
  notification_title TEXT;
  notification_message TEXT;
  -- 24 hour lookback so a freshly-deployed worker doesn't burst-send for
  -- schedules that silently lapsed while the worker didn't exist.
  LOOKBACK CONSTANT INTERVAL := INTERVAL '24 hours';
BEGIN
  FOR job_record IN
    SELECT
      j.job_id,
      j.title,
      j.description,
      j.status,
      j.assigned_technician_id,
      j.assigned_technician_name,
      j.scheduled_date,
      j.priority,
      j.job_type,
      c.name AS customer_name
      FROM jobs j
      LEFT JOIN customers c ON c.customer_id = j.customer_id
     WHERE j.deleted_at IS NULL
       AND j.scheduled_date IS NOT NULL
       AND j.scheduled_date <= NOW()
       AND j.scheduled_date > NOW() - LOOKBACK
       AND j.scheduled_reminder_sent_at IS NULL
       AND j.assigned_technician_id IS NOT NULL
       AND j.status IN ('New', 'Assigned')
  LOOP
    tech_id := job_record.assigned_technician_id;

    notification_title := '📅 Scheduled Job Today';
    notification_message :=
      COALESCE(job_record.title, LEFT(COALESCE(job_record.description, ''), 50))
      || CASE WHEN job_record.customer_name IS NOT NULL
              THEN ' — ' || job_record.customer_name
              ELSE ''
         END
      || ' is scheduled for today. Please review the job details and plan your route.';

    INSERT INTO notifications (
      user_id, type, title, message, reference_type, reference_id, priority
    ) VALUES (
      tech_id,
      'scheduled_job',
      notification_title,
      notification_message,
      'job',
      job_record.job_id,
      CASE
        WHEN job_record.priority = 'High' THEN 'high'
        WHEN job_record.priority = 'Urgent' THEN 'urgent'
        ELSE 'normal'
      END
    );

    UPDATE jobs
       SET scheduled_reminder_sent_at = NOW()
     WHERE job_id = job_record.job_id;

    sent_count := sent_count + 1;
  END LOOP;

  RETURN sent_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.send_scheduled_job_reminders() IS
  'Finds jobs with scheduled_date <= NOW() AND scheduled_reminder_sent_at IS NULL, inserts an in-app notification for the assigned technician, and stamps the sent flag. Called every 5 minutes by run_escalation_checks() via the existing escalation-checks pg_cron schedule. Safe to call manually for testing.';

-- =====================================================================
-- 3. Trigger — clear the sent flag when scheduled_date is rewritten,
--    so rescheduling a job re-arms the reminder for the new date.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.clear_scheduled_reminder_on_date_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.scheduled_date IS DISTINCT FROM OLD.scheduled_date THEN
    NEW.scheduled_reminder_sent_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clear_scheduled_reminder_on_date_change ON public.jobs;
CREATE TRIGGER trg_clear_scheduled_reminder_on_date_change
  BEFORE UPDATE OF scheduled_date ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_scheduled_reminder_on_date_change();

-- =====================================================================
-- 4. Hook the new worker into run_escalation_checks()
-- =====================================================================

CREATE OR REPLACE FUNCTION public.run_escalation_checks()
RETURNS TEXT AS $$
DECLARE
  overdue_count INTEGER;
  slotin_count INTEGER;
  response_count INTEGER;
  reminder_count INTEGER;
BEGIN
  overdue_count := escalate_overdue_jobs();
  slotin_count := escalate_slotin_sla();
  response_count := escalate_assignment_response();
  reminder_count := send_scheduled_job_reminders();
  RETURN 'Escalated: ' || overdue_count || ' overdue, '
         || slotin_count || ' slot-in SLA, '
         || response_count || ' no-response, '
         || reminder_count || ' scheduled reminders';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================
-- 5. Post-apply sanity checks
-- =====================================================================

DO $$
DECLARE
  col_exists BOOLEAN;
  fn_exists BOOLEAN;
  trg_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'jobs'
       AND column_name = 'scheduled_reminder_sent_at'
  ) INTO col_exists;

  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'send_scheduled_job_reminders'
  ) INTO fn_exists;

  SELECT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_clear_scheduled_reminder_on_date_change'
  ) INTO trg_exists;

  IF NOT col_exists THEN
    RAISE EXCEPTION 'Sanity check failed: scheduled_reminder_sent_at column was not created';
  END IF;
  IF NOT fn_exists THEN
    RAISE EXCEPTION 'Sanity check failed: send_scheduled_job_reminders() was not created';
  END IF;
  IF NOT trg_exists THEN
    RAISE EXCEPTION 'Sanity check failed: trg_clear_scheduled_reminder_on_date_change was not created';
  END IF;
END;
$$;
