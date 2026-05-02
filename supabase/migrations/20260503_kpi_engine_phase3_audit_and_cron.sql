-- Migration: KPI Engine Phase 3 — audit hardening + pg_cron month-end reminder
-- Date: 2026-05-03
--
-- Two additions to Phase 2:
--
--   3.1 Audit-override trigger on `jobs` — when a transfer happens (signaled
--       by `transfer_override_pts IS DISTINCT FROM OLD`), the trigger
--       overrides `reassigned_by_id` / `reassigned_by_name` with values
--       derived from `auth.uid()`. Closes the residual security-review B4
--       concern: an admin can no longer spoof another admin in the audit
--       log via the transfer flow. Scoped to transfers only — leaves
--       regular `reassignJob` (which doesn't touch transfer_override_pts)
--       untouched.
--
--   3.4 Month-end recompute reminder — a `kpi_recompute_pending` queue
--       table + a PL/pgSQL function that inserts a row for the previous
--       month + a pg_cron schedule that fires the function on the 1st of
--       each month at 1am UTC (9am MYT). The KpiScoreTab UI watches this
--       table and surfaces a banner when a row is unacknowledged. This is
--       a **reminder** pattern, not auto-recompute — porting the full
--       kpiService TS math to PL/pgSQL is a ~3h job with significant
--       correctness risk (Continue Tomorrow / Transfer / Assistance
--       interactions). The reminder pattern is honest: it tells the admin
--       "the new month is here, click Recompute" without trying to
--       silently get the math wrong.
--
-- Pre-flight: pg_cron 1.6.4 already installed; 3 existing cron jobs in FT
-- (escalation-checks, daily-service-check, acwer-recurring-schedule-generator).

BEGIN;

-- ============================================
-- 3.1 — Audit-override trigger on jobs
-- ============================================
CREATE OR REPLACE FUNCTION public.override_transfer_audit_actor()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  actor_user_id   uuid;
  actor_user_name text;
BEGIN
  -- Only override when this is a transfer event (transfer_override_pts
  -- changed). The other reassign flows don't touch this column so they're
  -- untouched.
  IF NEW.transfer_override_pts IS NOT DISTINCT FROM OLD.transfer_override_pts THEN
    RETURN NEW;
  END IF;

  SELECT user_id, name INTO actor_user_id, actor_user_name
    FROM public.users
   WHERE auth_id = auth.uid();

  -- If no matching user (shouldn't happen — protect_transfer_override_pts
  -- already verified caller is admin/supervisor), leave the client values
  -- alone rather than nulling them.
  IF actor_user_id IS NOT NULL THEN
    NEW.reassigned_by_id := actor_user_id;
    NEW.reassigned_by_name := actor_user_name;
    -- Also stamp reassigned_at if the caller didn't (defensive — the
    -- service does set it, but if a future flow forgets, this catches it).
    IF NEW.reassigned_at IS NULL THEN
      NEW.reassigned_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_override_transfer_audit_actor ON public.jobs;
CREATE TRIGGER trg_override_transfer_audit_actor
  BEFORE UPDATE OF transfer_override_pts ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.override_transfer_audit_actor();

COMMENT ON FUNCTION public.override_transfer_audit_actor() IS
  'KPI Engine Phase 3.1: server-side derivation of reassigned_by_id/name from auth.uid() during a transfer (signaled by transfer_override_pts change). Closes review B4 — an admin can no longer pass another admin''s actorId in the audit fields. Runs AFTER protect_transfer_override_pts (which already verified the caller is admin/supervisor).';

-- ============================================
-- 3.4 — Recompute reminder queue
-- ============================================
CREATE TABLE IF NOT EXISTS public.kpi_recompute_pending (
  pending_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year              int  NOT NULL CHECK (year BETWEEN 2024 AND 2100),
  month             int  NOT NULL CHECK (month BETWEEN 1 AND 12),
  queued_at         timestamptz NOT NULL DEFAULT now(),
  queued_by         text NOT NULL DEFAULT 'pg_cron',
  acknowledged_at   timestamptz,
  acknowledged_by   uuid REFERENCES public.users(user_id),
  UNIQUE (year, month)
);

COMMENT ON TABLE public.kpi_recompute_pending IS
  'KPI Engine Phase 3.4: queue of period reminders. pg_cron inserts a row on the 1st of each month for the previous month. KpiScoreTab shows a banner while acknowledged_at IS NULL. Admin clicks Recompute → service marks the row acknowledged. Not auto-recompute — see migration header for why.';

CREATE INDEX IF NOT EXISTS idx_kpi_pending_open
  ON public.kpi_recompute_pending(year, month)
  WHERE acknowledged_at IS NULL;

ALTER TABLE public.kpi_recompute_pending ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS kpi_pending_select ON public.kpi_recompute_pending;
CREATE POLICY kpi_pending_select
  ON public.kpi_recompute_pending
  FOR SELECT
  TO authenticated
  USING (public.is_admin_or_supervisor());

DROP POLICY IF EXISTS kpi_pending_update ON public.kpi_recompute_pending;
CREATE POLICY kpi_pending_update
  ON public.kpi_recompute_pending
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_supervisor())
  WITH CHECK (public.is_admin_or_supervisor());

-- Inserts come from pg_cron (privileged), no end-user INSERT policy needed.

-- ============================================
-- 3.4 — Cron function: queue last month's recompute
-- ============================================
CREATE OR REPLACE FUNCTION public.kpi_queue_last_month_recompute()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  last_month_first date;
BEGIN
  last_month_first := (date_trunc('month', now() AT TIME ZONE 'Asia/Kuala_Lumpur')::date - INTERVAL '1 month')::date;

  INSERT INTO public.kpi_recompute_pending (year, month, queued_at, queued_by)
  VALUES (
    EXTRACT(YEAR FROM last_month_first)::int,
    EXTRACT(MONTH FROM last_month_first)::int,
    now(),
    'pg_cron@1st-of-month'
  )
  ON CONFLICT (year, month) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.kpi_queue_last_month_recompute() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kpi_queue_last_month_recompute() TO postgres, authenticated;

COMMENT ON FUNCTION public.kpi_queue_last_month_recompute() IS
  'KPI Engine Phase 3.4: invoked by pg_cron on the 1st of each month at 1am UTC (9am MYT). Inserts a row into kpi_recompute_pending for the previous month. Idempotent via ON CONFLICT (year, month) DO NOTHING — re-runs are safe.';

-- ============================================
-- 3.4 — Schedule the cron job
-- ============================================
-- Remove any prior schedule of this job (idempotent migration replay).
SELECT cron.unschedule('kpi-month-end-reminder')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'kpi-month-end-reminder');

-- Schedule: 1am UTC = 9am MYT, on the 1st of every month.
SELECT cron.schedule(
  'kpi-month-end-reminder',
  '0 1 1 * *',
  $cron$ SELECT public.kpi_queue_last_month_recompute() $cron$
);

COMMIT;

-- ============================================
-- Post-apply verification
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_override_transfer_audit_actor') THEN
    RAISE EXCEPTION 'audit-override trigger not created';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='kpi_queue_last_month_recompute') THEN
    RAISE EXCEPTION 'kpi_queue_last_month_recompute() not created';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname='kpi-month-end-reminder') THEN
    RAISE EXCEPTION 'pg_cron job not scheduled';
  END IF;
  IF to_regclass('public.kpi_recompute_pending') IS NULL THEN
    RAISE EXCEPTION 'kpi_recompute_pending table not created';
  END IF;
  RAISE NOTICE 'KPI Phase 3 audit + cron migration applied successfully';
END $$;
