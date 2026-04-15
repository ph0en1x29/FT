-- Migration: Allow technicians to delete their own pending job requests
-- Purpose: Techs accidentally create duplicate requests by tapping repeatedly.
--          Let them clean up their own pending requests.
-- Date: 2026-04-14
-- Environment: Production-safe, idempotent

BEGIN;

-- Drop the old admin/supervisor-only delete policy
DROP POLICY IF EXISTS "job_requests_delete" ON job_requests;

-- Recreate: admins/supervisors can delete any, technicians can delete own pending only
CREATE POLICY "job_requests_delete" ON job_requests
  FOR DELETE TO authenticated
  USING (
    (select get_my_role()) IN ('Admin', 'Supervisor')
    OR (
      (select get_my_role()) = 'Technician'
      AND requested_by = auth.uid()
      AND status = 'pending'
    )
  );

COMMIT;
