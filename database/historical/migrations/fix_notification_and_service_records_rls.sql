-- =============================================
-- COMPREHENSIVE NOTIFICATION & SERVICE RECORDS FIX
-- File: fix_notification_and_service_records_rls.sql
-- Date: 2025-01-08
-- 
-- This migration fixes:
-- 1. Notification INSERT 403 error (RLS blocking tech inserts)
-- 2. job_service_records 406 error (RLS or missing record)
-- =============================================

-- =============================================
-- PART 1: NOTIFICATION RLS FIX
-- =============================================

-- Drop ALL existing notification policies (both naming conventions)
DROP POLICY IF EXISTS "notif_select_own" ON notifications;
DROP POLICY IF EXISTS "notif_select_admin" ON notifications;
DROP POLICY IF EXISTS "notif_insert_any" ON notifications;
DROP POLICY IF EXISTS "notif_update_own" ON notifications;
DROP POLICY IF EXISTS "notif_update_admin" ON notifications;
DROP POLICY IF EXISTS "notif_delete_own" ON notifications;
DROP POLICY IF EXISTS "notif_delete_admin" ON notifications;
DROP POLICY IF EXISTS "notif_debug_allow_all" ON notifications;
DROP POLICY IF EXISTS "authenticated_insert_notifications" ON notifications;
DROP POLICY IF EXISTS "notifications_insert_policy" ON notifications;
DROP POLICY IF EXISTS "notifications_select_policy" ON notifications;
DROP POLICY IF EXISTS "notifications_update_policy" ON notifications;
DROP POLICY IF EXISTS "notifications_delete_policy" ON notifications;

-- Create/replace SECURITY DEFINER helper functions
-- These bypass RLS on users table during the check
CREATE OR REPLACE FUNCTION get_my_user_id()
RETURNS UUID AS $$
    SELECT user_id FROM users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION get_my_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_user_id() TO anon;

CREATE OR REPLACE FUNCTION is_admin_or_supervisor()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM users 
        WHERE auth_id = auth.uid() 
        AND role IN ('admin', 'supervisor', 'Admin', 'Supervisor')
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION is_admin_or_supervisor() TO authenticated;

-- Create clean notification policies

-- SELECT: Users can read their own notifications
CREATE POLICY "notif_select_own" ON notifications
    FOR SELECT TO authenticated
    USING (user_id = get_my_user_id());

-- SELECT: Admin/Supervisor can read ALL notifications
CREATE POLICY "notif_select_admin" ON notifications
    FOR SELECT TO authenticated
    USING (is_admin_or_supervisor());

-- INSERT: ANY authenticated user can create notifications
-- This is critical for system to create notifications for other users
CREATE POLICY "notif_insert_any" ON notifications
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- UPDATE: Users can update their own notifications (mark as read)
CREATE POLICY "notif_update_own" ON notifications
    FOR UPDATE TO authenticated
    USING (user_id = get_my_user_id())
    WITH CHECK (user_id = get_my_user_id());

-- UPDATE: Admin/Supervisor can update any notification
CREATE POLICY "notif_update_admin" ON notifications
    FOR UPDATE TO authenticated
    USING (is_admin_or_supervisor())
    WITH CHECK (is_admin_or_supervisor());

-- DELETE: Users can delete their own notifications
CREATE POLICY "notif_delete_own" ON notifications
    FOR DELETE TO authenticated
    USING (user_id = get_my_user_id());

-- DELETE: Admin/Supervisor can delete any notification
CREATE POLICY "notif_delete_admin" ON notifications
    FOR DELETE TO authenticated
    USING (is_admin_or_supervisor());

-- =============================================
-- PART 2: JOB_SERVICE_RECORDS RLS FIX
-- =============================================

-- Check if job_service_records table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'job_service_records') THEN
        -- Enable RLS if not already enabled
        ALTER TABLE job_service_records ENABLE ROW LEVEL SECURITY;
        
        -- Drop existing policies
        DROP POLICY IF EXISTS "job_service_records_select_policy" ON job_service_records;
        DROP POLICY IF EXISTS "job_service_records_insert_policy" ON job_service_records;
        DROP POLICY IF EXISTS "job_service_records_update_policy" ON job_service_records;
        DROP POLICY IF EXISTS "job_service_records_delete_policy" ON job_service_records;
        DROP POLICY IF EXISTS "service_records_select_all" ON job_service_records;
        DROP POLICY IF EXISTS "service_records_insert_all" ON job_service_records;
        DROP POLICY IF EXISTS "service_records_update_all" ON job_service_records;
        
        -- Create permissive policies for job_service_records
        -- All authenticated users can read service records (needed for job details)
        CREATE POLICY "service_records_select_all" ON job_service_records
            FOR SELECT TO authenticated
            USING (true);
        
        -- All authenticated users can insert service records
        CREATE POLICY "service_records_insert_all" ON job_service_records
            FOR INSERT TO authenticated
            WITH CHECK (true);
        
        -- All authenticated users can update service records
        CREATE POLICY "service_records_update_all" ON job_service_records
            FOR UPDATE TO authenticated
            USING (true)
            WITH CHECK (true);
        
        -- Grant permissions
        GRANT SELECT, INSERT, UPDATE, DELETE ON job_service_records TO authenticated;
        
        RAISE NOTICE 'job_service_records RLS policies created successfully';
    ELSE
        RAISE NOTICE 'job_service_records table does not exist, skipping';
    END IF;
END $$;

-- =============================================
-- VERIFICATION
-- =============================================

-- Show notification policies
SELECT 'NOTIFICATION POLICIES:' as section;
SELECT policyname, cmd, permissive 
FROM pg_policies 
WHERE tablename = 'notifications'
ORDER BY cmd, policyname;

-- Show job_service_records policies (if table exists)
SELECT 'JOB_SERVICE_RECORDS POLICIES:' as section;
SELECT policyname, cmd, permissive 
FROM pg_policies 
WHERE tablename = 'job_service_records'
ORDER BY cmd, policyname;

-- =============================================
-- DONE
-- =============================================
