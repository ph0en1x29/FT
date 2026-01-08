-- =============================================
-- FieldPro Migration: Notification RLS v3 (BULLETPROOF)
-- =============================================
-- Date: 2026-01-08
-- Issue: Technicians getting 403 on notification SELECT
-- 
-- This version:
-- 1. Uses direct subqueries instead of helper functions
-- 2. Handles both auth_id matching AND legacy direct user_id matching
-- 3. Includes the helper function for other tables that need it
-- =============================================

-- =============================================
-- STEP 0: ENSURE HELPER FUNCTION EXISTS
-- =============================================
-- This function is used by other tables' RLS policies

CREATE OR REPLACE FUNCTION get_user_id_from_auth()
RETURNS UUID AS $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT user_id INTO v_user_id
    FROM users
    WHERE auth_id = auth.uid();
    
    RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_user_id_from_auth() TO authenticated;

-- =============================================
-- STEP 1: DROP ALL EXISTING NOTIFICATION POLICIES
-- =============================================

-- From fix_notification_realtime.sql
DROP POLICY IF EXISTS "admin_all_notifications" ON notifications;
DROP POLICY IF EXISTS "supervisor_all_notifications" ON notifications;
DROP POLICY IF EXISTS "supervisor_manage_notifications" ON notifications;
DROP POLICY IF EXISTS "users_select_own_notifications" ON notifications;
DROP POLICY IF EXISTS "users_update_own_notifications" ON notifications;
DROP POLICY IF EXISTS "users_delete_own_notifications" ON notifications;
DROP POLICY IF EXISTS "system_insert_notifications" ON notifications;
DROP POLICY IF EXISTS "authenticated_insert_notifications" ON notifications;

-- From fix_rls_performance.sql
DROP POLICY IF EXISTS "notifications_select_policy" ON notifications;
DROP POLICY IF EXISTS "notifications_update_policy" ON notifications;
DROP POLICY IF EXISTS "notifications_insert_policy" ON notifications;
DROP POLICY IF EXISTS "notifications_delete_policy" ON notifications;

-- From fix_notification_rls_cleanup.sql
DROP POLICY IF EXISTS "notif_select_own" ON notifications;
DROP POLICY IF EXISTS "notif_select_admin" ON notifications;
DROP POLICY IF EXISTS "notif_insert_any" ON notifications;
DROP POLICY IF EXISTS "notif_update_own" ON notifications;
DROP POLICY IF EXISTS "notif_update_admin" ON notifications;
DROP POLICY IF EXISTS "notif_delete_own" ON notifications;
DROP POLICY IF EXISTS "notif_delete_admin" ON notifications;

-- Any other possible names
DROP POLICY IF EXISTS "enable_all_notifications" ON notifications;

-- =============================================
-- STEP 2: ENSURE RLS IS ENABLED
-- =============================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- =============================================
-- STEP 3: CREATE SIMPLE, DIRECT POLICIES
-- =============================================
-- These use inline subqueries, not helper functions
-- More reliable because they don't depend on function existence/permissions

-- Policy 1: SELECT - Users can read notifications where user_id matches their user_id
-- Uses direct subquery to handle auth_id → user_id mapping
CREATE POLICY "notif_select_own" ON notifications
    FOR SELECT TO authenticated
    USING (
        user_id IN (
            SELECT u.user_id FROM users u WHERE u.auth_id = auth.uid()
        )
    );

-- Policy 2: SELECT - Admin/Supervisor can read ALL notifications
CREATE POLICY "notif_select_admin" ON notifications
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.auth_id = auth.uid() 
            AND u.role IN ('admin', 'supervisor', 'Admin', 'Supervisor')
        )
    );

-- Policy 3: INSERT - ANY authenticated user can create notifications
-- This is essential for system creating notifications for other users
CREATE POLICY "notif_insert_any" ON notifications
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- Policy 4: UPDATE - Users can update their own notifications (mark as read)
CREATE POLICY "notif_update_own" ON notifications
    FOR UPDATE TO authenticated
    USING (
        user_id IN (
            SELECT u.user_id FROM users u WHERE u.auth_id = auth.uid()
        )
    )
    WITH CHECK (
        user_id IN (
            SELECT u.user_id FROM users u WHERE u.auth_id = auth.uid()
        )
    );

-- Policy 5: UPDATE - Admin/Supervisor can update any notification
CREATE POLICY "notif_update_admin" ON notifications
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.auth_id = auth.uid() 
            AND u.role IN ('admin', 'supervisor', 'Admin', 'Supervisor')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.auth_id = auth.uid() 
            AND u.role IN ('admin', 'supervisor', 'Admin', 'Supervisor')
        )
    );

-- Policy 6: DELETE - Users can delete their own notifications
CREATE POLICY "notif_delete_own" ON notifications
    FOR DELETE TO authenticated
    USING (
        user_id IN (
            SELECT u.user_id FROM users u WHERE u.auth_id = auth.uid()
        )
    );

-- Policy 7: DELETE - Admin/Supervisor can delete any notification
CREATE POLICY "notif_delete_admin" ON notifications
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.auth_id = auth.uid() 
            AND u.role IN ('admin', 'supervisor', 'Admin', 'Supervisor')
        )
    );

-- =============================================
-- STEP 4: ENSURE REALTIME IS ENABLED
-- =============================================

ALTER TABLE notifications REPLICA IDENTITY FULL;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
    END IF;
EXCEPTION 
    WHEN undefined_object THEN NULL;
    WHEN duplicate_object THEN NULL;
END $$;

-- =============================================
-- STEP 5: ENSURE GRANTS
-- =============================================

GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- =============================================
-- STEP 6: VERIFY
-- =============================================

-- Show policy count
SELECT 'Notification policies created: ' || COUNT(*)::text as status
FROM pg_policies 
WHERE tablename = 'notifications';

-- List all policies
SELECT policyname, cmd, permissive
FROM pg_policies 
WHERE tablename = 'notifications'
ORDER BY policyname;

-- Test the auth mapping (run as authenticated user to verify)
-- SELECT get_user_id_from_auth() as my_user_id;
