-- ============================================================
-- Migration: ACWER Service Operations Flow — Phase 1 Backfill
-- Date: 2026-05-01
-- Purpose: Populate `jobs.billing_path` for existing jobs based on the
--          forklift's ownership + any active service contracts at the time
--          of this migration's run. Idempotent — only updates rows that
--          are still 'unset'.
--
-- Logic:
--   - forklift.ownership = 'company'  → 'fleet' (Path C wins, regardless of contract)
--   - forklift.ownership = 'customer' AND active contract covering the forklift → 'amc'
--   - forklift.ownership = 'customer' AND no covering contract → 'chargeable'
--   - no forklift OR ownership unknown → stays 'unset'
--
-- Behavioral impact: NONE. `billing_path` is read-only / advisory in Phase 1.
--   No service or trigger acts on this column yet.
--
-- Reversibility: re-set everything to 'unset' (block at bottom).
-- ============================================================

BEGIN;

-- 1. Backfill Path C (fleet) — Acwer-owned forklifts
UPDATE jobs SET
  billing_path = 'fleet',
  billing_path_reason = 'Forklift is Acwer-owned (Path C — Fleet) — backfilled 2026-05-01'
FROM forklifts
WHERE jobs.forklift_id = forklifts.forklift_id
  AND forklifts.ownership = 'company'
  AND jobs.billing_path = 'unset';

-- 2. Backfill Path A (AMC) — customer-owned + active covering contract
-- A contract "covers" a forklift if covered_forklift_ids is NULL/empty (covers all)
-- OR covered_forklift_ids contains this forklift_id.
-- "Active" here is relative to TODAY (this migration's wall-clock).
WITH amc_jobs AS (
  SELECT j.job_id, sc.contract_number, sc.contract_id
  FROM jobs j
  JOIN forklifts f ON j.forklift_id = f.forklift_id
  JOIN service_contracts sc
    ON sc.customer_id = j.customer_id
   AND sc.is_active = TRUE
   AND sc.start_date <= CURRENT_DATE
   AND sc.end_date >= CURRENT_DATE
   AND (sc.covered_forklift_ids IS NULL
        OR cardinality(sc.covered_forklift_ids) = 0
        OR f.forklift_id = ANY(sc.covered_forklift_ids))
  WHERE f.ownership = 'customer'
    AND j.billing_path = 'unset'
)
UPDATE jobs SET
  billing_path = 'amc',
  billing_path_reason = 'Active contract ' || COALESCE(amc_jobs.contract_number, amc_jobs.contract_id::text) || ' (Path A — AMC) — backfilled 2026-05-01'
FROM amc_jobs
WHERE jobs.job_id = amc_jobs.job_id;

-- 3. Backfill Path B (chargeable) — customer-owned, no covering contract.
-- This catches all remaining customer-owned forklift jobs that didn't match
-- Path A above.
UPDATE jobs SET
  billing_path = 'chargeable',
  billing_path_reason = 'Customer-owned, no active contract (Path B — Chargeable) — backfilled 2026-05-01'
FROM forklifts
WHERE jobs.forklift_id = forklifts.forklift_id
  AND forklifts.ownership = 'customer'
  AND jobs.billing_path = 'unset';

-- 4. Sanity check + telemetry
DO $$
DECLARE
  v_total INTEGER;
  v_unset INTEGER;
  v_amc INTEGER;
  v_chargeable INTEGER;
  v_fleet INTEGER;
  v_no_forklift INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total FROM jobs;
  SELECT COUNT(*) INTO v_unset FROM jobs WHERE billing_path = 'unset';
  SELECT COUNT(*) INTO v_amc FROM jobs WHERE billing_path = 'amc';
  SELECT COUNT(*) INTO v_chargeable FROM jobs WHERE billing_path = 'chargeable';
  SELECT COUNT(*) INTO v_fleet FROM jobs WHERE billing_path = 'fleet';
  SELECT COUNT(*) INTO v_no_forklift FROM jobs WHERE forklift_id IS NULL;

  RAISE NOTICE 'Phase 1 backfill summary: total=%, unset=%, amc=%, chargeable=%, fleet=%, no_forklift=%',
               v_total, v_unset, v_amc, v_chargeable, v_fleet, v_no_forklift;

  -- Every still-unset job must be either: (a) no forklift_id, or (b) forklift
  -- with ownership NOT IN ('company','customer'). Otherwise the backfill missed it.
  IF v_unset > 0 THEN
    DECLARE
      v_orphan INTEGER;
    BEGIN
      SELECT COUNT(*) INTO v_orphan FROM jobs j
      LEFT JOIN forklifts f ON j.forklift_id = f.forklift_id
      WHERE j.billing_path = 'unset'
        AND j.forklift_id IS NOT NULL
        AND f.ownership IN ('company', 'customer');
      IF v_orphan > 0 THEN
        RAISE EXCEPTION 'Phase 1 backfill: % jobs still unset despite having a classifiable forklift', v_orphan;
      END IF;
    END;
  END IF;
END $$;

COMMIT;

-- ============================================================
-- ROLLBACK (run separately if needed; reverts every backfilled row to 'unset')
-- ============================================================
-- BEGIN;
-- UPDATE jobs SET
--   billing_path = 'unset',
--   billing_path_reason = NULL
-- WHERE billing_path_reason LIKE '%backfilled 2026-05-01%';
-- COMMIT;
