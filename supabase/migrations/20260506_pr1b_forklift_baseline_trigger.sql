-- 2026-05-06 — PR 1b: forklifts BEFORE UPDATE trigger that auto-writes next_service_due
-- and next_service_hourmeter whenever last_service_date or last_service_hourmeter changes.
-- Defends the 4 UI writers (ServiceTrackingCard.saveEdit, useFleetManagement, AssignForkliftModal,
-- BulkServiceResetModal) without touching each one — they can keep their existing UPDATE shape
-- and the trigger fills in the rest.

BEGIN;
SET LOCAL statement_timeout = '30s';

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
BEGIN
  -- Only act when the service baseline actually changed (or NEW row).
  IF TG_OP = 'UPDATE'
     AND NEW.last_service_date     IS NOT DISTINCT FROM OLD.last_service_date
     AND NEW.last_service_hourmeter IS NOT DISTINCT FROM OLD.last_service_hourmeter
     AND NEW.fuel_type              IS NOT DISTINCT FROM OLD.fuel_type
     AND NEW.type                   IS NOT DISTINCT FROM OLD.type
     AND NEW.service_interval_hours IS NOT DISTINCT FROM OLD.service_interval_hours THEN
    RETURN NEW;
  END IF;

  v_calendar := v_fuel = 'electric'
             OR v_type IN ('battery/electrical','battery / electrical','reach truck','others','electric');

  v_baseline   := NEW.last_service_date;
  v_baseline_h := COALESCE(NEW.last_service_hourmeter, NEW.last_serviced_hourmeter, 0);

  -- Don't try to compute if we have no anchor.
  IF v_baseline IS NULL AND NOT v_calendar AND NEW.last_service_hourmeter IS NULL THEN
    RETURN NEW;
  END IF;

  -- Look up policy via the helper (uses service_intervals + AMC + fallback).
  SELECT * INTO v_int FROM get_service_interval_for_forklift(NEW.forklift_id);

  IF v_calendar THEN
    IF v_baseline IS NOT NULL THEN
      NEW.next_service_due := v_baseline + (COALESCE(v_int.interval_days, 90) || ' days')::INTERVAL;
    END IF;
    NEW.next_service_hourmeter   := NULL;
    -- Don't disturb next_target_service_hour for calendar units; older code reads it.
  ELSE
    NEW.next_service_due      := NULL;
    NEW.next_service_hourmeter   := v_baseline_h + COALESCE(v_int.interval_hours, NEW.service_interval_hours, 450);
    NEW.next_target_service_hour := v_baseline_h + COALESCE(v_int.interval_hours, NEW.service_interval_hours, 450);
  END IF;
  RETURN NEW;
END $$;
COMMENT ON FUNCTION public.set_forklift_next_service IS
  'BEFORE UPDATE on forklifts: when last_service_* or fuel_type/type changes, recompute '
  'next_service_due and next_service_hourmeter via get_service_interval_for_forklift. '
  'Covers UI writers that update only the baseline columns. PR 1b 2026-05-06.';

DROP TRIGGER IF EXISTS trg_set_forklift_next_service ON forklifts;
CREATE TRIGGER trg_set_forklift_next_service
BEFORE UPDATE ON forklifts
FOR EACH ROW
EXECUTE FUNCTION set_forklift_next_service();

-- Sanity: touch a few forklifts (no-op UPDATE) and confirm the trigger does not crash.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT forklift_id FROM forklifts WHERE last_service_date IS NOT NULL LIMIT 5 LOOP
    UPDATE forklifts SET updated_at = NOW() WHERE forklift_id = r.forklift_id;
  END LOOP;
  RAISE NOTICE 'Smoke test: trigger fires cleanly on no-op updates';
END $$;

COMMIT;
