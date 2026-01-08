-- =============================================
-- FieldPro Migration: Notification RLS Cleanup (COMPREHENSIVE)
-- =============================================
-- Date: 2026-01-08
-- Issue: Conflicting RLS policies blocking notification inserts
-- 
-- Root Cause: Two migration files created overlapping policies:
--   - fix_notification_realtime.sql: *_notifications policies
--   - fix_rls_performance.sql: notifications_*_policy policies
-- 
-- This migration drops ALL policies and creates ONE clean set.
-- =============================================

-- =============================================
-- STEP 1: DROP ALL EXISTING NOTIFICATION POLICIES
-- =============================================

-- From fix_notification_realtime.sql (newer naming)
DROP POLICY IF EXISTS "admin_all_notifications" ON notifications;
DROP POLICY IF EXISTS "supervisor_all_notifications" ON notifications;
DROP POLICY IF EXISTS "supervisor_manage_notifications" ON notifications;
DROP POLICY IF EXISTS "users_select_own_notifications" ON notifications;
DROP POLICY IF EXISTS "users_update_own_notifications" ON notifications;
DROP POLICY IF EXISTS "users_delete_own_notifications" ON notifications;
DROP POLICY IF EXISTS "system_insert_notifications" ON notifications;
DROP POLICY IF EXISTS "authenticated_insert_notifications" ON notifications;

-- From fix_rls_performance.sql (legacy naming)
DROP POLICY IF EXISTS "notifications_select_policy" ON notifications;
DROP POLICY IF EXISTS "notifications_update_policy" ON notifications;
DROP POLICY IF EXISTS "notifications_insert_policy" ON notifications;
DROP POLICY IF EXISTS "notifications_delete_policy" ON notifications;

-- Any other possible policy names
DROP POLICY IF EXISTS "notifications_admin_policy" ON notifications;
DROP POLICY IF EXISTS "notifications_user_policy" ON notifications;
DROP POLICY IF EXISTS "enable_all_notifications" ON notifications;

-- =============================================
-- STEP 2: ENSURE RLS IS ENABLED
-- =============================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- =============================================
-- STEP 3: CREATE CLEAN POLICY SET
-- =============================================

-- Policy 1: SELECT - Users can read their own notifications
-- Admin/Supervisor can read all (handled by separate policy)
CREATE POLICY "notif_select_own" ON notifications
    FOR SELECT TO authenticated
    USING (
        user_id = get_user_id_from_auth()
    );

-- Policy 2: SELECT - Admin/Supervisor can read ALL notifications
CREATE POLICY "notif_select_admin" ON notifications
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_id = auth.uid() 
            AND users.role IN ('admin', 'supervisor', 'Admin', 'Supervisor')
        )
    );

-- Policy 3: INSERT - ANY authenticated user can create notifications
-- This is essential for: system creating notifications for technicians,
-- admins creating notifications for others, etc.
CREATE POLICY "notif_insert_any" ON notifications
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- Policy 4: UPDATE - Users can update their own notifications (mark as read)
CREATE POLICY "notif_update_own" ON notifications
    FOR UPDATE TO authenticated
    USING (user_id = get_user_id_from_auth())
    WITH CHECK (user_id = get_user_id_from_auth());

-- Policy 5: UPDATE - Admin/Supervisor can update any notification
CREATE POLICY "notif_update_admin" ON notifications
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_id = auth.uid() 
            AND users.role IN ('admin', 'supervisor', 'Admin', 'Supervisor')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_id = auth.uid() 
            AND users.role IN ('admin', 'supervisor', 'Admin', 'Supervisor')
        )
    );

-- Policy 6: DELETE - Users can delete their own notifications
CREATE POLICY "notif_delete_own" ON notifications
    FOR DELETE TO authenticated
    USING (user_id = get_user_id_from_auth());

-- Policy 7: DELETE - Admin/Supervisor can delete any notification
CREATE POLICY "notif_delete_admin" ON notifications
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.auth_id = auth.uid() 
            AND users.role IN ('admin', 'supervisor', 'Admin', 'Supervisor')
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

-- Show final policy count (should be 7)
SELECT 
    'Policies created: ' || COUNT(*)::text as status
FROM pg_policies 
WHERE tablename = 'notifications';

-- List all policies for verification
SELECT 
    policyname,
    cmd,
    permissive
FROM pg_policies 
WHERE tablename = 'notifications'
ORDER BY policyname;
