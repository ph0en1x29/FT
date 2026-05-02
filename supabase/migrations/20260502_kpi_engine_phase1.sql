-- Migration: KPI Engine Phase 1 — monthly snapshot table + status-history index
-- Date: 2026-05-02
--
-- Background: client KPI spec (KPI_SPEC.md) introduces a points + attendance
-- bonus engine producing a monthly score per technician. Phase 1 ships the
-- computation primitives (pure TS in utils/kpi/) plus a frozen snapshot table
-- so that bonus payouts reference an immutable monthly value rather than a
-- recomputed-on-load number that drifts as code changes.
--
-- Phase 1 scope:
--   * kpi_monthly_snapshots table: one row per (technician, year, month)
--   * Composite index on job_status_history(job_id, changed_at) to make the
--     session-derivation read efficient per job
--
-- Out of scope (defer to Phase 2):
--   * Transfer-clone scheme (parent_job_id, -B/-C suffix)
--   * Pro-rata Assistance splitting beyond the existing lead+assistant pair
--   * New audit_event_type values (Phase 1 derives sessions from
--     job_status_history transitions which already exist)

BEGIN;

-- ============================================
-- 1. kpi_monthly_snapshots
-- ============================================
CREATE TABLE IF NOT EXISTS public.kpi_monthly_snapshots (
  snapshot_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id      uuid NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  year               int NOT NULL CHECK (year BETWEEN 2024 AND 2100),
  month              int NOT NULL CHECK (month BETWEEN 1 AND 12),
  job_points         int NOT NULL DEFAULT 0 CHECK (job_points >= 0),
  attendance_pct     numeric(5,2) NOT NULL DEFAULT 0 CHECK (attendance_pct BETWEEN 0 AND 100),
  bonus_points       int NOT NULL DEFAULT 0 CHECK (bonus_points IN (0, 20, 35)),
  tier               text NOT NULL CHECK (tier IN ('elite', 'steady', 'warning')),
  total_kpi_score    int NOT NULL DEFAULT 0,
  red_flag           boolean NOT NULL DEFAULT false,
  working_days       int CHECK (working_days IS NULL OR working_days >= 0),
  net_expected_days  int CHECK (net_expected_days IS NULL OR net_expected_days >= 0),
  actual_days_worked int CHECK (actual_days_worked IS NULL OR actual_days_worked >= 0),
  computed_at        timestamptz NOT NULL DEFAULT now(),
  computed_by        uuid REFERENCES public.users(user_id),
  notes              text,
  UNIQUE (technician_id, year, month)
);

COMMENT ON TABLE public.kpi_monthly_snapshots IS
  'Frozen monthly KPI snapshot per technician. Immutable record for bonus calc; recompute only via explicit admin action that overwrites the row.';

CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_tech_period
  ON public.kpi_monthly_snapshots(technician_id, year DESC, month DESC);

CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_period
  ON public.kpi_monthly_snapshots(year DESC, month DESC);

ALTER TABLE public.kpi_monthly_snapshots ENABLE ROW LEVEL SECURITY;

-- Match FT's permissive RLS pattern (gating happens at the app layer; same as
-- jobs and employee_leaves). If finer-grained access is needed later,
-- replace these policies in a follow-up migration.
DROP POLICY IF EXISTS kpi_snapshots_auth_all ON public.kpi_monthly_snapshots;
CREATE POLICY kpi_snapshots_auth_all ON public.kpi_monthly_snapshots
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================
-- 2. Composite index on job_status_history for session derivation
-- ============================================
-- Existing indexes are on (job_id) and (changed_at DESC) separately. The KPI
-- session reader does `WHERE job_id = $1 ORDER BY changed_at` per job — a
-- composite (job_id, changed_at) index is the right shape and lets the
-- planner avoid a sort.
CREATE INDEX IF NOT EXISTS idx_jsh_job_changed_at
  ON public.job_status_history(job_id, changed_at);

COMMIT;

-- ============================================
-- Sanity check (informational; trips a notice if the table didn't land)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'kpi_monthly_snapshots'
  ) THEN
    RAISE EXCEPTION 'kpi_monthly_snapshots was not created';
  END IF;
  RAISE NOTICE 'KPI Phase 1 migration applied successfully';
END $$;
