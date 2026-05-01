-- ============================================================
-- Migration: ACWER Service Operations Flow — Phase 5 Recurring Scheduler
-- Date: 2026-05-01
-- Purpose: Materialise `recurring_schedules` rows into `scheduled_services`
--          rows ahead of `next_due_date - lead_time_days`. Daily pg_cron job.
--          Mirrors the existing `daily-service-check` pattern; runs at 00:30
--          UTC (08:30 MYT — start of admin's day) so generated schedules are
--          visible at the morning's first board check.
--
-- Behavioral impact: GENERATIVE. Each daily run inserts new
--   `scheduled_services` rows for fleet forklifts that have a
--   `recurring_schedules` row whose `next_due_date - lead_time_days` has been
--   reached. After Phase 0 the table is empty, so this migration is a no-op
--   the first time it runs; only after admin populates `recurring_schedules`
--   (Phase 5 UI / direct SQL) does it produce any rows.
--
-- Reversibility: ROLLBACK block at the bottom drops the cron schedule and
--   the function. Existing `scheduled_services` rows are untouched.
-- ============================================================

BEGIN;

-- ============================================================
-- 0. Backfill missing columns on scheduled_services that the existing
--    services/serviceScheduleService.ts already INSERTs into. Without
--    these the existing service is broken (any attempt to insert fails).
--    The generator below also writes to these.
-- ============================================================

ALTER TABLE scheduled_services
  ADD COLUMN IF NOT EXISTS service_type TEXT,
  ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'Medium',
  ADD COLUMN IF NOT EXISTS auto_create_job BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC,
  ADD COLUMN IF NOT EXISTS created_by_id UUID REFERENCES users(user_id),
  ADD COLUMN IF NOT EXISTS created_by_name TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

COMMENT ON COLUMN scheduled_services.service_type IS
  '**(NEW 2026-05-01 / Phase 5)** Human-readable service category. Backfilled — table previously had no service_type column despite the type expecting one.';

-- ============================================================
-- 1. Generator function — idempotent per (recurring_schedule, due_date)
-- ============================================================

DROP FUNCTION IF EXISTS acwer_generate_recurring_jobs();

CREATE OR REPLACE FUNCTION acwer_generate_recurring_jobs()
RETURNS TABLE (
  out_schedule_id UUID,
  out_scheduled_id UUID,
  out_forklift_id UUID,
  out_due_date DATE,
  out_service_type TEXT
) AS $$
DECLARE
  v_row recurring_schedules%ROWTYPE;
  v_new_scheduled_id UUID;
  v_service_type TEXT;
BEGIN
  FOR v_row IN
    SELECT * FROM recurring_schedules rs
    WHERE rs.is_active = TRUE
      AND rs.next_due_date IS NOT NULL
      AND (rs.next_due_date - INTERVAL '1 day' * rs.lead_time_days) <= CURRENT_DATE
      -- guard: don't double-fire for the same due_date
      AND (rs.last_generated_at IS NULL OR rs.last_generated_at::date < rs.next_due_date)
  LOOP
    -- Pick a service_type label — prefer the linked service_interval's name,
    -- fall back to a sensible default by frequency.
    SELECT si.name INTO v_service_type
      FROM service_intervals si
      WHERE si.interval_id = v_row.service_interval_id;
    IF v_service_type IS NULL THEN
      v_service_type := CASE v_row.frequency
        WHEN 'monthly'   THEN 'Monthly PM Service'
        WHEN 'quarterly' THEN 'Quarterly PM Service'
        WHEN 'yearly'    THEN 'Yearly PM Service'
        WHEN 'hourmeter' THEN 'Hourmeter PM Service'
      END;
    END IF;

    -- Skip if a scheduled_services row already exists for this forklift +
    -- due_date (manual creation, prior cron run, etc.) — protects against
    -- duplicate jobs even if the guard above somehow misses.
    IF EXISTS (
      SELECT 1 FROM scheduled_services ss
      WHERE ss.forklift_id = v_row.forklift_id
        AND ss.due_date = v_row.next_due_date
        AND ss.service_type = v_service_type
        AND ss.status NOT IN ('cancelled', 'completed')
    ) THEN
      -- Stamp last_generated_at so we don't keep re-checking
      UPDATE recurring_schedules rs
        SET last_generated_at = NOW()
        WHERE rs.schedule_id = v_row.schedule_id;
      CONTINUE;
    END IF;

    -- INSERT the scheduled_services row. auto_create_job=TRUE means existing
    -- daily-service-check / admin "create job from scheduled" surface will
    -- pick this up downstream.
    INSERT INTO scheduled_services (
      forklift_id, service_interval_id, service_type, due_date, due_hourmeter,
      priority, status, auto_create_job, notes
    ) VALUES (
      v_row.forklift_id, v_row.service_interval_id, v_service_type,
      v_row.next_due_date, v_row.next_due_hourmeter,
      'Medium', 'scheduled', TRUE,
      'Auto-generated from recurring schedule (' || v_row.frequency || ')'
    )
    RETURNING scheduled_services.scheduled_id INTO v_new_scheduled_id;

    -- Roll the recurrence window forward + stamp last_generated_at.
    UPDATE recurring_schedules rs
      SET last_generated_at = NOW(),
          next_due_date = CASE rs.frequency
            WHEN 'monthly'   THEN rs.next_due_date + INTERVAL '1 month'
            WHEN 'quarterly' THEN rs.next_due_date + INTERVAL '3 months'
            WHEN 'yearly'    THEN rs.next_due_date + INTERVAL '1 year'
            -- 'hourmeter' frequency is driven by the forklift's hourmeter
            -- reading, not by date — keep next_due_date as-is so the next
            -- cycle is decided by hourmeter triggers, not by us.
            ELSE rs.next_due_date
          END
      WHERE rs.schedule_id = v_row.schedule_id;

    -- Yield the row to the caller so admin tooling / tests can inspect what got created
    out_schedule_id := v_row.schedule_id;
    out_scheduled_id := v_new_scheduled_id;
    out_forklift_id := v_row.forklift_id;
    out_due_date := v_row.next_due_date;
    out_service_type := v_service_type;
    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION acwer_generate_recurring_jobs() IS
  'ACWER Phase 5: walks active recurring_schedules whose next_due_date - lead_time_days has been reached, creates a scheduled_services row, rolls next_due_date forward by frequency, and stamps last_generated_at. Idempotent — re-running same day is a no-op.';

-- ============================================================
-- 2. Schedule it via pg_cron — daily at 00:30 UTC (08:30 MYT)
-- ============================================================

-- Drop any existing scheduling first (idempotent re-application)
DO $$ BEGIN
  PERFORM cron.unschedule('acwer-recurring-schedule-generator');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'acwer-recurring-schedule-generator',
  '30 0 * * *',
  'SELECT * FROM acwer_generate_recurring_jobs();'
);

-- ============================================================
-- 3. Sanity check
-- ============================================================

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM pg_proc
    WHERE proname = 'acwer_generate_recurring_jobs';
  IF v_count = 0 THEN
    RAISE EXCEPTION 'Phase 5: acwer_generate_recurring_jobs function not created';
  END IF;

  SELECT COUNT(*) INTO v_count FROM cron.job
    WHERE jobname = 'acwer-recurring-schedule-generator';
  IF v_count = 0 THEN
    RAISE EXCEPTION 'Phase 5: cron job acwer-recurring-schedule-generator not scheduled';
  END IF;

  RAISE NOTICE 'Phase 5 recurring scheduler: function + cron job in place.';
END $$;

COMMIT;

-- ============================================================
-- ROLLBACK (run separately if needed)
-- ============================================================
-- BEGIN;
-- SELECT cron.unschedule('acwer-recurring-schedule-generator');
-- DROP FUNCTION IF EXISTS acwer_generate_recurring_jobs();
-- COMMIT;
