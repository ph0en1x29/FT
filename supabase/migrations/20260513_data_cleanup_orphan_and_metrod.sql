-- 20260513_data_cleanup_orphan_and_metrod.sql
--
-- Two data corrections:
--
-- 1. ORPHAN CLONE CLEANUP (Bug #1 aftermath)
--    JOB-260511-034-D was created as an orphan clone during a failed transfer
--    of JOB-260511-034 (from Beh Choon Shen → Lim Kher Yuan). The parent
--    update failed, leaving:
--      - Clone JOB-260511-034-D in the DB with status 'Assigned'
--      - Parent JOB-260511-034 unchanged (still shows original assignment)
--    Fix: delete the orphan clone's media rows, then the clone itself.
--    The parent needs no change — it was never modified.
--
-- 2. METROD M50 → M55 FORKLIFT TRANSFER (re-application)
--    4 customer-owned forklifts (7FBR13-12312, 7FD45-38065, 8FD30-73970,
--    8FD15-60424) should be under account M55 (077f8d41...) not M50
--    (4d9621ff...). A migration for this was created 2026-05-06 but may
--    not have been applied. This is idempotent — if already on M55, it
--    skips; if still on M50, it moves them.

BEGIN;
SET LOCAL statement_timeout = '30s';

-- ════════════════════════════════════════════════════════════════════
-- 1. ORPHAN CLONE CLEANUP
-- ════════════════════════════════════════════════════════════════════

-- Find the orphan clone by job_number pattern. Use a DO block to handle
-- the case where the clone might already have been manually deleted.
DO $$
DECLARE
  v_clone_id UUID;
  v_media_deleted INTEGER;
BEGIN
  -- Look up the orphan clone
  SELECT job_id INTO v_clone_id
    FROM jobs
   WHERE job_number = 'JOB-260511-034-D'
     AND deleted_at IS NULL;

  IF v_clone_id IS NULL THEN
    RAISE NOTICE 'Orphan clone JOB-260511-034-D not found (already cleaned up or soft-deleted). Skipping.';
  ELSE
    -- Delete media rows first (FK constraint)
    DELETE FROM job_media WHERE job_id = v_clone_id;
    GET DIAGNOSTICS v_media_deleted = ROW_COUNT;
    RAISE NOTICE 'Deleted % job_media rows for clone %', v_media_deleted, v_clone_id;

    -- Delete any job_parts rows (should be empty for a fresh clone, but defensive)
    DELETE FROM job_parts WHERE job_id = v_clone_id;

    -- Delete the clone job row
    DELETE FROM jobs WHERE job_id = v_clone_id;
    RAISE NOTICE 'Deleted orphan clone JOB-260511-034-D (job_id: %)', v_clone_id;
  END IF;

  -- Verify the parent job is intact and NOT in 'Incomplete - Reassigned' state
  -- (it shouldn't be, since the parent update failed — but verify anyway)
  PERFORM 1
    FROM jobs
   WHERE job_number = 'JOB-260511-034'
     AND deleted_at IS NULL
     AND status != 'Incomplete - Reassigned';

  IF NOT FOUND THEN
    -- Either the parent doesn't exist, or it IS in Incomplete - Reassigned.
    -- Check which case:
    PERFORM 1
      FROM jobs
     WHERE job_number = 'JOB-260511-034'
       AND status = 'Incomplete - Reassigned';

    IF FOUND THEN
      -- Parent was partially modified — revert to its previous status.
      -- The most likely previous state was 'In Progress' or 'Assigned'.
      -- Log a notice; manual review may be needed.
      RAISE NOTICE 'WARNING: Parent JOB-260511-034 is in Incomplete - Reassigned state. It may need manual status correction.';
    ELSE
      RAISE NOTICE 'Parent JOB-260511-034 not found or already deleted. No action needed.';
    END IF;
  ELSE
    RAISE NOTICE 'Parent JOB-260511-034 verified — status is NOT Incomplete - Reassigned. OK.';
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════
-- 2. METROD M50 → M55 FORKLIFT TRANSFER (idempotent)
-- ════════════════════════════════════════════════════════════════════

-- M50  customer_id 4d9621ff-3723-4c69-87eb-f8ca10d722cd  account_number 3000/M50
-- M55  customer_id 077f8d41-8bde-4859-96e9-599c4d3a23ca  account_number 3000/M55

DO $$
DECLARE
  n_on_m50 INTEGER;
  n_on_m55 INTEGER;
  n_updated INTEGER;
BEGIN
  -- Check current state
  SELECT COUNT(*) INTO n_on_m50
    FROM forklifts
   WHERE serial_number IN ('7FBR13-12312','7FD45-38065','8FD30-73970','8FD15-60424')
     AND current_customer_id = '4d9621ff-3723-4c69-87eb-f8ca10d722cd';

  SELECT COUNT(*) INTO n_on_m55
    FROM forklifts
   WHERE serial_number IN ('7FBR13-12312','7FD45-38065','8FD30-73970','8FD15-60424')
     AND current_customer_id = '077f8d41-8bde-4859-96e9-599c4d3a23ca';

  IF n_on_m55 = 4 THEN
    RAISE NOTICE 'Metrod M50→M55: All 4 forklifts already on M55. No action needed.';
  ELSIF n_on_m50 > 0 THEN
    RAISE NOTICE 'Metrod M50→M55: % forklifts still on M50, % already on M55. Moving...', n_on_m50, n_on_m55;

    UPDATE forklifts
       SET current_customer_id = '077f8d41-8bde-4859-96e9-599c4d3a23ca',
           updated_at          = NOW()
     WHERE serial_number IN ('7FBR13-12312','7FD45-38065','8FD30-73970','8FD15-60424')
       AND current_customer_id = '4d9621ff-3723-4c69-87eb-f8ca10d722cd';

    GET DIAGNOSTICS n_updated = ROW_COUNT;
    RAISE NOTICE 'Moved % forklifts from M50 to M55.', n_updated;
  ELSE
    RAISE NOTICE 'Metrod M50→M55: No forklifts found on M50. Current state: % on M55. Check serial numbers.', n_on_m55;
  END IF;
END $$;

-- Post-check: verify final state
DO $$
DECLARE
  n_final INTEGER;
BEGIN
  SELECT COUNT(*) INTO n_final
    FROM forklifts
   WHERE serial_number IN ('7FBR13-12312','7FD45-38065','8FD30-73970','8FD15-60424')
     AND current_customer_id = '077f8d41-8bde-4859-96e9-599c4d3a23ca';

  RAISE NOTICE 'Final check: % of 4 forklifts are on M55.', n_final;

  IF n_final < 4 THEN
    RAISE WARNING 'Not all forklifts landed on M55 — manual review required.';
  END IF;
END $$;

COMMIT;
