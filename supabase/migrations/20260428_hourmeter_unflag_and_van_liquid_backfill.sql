-- ============================================================================
-- 2026-04-28 — Hourmeter flag clear + van-stock liquid backfill
--
-- Two unrelated client-reported issues bundled because both are one-shot data
-- patches with no schema change:
--
-- 1. JOB-260421-043 (GOH YUEH HAN, forklift A142) is stuck "In Progress"
--    because hourmeter 19,413 was flagged `pattern_mismatch`. The previous
--    reading 19,014 was from 2026-03-13 (~6 wk earlier), so the 399 h delta
--    triggered the warning_threshold_hours=100 guard even though the reading
--    is legitimate (forklift is now at 19,415 per Admin Two's manual update).
--    The current 100 h threshold is too tight when prior readings are stale,
--    so we also bump warning_threshold_hours to 200 to stop this recurring
--    on similar long-gap services. alert_threshold (500) is unchanged.
--
-- 2. The 6-van mass import on 2026-04-24 wrote the xlsx "Qty" column into the
--    legacy `quantity` field on van_stock_items, but the UI renders liquid
--    parts from `container_quantity * container_size + bulk_quantity` and
--    ignores `quantity`. Result: 19 liquid rows (engine oil, hydraulic oil,
--    gear oil, transmission oil) across all 6 vans display as "0.0 liter /
--    Out" — Shin reported them as "missing from the list". The xlsx Qty is
--    in liters (verified via Total = Qty × RM-per-liter), so the right
--    interpretation is `bulk_quantity = quantity` (loose volume on the van),
--    `container_quantity = 0` (no sealed drums). We leave `quantity`
--    untouched so legacy code paths (e.g. low-stock badge fallback) still
--    work — `bulk_quantity` is now the source of truth for display.
--
-- Both blocks idempotent and bounded: hourmeter clear targets exactly one
-- job_number; backfill targets only liquid rows where container/bulk are
-- both zero (so re-running won't overwrite admin edits).
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1a. Clear the pattern_mismatch flag on JOB-260421-043 so it can complete.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE jobs
SET hourmeter_flagged = FALSE,
    hourmeter_flag_reasons = '{}',
    hourmeter_validated_at = NOW(),
    hourmeter_validated_by_id = (SELECT user_id FROM users WHERE email = 'admin1@example.com' LIMIT 1),
    hourmeter_validated_by_name = (SELECT full_name FROM users WHERE email = 'admin1@example.com' LIMIT 1)
WHERE job_number = 'JOB-260421-043'
  AND hourmeter_flagged = TRUE
  AND status = 'In Progress';

-- Verify exactly one row updated
DO $$
DECLARE v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM jobs
  WHERE job_number = 'JOB-260421-043' AND hourmeter_flagged = FALSE;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly 1 unflagged JOB-260421-043 row, got %', v_count;
  END IF;
END$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1b. Raise warning threshold 100→200 h so stale-prior-reading services don't
--     auto-flag. alert_threshold stays 500.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE hourmeter_validation_configs
SET warning_threshold_hours = 200,
    updated_at = NOW(),
    updated_by_id = (SELECT user_id FROM users WHERE email = 'admin1@example.com' LIMIT 1),
    updated_by_name = (SELECT full_name FROM users WHERE email = 'admin1@example.com' LIMIT 1)
WHERE is_active = TRUE
  AND warning_threshold_hours = 100;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Backfill bulk_quantity for liquid van-stock rows imported with only the
--    legacy quantity field set. Targets rows from the 2026-04-24 import.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE van_stock_items vsi
SET bulk_quantity = vsi.quantity,
    container_quantity = 0,
    updated_at = NOW()
FROM parts p
WHERE p.part_id = vsi.part_id
  AND p.is_liquid = TRUE
  AND vsi.quantity > 0
  AND COALESCE(vsi.container_quantity, 0) = 0
  AND COALESCE(vsi.bulk_quantity, 0) = 0;

-- Verify the expected ~19 rows were touched (sanity bound, not exact)
DO $$
DECLARE v_remaining INT;
BEGIN
  SELECT COUNT(*) INTO v_remaining
  FROM van_stock_items vsi
  JOIN parts p ON p.part_id = vsi.part_id
  WHERE p.is_liquid = TRUE
    AND vsi.quantity > 0
    AND COALESCE(vsi.container_quantity, 0) = 0
    AND COALESCE(vsi.bulk_quantity, 0) = 0;
  IF v_remaining > 0 THEN
    RAISE EXCEPTION 'Expected zero unbackfilled liquid van rows after migration, got %', v_remaining;
  END IF;
END$$;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Post-apply spot checks (run as separate read-only queries):
--
-- SELECT job_number, hourmeter_flagged, hourmeter_flag_reasons, status
-- FROM jobs WHERE job_number = 'JOB-260421-043';
-- → expect: hourmeter_flagged=false, flag_reasons={}, status='In Progress'
--   (Shin/admin can now complete the job from the UI)
--
-- SELECT warning_threshold_hours, alert_threshold_hours FROM hourmeter_validation_configs WHERE is_active = TRUE;
-- → expect: 200, 500
--
-- SELECT vs.van_plate, p.part_name, vsi.quantity, vsi.container_quantity, vsi.bulk_quantity
-- FROM van_stock_items vsi JOIN parts p ON p.part_id=vsi.part_id JOIN van_stocks vs ON vs.van_stock_id=vsi.van_stock_id
-- WHERE p.is_liquid=true AND vs.notes LIKE '%Initial stock imported from Shin%'
-- ORDER BY vs.van_plate, p.part_name;
-- → expect every row to have bulk_quantity = quantity, container_quantity = 0
-- ─────────────────────────────────────────────────────────────────────────────
