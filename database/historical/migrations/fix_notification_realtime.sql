-- =============================================
-- FieldPro Migration: Fix Notification RLS Policies (SAFE VERSION)
-- =============================================
-- Fixes Issue: Notifications not being created/delivered reliably
-- 
-- This version safely drops ALL existing policies before recreating
-- to avoid "policy already exists" errors.
-- =============================================

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing notification policies (safe - no error if doesn't exist)
DROP POLICY IF EXISTS "admin_all_notifications" ON notifications;
DROP POLICY IF EXISTS "supervisor_all_notifications" ON notifications;
DROP POLICY IF EXISTS "supervisor_manage_notifications" ON notifications;
DROP POLICY IF EXISTS "users_select_own_notifications" ON notifications;
DROP POLICY IF EXISTS "users_update_own_notifications" ON notifications;
DROP POLICY IF EXISTS "users_delete_own_notifications" ON notifications;
DROP POLICY IF EXISTS "system_insert_notifications" ON notifications;
DROP POLICY IF EXISTS "authenticated_insert_notifications" ON notifications;

-- =============================================
-- RECREATE POLICIES
-- =============================================

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
    USING (user_id = auth.uid() OR user_id = get_user_id_from_auth());

-- Users: Can update their own notifications (mark as read)
CREATE POLICY "users_update_own_notifications" ON notifications
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid() OR user_id = get_user_id_from_auth())
    WITH CHECK (user_id = auth.uid() OR user_id = get_user_id_from_auth());

-- Allow any authenticated user to INSERT notifications
-- Needed for: Admin creating notifications for technicians, system triggers
CREATE POLICY "authenticated_insert_notifications" ON notifications
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- Users: Can delete their own notifications
CREATE POLICY "users_delete_own_notifications" ON notifications
    FOR DELETE TO authenticated
    USING (user_id = auth.uid() OR user_id = get_user_id_from_auth());

-- =============================================
-- ENABLE REALTIME
-- =============================================

-- Enable replica identity for realtime (needed for postgres_changes)
ALTER TABLE notifications REPLICA IDENTITY FULL;

-- Add to realtime publication if not already
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

-- Enable realtime for job_requests too
ALTER TABLE job_requests REPLICA IDENTITY FULL;

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

-- =============================================
-- VERIFY
-- =============================================

SELECT 'Notification RLS policies applied successfully' as status;
