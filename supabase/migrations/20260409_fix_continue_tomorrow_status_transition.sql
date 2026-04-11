-- 20260409_fix_continue_tomorrow_status_transition.sql
--
-- Problem: "Continue Tomorrow" fails for technicians with "Failed to update job."
--
-- Two blockers found:
--
-- 1. jobs_status_check constraint only allows 5 statuses (New, Assigned,
--    In Progress, Awaiting Finalization, Completed). 'Incomplete - Continuing'
--    is rejected at the constraint level before any trigger fires.
--
-- 2. get_status_order() does not include 'Incomplete - Continuing', returning
--    -1. The validate_job_status_transition trigger interprets 'In Progress' (2)
--    -> 'Incomplete - Continuing' (-1) as a backward transition and blocks it
--    for non-admin users. Same gap blocks Resume Job in the other direction.
--
-- Fix: add 'Incomplete - Continuing' to the CHECK constraint AND to
-- get_status_order() at index 2 (same as 'In Progress'). The two statuses
-- are lateral peers in the job lifecycle — one is active, the other is paused.

BEGIN;

-- Fix 1: Widen the status check constraint
ALTER TABLE public.jobs DROP CONSTRAINT jobs_status_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_status_check
  CHECK (status = ANY (ARRAY[
    'New'::text,
    'Assigned'::text,
    'In Progress'::text,
    'Incomplete - Continuing'::text,
    'Awaiting Finalization'::text,
    'Completed'::text
  ]));

-- Fix 2: Teach get_status_order about the new status
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

-- Post-apply sanity checks
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
