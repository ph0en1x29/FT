-- =====================================================================
-- One-off purge: hard-delete all jobs created before 2026-04-06
-- =====================================================================
--
-- Author: Opus, 2026-04-07
-- Approved scope: ALL 93 jobs in scope (Jay confirmed including 55 active
-- jobs — 42 Assigned + 13 In Progress — even though they may be in flight).
--
-- DESTRUCTIVE AND NOT REVERSIBLE. Run only after taking a backup. Run only
-- when no technicians are in the field, since this will pull active jobs
-- out from under them.
--
-- HOW TO RUN
-- ----------
-- 1. Take a Supabase backup (or `pg_dump --table=jobs --where="created_at
--    < '2026-04-06'"` from a workstation that has psql installed).
-- 2. Open the Supabase dashboard SQL editor (or psql via pooler).
-- 3. Paste this entire file in.
-- 4. The script wraps everything in a single BEGIN...COMMIT transaction.
--    To dry-run, change COMMIT to ROLLBACK at the bottom and re-run — all
--    the RAISE NOTICE counts will print but nothing will persist.
-- 5. Confirm the printed counts match the expected scope BEFORE running
--    the COMMIT version.
--
-- WHAT IT DOES
-- ------------
-- Phase 1: Create a temp table holding the in-scope job_ids for safety
--          and to keep every subquery consistent.
-- Phase 2: NULL out 10 NO ACTION foreign keys whose columns are nullable
--          (forklifts.last_service_job_id, jobs.converted_*, quotations,
--          scheduled_services, etc.). The dependent rows are preserved,
--          they just stop pointing at jobs that are about to vanish.
-- Phase 3: DELETE rows from 3 NO ACTION dependents whose FK columns are
--          NOT NULL (customer_acknowledgements, service_upgrade_logs,
--          van_stock_usage) — there is no way to preserve these without
--          changing the schema, so they go.
-- Phase 4: DELETE notifications referencing the in-scope jobs (these are
--          not FK-protected, but leaving them creates dangling references
--          in the UI).
-- Phase 5: DELETE FROM jobs. CASCADE handles ~16 dependent tables
--          automatically (job_parts, job_media, job_invoices,
--          job_assignments, job_audit_log, job_status_history, etc.).
-- Phase 6: Sanity checks — assert no orphans remain.
--
-- WHAT CASCADES AUTOMATICALLY (no manual cleanup needed)
-- ------------------------------------------------------
--   autocount_exports, extra_charges, hourmeter_amendments, job_assignments,
--   job_audit_log, job_duration_alerts, job_inventory_usage,
--   job_invoice_extra_charges, job_invoices, job_media, job_parts,
--   job_requests, job_service_records, job_status_history,
--   job_type_change_log, job_type_change_requests
--
-- WHAT GETS SET TO NULL (preserved but unlinked)
-- -----------------------------------------------
--   forklift_hourmeter_logs.job_id, forklifts.last_service_job_id,
--   hourmeter_history.job_id, hourmeter_readings.job_id (ON DELETE SET NULL
--   already at the FK level), inventory_movements.job_id,
--   jobs.converted_to_job_id, jobs.converted_from_job_id, quotations.job_id,
--   scheduled_services.job_id, service_predictions.job_id,
--   van_stock_replenishments.triggered_by_job_id
--
-- WHAT GETS HARD-DELETED (besides jobs themselves and CASCADE children)
-- ---------------------------------------------------------------------
--   customer_acknowledgements (NOT NULL FK)
--   service_upgrade_logs (NOT NULL FK)
--   van_stock_usage (NOT NULL FK)
--   notifications referencing these jobs (no FK, manual cleanup)

BEGIN;

-- Phase 1: snapshot the in-scope job_ids
CREATE TEMP TABLE _purge_targets ON COMMIT DROP AS
SELECT job_id, status, created_at
  FROM public.jobs
 WHERE created_at < '2026-04-06';

DO $$
DECLARE
  total_count INTEGER;
  active_count INTEGER;
  oldest TIMESTAMPTZ;
  newest TIMESTAMPTZ;
BEGIN
  SELECT count(*) INTO total_count FROM _purge_targets;
  SELECT count(*) INTO active_count FROM _purge_targets WHERE status IN ('Assigned','In Progress');
  SELECT min(created_at), max(created_at) INTO oldest, newest FROM _purge_targets;
  RAISE NOTICE '======= PURGE SCOPE =======';
  RAISE NOTICE 'Jobs in scope: %', total_count;
  RAISE NOTICE 'Active jobs (Assigned + In Progress): %', active_count;
  RAISE NOTICE 'Date range: % to %', oldest, newest;
  RAISE NOTICE '===========================';
END $$;

-- Phase 2: NULL out nullable NO ACTION FK references
DO $$
DECLARE n INTEGER;
BEGIN
  UPDATE public.forklifts SET last_service_job_id = NULL WHERE last_service_job_id IN (SELECT job_id FROM _purge_targets);
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'forklifts.last_service_job_id set NULL: %', n;

  UPDATE public.forklift_hourmeter_logs SET job_id = NULL WHERE job_id IN (SELECT job_id FROM _purge_targets);
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'forklift_hourmeter_logs.job_id set NULL: %', n;

  UPDATE public.hourmeter_history SET job_id = NULL WHERE job_id IN (SELECT job_id FROM _purge_targets);
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'hourmeter_history.job_id set NULL: %', n;

  UPDATE public.inventory_movements SET job_id = NULL WHERE job_id IN (SELECT job_id FROM _purge_targets);
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'inventory_movements.job_id set NULL: %', n;

  -- Self-referential: newer jobs may point at older ones being purged
  UPDATE public.jobs SET converted_to_job_id = NULL WHERE converted_to_job_id IN (SELECT job_id FROM _purge_targets);
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'jobs.converted_to_job_id set NULL: %', n;

  UPDATE public.jobs SET converted_from_job_id = NULL WHERE converted_from_job_id IN (SELECT job_id FROM _purge_targets);
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'jobs.converted_from_job_id set NULL: %', n;

  UPDATE public.quotations SET job_id = NULL WHERE job_id IN (SELECT job_id FROM _purge_targets);
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'quotations.job_id set NULL: %', n;

  UPDATE public.scheduled_services SET job_id = NULL WHERE job_id IN (SELECT job_id FROM _purge_targets);
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'scheduled_services.job_id set NULL: %', n;

  UPDATE public.service_predictions SET job_id = NULL WHERE job_id IN (SELECT job_id FROM _purge_targets);
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'service_predictions.job_id set NULL: %', n;

  UPDATE public.van_stock_replenishments SET triggered_by_job_id = NULL WHERE triggered_by_job_id IN (SELECT job_id FROM _purge_targets);
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'van_stock_replenishments.triggered_by_job_id set NULL: %', n;

  -- hourmeter_readings.job_id is already ON DELETE SET NULL at the FK level — no manual UPDATE needed
END $$;

-- Phase 3: hard-delete NOT NULL NO ACTION FK dependents
DO $$
DECLARE n INTEGER;
BEGIN
  DELETE FROM public.customer_acknowledgements WHERE job_id IN (SELECT job_id FROM _purge_targets);
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'customer_acknowledgements deleted: %', n;

  DELETE FROM public.service_upgrade_logs WHERE job_id IN (SELECT job_id FROM _purge_targets);
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'service_upgrade_logs deleted: %', n;

  DELETE FROM public.van_stock_usage WHERE job_id IN (SELECT job_id FROM _purge_targets);
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'van_stock_usage deleted: %', n;
END $$;

-- Phase 4: clean up notifications (no FK, manual)
DO $$
DECLARE n INTEGER;
BEGIN
  DELETE FROM public.notifications
   WHERE reference_type = 'job'
     AND reference_id IN (SELECT job_id FROM _purge_targets);
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'notifications deleted: %', n;
END $$;

-- Phase 5: the main event — DELETE FROM jobs (CASCADE handles ~16 child tables)
DO $$
DECLARE n INTEGER;
BEGIN
  DELETE FROM public.jobs WHERE job_id IN (SELECT job_id FROM _purge_targets);
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'jobs deleted: %', n;
END $$;

-- Phase 6: sanity checks
DO $$
DECLARE
  remaining_old INTEGER;
  orphaned_notifications INTEGER;
BEGIN
  SELECT count(*) INTO remaining_old FROM public.jobs WHERE created_at < '2026-04-06';
  IF remaining_old > 0 THEN
    RAISE EXCEPTION 'Sanity check FAILED: % jobs older than 2026-04-06 still present after purge', remaining_old;
  END IF;
  RAISE NOTICE 'Sanity check 1 OK: no jobs < 2026-04-06 remain';

  SELECT count(*) INTO orphaned_notifications
    FROM public.notifications n
   WHERE n.reference_type = 'job'
     AND n.reference_id NOT IN (SELECT job_id FROM public.jobs)
     AND n.created_at < '2026-04-06';
  RAISE NOTICE 'Sanity check 2: orphaned old notifications still present: %', orphaned_notifications;

  RAISE NOTICE '======= PURGE COMPLETE =======';
END $$;

-- Change to ROLLBACK for a dry run; COMMIT to actually apply.
COMMIT;
