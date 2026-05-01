-- =============================================
-- FieldPro Migration: Skip notifications for soft-deleted jobs
-- =============================================
-- Date: 2026-05-01
-- Purpose:
--   Previously, useRealtimeNotifications.ts ran a per-notification single-row
--   SELECT on the realtime path to filter out notifications referencing
--   soft-deleted jobs. The 2026-05-01 audit confirmed 0 such rows currently
--   exist — the client filter was pure overhead. This trigger keeps that
--   guarantee at the database level so the client filter can be removed.
--
--   If a notification is INSERTed referencing a job that's already been
--   soft-deleted, the trigger drops it. Existing rows are unaffected.
-- =============================================

BEGIN;

CREATE OR REPLACE FUNCTION skip_notifications_for_deleted_jobs() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.reference_type = 'job' AND NEW.reference_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM jobs
      WHERE job_id = NEW.reference_id::uuid AND deleted_at IS NOT NULL
    ) THEN
      RETURN NULL;  -- silently skip — not an error
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_skip_deleted ON notifications;
CREATE TRIGGER trg_notifications_skip_deleted
  BEFORE INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION skip_notifications_for_deleted_jobs();

COMMIT;

-- Verify
SELECT tgname, tgrelid::regclass AS on_table
FROM pg_trigger
WHERE tgname = 'trg_notifications_skip_deleted';
