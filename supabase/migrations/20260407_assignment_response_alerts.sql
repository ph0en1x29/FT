-- 15-minute no-reply re-alert for technician job assignments
--
-- Problem
-- -------
-- When an admin assigns a job, the technician has 15 minutes to accept or reject.
-- If the technician doesn't respond, admins should be re-alerted on a schedule
-- so the assignment doesn't silently rot. Today there is no such mechanism:
--
--   1. jobs.technician_response_deadline column was declared on the TS Job type
--      but never created in the live DB (Phase 0 confirmed).
--   2. assignJob() never set the deadline (would have failed anyway).
--   3. The frontend countdown timer (getResponseTimeRemaining in
--      pages/JobDetail/utils.ts:21) always returned null.
--   4. checkExpiredJobResponses() in jobAssignmentCrudService.ts existed but
--      was never invoked from anywhere — no scheduler, no startup hook.
--
-- An existing pg_cron job (escalation-checks, every 5 minutes) calls
-- run_escalation_checks(), which currently only handles 24h-overdue jobs and
-- slot-in SLA breaches. We hook into that same function.
--
-- Fix
-- ---
-- 1. Add three columns: technician_response_deadline (the timer the frontend
--    already reads), last_response_alert_at (throttle so we re-fire at most
--    once per 15-min window), response_alert_count (cap so we don't nag
--    forever).
-- 2. Backfill technician_response_deadline for currently-assigned jobs.
-- 3. Backfill last_response_alert_at = NOW() for currently-stale jobs so they
--    don't burst-fire on the next cron tick.
-- 4. New trigger trg_set_response_deadline auto-populates the deadline column
--    whenever assigned_at is written. The JS service stays untouched —
--    assignment paths get the deadline for free via the trigger.
-- 5. New function escalate_assignment_response() finds eligible jobs and
--    inserts notifications for all admins/supervisors. Caps at MAX_ALERTS=4
--    iterations (1 hour total nagging window). Safety: 24h lookback so
--    historical stale assignments don't pollute the alert stream.
-- 6. run_escalation_checks() amended to also call the new worker, returning
--    its count alongside the existing overdue + slot-in counts.
-- 7. No change to pg_cron — the existing escalation-checks job picks it up
--    via the new run_escalation_checks() body.

-- =====================================================================
-- 1. Columns
-- =====================================================================

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS technician_response_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_response_alert_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS response_alert_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.jobs.technician_response_deadline IS
  'Deadline by which the assigned technician must accept or reject (assigned_at + 15 minutes). Auto-populated by trg_set_response_deadline.';
COMMENT ON COLUMN public.jobs.last_response_alert_at IS
  'Timestamp of the most recent no-response re-alert sent to admins. Used to throttle to once per 15-min window.';
COMMENT ON COLUMN public.jobs.response_alert_count IS
  'Number of no-response re-alerts already sent for this assignment. Capped at 4 (1 hour total nagging window).';

-- =====================================================================
-- 2. Backfill the deadline for currently-assigned jobs
-- =====================================================================

UPDATE public.jobs
   SET technician_response_deadline = assigned_at + INTERVAL '15 minutes'
 WHERE assigned_at IS NOT NULL
   AND technician_response_deadline IS NULL;

-- =====================================================================
-- 3. Suppress the burst on first cron tick by marking already-stale jobs
--    as "just alerted" — they'll re-alert at the next normal cadence
-- =====================================================================

UPDATE public.jobs
   SET last_response_alert_at = NOW()
 WHERE status = 'Assigned'
   AND assigned_at IS NOT NULL
   AND technician_accepted_at IS NULL
   AND technician_rejected_at IS NULL
   AND assigned_at < NOW() - INTERVAL '15 minutes'
   AND last_response_alert_at IS NULL;

-- =====================================================================
-- 4. Trigger to auto-populate the deadline when a job is assigned
-- =====================================================================

CREATE OR REPLACE FUNCTION public.set_technician_response_deadline()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set the deadline when assigned_at is being set or changed.
  IF NEW.assigned_at IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.assigned_at IS DISTINCT FROM NEW.assigned_at) THEN
    NEW.technician_response_deadline := NEW.assigned_at + INTERVAL '15 minutes';
    -- Reset the alert tracker on a fresh assignment.
    NEW.last_response_alert_at := NULL;
    NEW.response_alert_count := 0;
  ELSIF NEW.assigned_at IS NULL THEN
    -- Cleared assignment: clear the deadline too.
    NEW.technician_response_deadline := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_response_deadline ON public.jobs;
CREATE TRIGGER trg_set_response_deadline
  BEFORE INSERT OR UPDATE OF assigned_at ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_technician_response_deadline();

-- =====================================================================
-- 5. Escalation worker — runs every 5 min via existing escalation-checks cron
-- =====================================================================

CREATE OR REPLACE FUNCTION public.escalate_assignment_response()
RETURNS INTEGER AS $$
DECLARE
  alerted_count INTEGER := 0;
  job_record RECORD;
  admin_record RECORD;
  minutes_overdue INTEGER;
  next_iteration INTEGER;
  MAX_ALERTS CONSTANT INTEGER := 4;        -- 4 alerts = 1 hour total
  ALERT_INTERVAL CONSTANT INTERVAL := INTERVAL '15 minutes';
  LOOKBACK CONSTANT INTERVAL := INTERVAL '24 hours';
BEGIN
  FOR job_record IN
    SELECT job_id, title, description, assigned_technician_name, assigned_at,
           response_alert_count
      FROM jobs
     WHERE status = 'Assigned'
       AND deleted_at IS NULL
       AND assigned_at IS NOT NULL
       AND assigned_at > NOW() - LOOKBACK
       AND technician_accepted_at IS NULL
       AND technician_rejected_at IS NULL
       AND technician_response_deadline IS NOT NULL
       AND technician_response_deadline < NOW()
       AND COALESCE(response_alert_count, 0) < MAX_ALERTS
       AND (last_response_alert_at IS NULL
            OR last_response_alert_at < NOW() - ALERT_INTERVAL)
  LOOP
    next_iteration := COALESCE(job_record.response_alert_count, 0) + 1;
    minutes_overdue := EXTRACT(EPOCH FROM (NOW() - job_record.assigned_at)) / 60;

    UPDATE jobs
       SET last_response_alert_at = NOW(),
           response_alert_count = next_iteration
     WHERE job_id = job_record.job_id;

    FOR admin_record IN
      SELECT user_id FROM users
       WHERE role IN ('admin', 'admin_service', 'supervisor')
         AND is_active = true
    LOOP
      INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id, priority)
      VALUES (
        admin_record.user_id,
        'escalation',
        '⏰ No Response from Technician (' || next_iteration || '/' || MAX_ALERTS || ')',
        COALESCE(job_record.title, LEFT(job_record.description, 50))
          || ' assigned to ' || COALESCE(job_record.assigned_technician_name, 'Unassigned')
          || ' has been pending for ' || minutes_overdue || ' minutes without accept or reject.'
          || CASE WHEN next_iteration >= MAX_ALERTS
                  THEN ' This is the final automatic reminder — please reassign or contact the technician.'
                  ELSE ' Consider reassigning or checking on the technician.'
             END,
        'job',
        job_record.job_id,
        CASE WHEN next_iteration >= MAX_ALERTS THEN 'urgent' ELSE 'high' END
      );
    END LOOP;

    alerted_count := alerted_count + 1;
  END LOOP;

  RETURN alerted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================
-- 6. Hook the new worker into run_escalation_checks
-- =====================================================================

CREATE OR REPLACE FUNCTION public.run_escalation_checks()
RETURNS TEXT AS $$
DECLARE
  overdue_count INTEGER;
  slotin_count INTEGER;
  response_count INTEGER;
BEGIN
  overdue_count := escalate_overdue_jobs();
  slotin_count := escalate_slotin_sla();
  response_count := escalate_assignment_response();
  RETURN 'Escalated: ' || overdue_count || ' overdue, '
         || slotin_count || ' slot-in SLA, '
         || response_count || ' no-response';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
