-- =============================================
-- HR SYSTEM DATA MODEL FIX - User ↔ Employee 1:1
-- Version: 2.0
-- Description: Fixes the broken Employee-User relationship
-- IMPORTANT: Run this migration carefully, backup data first
-- =============================================

-- =============================================
-- STEP 1: CREATE HELPER FUNCTION FOR ROLE CHECKING
-- =============================================

-- Function to get user role from auth.uid()
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role
    FROM users
    WHERE auth_id = auth.uid();
    
    RETURN COALESCE(user_role, 'employee');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if current user is admin or supervisor
CREATE OR REPLACE FUNCTION is_admin_or_supervisor()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_user_role() IN ('admin', 'supervisor');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if current user is admin, supervisor, or HR
CREATE OR REPLACE FUNCTION is_hr_authorized()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_user_role() IN ('admin', 'supervisor', 'accountant');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to get the user_id from users table that corresponds to current auth user
CREATE OR REPLACE FUNCTION get_my_user_id()
RETURNS UUID AS $$
DECLARE
    my_user_id UUID;
BEGIN
    SELECT user_id INTO my_user_id
    FROM users
    WHERE auth_id = auth.uid();
    
    RETURN my_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================
-- STEP 2: BACKUP EXISTING DATA (Safety measure)
-- =============================================

-- Create backup tables
CREATE TABLE IF NOT EXISTS _backup_employees AS SELECT * FROM employees;
CREATE TABLE IF NOT EXISTS _backup_employee_licenses AS SELECT * FROM employee_licenses;
CREATE TABLE IF NOT EXISTS _backup_employee_permits AS SELECT * FROM employee_permits;
CREATE TABLE IF NOT EXISTS _backup_employee_leaves AS SELECT * FROM employee_leaves;
CREATE TABLE IF NOT EXISTS _backup_employee_leave_balances AS SELECT * FROM employee_leave_balances;
CREATE TABLE IF NOT EXISTS _backup_hr_alerts AS SELECT * FROM hr_alerts;

-- =============================================
-- STEP 3: DROP EXISTING RLS POLICIES
-- =============================================

DROP POLICY IF EXISTS "Allow read for authenticated" ON employees;
DROP POLICY IF EXISTS "Allow all for authenticated" ON employees;
DROP POLICY IF EXISTS "Allow read for authenticated" ON employee_licenses;
DROP POLICY IF EXISTS "Allow all for authenticated" ON employee_licenses;
DROP POLICY IF EXISTS "Allow read for authenticated" ON employee_permits;
DROP POLICY IF EXISTS "Allow all for authenticated" ON employee_permits;
DROP POLICY IF EXISTS "Allow read for authenticated" ON employee_leaves;
DROP POLICY IF EXISTS "Allow all for authenticated" ON employee_leaves;
DROP POLICY IF EXISTS "Allow read for authenticated" ON hr_alerts;
DROP POLICY IF EXISTS "Allow all for authenticated" ON hr_alerts;
DROP POLICY IF EXISTS "Allow read for authenticated" ON employee_leave_balances;
DROP POLICY IF EXISTS "Allow all for authenticated" ON employee_leave_balances;

-- =============================================
-- STEP 4: DROP EXISTING VIEWS (they depend on old schema)
-- =============================================

DROP VIEW IF EXISTS v_expiring_licenses;
DROP VIEW IF EXISTS v_expiring_permits;
DROP VIEW IF EXISTS v_todays_leave;
DROP VIEW IF EXISTS v_pending_leaves;

-- =============================================
-- STEP 5: DROP EXISTING TRIGGERS
-- =============================================

DROP TRIGGER IF EXISTS trigger_update_license_status ON employee_licenses;
DROP TRIGGER IF EXISTS trigger_update_permit_status ON employee_permits;
DROP TRIGGER IF EXISTS trigger_calculate_leave_days ON employee_leaves;

-- =============================================
-- STEP 6: DROP FOREIGN KEY CONSTRAINTS
-- =============================================

ALTER TABLE employee_licenses DROP CONSTRAINT IF EXISTS employee_licenses_employee_id_fkey;
ALTER TABLE employee_permits DROP CONSTRAINT IF EXISTS employee_permits_employee_id_fkey;
ALTER TABLE employee_leaves DROP CONSTRAINT IF EXISTS employee_leaves_employee_id_fkey;
ALTER TABLE employee_leave_balances DROP CONSTRAINT IF EXISTS employee_leave_balances_employee_id_fkey;
ALTER TABLE hr_alerts DROP CONSTRAINT IF EXISTS hr_alerts_employee_id_fkey;
ALTER TABLE hr_alerts DROP CONSTRAINT IF EXISTS hr_alerts_license_id_fkey;
ALTER TABLE hr_alerts DROP CONSTRAINT IF EXISTS hr_alerts_permit_id_fkey;
ALTER TABLE hr_alerts DROP CONSTRAINT IF EXISTS hr_alerts_leave_id_fkey;

-- =============================================
-- STEP 7: DROP OLD INDEXES
-- =============================================

DROP INDEX IF EXISTS idx_employees_user_id;
DROP INDEX IF EXISTS idx_employees_status;
DROP INDEX IF EXISTS idx_employees_department;
DROP INDEX IF EXISTS idx_employee_licenses_employee;
DROP INDEX IF EXISTS idx_employee_licenses_expiry;
DROP INDEX IF EXISTS idx_employee_licenses_status;
DROP INDEX IF EXISTS idx_employee_permits_employee;
DROP INDEX IF EXISTS idx_employee_permits_expiry;
DROP INDEX IF EXISTS idx_employee_permits_status;
DROP INDEX IF EXISTS idx_employee_leaves_employee;
DROP INDEX IF EXISTS idx_employee_leaves_dates;
DROP INDEX IF EXISTS idx_employee_leaves_status;
DROP INDEX IF EXISTS idx_hr_alerts_type;
DROP INDEX IF EXISTS idx_hr_alerts_employee;
DROP INDEX IF EXISTS idx_hr_alerts_scheduled;

-- =============================================
-- STEP 8: RECREATE EMPLOYEES TABLE WITH user_id AS PRIMARY KEY
-- =============================================

-- First rename the old table
ALTER TABLE employees RENAME TO employees_old;

-- Create new employees table with user_id as primary key
CREATE TABLE employees (
    -- user_id is now PRIMARY KEY and references users.user_id
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    
    -- Basic Information
    employee_code VARCHAR(50) UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    ic_number VARCHAR(50), -- Malaysian IC Number
    address TEXT,
    
    -- Employment Details
    department VARCHAR(100),
    position VARCHAR(100),
    joined_date DATE NOT NULL DEFAULT CURRENT_DATE,
    employment_type VARCHAR(50) DEFAULT 'full-time', -- full-time, part-time, contract
    status VARCHAR(50) DEFAULT 'active', -- active, inactive, terminated, on_leave
    
    -- Emergency Contact
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(50),
    emergency_contact_relationship VARCHAR(100),
    
    -- Profile Photo
    profile_photo_url TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by_id UUID,
    created_by_name VARCHAR(255),
    updated_by_id UUID,
    updated_by_name VARCHAR(255),
    notes TEXT
);

-- Migrate data from old table to new (linking via old user_id where available)
INSERT INTO employees (
    user_id,
    employee_code,
    full_name,
    phone,
    email,
    ic_number,
    address,
    department,
    position,
    joined_date,
    employment_type,
    status,
    emergency_contact_name,
    emergency_contact_phone,
    emergency_contact_relationship,
    profile_photo_url,
    created_at,
    updated_at,
    created_by_id,
    created_by_name,
    updated_by_id,
    updated_by_name,
    notes
)
SELECT 
    COALESCE(eo.user_id, u.user_id) as user_id,
    eo.employee_code,
    eo.full_name,
    COALESCE(eo.phone, u.email),
    COALESCE(eo.email, u.email),
    eo.ic_number,
    eo.address,
    eo.department,
    eo.position,
    eo.joined_date,
    eo.employment_type,
    eo.status,
    eo.emergency_contact_name,
    eo.emergency_contact_phone,
    eo.emergency_contact_relationship,
    eo.profile_photo_url,
    eo.created_at,
    eo.updated_at,
    eo.created_by_id,
    eo.created_by_name,
    eo.updated_by_id,
    eo.updated_by_name,
    eo.notes
FROM employees_old eo
LEFT JOIN users u ON eo.user_id = u.user_id
WHERE eo.user_id IS NOT NULL;

-- Create employee records for users that don't have employee profiles
INSERT INTO employees (user_id, full_name, email, joined_date, status)
SELECT 
    u.user_id,
    u.name,
    u.email,
    COALESCE(u.created_at::date, CURRENT_DATE),
    'active'
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM employees e WHERE e.user_id = u.user_id
)
AND u.is_active = true;

-- =============================================
-- STEP 9: UPDATE RELATED TABLES TO USE user_id
-- =============================================

-- Create mapping table for old employee_id to new user_id
CREATE TEMP TABLE employee_id_mapping AS
SELECT eo.employee_id as old_employee_id, e.user_id as new_user_id
FROM employees_old eo
JOIN employees e ON eo.user_id = e.user_id;

-- Update employee_licenses: rename employee_id to user_id
ALTER TABLE employee_licenses RENAME COLUMN employee_id TO user_id;

-- Update the user_id values based on mapping
UPDATE employee_licenses el
SET user_id = m.new_user_id
FROM employee_id_mapping m
WHERE el.user_id = m.old_employee_id;

-- Add foreign key constraint
ALTER TABLE employee_licenses 
ADD CONSTRAINT employee_licenses_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES employees(user_id) ON DELETE CASCADE;

-- Update employee_permits: rename employee_id to user_id  
ALTER TABLE employee_permits RENAME COLUMN employee_id TO user_id;

UPDATE employee_permits ep
SET user_id = m.new_user_id
FROM employee_id_mapping m
WHERE ep.user_id = m.old_employee_id;

ALTER TABLE employee_permits 
ADD CONSTRAINT employee_permits_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES employees(user_id) ON DELETE CASCADE;

-- Update employee_leaves: rename employee_id to user_id
ALTER TABLE employee_leaves RENAME COLUMN employee_id TO user_id;

UPDATE employee_leaves el
SET user_id = m.new_user_id
FROM employee_id_mapping m
WHERE el.user_id = m.old_employee_id;

-- Add columns for who requested and who approved (using user_id)
ALTER TABLE employee_leaves 
ADD COLUMN IF NOT EXISTS requested_by_user_id UUID REFERENCES users(user_id),
ADD COLUMN IF NOT EXISTS approved_by_user_id UUID REFERENCES users(user_id),
ADD COLUMN IF NOT EXISTS rejected_by_user_id UUID REFERENCES users(user_id);

-- Migrate approval data
UPDATE employee_leaves SET requested_by_user_id = user_id;

ALTER TABLE employee_leaves 
ADD CONSTRAINT employee_leaves_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES employees(user_id) ON DELETE CASCADE;

-- Update employee_leave_balances: rename employee_id to user_id
ALTER TABLE employee_leave_balances RENAME COLUMN employee_id TO user_id;

UPDATE employee_leave_balances elb
SET user_id = m.new_user_id
FROM employee_id_mapping m
WHERE elb.user_id = m.old_employee_id;

-- Drop old unique constraint and recreate
ALTER TABLE employee_leave_balances DROP CONSTRAINT IF EXISTS employee_leave_balances_employee_id_leave_type_id_year_key;
ALTER TABLE employee_leave_balances ADD CONSTRAINT employee_leave_balances_user_leave_type_year_key 
UNIQUE(user_id, leave_type_id, year);

ALTER TABLE employee_leave_balances 
ADD CONSTRAINT employee_leave_balances_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES employees(user_id) ON DELETE CASCADE;

-- Update hr_alerts: rename employee_id to user_id
ALTER TABLE hr_alerts RENAME COLUMN employee_id TO user_id;

UPDATE hr_alerts ha
SET user_id = m.new_user_id
FROM employee_id_mapping m
WHERE ha.user_id = m.old_employee_id;

ALTER TABLE hr_alerts 
ADD CONSTRAINT hr_alerts_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES employees(user_id) ON DELETE CASCADE;

-- Re-add foreign keys for license_id, permit_id, leave_id
ALTER TABLE hr_alerts 
ADD CONSTRAINT hr_alerts_license_id_fkey 
FOREIGN KEY (license_id) REFERENCES employee_licenses(license_id) ON DELETE CASCADE;

ALTER TABLE hr_alerts 
ADD CONSTRAINT hr_alerts_permit_id_fkey 
FOREIGN KEY (permit_id) REFERENCES employee_permits(permit_id) ON DELETE CASCADE;

ALTER TABLE hr_alerts 
ADD CONSTRAINT hr_alerts_leave_id_fkey 
FOREIGN KEY (leave_id) REFERENCES employee_leaves(leave_id) ON DELETE CASCADE;


-- =============================================
-- STEP 10: CREATE NEW INDEXES
-- =============================================

CREATE INDEX idx_employees_status ON employees(status);
CREATE INDEX idx_employees_department ON employees(department);
CREATE INDEX idx_employees_email ON employees(email);

CREATE INDEX idx_employee_licenses_user ON employee_licenses(user_id);
CREATE INDEX idx_employee_licenses_expiry ON employee_licenses(expiry_date);
CREATE INDEX idx_employee_licenses_status ON employee_licenses(status);

CREATE INDEX idx_employee_permits_user ON employee_permits(user_id);
CREATE INDEX idx_employee_permits_expiry ON employee_permits(expiry_date);
CREATE INDEX idx_employee_permits_status ON employee_permits(status);

CREATE INDEX idx_employee_leaves_user ON employee_leaves(user_id);
CREATE INDEX idx_employee_leaves_dates ON employee_leaves(start_date, end_date);
CREATE INDEX idx_employee_leaves_status ON employee_leaves(status);

CREATE INDEX idx_hr_alerts_type ON hr_alerts(alert_type);
CREATE INDEX idx_hr_alerts_user ON hr_alerts(user_id);
CREATE INDEX idx_hr_alerts_scheduled ON hr_alerts(scheduled_for);

-- =============================================
-- STEP 11: CREATE PROPER RLS POLICIES
-- =============================================

-- EMPLOYEES TABLE RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- Employees can read their own profile
CREATE POLICY "employees_select_own" ON employees 
FOR SELECT TO authenticated 
USING (user_id = get_my_user_id() OR is_hr_authorized());

-- Employees can update their own limited fields
CREATE POLICY "employees_update_own" ON employees 
FOR UPDATE TO authenticated 
USING (user_id = get_my_user_id())
WITH CHECK (user_id = get_my_user_id());

-- Admin/Supervisor can manage all employees
CREATE POLICY "employees_admin_all" ON employees 
FOR ALL TO authenticated 
USING (is_admin_or_supervisor())
WITH CHECK (is_admin_or_supervisor());

-- HR (accountant) can read all employees
CREATE POLICY "employees_hr_select" ON employees 
FOR SELECT TO authenticated 
USING (get_user_role() = 'accountant');

-- EMPLOYEE LICENSES TABLE RLS
ALTER TABLE employee_licenses ENABLE ROW LEVEL SECURITY;

-- Employees can read their own licenses
CREATE POLICY "licenses_select_own" ON employee_licenses 
FOR SELECT TO authenticated 
USING (user_id = get_my_user_id() OR is_hr_authorized());

-- Admin/Supervisor can manage all licenses
CREATE POLICY "licenses_admin_all" ON employee_licenses 
FOR ALL TO authenticated 
USING (is_admin_or_supervisor())
WITH CHECK (is_admin_or_supervisor());

-- EMPLOYEE PERMITS TABLE RLS
ALTER TABLE employee_permits ENABLE ROW LEVEL SECURITY;

-- Employees can read their own permits
CREATE POLICY "permits_select_own" ON employee_permits 
FOR SELECT TO authenticated 
USING (user_id = get_my_user_id() OR is_hr_authorized());

-- Admin/Supervisor can manage all permits
CREATE POLICY "permits_admin_all" ON employee_permits 
FOR ALL TO authenticated 
USING (is_admin_or_supervisor())
WITH CHECK (is_admin_or_supervisor());

-- EMPLOYEE LEAVES TABLE RLS
ALTER TABLE employee_leaves ENABLE ROW LEVEL SECURITY;

-- Employees can read their own leaves
CREATE POLICY "leaves_select_own" ON employee_leaves 
FOR SELECT TO authenticated 
USING (user_id = get_my_user_id() OR is_hr_authorized());

-- Employees can create leave requests for themselves
CREATE POLICY "leaves_insert_own" ON employee_leaves 
FOR INSERT TO authenticated 
WITH CHECK (user_id = get_my_user_id());

-- Employees can update (cancel) their own pending leaves
CREATE POLICY "leaves_update_own_pending" ON employee_leaves 
FOR UPDATE TO authenticated 
USING (user_id = get_my_user_id() AND status = 'pending')
WITH CHECK (user_id = get_my_user_id());

-- Admin/Supervisor can manage all leaves (approve/reject)
CREATE POLICY "leaves_admin_all" ON employee_leaves 
FOR ALL TO authenticated 
USING (is_admin_or_supervisor())
WITH CHECK (is_admin_or_supervisor());

-- EMPLOYEE LEAVE BALANCES TABLE RLS
ALTER TABLE employee_leave_balances ENABLE ROW LEVEL SECURITY;

-- Employees can read their own balances
CREATE POLICY "balances_select_own" ON employee_leave_balances 
FOR SELECT TO authenticated 
USING (user_id = get_my_user_id() OR is_hr_authorized());

-- Admin/Supervisor can manage all balances
CREATE POLICY "balances_admin_all" ON employee_leave_balances 
FOR ALL TO authenticated 
USING (is_admin_or_supervisor())
WITH CHECK (is_admin_or_supervisor());

-- HR ALERTS TABLE RLS
ALTER TABLE hr_alerts ENABLE ROW LEVEL SECURITY;

-- Users can read alerts they are recipients of
CREATE POLICY "alerts_select_recipient" ON hr_alerts 
FOR SELECT TO authenticated 
USING (get_my_user_id() = ANY(recipient_ids) OR is_hr_authorized());

-- Admin/Supervisor can manage all alerts
CREATE POLICY "alerts_admin_all" ON hr_alerts 
FOR ALL TO authenticated 
USING (is_admin_or_supervisor())
WITH CHECK (is_admin_or_supervisor());

-- LEAVE TYPES TABLE RLS (read-only for all authenticated)
ALTER TABLE leave_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leave_types_select_all" ON leave_types 
FOR SELECT TO authenticated 
USING (true);

CREATE POLICY "leave_types_admin_all" ON leave_types 
FOR ALL TO authenticated 
USING (is_admin_or_supervisor())
WITH CHECK (is_admin_or_supervisor());


-- =============================================
-- STEP 12: RECREATE TRIGGERS
-- =============================================

-- Function to update license status based on expiry
CREATE OR REPLACE FUNCTION update_license_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.expiry_date < CURRENT_DATE AND NEW.status = 'active' THEN
        NEW.status := 'expired';
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_license_status
BEFORE UPDATE ON employee_licenses
FOR EACH ROW EXECUTE FUNCTION update_license_status();

-- Function to update permit status based on expiry
CREATE OR REPLACE FUNCTION update_permit_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.expiry_date < CURRENT_DATE AND NEW.status = 'active' THEN
        NEW.status := 'expired';
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_permit_status
BEFORE UPDATE ON employee_permits
FOR EACH ROW EXECUTE FUNCTION update_permit_status();

-- Function to calculate leave days
CREATE OR REPLACE FUNCTION calculate_leave_days()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_half_day THEN
        NEW.total_days := 0.5;
    ELSE
        NEW.total_days := (NEW.end_date - NEW.start_date) + 1;
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_leave_days
BEFORE INSERT OR UPDATE ON employee_leaves
FOR EACH ROW EXECUTE FUNCTION calculate_leave_days();

-- Function to auto-update employee updated_at
CREATE OR REPLACE FUNCTION update_employee_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_employee_updated_at
BEFORE UPDATE ON employees
FOR EACH ROW EXECUTE FUNCTION update_employee_timestamp();

-- =============================================
-- STEP 13: AUTO-CREATE EMPLOYEE PROFILE ON USER CREATION
-- =============================================

-- This function creates an employee profile when a user is created
CREATE OR REPLACE FUNCTION create_employee_on_user_insert()
RETURNS TRIGGER AS $$
BEGIN
    -- Create employee profile for the new user
    INSERT INTO employees (
        user_id,
        full_name,
        email,
        joined_date,
        status
    ) VALUES (
        NEW.user_id,
        NEW.name,
        NEW.email,
        CURRENT_DATE,
        'active'
    )
    ON CONFLICT (user_id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on users table
DROP TRIGGER IF EXISTS trigger_create_employee_on_user_insert ON users;
CREATE TRIGGER trigger_create_employee_on_user_insert
AFTER INSERT ON users
FOR EACH ROW EXECUTE FUNCTION create_employee_on_user_insert();

-- =============================================
-- STEP 14: RECREATE VIEWS
-- =============================================

-- View: Expiring Licenses (within 60 days)
CREATE OR REPLACE VIEW v_expiring_licenses AS
SELECT 
    el.*,
    e.full_name,
    e.phone,
    e.department,
    e.employee_code,
    EXTRACT(DAY FROM el.expiry_date - CURRENT_DATE) AS days_until_expiry
FROM employee_licenses el
JOIN employees e ON el.user_id = e.user_id
WHERE el.status = 'active'
  AND el.expiry_date <= CURRENT_DATE + INTERVAL '60 days'
ORDER BY el.expiry_date ASC;

-- View: Expiring Permits (within 60 days)
CREATE OR REPLACE VIEW v_expiring_permits AS
SELECT 
    ep.*,
    e.full_name,
    e.phone,
    e.department,
    e.employee_code,
    EXTRACT(DAY FROM ep.expiry_date - CURRENT_DATE) AS days_until_expiry
FROM employee_permits ep
JOIN employees e ON ep.user_id = e.user_id
WHERE ep.status = 'active'
  AND ep.expiry_date <= CURRENT_DATE + INTERVAL '60 days'
ORDER BY ep.expiry_date ASC;

-- View: Today's Leave Schedule
CREATE OR REPLACE VIEW v_todays_leave AS
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

-- View: Pending Leave Requests
CREATE OR REPLACE VIEW v_pending_leaves AS
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

-- =============================================
-- STEP 15: CLEANUP - DROP OLD TABLE (OPTIONAL - KEEP FOR SAFETY)
-- =============================================

-- Uncomment these lines after verifying migration success:
-- DROP TABLE IF EXISTS employees_old;
-- DROP TABLE IF EXISTS _backup_employees;
-- DROP TABLE IF EXISTS _backup_employee_licenses;
-- DROP TABLE IF EXISTS _backup_employee_permits;
-- DROP TABLE IF EXISTS _backup_employee_leaves;
-- DROP TABLE IF EXISTS _backup_employee_leave_balances;
-- DROP TABLE IF EXISTS _backup_hr_alerts;

-- =============================================
-- MIGRATION COMPLETE
-- =============================================

-- Summary of changes:
-- 1. employees.user_id is now PRIMARY KEY (references users.user_id)
-- 2. All HR tables now use user_id instead of employee_id
-- 3. RLS policies enforce:
--    - Employees can only read/update their own profile
--    - Admin/Supervisor can read/update all employees
--    - Accountant can read all employees (for payroll)
-- 4. Auto-create employee profile on user signup
-- 5. Leave requests now track requested_by_user_id and approved_by_user_id

COMMENT ON TABLE employees IS 'Employee profiles linked 1:1 with users. user_id is the primary key referencing users.user_id';
COMMENT ON COLUMN employees.user_id IS 'Primary key - references users.user_id for strict 1:1 relationship';

