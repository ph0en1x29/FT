-- =============================================
-- MERGE EMPLOYEES INTO USERS TABLE
-- Version: 1.1
-- Description: Eliminates the separate employees table by adding 
--              all HR fields directly to users table.
--              This ensures 1:1 relationship by design (same table!)
-- =============================================

-- =============================================
-- STEP 1: BACKUP EXISTING DATA
-- =============================================

CREATE TABLE IF NOT EXISTS _backup_users_before_merge AS SELECT * FROM users;

-- Only backup employees if the table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employees') THEN
    EXECUTE 'CREATE TABLE IF NOT EXISTS _backup_employees_before_merge AS SELECT * FROM employees';
  END IF;
END $$;

-- =============================================
-- STEP 2: ADD HR COLUMNS TO USERS TABLE
-- =============================================

-- Basic HR Information
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_code VARCHAR(50) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS ic_number VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;

-- Employment Details
ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS position VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS joined_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS employment_type VARCHAR(50) DEFAULT 'full-time';
ALTER TABLE users ADD COLUMN IF NOT EXISTS employment_status VARCHAR(50) DEFAULT 'active';

-- Emergency Contact
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_relationship VARCHAR(100);

-- Profile Photo (users already has avatar, but we'll add this for consistency)
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;

-- Metadata columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by_id UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_by_id UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_by_name VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS notes TEXT;

-- =============================================
-- STEP 3: MIGRATE DATA FROM EMPLOYEES TO USERS
-- =============================================

-- Only migrate if employees table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employees') THEN
    UPDATE users u
    SET 
        employee_code = e.employee_code,
        full_name = COALESCE(e.full_name, u.name),
        phone = e.phone,
        ic_number = e.ic_number,
        address = e.address,
        department = e.department,
        position = e.position,
        joined_date = e.joined_date,
        employment_type = e.employment_type,
        employment_status = e.status,
        emergency_contact_name = e.emergency_contact_name,
        emergency_contact_phone = e.emergency_contact_phone,
        emergency_contact_relationship = e.emergency_contact_relationship,
        profile_photo_url = COALESCE(e.profile_photo_url, u.avatar),
        updated_at = COALESCE(e.updated_at, NOW()),
        created_by_id = e.created_by_id,
        created_by_name = e.created_by_name,
        updated_by_id = e.updated_by_id,
        updated_by_name = e.updated_by_name,
        notes = e.notes
    FROM employees e
    WHERE u.user_id = e.user_id;
  END IF;
END $$;

-- Set defaults for users without employee records
UPDATE users 
SET 
    full_name = COALESCE(full_name, name),
    joined_date = COALESCE(joined_date, created_at::date, CURRENT_DATE),
    employment_status = COALESCE(employment_status, 'active'),
    employment_type = COALESCE(employment_type, 'full-time')
WHERE full_name IS NULL OR joined_date IS NULL;

-- =============================================
-- STEP 4: DROP OLD POLICIES AND CONSTRAINTS ON EMPLOYEES
-- =============================================

-- Drop RLS policies on employees (only if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employees') THEN
    DROP POLICY IF EXISTS "employees_select_own" ON employees;
    DROP POLICY IF EXISTS "employees_update_own" ON employees;
    DROP POLICY IF EXISTS "employees_admin_all" ON employees;
    DROP POLICY IF EXISTS "employees_hr_select" ON employees;
    DROP TRIGGER IF EXISTS trigger_employee_updated_at ON employees;
  END IF;
END $$;

-- Drop trigger that auto-creates employee (no longer needed!)
DROP TRIGGER IF EXISTS trigger_create_employee_on_user_insert ON users;
DROP FUNCTION IF EXISTS create_employee_on_user_insert();

-- =============================================
-- STEP 5: UPDATE FOREIGN KEYS TO POINT TO USERS TABLE
-- =============================================

-- Drop old foreign keys from HR tables (they reference employees)
ALTER TABLE employee_licenses DROP CONSTRAINT IF EXISTS employee_licenses_user_id_fkey;
ALTER TABLE employee_permits DROP CONSTRAINT IF EXISTS employee_permits_user_id_fkey;
ALTER TABLE employee_leaves DROP CONSTRAINT IF EXISTS employee_leaves_user_id_fkey;
ALTER TABLE employee_leave_balances DROP CONSTRAINT IF EXISTS employee_leave_balances_user_id_fkey;
ALTER TABLE hr_alerts DROP CONSTRAINT IF EXISTS hr_alerts_user_id_fkey;

-- Add new foreign keys pointing to users table
ALTER TABLE employee_licenses 
ADD CONSTRAINT employee_licenses_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

ALTER TABLE employee_permits 
ADD CONSTRAINT employee_permits_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

ALTER TABLE employee_leaves 
ADD CONSTRAINT employee_leaves_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

ALTER TABLE employee_leave_balances 
ADD CONSTRAINT employee_leave_balances_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

ALTER TABLE hr_alerts 
ADD CONSTRAINT hr_alerts_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE;

-- =============================================
-- STEP 6: DROP OLD VIEWS (they reference employees table)
-- =============================================

DROP VIEW IF EXISTS v_expiring_licenses;
DROP VIEW IF EXISTS v_expiring_permits;
DROP VIEW IF EXISTS v_todays_leave;
DROP VIEW IF EXISTS v_pending_leaves;

-- =============================================
-- STEP 7: CREATE NEW VIEWS (using users table directly)
-- =============================================

-- View: Expiring Licenses (within 60 days)
CREATE OR REPLACE VIEW v_expiring_licenses AS
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

-- View: Expiring Permits (within 60 days)
CREATE OR REPLACE VIEW v_expiring_permits AS
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

-- View: Today's Leave Schedule
CREATE OR REPLACE VIEW v_todays_leave AS
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

-- View: Pending Leave Requests
CREATE OR REPLACE VIEW v_pending_leaves AS
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

-- =============================================
-- STEP 8: ADD TRIGGER FOR UPDATED_AT ON USERS
-- =============================================

CREATE OR REPLACE FUNCTION update_user_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_user_updated_at ON users;
CREATE TRIGGER trigger_user_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_user_timestamp();

-- =============================================
-- STEP 9: ADD NEW INDEXES ON USERS TABLE
-- =============================================

CREATE INDEX IF NOT EXISTS idx_users_employment_status ON users(employment_status);
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department);
CREATE INDEX IF NOT EXISTS idx_users_employee_code ON users(employee_code);
CREATE INDEX IF NOT EXISTS idx_users_joined_date ON users(joined_date);

-- =============================================
-- STEP 10: DROP THE EMPLOYEES TABLE
-- =============================================

-- First drop any remaining dependencies
DROP TABLE IF EXISTS employees_old CASCADE;
DROP TABLE IF EXISTS employees CASCADE;

-- =============================================
-- STEP 11: UPDATE RLS POLICIES FOR HR DATA ON USERS TABLE
-- =============================================

-- Note: Users table should already have RLS policies from before.
-- We just need to ensure they cover the new HR columns.
-- The existing policies should work since they're based on user_id.

-- =============================================
-- STEP 12: VERIFY DATA INTEGRITY
-- =============================================

-- Check that all users have essential HR fields populated
DO $$
DECLARE
    missing_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO missing_count
    FROM users
    WHERE full_name IS NULL OR joined_date IS NULL;
    
    IF missing_count > 0 THEN
        RAISE NOTICE 'Warning: % users are missing full_name or joined_date', missing_count;
    ELSE
        RAISE NOTICE 'Success: All users have required HR fields populated';
    END IF;
END $$;

-- =============================================
-- MIGRATION COMPLETE
-- =============================================

-- Summary of changes:
-- 1. All HR columns from employees are now in users table
-- 2. employees table has been dropped
-- 3. All FK references (licenses, permits, leaves, etc.) now point to users
-- 4. Views recreated to use users table directly
-- 5. No more sync issues - single source of truth!
--
-- Column mapping:
--   users.name         -> Display name (login)
--   users.full_name    -> Full legal name (HR)
--   users.email        -> Email address
--   users.role         -> System role (admin, supervisor, technician, accountant)
--   users.employment_status -> HR status (active, inactive, terminated, on_leave)
--   users.is_active    -> Can login to system
--
-- To cleanup backup tables after verifying migration:
-- DROP TABLE IF EXISTS _backup_users_before_merge;
-- DROP TABLE IF EXISTS _backup_employees_before_merge;

COMMENT ON TABLE users IS 'Combined user accounts and HR profiles. Single source of truth for all user/employee data.';
