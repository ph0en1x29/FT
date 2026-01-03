-- ============================================
-- Fix: Convert views to SECURITY INVOKER
-- ============================================
-- PostgreSQL requires explicit security_invoker = true
-- to make views respect the querying user's RLS policies

BEGIN;

-- 1. active_rentals_view
DROP VIEW IF EXISTS active_rentals_view;
CREATE VIEW active_rentals_view 
WITH (security_invoker = true)
AS
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

-- 2. v_todays_leave
DROP VIEW IF EXISTS v_todays_leave;
CREATE VIEW v_todays_leave 
WITH (security_invoker = true)
AS
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

-- 3. v_expiring_licenses
DROP VIEW IF EXISTS v_expiring_licenses;
CREATE VIEW v_expiring_licenses 
WITH (security_invoker = true)
AS
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

-- 4. v_pending_leaves
DROP VIEW IF EXISTS v_pending_leaves;
CREATE VIEW v_pending_leaves 
WITH (security_invoker = true)
AS
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

-- 5. v_expiring_permits
DROP VIEW IF EXISTS v_expiring_permits;
CREATE VIEW v_expiring_permits 
WITH (security_invoker = true)
AS
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

-- Grant permissions
GRANT SELECT ON active_rentals_view TO authenticated;
GRANT SELECT ON v_todays_leave TO authenticated;
GRANT SELECT ON v_expiring_licenses TO authenticated;
GRANT SELECT ON v_pending_leaves TO authenticated;
GRANT SELECT ON v_expiring_permits TO authenticated;

COMMIT;
