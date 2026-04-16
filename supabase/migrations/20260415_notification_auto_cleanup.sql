-- =====================================================================
-- Migration: Auto-cleanup of read notifications after 30 days
-- Date: 2026-04-15
-- Author: Opus
--
-- Context
-- -------
-- Notifications currently accumulate forever. Admins requested that read
-- notifications be auto-deleted after 30 days to keep the system clean
-- while preserving a history window as a safety net.
--
-- Approach
-- --------
-- 1. New function cleanup_old_notifications() deletes read notifications
--    older than 30 days and returns the count deleted.
-- 2. Hook into run_escalation_checks() which runs every 5 minutes via
--    the existing pg_cron schedule. Cleanup runs on every tick but is
--    cheap (indexed scan on is_read + read_at).
-- =====================================================================

-- =====================================================================
-- 1. Cleanup function
-- =====================================================================

CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.notifications
   WHERE is_read = TRUE
     AND read_at < NOW() - INTERVAL '30 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public;

COMMENT ON FUNCTION public.cleanup_old_notifications() IS
  'Deletes read notifications older than 30 days. Called by run_escalation_checks() every 5 minutes via pg_cron. Safe to call manually.';

-- =====================================================================
-- 2. Hook into run_escalation_checks()
-- =====================================================================

CREATE OR REPLACE FUNCTION public.run_escalation_checks()
RETURNS TEXT AS $$
DECLARE
  overdue_count INTEGER;
  slotin_count INTEGER;
  response_count INTEGER;
  reminder_count INTEGER;
  cleanup_count INTEGER;
BEGIN
  overdue_count := escalate_overdue_jobs();
  slotin_count := escalate_slotin_sla();
  response_count := escalate_assignment_response();
  reminder_count := send_scheduled_job_reminders();
  cleanup_count := cleanup_old_notifications();
  RETURN 'Escalated: ' || overdue_count || ' overdue, '
         || slotin_count || ' slot-in SLA, '
         || response_count || ' no-response, '
         || reminder_count || ' scheduled reminders, '
         || cleanup_count || ' old notifications cleaned';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================
-- 3. Post-apply sanity check
-- =====================================================================

DO $$
DECLARE
  fn_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'cleanup_old_notifications'
  ) INTO fn_exists;

  IF NOT fn_exists THEN
    RAISE EXCEPTION 'cleanup_old_notifications() function did not land';
  END IF;

  -- Verify run_escalation_checks includes the new worker
  PERFORM public.run_escalation_checks();
  RAISE NOTICE 'Migration verified: cleanup_old_notifications() installed and hooked into run_escalation_checks()';
END;
$$;
