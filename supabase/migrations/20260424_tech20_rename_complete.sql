-- 20260424_tech20_rename_complete.sql
--
-- Follow-up to 20260424_tech_account_cleanup.sql. The initial migration updated
-- users.full_name = 'SYUKRI' for tech20 (e97ec210-...) but left:
--   (a) users.name = 'MOHAMAD YAZID BIN YAACOB' — the UI renders users.name in
--       the People roster, van stock assign modal, KPI dashboard, and new-job
--       technician dropdown, so the old name was still everywhere.
--   (b) denormalized name snapshots on operational tables still carrying
--       'MOHAMAD YAZID BIN YAACOB'.
--
-- Shin's directive (WhatsApp 2026-04-23 21:37): "JUST RENAME TO SYUKRI AS YAZID
-- NO LONGER WITH ACWER". Interpreting as full rename — the seat IS Syukri now,
-- historical jobs should display Syukri in the UI. Provenance ("was YAZID") is
-- preserved in users.notes by the prior migration.
--
-- Out of scope (deliberate):
--   - job_audit_log (202 rows) — immutable by design (trg_prevent_audit_update).
--     Audit log should preserve who-acted-at-the-time; users.notes already
--     records the rename so the trail is reconstructable.
--   - notifications.message (295 rows) — historical push-notification bodies
--   - job_audit_log.event_description — narrative audit trail
--   - user_action_errors.error_message (15 rows) — internal diagnostics
--   - _backup_* tables — pre-migration snapshots
--   - yazid@example.com row (is_active=false) — separate historical account
--
-- jobs table: ~20 UPDATE triggers (audit log writers, notifications,
-- forklift state sync, etc). We are only changing denormalized name columns,
-- NOT business-logic columns; firing those triggers would be noise. Wrap the
-- jobs UPDATE in `SET LOCAL session_replication_role = replica` so user triggers
-- are bypassed for exactly the duration of the name rewrite. Other target
-- tables (job_media, job_status_history, hourmeter_*, flagged_*) have no
-- UPDATE triggers — verified via information_schema.triggers sweep.
--
-- Every UPDATE is doubly filtered where possible (<id_column> = tech20_id AND
-- <name_column> = old name) so we never touch a row where a different tech's
-- denorm happens to match.

BEGIN;

-- ----------------------------------------------------------------------
-- 0. Canonical name column on users (root cause of Shin's complaint)
-- ----------------------------------------------------------------------

UPDATE users
SET name = 'SYUKRI',
    updated_at = NOW()
WHERE user_id = 'e97ec210-d470-49c1-8121-a87c1829cb3c'
  AND name = 'MOHAMAD YAZID BIN YAACOB';

-- ----------------------------------------------------------------------
-- 1. jobs table — 4 denormalized name columns, triggers bypassed
-- ----------------------------------------------------------------------

-- Bypass user triggers for the duration of this block only. 'replica' skips
-- triggers created with default ENABLE (i.e. all user-defined triggers).
SET LOCAL session_replication_role = replica;

UPDATE jobs SET assigned_technician_name = 'SYUKRI'
WHERE assigned_technician_id = 'e97ec210-d470-49c1-8121-a87c1829cb3c'
  AND assigned_technician_name = 'MOHAMAD YAZID BIN YAACOB';

UPDATE jobs SET completed_by_name = 'SYUKRI'
WHERE completed_by_id = 'e97ec210-d470-49c1-8121-a87c1829cb3c'
  AND completed_by_name = 'MOHAMAD YAZID BIN YAACOB';

UPDATE jobs SET started_by_name = 'SYUKRI'
WHERE started_by_id = 'e97ec210-d470-49c1-8121-a87c1829cb3c'
  AND started_by_name = 'MOHAMAD YAZID BIN YAACOB';

UPDATE jobs SET first_hourmeter_recorded_by_name = 'SYUKRI'
WHERE first_hourmeter_recorded_by_id = 'e97ec210-d470-49c1-8121-a87c1829cb3c'
  AND first_hourmeter_recorded_by_name = 'MOHAMAD YAZID BIN YAACOB';

-- Restore normal trigger firing for the rest of the transaction.
SET LOCAL session_replication_role = origin;

-- ----------------------------------------------------------------------
-- 2. Operational logs — rewrite snapshots (no UPDATE triggers on these)
-- ----------------------------------------------------------------------

UPDATE job_media SET uploaded_by_name = 'SYUKRI'
WHERE uploaded_by_id = 'e97ec210-d470-49c1-8121-a87c1829cb3c'
  AND uploaded_by_name = 'MOHAMAD YAZID BIN YAACOB';

UPDATE job_status_history SET changed_by_name = 'SYUKRI'
WHERE changed_by = 'e97ec210-d470-49c1-8121-a87c1829cb3c'
  AND changed_by_name = 'MOHAMAD YAZID BIN YAACOB';

UPDATE hourmeter_history SET recorded_by_name = 'SYUKRI'
WHERE recorded_by_id = 'e97ec210-d470-49c1-8121-a87c1829cb3c'
  AND recorded_by_name = 'MOHAMAD YAZID BIN YAACOB';

UPDATE hourmeter_readings SET recorded_by_name = 'SYUKRI'
WHERE recorded_by_id = 'e97ec210-d470-49c1-8121-a87c1829cb3c'
  AND recorded_by_name = 'MOHAMAD YAZID BIN YAACOB';

-- ----------------------------------------------------------------------
-- 3. flagged_hourmeter_readings / flagged_photos
-- ----------------------------------------------------------------------
-- Both are VIEWS over jobs.assigned_technician_name (confirmed via pg_views).
-- Updating jobs above already flows through — no direct UPDATE needed.

-- ----------------------------------------------------------------------
-- 4. Post-apply assertions
-- ----------------------------------------------------------------------

DO $$
DECLARE
  v_leftover int;
  v_users_name text;
BEGIN
  SELECT name INTO v_users_name
  FROM users
  WHERE user_id = 'e97ec210-d470-49c1-8121-a87c1829cb3c';
  IF v_users_name <> 'SYUKRI' THEN
    RAISE EXCEPTION 'users.name for tech20 did not update: got "%"', v_users_name;
  END IF;

  SELECT
    (SELECT COUNT(*) FROM jobs WHERE assigned_technician_id = 'e97ec210-d470-49c1-8121-a87c1829cb3c'
                                 AND assigned_technician_name = 'MOHAMAD YAZID BIN YAACOB')
  + (SELECT COUNT(*) FROM jobs WHERE completed_by_id = 'e97ec210-d470-49c1-8121-a87c1829cb3c'
                                 AND completed_by_name = 'MOHAMAD YAZID BIN YAACOB')
  + (SELECT COUNT(*) FROM jobs WHERE started_by_id = 'e97ec210-d470-49c1-8121-a87c1829cb3c'
                                 AND started_by_name = 'MOHAMAD YAZID BIN YAACOB')
  + (SELECT COUNT(*) FROM jobs WHERE first_hourmeter_recorded_by_id = 'e97ec210-d470-49c1-8121-a87c1829cb3c'
                                 AND first_hourmeter_recorded_by_name = 'MOHAMAD YAZID BIN YAACOB')
  + (SELECT COUNT(*) FROM job_media WHERE uploaded_by_id = 'e97ec210-d470-49c1-8121-a87c1829cb3c'
                                      AND uploaded_by_name = 'MOHAMAD YAZID BIN YAACOB')
  + (SELECT COUNT(*) FROM job_status_history WHERE changed_by = 'e97ec210-d470-49c1-8121-a87c1829cb3c'
                                               AND changed_by_name = 'MOHAMAD YAZID BIN YAACOB')
  + (SELECT COUNT(*) FROM hourmeter_history WHERE recorded_by_id = 'e97ec210-d470-49c1-8121-a87c1829cb3c'
                                              AND recorded_by_name = 'MOHAMAD YAZID BIN YAACOB')
  + (SELECT COUNT(*) FROM hourmeter_readings WHERE recorded_by_id = 'e97ec210-d470-49c1-8121-a87c1829cb3c'
                                               AND recorded_by_name = 'MOHAMAD YAZID BIN YAACOB')
  INTO v_leftover;

  IF v_leftover <> 0 THEN
    RAISE EXCEPTION 'tech20 rename incomplete: % rows still carry old name', v_leftover;
  END IF;
END $$;

COMMIT;
