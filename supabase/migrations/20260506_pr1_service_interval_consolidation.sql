-- 2026-05-06 — PR 1: service-interval consolidation + completion-trigger reconciliation.
-- Client report (Shin, 5/6 3:18 AM): Service Tracking shows 07/06/2026 (last 09/03 + 90d) but
-- Alert shows stale 26/03/2026. Plus dashboard treats Electrical units as Diesel.
--
-- Root causes found in adversarial review:
--  1. ServiceTrackingCard.saveEdit + 3 other UI writers update last_service_date but never
--     write next_service_due, so the alert column rots. Helper `applyServiceBaseline()`
--     is added in the TS layer; this migration is the DB-side reconciliation.
--  2. Two competing completion triggers: trigger_update_forklift_service (fires on EVERY
--     status→Completed including Repair, hardcodes 90d fallback) and on_service_job_completed
--     (gated correctly but doesn't write next_service_due). 253 forklifts in production
--     have next_service_due < last_service_date — the impossible state proves the divergence.
--  3. set_service_interval_by_type() encodes old policy (500/350); doesn't match user policy
--     (450/300/calendar 90d) or the values already in `service_intervals` table.
--  4. get_service_interval(fuel_type) SQL fn returns 500/350/NULL — same drift.
--
-- Strategy:
--  • `service_intervals` table is the single source of truth (already correct for Full Service).
--  • New helper get_service_interval_for_forklift() reads it, routes by fuel_type.
--  • Drop trigger_update_forklift_service entirely.
--  • Widen on_service_job_completed to write next_service_due + next_service_hourmeter,
--    gated by job_type IN ('Service','Full Service','Minor Service','PM Service','PM').
--  • Rewrite set_service_interval_by_type() to use new policy.
--  • Update get_service_interval() to new policy (kept for back-compat; no longer canonical).
--  • Backfill all forklifts with last_service_date set: stamp correct next_service_due
--    and next_service_hourmeter based on fuel_type. Touches the 253 + 84 + 472 + 398 rows.

BEGIN;
SET LOCAL statement_timeout = '180s';

-- 1.1 Helper: lookup interval for a forklift via service_intervals (Full Service row).
-- Routes by fuel_type. Returns (interval_hours, interval_days). Calendar units have
-- interval_hours NULL, hourmeter units have interval_days NULL.
CREATE OR REPLACE FUNCTION public.get_service_interval_for_forklift(p_forklift_id UUID)
RETURNS TABLE(interval_hours INTEGER, interval_days INTEGER, source TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_fuel TEXT;
  v_type TEXT;
  v_lookup_type TEXT;
BEGIN
  SELECT LOWER(TRIM(fuel_type)), LOWER(TRIM(type))
    INTO v_fuel, v_type
    FROM forklifts WHERE forklift_id = p_forklift_id;

  -- Normalize fuel_type/type → service_intervals.forklift_type lookup key.
  -- Calendar-serviced: electric fuel, OR a type the user policy puts on calendar
  -- (Battery/Electrical, Battery / Electrical, Reach Truck, Others — even if their
  -- fuel_type is mistakenly diesel, e.g. the 4 unreconciled Others rows).
  IF v_fuel = 'electric'
     OR v_type IN ('battery/electrical','battery / electrical','reach truck','others','electric') THEN
    v_lookup_type := 'Electric';
  ELSIF v_fuel IN ('lpg','gas') THEN
    v_lookup_type := 'LPG';
  ELSIF v_fuel = 'petrol' THEN
    v_lookup_type := 'Petrol';
  ELSE
    v_lookup_type := 'Diesel';
  END IF;

  RETURN QUERY
    SELECT si.hourmeter_interval, si.calendar_interval_days, 'service_intervals'::TEXT
      FROM service_intervals si
     WHERE si.forklift_type = v_lookup_type
       AND si.service_type  = 'Full Service'
       AND COALESCE(si.is_active, TRUE)
     LIMIT 1;

  -- Fallback if the table is missing the row (defensive — should never hit).
  IF NOT FOUND THEN
    RETURN QUERY SELECT
      CASE v_lookup_type
        WHEN 'Electric' THEN NULL::INTEGER
        WHEN 'LPG'      THEN 300
        WHEN 'Petrol'   THEN 350
        ELSE 450
      END,
      CASE v_lookup_type
        WHEN 'Electric' THEN 90
        ELSE NULL::INTEGER
      END,
      'fallback'::TEXT;
  END IF;
END $$;
COMMENT ON FUNCTION public.get_service_interval_for_forklift IS
  'Returns the Full Service interval for a forklift via service_intervals. '
  'Routes by fuel_type; calendar branch covers electric, Reach Truck, Others. '
  'Single source of truth for service intervals (PR 1, 2026-05-06).';

-- 1.2 Rewrite set_service_interval_by_type to use new policy.
-- Fires BEFORE INSERT OR UPDATE on forklifts; only stamps service_interval_hours when
-- it's NULL or when type/fuel_type changed.
CREATE OR REPLACE FUNCTION public.set_service_interval_by_type()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public
AS $$
DECLARE v_fuel TEXT := LOWER(TRIM(COALESCE(NEW.fuel_type, '')));
        v_type TEXT := LOWER(TRIM(COALESCE(NEW.type, '')));
BEGIN
  -- Only stamp on INSERT or when classification actually changed.
  IF TG_OP = 'INSERT'
     OR NEW.service_interval_hours IS NULL
     OR (TG_OP = 'UPDATE' AND (OLD.fuel_type IS DISTINCT FROM NEW.fuel_type OR OLD.type IS DISTINCT FROM NEW.type)) THEN
    IF v_fuel = 'electric'
       OR v_type IN ('battery/electrical','battery / electrical','reach truck','others','electric') THEN
      NEW.service_interval_hours := NULL;  -- calendar-serviced
    ELSIF v_fuel IN ('lpg','gas') THEN
      NEW.service_interval_hours := 300;
    ELSIF v_fuel = 'petrol' THEN
      NEW.service_interval_hours := 350;
    ELSE
      NEW.service_interval_hours := 450;   -- diesel default
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- 1.3 Drop the broken Repair-completion trigger and its function.
DROP TRIGGER IF EXISTS trigger_update_forklift_service ON jobs;
DROP FUNCTION IF EXISTS public.update_forklift_service_schedule();

-- 1.4 Widen on_service_job_completed: also write next_service_due + next_service_hourmeter,
-- branching on calendar vs hourmeter mode. Gate to genuine service job_types.
CREATE OR REPLACE FUNCTION public.on_service_job_completed()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_int RECORD;
  v_fuel TEXT;
  v_type TEXT;
  v_calendar BOOLEAN;
  v_completed_at TIMESTAMPTZ;
  v_hourmeter INTEGER;
BEGIN
  IF NEW.status <> 'Completed' OR OLD.status = 'Completed' THEN
    RETURN NEW;
  END IF;
  IF NEW.job_type IS NULL
     OR NEW.job_type NOT IN ('Service', 'Full Service', 'Minor Service', 'PM Service', 'PM') THEN
    RETURN NEW;
  END IF;
  IF NEW.forklift_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_int FROM get_service_interval_for_forklift(NEW.forklift_id);
  SELECT LOWER(TRIM(fuel_type)), LOWER(TRIM(type))
    INTO v_fuel, v_type
    FROM forklifts WHERE forklift_id = NEW.forklift_id;
  v_calendar := v_fuel = 'electric'
             OR v_type IN ('battery/electrical','battery / electrical','reach truck','others','electric');

  v_completed_at := COALESCE(NEW.completed_at, CURRENT_TIMESTAMP);
  v_hourmeter    := COALESCE(NEW.hourmeter_reading, 0);

  UPDATE forklifts SET
    last_service_date     = v_completed_at,
    last_service_hourmeter   = CASE WHEN NEW.hourmeter_reading IS NOT NULL THEN NEW.hourmeter_reading ELSE last_service_hourmeter END,
    last_serviced_hourmeter  = CASE WHEN NEW.hourmeter_reading IS NOT NULL THEN NEW.hourmeter_reading ELSE last_serviced_hourmeter END,
    hourmeter             = CASE WHEN NEW.hourmeter_reading IS NOT NULL THEN GREATEST(hourmeter, NEW.hourmeter_reading) ELSE hourmeter END,
    next_service_due      = CASE WHEN v_calendar
                                  THEN v_completed_at + (COALESCE(v_int.interval_days, 90) || ' days')::INTERVAL
                                  ELSE NULL END,
    next_service_hourmeter   = CASE WHEN v_calendar THEN NULL
                                  ELSE v_hourmeter + COALESCE(v_int.interval_hours, 450) END,
    next_target_service_hour = CASE WHEN v_calendar THEN next_target_service_hour
                                  ELSE v_hourmeter + COALESCE(v_int.interval_hours, 450) END,
    updated_at            = NOW()
  WHERE forklift_id = NEW.forklift_id;

  -- Preserve original side-effect: hourmeter_readings audit row.
  IF NEW.hourmeter_reading IS NOT NULL THEN
    INSERT INTO hourmeter_readings (
      forklift_id, hourmeter_value, recorded_by_id, recorded_by_name,
      job_id, is_service_reading, notes
    ) VALUES (
      NEW.forklift_id, NEW.hourmeter_reading, NEW.completed_by_id, NEW.completed_by_name,
      NEW.job_id, TRUE, 'Service completed - hourmeter cycle reset'
    );
  END IF;

  RETURN NEW;
END $$;

-- 1.5 Update legacy get_service_interval(fuel_type) for back-compat callers.
CREATE OR REPLACE FUNCTION public.get_service_interval(p_fuel_type CHARACTER VARYING)
RETURNS INTEGER LANGUAGE plpgsql IMMUTABLE SET search_path = public
AS $$
BEGIN
  CASE LOWER(p_fuel_type)
    WHEN 'diesel' THEN RETURN 450;
    WHEN 'lpg'    THEN RETURN 300;
    WHEN 'gas'    THEN RETURN 300;
    WHEN 'petrol' THEN RETURN 350;
    WHEN 'electric' THEN RETURN NULL;
    ELSE RETURN 450;
  END CASE;
END $$;

-- 1.6 Backfill: every forklift with last_service_date set gets a fresh
-- next_service_due + next_service_hourmeter using the new helper.
-- Also reset service_interval_hours for non-electric units to the new policy
-- (only if currently at the old defaults 500 or 350).
WITH bf AS (
  SELECT f.forklift_id,
         f.last_service_date,
         f.last_service_hourmeter,
         f.fuel_type,
         f.type,
         (LOWER(TRIM(f.fuel_type)) = 'electric'
            OR LOWER(TRIM(f.type)) IN ('battery/electrical','battery / electrical','reach truck','others','electric')
         ) AS is_calendar,
         (SELECT i.interval_hours FROM get_service_interval_for_forklift(f.forklift_id) i) AS i_hours,
         (SELECT i.interval_days  FROM get_service_interval_for_forklift(f.forklift_id) i) AS i_days
    FROM forklifts f
   WHERE f.last_service_date IS NOT NULL
)
UPDATE forklifts f
   SET next_service_due      = CASE WHEN bf.is_calendar
                                    THEN bf.last_service_date + (COALESCE(bf.i_days, 90) || ' days')::INTERVAL
                                    ELSE NULL END,
       next_service_hourmeter   = CASE WHEN bf.is_calendar THEN NULL
                                    ELSE COALESCE(bf.last_service_hourmeter, 0) + COALESCE(bf.i_hours, 450) END,
       next_target_service_hour = CASE WHEN bf.is_calendar THEN next_target_service_hour
                                    ELSE COALESCE(bf.last_service_hourmeter, 0) + COALESCE(bf.i_hours, 450) END,
       service_interval_hours = CASE
                                  WHEN bf.is_calendar THEN NULL
                                  WHEN f.service_interval_hours IN (500, 350) THEN COALESCE(bf.i_hours, 450)
                                  ELSE f.service_interval_hours
                                END,
       updated_at             = NOW()
  FROM bf
 WHERE f.forklift_id = bf.forklift_id;

-- 1.7 For forklifts with NULL last_service_date but next_service_due set, leave them
-- alone (we have no anchor to recompute from).

-- 1.8 Invariants
DO $$
DECLARE n INTEGER;
BEGIN
  -- Impossible state: next_service_due before last_service_date
  SELECT COUNT(*) INTO n FROM forklifts
   WHERE next_service_due IS NOT NULL AND last_service_date IS NOT NULL
     AND next_service_due < last_service_date;
  IF n <> 0 THEN RAISE EXCEPTION 'Invariant 1: % forklifts still have next_service_due < last_service_date', n; END IF;

  -- Calendar units that have been serviced should have next_service_due set
  SELECT COUNT(*) INTO n FROM forklifts
   WHERE last_service_date IS NOT NULL
     AND next_service_due IS NULL
     AND (LOWER(TRIM(fuel_type)) = 'electric'
          OR LOWER(TRIM(type)) IN ('battery/electrical','battery / electrical','reach truck','others','electric'));
  IF n <> 0 THEN RAISE EXCEPTION 'Invariant 2: % calendar forklifts have last_service_date set but next_service_due NULL', n; END IF;

  -- Calendar units must have NULL service_interval_hours (no hourmeter interval)
  SELECT COUNT(*) INTO n FROM forklifts
   WHERE service_interval_hours IS NOT NULL
     AND (LOWER(TRIM(fuel_type)) = 'electric'
          OR LOWER(TRIM(type)) IN ('battery/electrical','battery / electrical','reach truck'));
  -- Don't fail on this — it's a soft invariant; some pre-existing rows may not match yet.
  -- Just note it.
  RAISE NOTICE 'Soft check: % calendar forklifts still have service_interval_hours set (mostly Reach Truck/Battery legacy)', n;

  -- Hourmeter units (diesel/lpg/petrol) should have service_interval_hours = 450/300/350
  SELECT COUNT(*) INTO n FROM forklifts
   WHERE LOWER(TRIM(fuel_type)) IN ('diesel','lpg','gas','petrol')
     AND LOWER(TRIM(type)) NOT IN ('battery/electrical','battery / electrical','reach truck','others','electric')
     AND service_interval_hours IS NOT NULL
     AND service_interval_hours NOT IN (450, 300, 350);
  RAISE NOTICE 'Soft check: % hourmeter forklifts have non-policy interval (likely AMC overrides)', n;
END $$;

COMMIT;
