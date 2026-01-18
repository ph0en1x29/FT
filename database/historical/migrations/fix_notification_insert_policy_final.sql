-- =============================================
-- FieldPro Migration: Final Notification RLS Fix
-- =============================================
-- Date: 2026-01-08
-- Description: Aggressively cleans up and resets Notification RLS policies.
--              Ensures INSERT is allowed for all authenticated users.
--              Uses direct subqueries to avoid function dependency issues.
-- =============================================

BEGIN;

-- 1. Enable RLS (just in case)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 2. Drop ALL existing policies to ensure a clean slate
-- We drop by potential names used in previous migrations
DROP POLICY IF EXISTS "admin_all_notifications" ON notifications;
DROP POLICY IF EXISTS "supervisor_all_notifications" ON notifications;
DROP POLICY IF EXISTS "supervisor_manage_notifications" ON notifications;
DROP POLICY IF EXISTS "users_select_own_notifications" ON notifications;
DROP POLICY IF EXISTS "users_update_own_notifications" ON notifications;
DROP POLICY IF EXISTS "users_delete_own_notifications" ON notifications;
DROP POLICY IF EXISTS "system_insert_notifications" ON notifications;
DROP POLICY IF EXISTS "authenticated_insert_notifications" ON notifications;
DROP POLICY IF EXISTS "notifications_select_policy" ON notifications;
DROP POLICY IF EXISTS "notifications_update_policy" ON notifications;
DROP POLICY IF EXISTS "notifications_insert_policy" ON notifications;
DROP POLICY IF EXISTS "notifications_delete_policy" ON notifications;
DROP POLICY IF EXISTS "notif_select_own" ON notifications;
DROP POLICY IF EXISTS "notif_select_admin" ON notifications;
DROP POLICY IF EXISTS "notif_insert_any" ON notifications;
DROP POLICY IF EXISTS "notif_update_own" ON notifications;
DROP POLICY IF EXISTS "notif_update_admin" ON notifications;
DROP POLICY IF EXISTS "notif_delete_own" ON notifications;
DROP POLICY IF EXISTS "notif_delete_admin" ON notifications;
DROP POLICY IF EXISTS "notifications_admin_policy" ON notifications;
DROP POLICY IF EXISTS "notifications_user_policy" ON notifications;
DROP POLICY IF EXISTS "enable_all_notifications" ON notifications;

-- 3. Create simplified, robust policies

-- INSERT: Allow ANY authenticated user to insert ANY notification.
-- This is critical for cross-user notifications (e.g. tech requesting assistance)
CREATE POLICY "policy_notifications_insert" ON notifications
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- SELECT: Users see their own + Admins/Supervisors see all
CREATE POLICY "policy_notifications_select" ON notifications
    FOR SELECT TO authenticated
    USING (
        -- User sees their own
        user_id IN (SELECT user_id FROM users WHERE auth_id = auth.uid())
        OR
        -- Admin/Supervisor sees all
        EXISTS (
            SELECT 1 FROM users 
            WHERE auth_id = auth.uid() 
            AND role IN ('admin', 'supervisor', 'Admin', 'Supervisor')
        )
    );

-- UPDATE: Users can update their own (e.g. mark read) + Admins update all
CREATE POLICY "policy_notifications_update" ON notifications
    FOR UPDATE TO authenticated
    USING (
        -- User updates their own
        user_id IN (SELECT user_id FROM users WHERE auth_id = auth.uid())
        OR
        -- Admin/Supervisor updates all
        EXISTS (
            SELECT 1 FROM users 
            WHERE auth_id = auth.uid() 
            AND role IN ('admin', 'supervisor', 'Admin', 'Supervisor')
        )
    )
    WITH CHECK (true); -- simplified check, rely on USING

-- DELETE: Users delete their own + Admins delete all
CREATE POLICY "policy_notifications_delete" ON notifications
    FOR DELETE TO authenticated
    USING (
        -- User deletes their own
        user_id IN (SELECT user_id FROM users WHERE auth_id = auth.uid())
        OR
        -- Admin/Supervisor deletes all
        EXISTS (
            SELECT 1 FROM users 
            WHERE auth_id = auth.uid() 
            AND role IN ('admin', 'supervisor', 'Admin', 'Supervisor')
        )
    );

-- 4. Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO authenticated;

COMMIT;
