-- Migration: KPI Engine Phase 2 — Security hardening
-- Date: 2026-05-03
--
-- Background: The Phase 2 transfer-clone shipped with permissive RLS
-- matching FT's existing pattern (auth.uid() IS NOT NULL). Subsequent
-- security review surfaced 4 BLOCKING issues that turn the KPI engine into
-- a self-service bonus dispenser:
--   B1. Any tech can UPDATE jobs.transfer_override_pts to 5 → +5 KPI pts.
--   B2. Any tech can INSERT a clone with arbitrary parent_job_id → forge
--       TRANSFERRED events on a victim's job.
--   B3. Any tech can UPSERT kpi_monthly_snapshots → overwrite their own
--       (or anyone's) frozen snapshot.
--   B4. (Pre-existing) jobTransferService trusts client-supplied actorId —
--       not addressed at DB layer; the trigger here ensures only admins can
--       even reach the DB write paths that matter (B1/B2).
-- Plus 2 SHOULD-FIX from FT-review:
--   S1. employee_leaves has no constraint enforcing is_half_day → single
--       day, leaving a foothold for KPI inflation if a stale row exists.
--
-- Pre-flight (verified 2026-05-03 on prod):
--   * 0 employee_leaves rows violate the half-day single-day invariant.
--   * 0 jobs have parent_job_id or transfer_override_pts set (Phase 2
--     hasn't been used yet — safe to add the new constraints).
--   * No active production users have the role enums removed below; FT
--     uses lowercase role values: admin, admin_service, admin_store,
--     supervisor, technician, accountant.

BEGIN;

-- ============================================
-- 1. Helper: STABLE predicate for admin/supervisor authority
--    SECURITY DEFINER so the function bypasses users RLS — needed because
--    the function is called from RLS policies on other tables.
-- ============================================
CREATE OR REPLACE FUNCTION public.is_admin_or_supervisor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
      AND role IN ('admin', 'admin_service', 'admin_store', 'supervisor')
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin_or_supervisor() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_or_supervisor() TO authenticated;

COMMENT ON FUNCTION public.is_admin_or_supervisor() IS
  'KPI Engine Phase 2 hardening: returns TRUE when the calling auth.uid() corresponds to a users row with admin/admin_service/admin_store/supervisor role. Used by RLS policies + BEFORE-write triggers. SECURITY DEFINER bypasses users RLS so the function works regardless of the caller''s read access on the users table.';

-- ============================================
-- 2. Trigger: protect jobs.transfer_override_pts (B1)
--    Block any UPDATE that changes this column from a non-admin actor.
-- ============================================
CREATE OR REPLACE FUNCTION public.protect_transfer_override_pts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.transfer_override_pts IS DISTINCT FROM OLD.transfer_override_pts THEN
    IF NOT public.is_admin_or_supervisor() THEN
      RAISE EXCEPTION 'Only admin or supervisor can set transfer_override_pts (got role=%)',
        (SELECT role FROM public.users WHERE auth_id = auth.uid());
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_transfer_override_pts ON public.jobs;
CREATE TRIGGER trg_protect_transfer_override_pts
  BEFORE UPDATE OF transfer_override_pts ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_transfer_override_pts();

-- ============================================
-- 3. Trigger: protect clone INSERT (B2)
--    Block INSERTs with parent_job_id set unless caller is admin/supervisor.
--    Also enforce spec invariants:
--      a. parent_job_id != job_id (no self-loop)
--      b. parent must itself have parent_job_id IS NULL (clone always
--         points to the un-suffixed root original, never to an
--         intermediate clone — KPI_SPEC §3.2)
-- ============================================
CREATE OR REPLACE FUNCTION public.protect_clone_creation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_has_grandparent boolean;
BEGIN
  IF NEW.parent_job_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT public.is_admin_or_supervisor() THEN
    RAISE EXCEPTION 'Only admin or supervisor can create cloned jobs (parent_job_id set)';
  END IF;

  IF NEW.parent_job_id = NEW.job_id THEN
    RAISE EXCEPTION 'parent_job_id must not equal job_id (self-loop)';
  END IF;

  SELECT (parent_job_id IS NOT NULL) INTO parent_has_grandparent
    FROM public.jobs WHERE job_id = NEW.parent_job_id;

  IF parent_has_grandparent IS NULL THEN
    RAISE EXCEPTION 'parent_job_id % does not exist', NEW.parent_job_id;
  END IF;

  IF parent_has_grandparent THEN
    RAISE EXCEPTION 'parent_job_id must point to the root original, not an intermediate clone (spec invariant)';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_clone_creation ON public.jobs;
CREATE TRIGGER trg_protect_clone_creation
  BEFORE INSERT ON public.jobs
  FOR EACH ROW
  WHEN (NEW.parent_job_id IS NOT NULL)
  EXECUTE FUNCTION public.protect_clone_creation();

-- ============================================
-- 4. RLS rewrite for kpi_monthly_snapshots (B3)
--    Replace the permissive policy with:
--      SELECT: tech sees own row + admin/supervisor sees all
--      INSERT/UPDATE/DELETE: admin/supervisor only
-- ============================================
DROP POLICY IF EXISTS kpi_snapshots_auth_all ON public.kpi_monthly_snapshots;

CREATE POLICY kpi_snapshots_select_own_or_admin
  ON public.kpi_monthly_snapshots
  FOR SELECT
  TO authenticated
  USING (
    technician_id = (SELECT user_id FROM public.users WHERE auth_id = auth.uid())
    OR public.is_admin_or_supervisor()
  );

CREATE POLICY kpi_snapshots_insert_admin
  ON public.kpi_monthly_snapshots
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_supervisor());

CREATE POLICY kpi_snapshots_update_admin
  ON public.kpi_monthly_snapshots
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_supervisor())
  WITH CHECK (public.is_admin_or_supervisor());

CREATE POLICY kpi_snapshots_delete_admin
  ON public.kpi_monthly_snapshots
  FOR DELETE
  TO authenticated
  USING (public.is_admin_or_supervisor());

-- ============================================
-- 5. employee_leaves: enforce half-day single-day invariant (S1)
--    Pre-flight: 0 existing rows violate this.
-- ============================================
ALTER TABLE public.employee_leaves
  DROP CONSTRAINT IF EXISTS chk_half_day_single_day;
ALTER TABLE public.employee_leaves
  ADD CONSTRAINT chk_half_day_single_day
  CHECK (NOT is_half_day OR start_date = end_date);

COMMENT ON CONSTRAINT chk_half_day_single_day ON public.employee_leaves IS
  'KPI Engine Phase 2 hardening (S1): half-day leaves must span exactly one day. Without this, computeOverlapDays in services/kpiService.ts could over-count attendance for stale multi-day half-day rows, inflating the tech''s KPI score.';

COMMIT;

-- ============================================
-- Post-apply verification
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname='is_admin_or_supervisor') THEN
    RAISE EXCEPTION 'is_admin_or_supervisor() not created';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_protect_transfer_override_pts') THEN
    RAISE EXCEPTION 'trg_protect_transfer_override_pts not created';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_protect_clone_creation') THEN
    RAISE EXCEPTION 'trg_protect_clone_creation not created';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='kpi_monthly_snapshots' AND policyname='kpi_snapshots_select_own_or_admin') THEN
    RAISE EXCEPTION 'kpi_snapshots SELECT policy not created';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='kpi_monthly_snapshots' AND policyname='kpi_snapshots_insert_admin') THEN
    RAISE EXCEPTION 'kpi_snapshots INSERT policy not created';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename='kpi_monthly_snapshots' AND policyname='kpi_snapshots_auth_all') THEN
    RAISE EXCEPTION 'old permissive kpi_snapshots policy was not dropped';
  END IF;
  RAISE NOTICE 'KPI Phase 2 hardening migration applied successfully';
END $$;
