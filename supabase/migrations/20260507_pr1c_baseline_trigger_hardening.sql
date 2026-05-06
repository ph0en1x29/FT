-- 2026-05-07 — PR 1c: hardening for the forklift baseline trigger after the
-- post-ship audit (residual-bug-class memo 2026-05-06). Three changes:
--
--  1. Trigger fires on BEFORE INSERT in addition to BEFORE UPDATE — fresh forklift
--     creation that arrives with last_service_date set now also stamps next_service_*.
--  2. Respect explicit caller-supplied next_service_due / next_service_hourmeter
--     overrides. If the new row carries an override (DISTINCT FROM the OLD value),
--     leave it alone. Admins occasionally need to back-date or post-pone a service
--     and the trigger was clobbering their write.
--  3. Backfill the legacy service_interval_hours column for non-calendar units to
--     the new policy (450/300/350) where the existing value matches the OLD policy
--     defaults (500/350) AND the forklift is not covered by an AMC contract with
--     a custom override. Display callers like ServiceTrackingCard.tsx:274 then
--     read the right number.

BEGIN;
SET LOCAL statement_timeout = '120s';

CREATE OR REPLACE FUNCTION public.set_forklift_next_service()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public
AS $$
DECLARE
  v_int RECORD;
  v_fuel TEXT := LOWER(TRIM(COALESCE(NEW.fuel_type, '')));
  v_type TEXT := LOWER(TRIM(COALESCE(NEW.type, '')));
  v_calendar BOOLEAN;
  v_baseline TIMESTAMPTZ;
  v_baseline_h INTEGER;
  v_due_overridden BOOLEAN;
  v_hour_overridden BOOLEAN;
BEGIN
  -- Skip on UPDATE if nothing baseline-relevant changed.
  IF TG_OP = 'UPDATE'
     AND NEW.last_service_date     IS NOT DISTINCT FROM OLD.last_service_date
     AND NEW.last_service_hourmeter IS NOT DISTINCT FROM OLD.last_service_hourmeter
     AND NEW.fuel_type              IS NOT DISTINCT FROM OLD.fuel_type
     AND NEW.type                   IS NOT DISTINCT FROM OLD.type
     AND NEW.service_interval_hours IS NOT DISTINCT FROM OLD.service_interval_hours
     AND NEW.next_service_due       IS NOT DISTINCT FROM OLD.next_service_due
     AND NEW.next_service_hourmeter IS NOT DISTINCT FROM OLD.next_service_hourmeter THEN
    RETURN NEW;
  END IF;

  v_calendar := v_fuel = 'electric'
             OR v_type IN ('battery/electrical','battery / electrical','reach truck','others','electric');

  v_baseline   := NEW.last_service_date;
  v_baseline_h := COALESCE(NEW.last_service_hourmeter, NEW.last_serviced_hourmeter, 0);

  -- Detect explicit overrides: caller wrote a non-null next_service_* AND it's
  -- different from the old value. INSERT counts as override iff non-null.
  IF TG_OP = 'INSERT' THEN
    v_due_overridden  := NEW.next_service_due IS NOT NULL;
    v_hour_overridden := NEW.next_service_hourmeter IS NOT NULL;
  ELSE
    v_due_overridden  := NEW.next_service_due IS DISTINCT FROM OLD.next_service_due
                        AND NEW.next_service_due IS NOT NULL;
    v_hour_overridden := NEW.next_service_hourmeter IS DISTINCT FROM OLD.next_service_hourmeter
                        AND NEW.next_service_hourmeter IS NOT NULL;
  END IF;

  -- No anchor and no override = nothing to compute.
  IF v_baseline IS NULL AND NEW.last_service_hourmeter IS NULL
     AND NOT v_due_overridden AND NOT v_hour_overridden THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_int FROM get_service_interval_for_forklift(NEW.forklift_id);

  IF v_calendar THEN
    IF NOT v_due_overridden AND v_baseline IS NOT NULL THEN
      NEW.next_service_due := v_baseline + (COALESCE(v_int.interval_days, 90) || ' days')::INTERVAL;
    END IF;
    NEW.next_service_hourmeter   := NULL;
    -- Calendar units: don't disturb next_target_service_hour; older code reads it.
  ELSE
    IF NOT v_due_overridden THEN
      NEW.next_service_due := NULL;
    END IF;
    IF NOT v_hour_overridden THEN
      NEW.next_service_hourmeter   := v_baseline_h + COALESCE(v_int.interval_hours, NEW.service_interval_hours, 450);
      NEW.next_target_service_hour := v_baseline_h + COALESCE(v_int.interval_hours, NEW.service_interval_hours, 450);
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_forklift_next_service ON forklifts;
CREATE TRIGGER trg_set_forklift_next_service
BEFORE INSERT OR UPDATE ON forklifts
FOR EACH ROW
EXECUTE FUNCTION set_forklift_next_service();

-- 1c.2 Backfill the display column for hourmeter units stuck on old policy
-- defaults. AMC overrides are skipped (service_contracts.default_hourmeter_interval
-- when the forklift is in covered_forklift_ids).
WITH amc AS (
  SELECT UNNEST(covered_forklift_ids) AS forklift_id, default_hourmeter_interval
    FROM service_contracts
   WHERE COALESCE(is_active, FALSE) AND default_hourmeter_interval IS NOT NULL
)
UPDATE forklifts f
   SET service_interval_hours =
        CASE LOWER(TRIM(f.fuel_type))
          WHEN 'lpg' THEN 300
          WHEN 'gas' THEN 300
          WHEN 'petrol' THEN 350
          ELSE 450
        END,
       updated_at = NOW()
 WHERE LOWER(TRIM(f.fuel_type)) IN ('diesel','lpg','gas','petrol')
   AND LOWER(TRIM(f.type)) NOT IN ('battery/electrical','battery / electrical','reach truck','others','electric')
   AND f.service_interval_hours IN (500, 350)
   AND NOT EXISTS (SELECT 1 FROM amc WHERE amc.forklift_id = f.forklift_id);

-- Calendar units should have NULL service_interval_hours; reset stale legacy values
-- so display callers stop showing "Service Interval: 500 hrs" on Battery/Electrical
-- forklifts.
UPDATE forklifts
   SET service_interval_hours = NULL,
       updated_at = NOW()
 WHERE service_interval_hours IS NOT NULL
   AND (LOWER(TRIM(fuel_type)) = 'electric'
        OR LOWER(TRIM(type)) IN ('battery/electrical','battery / electrical','reach truck'));

-- 1c.3 Sanity invariants
DO $$
DECLARE n INTEGER;
BEGIN
  SELECT COUNT(*) INTO n FROM forklifts
   WHERE LOWER(TRIM(fuel_type)) IN ('diesel','lpg','gas','petrol')
     AND LOWER(TRIM(type)) NOT IN ('battery/electrical','battery / electrical','reach truck','others','electric')
     AND service_interval_hours IN (500, 350);
  RAISE NOTICE 'Hourmeter units still on legacy 500/350 (likely AMC overrides): %', n;

  SELECT COUNT(*) INTO n FROM forklifts
   WHERE service_interval_hours IS NOT NULL
     AND (LOWER(TRIM(fuel_type)) = 'electric'
          OR LOWER(TRIM(type)) IN ('battery/electrical','battery / electrical','reach truck'));
  IF n > 0 THEN RAISE EXCEPTION 'Calendar unit still has service_interval_hours set: %', n; END IF;
END $$;

COMMIT;
