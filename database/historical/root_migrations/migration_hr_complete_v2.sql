-- =============================================
-- HR SYSTEM - COMPLETE MIGRATION (CLEAN INSTALL)
-- Version: 2.0
-- Description: Employee management with proper User ↔ Employee 1:1 relationship
-- Run this if HR tables don't exist yet
-- =============================================

-- =============================================
-- STEP 1: CREATE HELPER FUNCTIONS
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

-- Function to check if current user is admin, supervisor, or HR (accountant)
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
-- STEP 2: CREATE LEAVE TYPES TABLE (No dependencies)
-- =============================================

CREATE TABLE IF NOT EXISTS leave_types (
    leave_type_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_paid BOOLEAN DEFAULT true,
    requires_approval BOOLEAN DEFAULT true,
    requires_document BOOLEAN DEFAULT false,
    max_days_per_year INTEGER,
    color VARCHAR(20) DEFAULT '#3B82F6',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default leave types
INSERT INTO leave_types (name, description, is_paid, requires_document, max_days_per_year, color) VALUES
    ('Medical Leave', 'Sick leave with medical certificate', true, true, 14, '#EF4444'),
    ('Annual Leave', 'Regular vacation leave', true, false, 14, '#10B981'),
    ('Emergency Leave', 'Urgent personal matters', true, false, 5, '#F59E0B'),
    ('Unpaid Leave', 'Leave without pay', false, false, NULL, '#6B7280'),
    ('Call-Out', 'Emergency duty call-out (counts as work)', true, false, NULL, '#8B5CF6'),
    ('Maternity Leave', 'Maternity/Paternity leave', true, true, 60, '#EC4899'),
    ('Compassionate Leave', 'Bereavement or family emergency', true, false, 3, '#6366F1'),
    ('Replacement Leave', 'Off day for working on public holiday', true, false, NULL, '#14B8A6')
ON CONFLICT (name) DO NOTHING;


-- =============================================
-- STEP 3: CREATE EMPLOYEES TABLE
-- user_id is PRIMARY KEY (1:1 relationship with users)
-- =============================================

CREATE TABLE IF NOT EXISTS employees (
    -- user_id is PRIMARY KEY and FK to users - enforces 1:1 relationship
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    
    -- Basic Information
    employee_code VARCHAR(50) UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    ic_number VARCHAR(50),
    address TEXT,
    
    -- Employment Details
    department VARCHAR(100),
    position VARCHAR(100),
    joined_date DATE NOT NULL DEFAULT CURRENT_DATE,
    employment_type VARCHAR(50) DEFAULT 'full-time',
    status VARCHAR(50) DEFAULT 'active',
    
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

COMMENT ON TABLE employees IS 'Employee profiles linked 1:1 with users. user_id is the primary key.';
COMMENT ON COLUMN employees.user_id IS 'Primary key - references users.user_id for strict 1:1 relationship';


-- =============================================
-- STEP 4: CREATE EMPLOYEE LICENSES TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS employee_licenses (
    license_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES employees(user_id) ON DELETE CASCADE,
    
    -- License Information
    license_type VARCHAR(100) NOT NULL,
    license_number VARCHAR(100) NOT NULL,
    issuing_authority VARCHAR(255),
    issue_date DATE,
    expiry_date DATE NOT NULL,
    
    -- License Image
    license_front_image_url TEXT,
    license_back_image_url TEXT,
    
    -- Status
    status VARCHAR(50) DEFAULT 'active',
    
    -- Alert Settings
    alert_days_before INTEGER DEFAULT 30,
    last_alert_sent_at TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by_id UUID,
    created_by_name VARCHAR(255),
    verified_at TIMESTAMPTZ,
    verified_by_id UUID,
    verified_by_name VARCHAR(255),
    notes TEXT
);

-- =============================================
-- STEP 5: CREATE EMPLOYEE PERMITS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS employee_permits (
    permit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES employees(user_id) ON DELETE CASCADE,
    
    -- Permit Information
    permit_type VARCHAR(100) NOT NULL,
    permit_number VARCHAR(100) NOT NULL,
    permit_name VARCHAR(255),
    issuing_authority VARCHAR(255),
    issue_date DATE,
    expiry_date DATE NOT NULL,
    
    -- Permit scope
    restricted_areas TEXT[],
    
    -- Permit Document
    permit_document_url TEXT,
    
    -- Status
    status VARCHAR(50) DEFAULT 'active',
    
    -- Alert Settings
    alert_days_before INTEGER DEFAULT 30,
    last_alert_sent_at TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by_id UUID,
    created_by_name VARCHAR(255),
    verified_at TIMESTAMPTZ,
    verified_by_id UUID,
    verified_by_name VARCHAR(255),
    notes TEXT
);


-- =============================================
-- STEP 6: CREATE EMPLOYEE LEAVES TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS employee_leaves (
    leave_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES employees(user_id) ON DELETE CASCADE,
    leave_type_id UUID NOT NULL REFERENCES leave_types(leave_type_id),
    
    -- Leave Period
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days DECIMAL(4,1) NOT NULL DEFAULT 1,
    is_half_day BOOLEAN DEFAULT false,
    half_day_type VARCHAR(20),
    
    -- Request Details
    reason TEXT,
    supporting_document_url TEXT,
    
    -- Approval Workflow - uses user_id references
    status VARCHAR(50) DEFAULT 'pending',
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    requested_by_user_id UUID REFERENCES users(user_id),
    approved_at TIMESTAMPTZ,
    approved_by_id UUID,
    approved_by_name VARCHAR(255),
    approved_by_user_id UUID REFERENCES users(user_id),
    rejected_at TIMESTAMPTZ,
    rejected_by_id UUID,
    rejected_by_name VARCHAR(255),
    rejected_by_user_id UUID REFERENCES users(user_id),
    rejection_reason TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT
);

-- =============================================
-- STEP 7: CREATE EMPLOYEE LEAVE BALANCES TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS employee_leave_balances (
    balance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES employees(user_id) ON DELETE CASCADE,
    leave_type_id UUID NOT NULL REFERENCES leave_types(leave_type_id),
    year INTEGER NOT NULL,
    
    -- Balance
    entitled_days DECIMAL(5,1) DEFAULT 0,
    used_days DECIMAL(5,1) DEFAULT 0,
    pending_days DECIMAL(5,1) DEFAULT 0,
    carried_forward DECIMAL(5,1) DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, leave_type_id, year)
);


-- =============================================
-- STEP 8: CREATE HR ALERTS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS hr_alerts (
    alert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type VARCHAR(50) NOT NULL,
    
    -- Related Records - uses user_id
    user_id UUID REFERENCES employees(user_id) ON DELETE CASCADE,
    license_id UUID REFERENCES employee_licenses(license_id) ON DELETE CASCADE,
    permit_id UUID REFERENCES employee_permits(permit_id) ON DELETE CASCADE,
    leave_id UUID REFERENCES employee_leaves(leave_id) ON DELETE CASCADE,
    
    -- Alert Details
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20) DEFAULT 'warning',
    
    -- Recipients
    recipient_ids UUID[] NOT NULL,
    
    -- Status
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    read_by_id UUID,
    
    -- Scheduling
    scheduled_for TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

-- =============================================
-- STEP 9: CREATE INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);

CREATE INDEX IF NOT EXISTS idx_employee_licenses_user ON employee_licenses(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_licenses_expiry ON employee_licenses(expiry_date);
CREATE INDEX IF NOT EXISTS idx_employee_licenses_status ON employee_licenses(status);

CREATE INDEX IF NOT EXISTS idx_employee_permits_user ON employee_permits(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_permits_expiry ON employee_permits(expiry_date);
CREATE INDEX IF NOT EXISTS idx_employee_permits_status ON employee_permits(status);

CREATE INDEX IF NOT EXISTS idx_employee_leaves_user ON employee_leaves(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_leaves_dates ON employee_leaves(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_employee_leaves_status ON employee_leaves(status);

CREATE INDEX IF NOT EXISTS idx_hr_alerts_type ON hr_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_hr_alerts_user ON hr_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_hr_alerts_scheduled ON hr_alerts(scheduled_for);


-- =============================================
-- STEP 10: CREATE TRIGGERS
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

DROP TRIGGER IF EXISTS trigger_update_license_status ON employee_licenses;
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

DROP TRIGGER IF EXISTS trigger_update_permit_status ON employee_permits;
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

DROP TRIGGER IF EXISTS trigger_calculate_leave_days ON employee_leaves;
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

DROP TRIGGER IF EXISTS trigger_employee_updated_at ON employees;
CREATE TRIGGER trigger_employee_updated_at
BEFORE UPDATE ON employees
FOR EACH ROW EXECUTE FUNCTION update_employee_timestamp();


-- =============================================
-- STEP 11: AUTO-CREATE EMPLOYEE ON USER SIGNUP
-- =============================================

-- This function creates an employee profile when a user is created
CREATE OR REPLACE FUNCTION create_employee_on_user_insert()
RETURNS TRIGGER AS $$
BEGIN
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
-- STEP 12: CREATE VIEWS
-- =============================================

-- View: Expiring Licenses (within 60 days)
CREATE OR REPLACE VIEW v_expiring_licenses AS
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

-- View: Expiring Permits (within 60 days)
CREATE OR REPLACE VIEW v_expiring_permits AS
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
-- STEP 13: ROW LEVEL SECURITY (RLS) POLICIES
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

CREATE POLICY "licenses_select_own" ON employee_licenses 
FOR SELECT TO authenticated 
USING (user_id = get_my_user_id() OR is_hr_authorized());

CREATE POLICY "licenses_admin_all" ON employee_licenses 
FOR ALL TO authenticated 
USING (is_admin_or_supervisor())
WITH CHECK (is_admin_or_supervisor());

-- EMPLOYEE PERMITS TABLE RLS
ALTER TABLE employee_permits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "permits_select_own" ON employee_permits 
FOR SELECT TO authenticated 
USING (user_id = get_my_user_id() OR is_hr_authorized());

CREATE POLICY "permits_admin_all" ON employee_permits 
FOR ALL TO authenticated 
USING (is_admin_or_supervisor())
WITH CHECK (is_admin_or_supervisor());

-- EMPLOYEE LEAVES TABLE RLS
ALTER TABLE employee_leaves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leaves_select_own" ON employee_leaves 
FOR SELECT TO authenticated 
USING (user_id = get_my_user_id() OR is_hr_authorized());

CREATE POLICY "leaves_insert_own" ON employee_leaves 
FOR INSERT TO authenticated 
WITH CHECK (user_id = get_my_user_id());

CREATE POLICY "leaves_update_own_pending" ON employee_leaves 
FOR UPDATE TO authenticated 
USING (user_id = get_my_user_id() AND status = 'pending')
WITH CHECK (user_id = get_my_user_id());

CREATE POLICY "leaves_admin_all" ON employee_leaves 
FOR ALL TO authenticated 
USING (is_admin_or_supervisor())
WITH CHECK (is_admin_or_supervisor());

-- EMPLOYEE LEAVE BALANCES TABLE RLS
ALTER TABLE employee_leave_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "balances_select_own" ON employee_leave_balances 
FOR SELECT TO authenticated 
USING (user_id = get_my_user_id() OR is_hr_authorized());

CREATE POLICY "balances_admin_all" ON employee_leave_balances 
FOR ALL TO authenticated 
USING (is_admin_or_supervisor())
WITH CHECK (is_admin_or_supervisor());

-- HR ALERTS TABLE RLS
ALTER TABLE hr_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "alerts_select_recipient" ON hr_alerts 
FOR SELECT TO authenticated 
USING (get_my_user_id() = ANY(recipient_ids) OR is_hr_authorized());

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
-- STEP 14: CREATE EMPLOYEE PROFILES FOR EXISTING USERS
-- =============================================

-- Create employee records for all existing active users who don't have profiles
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
AND u.is_active = true
ON CONFLICT (user_id) DO NOTHING;

-- =============================================
-- MIGRATION COMPLETE
-- =============================================