-- Migration: KPI Engine Phase 2 — Transfer/clone columns on jobs
-- Date: 2026-05-03
--
-- Background: Phase 1 (20260502_kpi_engine_phase1.sql) shipped the pure
-- computation primitives + monthly snapshot table. Phase 2 adds the Transfer
-- feature per KPI_SPEC.md §3.2: admin reassigns a job, system creates a clone
-- with `-B`/`-C` suffix, both linked via parent_job_id. Outgoing tech
-- normally gets 0 pts, optionally 5 with admin override.
--
-- Why these columns and not a triggered audit event:
--   * parent_job_id is needed for permanent linkage (clone shows source row
--     in its history; spec invariant: clone's parent is always the un-suffixed
--     original, never an intermediate clone — handled in service layer).
--   * transfer_override_pts is the per-incident override authority (we
--     decided per-transfer admin checkbox, not global config — see CHANGELOG
--     2026-05-03 KPI Engine Phase 1).
--   * No new audit_event_type values added; kpiService synthesizes
--     TimerEvents from job_status_history + parent_job_id + assignments at
--     read time.
--
-- The existing trg_generate_job_number trigger already has
-- `WHEN (new.job_number IS NULL)` so callers can pass explicit `-B` suffix
-- on INSERT without the auto-generator clobbering it. No function changes
-- needed.

BEGIN;

-- ============================================
-- 1. parent_job_id (FK to jobs, self-reference, ON DELETE SET NULL)
-- ============================================
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS parent_job_id uuid
    REFERENCES public.jobs(job_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.jobs.parent_job_id IS
  'KPI Engine Phase 2: when this row is a Transfer-clone (job_number suffix -B/-C/...), points to the un-suffixed original job. NULL for normal jobs and for the original job itself. Spec invariant: always points to the root original, never to an intermediate clone.';

-- ============================================
-- 2. transfer_override_pts (admin's per-transfer 0/5 decision)
-- ============================================
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS transfer_override_pts int
    CHECK (transfer_override_pts IS NULL OR transfer_override_pts IN (0, 5));

COMMENT ON COLUMN public.jobs.transfer_override_pts IS
  'KPI Engine Phase 2: set on the ORIGINAL row at transfer time. NULL means not transferred. 0 = outgoing tech gets no pts (default per spec §3.2). 5 = admin approved partial credit for initial labor. Read by services/kpiService.ts when computing the original tech''s award.';

-- ============================================
-- 3. Index for child-of-parent lookups
-- ============================================
CREATE INDEX IF NOT EXISTS idx_jobs_parent_job_id
  ON public.jobs(parent_job_id)
  WHERE parent_job_id IS NOT NULL;

-- ============================================
-- 4. Sanity check: no existing job_number ends in -X (would collide with
--    the new -B/-C scheme). This was verified live on 2026-05-03 (0 rows).
--    The check below makes the migration safe on any DB regardless.
-- ============================================
DO $$
DECLARE
  collision_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO collision_count
  FROM public.jobs
  WHERE job_number ~ '-[A-Z]$';

  IF collision_count > 0 THEN
    RAISE NOTICE 'WARNING: % existing jobs have a -X suffix in job_number. Phase 2 transfer suffix scheme may collide. Review before transferring any job.', collision_count;
  END IF;
END $$;

COMMIT;

-- ============================================
-- Post-apply verification (notice only, never aborts)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'jobs'
      AND column_name = 'parent_job_id'
  ) THEN
    RAISE EXCEPTION 'parent_job_id column was not created';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'jobs'
      AND column_name = 'transfer_override_pts'
  ) THEN
    RAISE EXCEPTION 'transfer_override_pts column was not created';
  END IF;
  RAISE NOTICE 'KPI Phase 2 migration applied successfully';
END $$;
