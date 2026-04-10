-- 20260409_fix_continue_tomorrow_status_transition.sql
--
-- Problem: "Continue Tomorrow" fails for technicians with "Failed to update job."
--
-- Root cause: get_status_order() does not know about 'Incomplete - Continuing',
-- so it returns -1. The validate_job_status_transition trigger interprets
-- 'In Progress' (2) -> 'Incomplete - Continuing' (-1) as a backward transition
-- and blocks it for non-admin users. The same gap blocks "Resume Job"
-- ('Incomplete - Continuing' -> 'In Progress') because -1 -> 2 looks like a
-- 3-step forward skip, which is also rejected for technicians.
--
-- Fix: add 'Incomplete - Continuing' to get_status_order() at index 2 (same as
-- 'In Progress'). The two statuses are lateral peers in the job lifecycle —
-- one is active, the other is paused. Equal indices mean the trigger treats
-- both transitions as a no-op (neither forward nor backward), so they pass
-- through for all roles.

BEGIN;

CREATE OR REPLACE FUNCTION get_status_order(status_val TEXT)
RETURNS INTEGER AS $$
BEGIN
    RETURN CASE status_val
        WHEN 'New' THEN 0
        WHEN 'Assigned' THEN 1
        WHEN 'In Progress' THEN 2
        WHEN 'Incomplete - Continuing' THEN 2
        WHEN 'Awaiting Finalization' THEN 3
        WHEN 'Completed' THEN 4
        ELSE -1
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Post-apply sanity check
DO $$
BEGIN
  IF get_status_order('Incomplete - Continuing') != 2 THEN
    RAISE EXCEPTION 'get_status_order did not return 2 for Incomplete - Continuing';
  END IF;
  IF get_status_order('In Progress') != 2 THEN
    RAISE EXCEPTION 'get_status_order did not return 2 for In Progress';
  END IF;
END $$;

COMMIT;
