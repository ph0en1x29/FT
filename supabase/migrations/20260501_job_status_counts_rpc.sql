-- =============================================
-- FieldPro Migration: get_job_status_counts() RPC
-- =============================================
-- Date: 2026-05-01
-- Purpose:
--   The previous JS implementation issued 11 parallel `count: 'exact', head: true`
--   queries to the jobs table to produce the JobBoard QuickStats KPI tiles.
--   The 750ms client-side debounce added in pages/JobBoard/hooks/useJobData.ts
--   already collapses bursts of realtime events into one fetch — this RPC
--   collapses that one fetch into a single SQL round-trip with one index scan
--   instead of eleven.
-- =============================================

BEGIN;

CREATE OR REPLACE FUNCTION get_job_status_counts(
  p_user_id uuid,
  p_is_technician boolean
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT jsonb_build_object(
    'total',                COUNT(*),
    'new',                  COUNT(*) FILTER (WHERE status = 'New'),
    'assigned',             COUNT(*) FILTER (WHERE status = 'Assigned'),
    'inProgress',           COUNT(*) FILTER (WHERE status = 'In Progress'),
    'awaiting',             COUNT(*) FILTER (WHERE status = 'Awaiting Finalization'),
    'completed',            COUNT(*) FILTER (WHERE status = 'Completed'),
    'awaitingAck',          COUNT(*) FILTER (WHERE status = 'Completed Awaiting Acknowledgement'),
    'disputed',             COUNT(*) FILTER (WHERE status = 'Disputed'),
    'incompleteContinuing', COUNT(*) FILTER (WHERE status = 'Incomplete - Continuing'),
    'incompleteReassigned', COUNT(*) FILTER (WHERE status = 'Incomplete - Reassigned'),
    'slotInPendingAck',     COUNT(*) FILTER (
        WHERE job_type = 'Slot-In'
          AND acknowledged_at IS NULL
          AND status NOT IN ('Completed', 'Cancelled')
      )
  )
  FROM jobs
  WHERE deleted_at IS NULL
    AND (NOT p_is_technician OR assigned_technician_id = p_user_id);
$$;

GRANT EXECUTE ON FUNCTION get_job_status_counts(uuid, boolean) TO authenticated;

COMMIT;

-- Sanity check
SELECT get_job_status_counts(NULL::uuid, FALSE);
