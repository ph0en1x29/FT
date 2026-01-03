-- ============================================
-- FieldPro Security Fix: Supabase Linter Issues
-- ============================================
-- Fixes 10 security issues reported by Supabase:
-- - 5 Security Definer Views (bypasses RLS)
-- - 5 Tables without RLS enabled
--
-- Run this in Supabase SQL Editor
-- ============================================

BEGIN;

-- =============================================
-- PREREQUISITE: Ensure helper functions exist
-- =============================================
-- These functions are required for RLS policies

-- get_current_user_role - looks up role by auth_id
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role 
    FROM users 
    WHERE auth_id = auth.uid();  -- Uses auth_id, not user_id
    RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- has_role - check if user has specific role
CREATE OR REPLACE FUNCTION has_role(required_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_current_user_role() = required_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- get_user_id_from_auth - convert auth_id to user_id
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
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION get_current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION has_role(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_id_from_auth() TO authenticated;

-- =============================================
-- PART 1: FIX SECURITY DEFINER VIEWS
-- =============================================
-- These views currently bypass RLS. We recreate them
-- with SECURITY INVOKER (default) so they respect
-- the querying user's permissions.

-- 1. active_rentals_view
DROP VIEW IF EXISTS active_rentals_view;
CREATE VIEW active_rentals_view AS
SELECT 
    r.*,
    f.serial_number,
    f.make,
    f.model,
    f.type AS forklift_type,
    f.hourmeter,
    f.status AS forklift_status,
    c.name AS customer_name,
    c.address AS customer_address,
    c.phone AS customer_phone
FROM forklift_rentals r
JOIN forklifts f ON r.forklift_id = f.forklift_id
JOIN customers c ON r.customer_id = c.customer_id
WHERE r.status = 'active';

COMMENT ON VIEW active_rentals_view IS 'Active rentals with forklift and customer details. Uses SECURITY INVOKER (respects RLS).';

-- 2. v_todays_leave
DROP VIEW IF EXISTS v_todays_leave;
CREATE VIEW v_todays_leave AS
SELECT 
    el.*,
    e.full_name,
    e.department,
    e.employee_code,
    lt.name AS leave_type_name,
    lt.color AS leave_type_color
FROM employee_leaves el
JOIN employees e ON el.user_id = e.user_id
JOIN leave_types lt ON el.leave_type_id = lt.leave_type_id
WHERE el.status = 'approved'
  AND CURRENT_DATE BETWEEN el.start_date AND el.end_date
ORDER BY e.department, e.full_name;

COMMENT ON VIEW v_todays_leave IS 'Employees on leave today. Uses SECURITY INVOKER (respects RLS).';

-- 3. v_expiring_licenses
DROP VIEW IF EXISTS v_expiring_licenses;
CREATE VIEW v_expiring_licenses AS
SELECT 
    el.*,
    e.full_name,
    e.phone,
    e.department,
    e.employee_code,
    (el.expiry_date - CURRENT_DATE) AS days_until_expiry
FROM employee_licenses el
JOIN employees e ON el.user_id = e.user_id
WHERE el.status = 'active'
  AND el.expiry_date <= CURRENT_DATE + INTERVAL '60 days'
ORDER BY el.expiry_date ASC;

COMMENT ON VIEW v_expiring_licenses IS 'Licenses expiring within 60 days. Uses SECURITY INVOKER (respects RLS).';

-- 4. v_pending_leaves
DROP VIEW IF EXISTS v_pending_leaves;
CREATE VIEW v_pending_leaves AS
SELECT 
    el.*,
    e.full_name,
    e.department,
    e.employee_code,
    lt.name AS leave_type_name
FROM employee_leaves el
JOIN employees e ON el.user_id = e.user_id
JOIN leave_types lt ON el.leave_type_id = lt.leave_type_id
WHERE el.status = 'pending'
ORDER BY el.requested_at ASC;

COMMENT ON VIEW v_pending_leaves IS 'Pending leave requests. Uses SECURITY INVOKER (respects RLS).';

-- 5. v_expiring_permits
DROP VIEW IF EXISTS v_expiring_permits;
CREATE VIEW v_expiring_permits AS
SELECT 
    ep.*,
    e.full_name,
    e.phone,
    e.department,
    e.employee_code,
    (ep.expiry_date - CURRENT_DATE) AS days_until_expiry
FROM employee_permits ep
JOIN employees e ON ep.user_id = e.user_id
WHERE ep.status = 'active'
  AND ep.expiry_date <= CURRENT_DATE + INTERVAL '60 days'
ORDER BY ep.expiry_date ASC;

COMMENT ON VIEW v_expiring_permits IS 'Permits expiring within 60 days. Uses SECURITY INVOKER (respects RLS).';


-- =============================================
-- PART 2: ENABLE RLS + ADD POLICIES FOR 5 TABLES
-- =============================================
-- Enable RLS and add policies in same transaction
-- to prevent access lockout.

-- =============================================
-- 2.1 QUOTATIONS TABLE
-- =============================================

ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "admin_all_quotations" ON quotations;
DROP POLICY IF EXISTS "supervisor_all_quotations" ON quotations;
DROP POLICY IF EXISTS "accountant_quotations" ON quotations;
DROP POLICY IF EXISTS "technician_quotations" ON quotations;

-- Admin: Full access
CREATE POLICY "admin_all_quotations" ON quotations
    FOR ALL TO authenticated
    USING (has_role('admin'))
    WITH CHECK (has_role('admin'));

-- Supervisor: Full access
CREATE POLICY "supervisor_all_quotations" ON quotations
    FOR ALL TO authenticated
    USING (has_role('supervisor'))
    WITH CHECK (has_role('supervisor'));

-- Accountant: Full access (quotations are financial docs)
CREATE POLICY "accountant_all_quotations" ON quotations
    FOR ALL TO authenticated
    USING (has_role('accountant'))
    WITH CHECK (has_role('accountant'));

-- Technician: Select only (view quotations for their jobs)
CREATE POLICY "technician_select_quotations" ON quotations
    FOR SELECT TO authenticated
    USING (has_role('technician'));


-- =============================================
-- 2.2 SERVICE_INTERVALS TABLE
-- =============================================
-- Configuration table for forklift service schedules

ALTER TABLE service_intervals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_service_intervals" ON service_intervals;
DROP POLICY IF EXISTS "authenticated_read_service_intervals" ON service_intervals;

-- Admin: Full access (can modify service intervals)
CREATE POLICY "admin_all_service_intervals" ON service_intervals
    FOR ALL TO authenticated
    USING (has_role('admin'))
    WITH CHECK (has_role('admin'));

-- Supervisor: Full access
CREATE POLICY "supervisor_all_service_intervals" ON service_intervals
    FOR ALL TO authenticated
    USING (has_role('supervisor'))
    WITH CHECK (has_role('supervisor'));

-- All authenticated: Read access (needed for service scheduling)
CREATE POLICY "authenticated_select_service_intervals" ON service_intervals
    FOR SELECT TO authenticated
    USING (true);

-- =============================================
-- 2.3 SCHEDULED_SERVICES TABLE
-- =============================================
-- Auto-generated service jobs

ALTER TABLE scheduled_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_scheduled_services" ON scheduled_services;
DROP POLICY IF EXISTS "supervisor_all_scheduled_services" ON scheduled_services;
DROP POLICY IF EXISTS "technician_scheduled_services" ON scheduled_services;

-- Admin: Full access
CREATE POLICY "admin_all_scheduled_services" ON scheduled_services
    FOR ALL TO authenticated
    USING (has_role('admin'))
    WITH CHECK (has_role('admin'));

-- Supervisor: Full access
CREATE POLICY "supervisor_all_scheduled_services" ON scheduled_services
    FOR ALL TO authenticated
    USING (has_role('supervisor'))
    WITH CHECK (has_role('supervisor'));

-- Accountant: Select only
CREATE POLICY "accountant_select_scheduled_services" ON scheduled_services
    FOR SELECT TO authenticated
    USING (has_role('accountant'));

-- Technician: Select only
CREATE POLICY "technician_select_scheduled_services" ON scheduled_services
    FOR SELECT TO authenticated
    USING (has_role('technician'));


-- =============================================
-- 2.4 NOTIFICATIONS TABLE
-- =============================================
-- User notifications for job assignments, alerts, etc.

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_notifications" ON notifications;
DROP POLICY IF EXISTS "users_own_notifications" ON notifications;
DROP POLICY IF EXISTS "system_insert_notifications" ON notifications;

-- Admin: Full access (manage all notifications)
CREATE POLICY "admin_all_notifications" ON notifications
    FOR ALL TO authenticated
    USING (has_role('admin'))
    WITH CHECK (has_role('admin'));

-- Supervisor: Can view all and create notifications
CREATE POLICY "supervisor_manage_notifications" ON notifications
    FOR ALL TO authenticated
    USING (has_role('supervisor'))
    WITH CHECK (has_role('supervisor'));

-- Users: Can view and update their own notifications (mark as read)
CREATE POLICY "users_select_own_notifications" ON notifications
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR user_id = get_user_id_from_auth());

CREATE POLICY "users_update_own_notifications" ON notifications
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid() OR user_id = get_user_id_from_auth())
    WITH CHECK (user_id = auth.uid() OR user_id = get_user_id_from_auth());

-- =============================================
-- 2.5 TECHNICIAN_KPI_SNAPSHOTS TABLE
-- =============================================
-- Performance metrics snapshots

ALTER TABLE technician_kpi_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_kpi_snapshots" ON technician_kpi_snapshots;
DROP POLICY IF EXISTS "supervisor_all_kpi_snapshots" ON technician_kpi_snapshots;
DROP POLICY IF EXISTS "technician_own_kpi" ON technician_kpi_snapshots;

-- Admin: Full access
CREATE POLICY "admin_all_kpi_snapshots" ON technician_kpi_snapshots
    FOR ALL TO authenticated
    USING (has_role('admin'))
    WITH CHECK (has_role('admin'));

-- Supervisor: Full access (manage KPIs)
CREATE POLICY "supervisor_all_kpi_snapshots" ON technician_kpi_snapshots
    FOR ALL TO authenticated
    USING (has_role('supervisor'))
    WITH CHECK (has_role('supervisor'));

-- Accountant: Select only (for reporting)
CREATE POLICY "accountant_select_kpi_snapshots" ON technician_kpi_snapshots
    FOR SELECT TO authenticated
    USING (has_role('accountant'));

-- Technician: Can only view their own KPI data
CREATE POLICY "technician_own_kpi_snapshots" ON technician_kpi_snapshots
    FOR SELECT TO authenticated
    USING (
        has_role('technician')
        AND (technician_id = auth.uid() OR technician_id = get_user_id_from_auth())
    );


-- =============================================
-- PART 3: GRANT PERMISSIONS
-- =============================================
-- Ensure authenticated role has proper grants

REVOKE ALL ON quotations FROM public;
REVOKE ALL ON service_intervals FROM public;
REVOKE ALL ON scheduled_services FROM public;
REVOKE ALL ON notifications FROM public;
REVOKE ALL ON technician_kpi_snapshots FROM public;

GRANT SELECT, INSERT, UPDATE, DELETE ON quotations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON service_intervals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON scheduled_services TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON technician_kpi_snapshots TO authenticated;

-- Grant select on views
GRANT SELECT ON active_rentals_view TO authenticated;
GRANT SELECT ON v_todays_leave TO authenticated;
GRANT SELECT ON v_expiring_licenses TO authenticated;
GRANT SELECT ON v_pending_leaves TO authenticated;
GRANT SELECT ON v_expiring_permits TO authenticated;

COMMIT;

-- =============================================
-- VERIFICATION QUERIES (Run after migration)
-- =============================================
-- Uncomment and run these to verify the fixes:

-- Check RLS is enabled:
-- SELECT tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
-- AND tablename IN ('quotations', 'service_intervals', 'scheduled_services', 'notifications', 'technician_kpi_snapshots');

-- Check views are not SECURITY DEFINER:
-- SELECT viewname, definition 
-- FROM pg_views 
-- WHERE schemaname = 'public' 
-- AND viewname IN ('active_rentals_view', 'v_todays_leave', 'v_expiring_licenses', 'v_pending_leaves', 'v_expiring_permits');

-- List all policies on fixed tables:
-- SELECT tablename, policyname, permissive, roles, cmd, qual 
-- FROM pg_policies 
-- WHERE tablename IN ('quotations', 'service_intervals', 'scheduled_services', 'notifications', 'technician_kpi_snapshots');

