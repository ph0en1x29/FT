-- 2026-05-06 — Reconcile forklifts where forklifts.type clearly disagrees with fuel_type.
-- Why: PR 1 will route service-interval logic on fuel_type (date vs hourmeter, 450h/300h/90d).
-- Today 55 rows have fuel_type='diesel' even though the user-facing `type` reads
-- 'Battery/Electrical', 'Reach Truck', 'Lpg', 'LPG', or 'Others'. Without this reconciliation
-- they would be permanently misrouted as Diesel (hourmeter, 450h) once PR 1 lands.
--
-- Strategy: trust `type`, since it appears in every UI and has been curated.
--
--   type 'Battery/Electrical' / 'Battery / Electrical' / 'Reach Truck' / 'Electric'  → fuel_type 'electric'
--   type 'Lpg' / 'LPG'                                                               → fuel_type 'lpg'
--
-- Out-of-scope (left for human review):
--   type 'Others' (4 rows): the fuel_type CHECK constraint allows only
--   {diesel, lpg, gas, petrol, electric}; we do not know whether these are electric or
--   diesel. PR 1's serviceInterval helper will route 'Others' as calendar regardless of
--   fuel_type, so this is not blocking. Admin can audit individually.
--
-- Counts (verified live 2026-05-06):
--   Battery/Electrical+diesel : 25  → electric
--   Reach Truck+diesel        : 15  → electric
--   Lpg+diesel                : 6   → lpg
--   LPG+diesel                : 5   → lpg
--   Others+diesel             : 4   → SKIP (manual review)
--   total updated             : 51

BEGIN;
SET LOCAL statement_timeout = '60s';

-- Pre-flight: snapshot the rows for audit trail. Excludes 'Others' (manual review).
CREATE TEMP TABLE _fuel_recon ON COMMIT DROP AS
SELECT forklift_id, serial_number, type, fuel_type AS old_fuel_type,
       CASE
         WHEN LOWER(TRIM(type)) IN ('battery/electrical','battery / electrical','reach truck','electric') THEN 'electric'
         WHEN LOWER(TRIM(type)) IN ('lpg','gas','petrol')                                                  THEN 'lpg'
         ELSE NULL
       END AS new_fuel_type
  FROM forklifts
 WHERE ((LOWER(TRIM(type)) IN ('battery/electrical','battery / electrical','reach truck','electric') AND fuel_type = 'diesel')
     OR (LOWER(TRIM(type)) IN ('lpg','gas','petrol')                                                  AND fuel_type = 'diesel'));

DO $$
DECLARE n INTEGER; n_null INTEGER; n_others INTEGER;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE new_fuel_type IS NULL) INTO n, n_null FROM _fuel_recon;
  SELECT COUNT(*) INTO n_others FROM forklifts WHERE LOWER(TRIM(type))='others' AND fuel_type='diesel';
  RAISE NOTICE 'Reconciliation: in-scope=% (mapped=%, unmapped=%) — Others-diesel left unchanged: %',
               n, n - n_null, n_null, n_others;
  IF n <> 51 THEN
    RAISE EXCEPTION 'Pre-flight: expected 51 in-scope candidates but found %.', n;
  END IF;
  IF n_null > 0 THEN
    RAISE EXCEPTION 'Pre-flight: % candidates lacked a target mapping (data drift since planning)', n_null;
  END IF;
END $$;

-- Apply
UPDATE forklifts f
   SET fuel_type  = r.new_fuel_type,
       updated_at = NOW()
  FROM _fuel_recon r
 WHERE f.forklift_id = r.forklift_id;

-- Post-check: zero in-scope mismatches remain (Others-diesel may still exist; expected).
DO $$
DECLARE n INTEGER;
BEGIN
  SELECT COUNT(*) INTO n
    FROM forklifts
   WHERE ((LOWER(TRIM(type)) IN ('battery/electrical','battery / electrical','reach truck','electric') AND fuel_type = 'diesel')
       OR (LOWER(TRIM(type)) IN ('lpg','gas','petrol')                                                  AND fuel_type = 'diesel'));
  IF n <> 0 THEN
    RAISE EXCEPTION 'Post-check: % in-scope mismatches remain', n;
  END IF;
END $$;

COMMIT;
