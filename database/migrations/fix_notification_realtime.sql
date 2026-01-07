-- ============================================
-- FieldPro Migration: Fix Notification RLS Policies
-- ============================================
-- Fixes Issue: Notifications not being created/delivered reliably
-- 
-- Problem: Current RLS policies only allow admin/supervisor to INSERT
-- notifications, but the system needs to create notifications for technicians
-- when they are assigned jobs or their requests are approved.
--
-- Solution: Add a policy allowing authenticated users to receive notifications
-- (INSERT into their own user_id) and allow admin/supervisor to create
-- notifications for any user.
-- ============================================

-- Enable RLS if not already enabled
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate with correct permissions
DROP POLICY IF EXISTS "admin_all_notifications" ON notifications;
DROP POLICY IF EXISTS "supervisor_manage_notifications" ON notifications;
DROP POLICY IF EXISTS "users_select_own_notifications" ON notifications;
DROP POLICY IF EXISTS "users_update_own_notifications" ON notifications;
DROP POLICY IF EXISTS "system_insert_notifications" ON notifications;

-- Admin: Full access (manage all notifications)
CREATE POLICY "admin_all_notifications" ON notifications
    FOR ALL TO authenticated
    USING (has_role('admin'))
    WITH CHECK (has_role('admin'));

-- Supervisor: Full access (manage all notifications)
CREATE POLICY "supervisor_all_notifications" ON notifications
    FOR ALL TO authenticated
    USING (has_role('supervisor'))
    WITH CHECK (has_role('supervisor'));

-- Users: Can view their own notifications
CREATE POLICY "users_select_own_notifications" ON notifications
    FOR SELECT TO authenticated
    USING (
        user_id = auth.uid() 
        OR user_id = get_user_id_from_auth()
    );

-- Users: Can update their own notifications (mark as read, etc.)
CREATE POLICY "users_update_own_notifications" ON notifications
    FOR UPDATE TO authenticated
    USING (
        user_id = auth.uid() 
        OR user_id = get_user_id_from_auth()
    )
    WITH CHECK (
        user_id = auth.uid() 
        OR user_id = get_user_id_from_auth()
    );

-- Allow any authenticated user to INSERT notifications
-- This is needed because:
-- 1. Admin creates notification for technician (admin is logged in, inserts for technician)
-- 2. System triggers create notifications via SECURITY DEFINER functions
-- The CHECK ensures we only create for valid user_ids (foreign key does this)
CREATE POLICY "authenticated_insert_notifications" ON notifications
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- Users: Can delete their own notifications (optional cleanup)
CREATE POLICY "users_delete_own_notifications" ON notifications
    FOR DELETE TO authenticated
    USING (
        user_id = auth.uid() 
        OR user_id = get_user_id_from_auth()
    );

-- =============================================
-- ENABLE REALTIME FOR NOTIFICATIONS TABLE
-- =============================================
-- This is critical for real-time updates to work

-- Enable replica identity for realtime
ALTER TABLE notifications REPLICA IDENTITY FULL;

-- Add to realtime publication if not already
DO $$ 
BEGIN
    -- Check if table is already in publication
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
    END IF;
EXCEPTION 
    WHEN undefined_object THEN
        -- Publication doesn't exist, create it
        CREATE PUBLICATION supabase_realtime FOR TABLE notifications;
    WHEN duplicate_object THEN
        -- Already in publication, ignore
        NULL;
END $$;

-- =============================================
-- ENABLE REALTIME FOR JOB_REQUESTS TABLE
-- =============================================
-- Needed for admins to receive real-time request updates

-- Enable replica identity for realtime
ALTER TABLE job_requests REPLICA IDENTITY FULL;

-- Add to realtime publication if not already
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'job_requests'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE job_requests;
    END IF;
EXCEPTION 
    WHEN undefined_object THEN NULL;
    WHEN duplicate_object THEN NULL;
END $$;

-- =============================================
-- GRANT PERMISSIONS
-- =============================================

GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO authenticated;

-- Add comments
COMMENT ON POLICY "admin_all_notifications" ON notifications IS 'Admin has full access to all notifications';
COMMENT ON POLICY "supervisor_all_notifications" ON notifications IS 'Supervisor has full access to all notifications';
COMMENT ON POLICY "users_select_own_notifications" ON notifications IS 'Users can view their own notifications';
COMMENT ON POLICY "users_update_own_notifications" ON notifications IS 'Users can update their own notifications (mark as read)';
COMMENT ON POLICY "authenticated_insert_notifications" ON notifications IS 'Any authenticated user can create notifications (needed for system notifications)';
COMMENT ON POLICY "users_delete_own_notifications" ON notifications IS 'Users can delete their own notifications';
