-- =============================================
-- FIX: Security Linter Warnings
-- Date: 2026-01-05
-- Issues:
--   1. SECURITY DEFINER views (should be SECURITY INVOKER)
--   2. Backup tables without RLS
-- =============================================

-- =============================================
-- PART 1: Fix SECURITY DEFINER Views
-- Recreate views with explicit SECURITY INVOKER
-- =============================================

-- Drop and recreate v_expiring_licenses
DROP VIEW IF EXISTS v_expiring_licenses;
CREATE VIEW v_expiring_licenses 
WITH (security_invoker = true)
AS
SELECT 
    el.*,
    u.full_name,
    u.phone,
    u.department,
    u.employee_code,
    (el.expiry_date - CURRENT_DATE) AS days_until_expiry
FROM employee_licenses el
JOIN users u ON el.user_id = u.user_id
WHERE el.status = 'active'
  AND el.expiry_date <= CURRENT_DATE + INTERVAL '60 days'
ORDER BY el.expiry_date ASC;

-- Drop and recreate v_expiring_permits
DROP VIEW IF EXISTS v_expiring_permits;
CREATE VIEW v_expiring_permits
WITH (security_invoker = true)
AS
SELECT 
    ep.*,
    u.full_name,
    u.phone,
    u.department,
    u.employee_code,
    (ep.expiry_date - CURRENT_DATE) AS days_until_expiry
FROM employee_permits ep
JOIN users u ON ep.user_id = u.user_id
WHERE ep.status = 'active'
  AND ep.expiry_date <= CURRENT_DATE + INTERVAL '60 days'
ORDER BY ep.expiry_date ASC;

-- Drop and recreate v_todays_leave
DROP VIEW IF EXISTS v_todays_leave;
CREATE VIEW v_todays_leave
WITH (security_invoker = true)
AS
SELECT 
    el.*,
    u.full_name,
    u.department,
    u.employee_code,
    lt.name AS leave_type_name,
    lt.color AS leave_type_color
FROM employee_leaves el
JOIN users u ON el.user_id = u.user_id
JOIN leave_types lt ON el.leave_type_id = lt.leave_type_id
WHERE el.status = 'approved'
  AND CURRENT_DATE BETWEEN el.start_date AND el.end_date
ORDER BY u.department, u.full_name;

-- Drop and recreate v_pending_leaves
DROP VIEW IF EXISTS v_pending_leaves;
CREATE VIEW v_pending_leaves
WITH (security_invoker = true)
AS
SELECT 
    el.*,
    u.full_name,
    u.department,
    u.employee_code,
    lt.name AS leave_type_name
FROM employee_leaves el
JOIN users u ON el.user_id = u.user_id
JOIN leave_types lt ON el.leave_type_id = lt.leave_type_id
WHERE el.status = 'pending'
ORDER BY el.requested_at ASC;

-- Grant SELECT on views to authenticated users
GRANT SELECT ON v_expiring_licenses TO authenticated;
GRANT SELECT ON v_expiring_permits TO authenticated;
GRANT SELECT ON v_todays_leave TO authenticated;
GRANT SELECT ON v_pending_leaves TO authenticated;

-- =============================================
-- PART 2: Fix Backup Tables Without RLS
-- Option A: Drop if no longer needed (RECOMMENDED)
-- Option B: Enable RLS with restrictive policy
-- =============================================

-- Option A: Drop backup tables (uncomment if data no longer needed)
-- DROP TABLE IF EXISTS _backup_users_before_merge;
-- DROP TABLE IF EXISTS _backup_employees_before_merge;

-- Option B: Enable RLS and restrict access (keep data but secure it)
-- Only use this if you need to keep the backup data

-- Enable RLS on backup tables
ALTER TABLE IF EXISTS _backup_users_before_merge ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS _backup_employees_before_merge ENABLE ROW LEVEL SECURITY;

-- Create restrictive policies (only service_role can access)
DROP POLICY IF EXISTS "backup_users_no_access" ON _backup_users_before_merge;
CREATE POLICY "backup_users_no_access" ON _backup_users_before_merge
    FOR ALL
    TO authenticated
    USING (false);

DROP POLICY IF EXISTS "backup_employees_no_access" ON _backup_employees_before_merge;
CREATE POLICY "backup_employees_no_access" ON _backup_employees_before_merge
    FOR ALL
    TO authenticated
    USING (false);

-- =============================================
-- VERIFICATION QUERIES (run after migration)
-- =============================================

-- Check view security settings:
-- SELECT viewname, viewowner 
-- FROM pg_views 
-- WHERE schemaname = 'public' AND viewname LIKE 'v_%';

-- Check RLS status on backup tables:
-- SELECT tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' AND tablename LIKE '_backup%';
