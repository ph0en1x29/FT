-- =============================================
-- HR SYSTEM MIGRATION
-- Version: 1.0
-- Description: Employee management, licenses, permits, and leave tracking
-- =============================================

-- =============================================
-- 1. EMPLOYEES TABLE (Extends user information)
-- =============================================

CREATE TABLE IF NOT EXISTS employees (
    employee_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    
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
    joined_date DATE NOT NULL,
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

-- =============================================
-- 2. EMPLOYEE LICENSES TABLE (Driving Licenses)
-- =============================================

CREATE TABLE IF NOT EXISTS employee_licenses (
    license_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
    
    -- License Information
    license_type VARCHAR(100) NOT NULL, -- Class B, Class D, etc.
    license_number VARCHAR(100) NOT NULL,
    issuing_authority VARCHAR(255),
    issue_date DATE,
    expiry_date DATE NOT NULL,
    
    -- License Image
    license_front_image_url TEXT,
    license_back_image_url TEXT,
    
    -- Status
    status VARCHAR(50) DEFAULT 'active', -- active, expired, suspended, revoked
    
    -- Alert Settings
    alert_days_before INTEGER DEFAULT 30, -- Days before expiry to send alert
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
-- 3. EMPLOYEE PERMITS TABLE (Special Area Permits)
-- =============================================

CREATE TABLE IF NOT EXISTS employee_permits (
    permit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
    
    -- Permit Information
    permit_type VARCHAR(100) NOT NULL, -- Security Clearance, Hazardous Area, etc.
    permit_number VARCHAR(100) NOT NULL,
    permit_name VARCHAR(255), -- Descriptive name
    issuing_authority VARCHAR(255),
    issue_date DATE,
    expiry_date DATE NOT NULL,
    
    -- Permit scope
    restricted_areas TEXT[], -- List of areas this permit allows access to
    
    -- Permit Document
    permit_document_url TEXT,
    
    -- Status
    status VARCHAR(50) DEFAULT 'active', -- active, expired, suspended, revoked
    
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
-- 4. LEAVE TYPES TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS leave_types (
    leave_type_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_paid BOOLEAN DEFAULT true,
    requires_approval BOOLEAN DEFAULT true,
    requires_document BOOLEAN DEFAULT false, -- e.g., MC for medical leave
    max_days_per_year INTEGER,
    color VARCHAR(20) DEFAULT '#3B82F6', -- For calendar display
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
-- 5. EMPLOYEE LEAVES TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS employee_leaves (
    leave_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
    leave_type_id UUID NOT NULL REFERENCES leave_types(leave_type_id),
    
    -- Leave Period
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days DECIMAL(4,1) NOT NULL, -- Supports half days
    is_half_day BOOLEAN DEFAULT false,
    half_day_type VARCHAR(20), -- 'morning' or 'afternoon'
    
    -- Request Details
    reason TEXT,
    supporting_document_url TEXT, -- MC, etc.
    
    -- Approval Workflow
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, cancelled
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    approved_by_id UUID,
    approved_by_name VARCHAR(255),
    rejected_at TIMESTAMPTZ,
    rejected_by_id UUID,
    rejected_by_name VARCHAR(255),
    rejection_reason TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT
);

-- =============================================
-- 6. HR ALERTS TABLE (For license/permit expiry notifications)
-- =============================================

CREATE TABLE IF NOT EXISTS hr_alerts (
    alert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Alert Type
    alert_type VARCHAR(50) NOT NULL, -- 'license_expiry', 'permit_expiry', 'leave_request'
    
    -- Related Records
    employee_id UUID REFERENCES employees(employee_id) ON DELETE CASCADE,
    license_id UUID REFERENCES employee_licenses(license_id) ON DELETE CASCADE,
    permit_id UUID REFERENCES employee_permits(permit_id) ON DELETE CASCADE,
    leave_id UUID REFERENCES employee_leaves(leave_id) ON DELETE CASCADE,
    
    -- Alert Details
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20) DEFAULT 'warning', -- info, warning, critical
    
    -- Recipients
    recipient_ids UUID[] NOT NULL, -- User IDs to notify
    
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
-- 7. EMPLOYEE LEAVE BALANCE TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS employee_leave_balances (
    balance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(employee_id) ON DELETE CASCADE,
    leave_type_id UUID NOT NULL REFERENCES leave_types(leave_type_id),
    year INTEGER NOT NULL,
    
    -- Balance
    entitled_days DECIMAL(5,1) DEFAULT 0,
    used_days DECIMAL(5,1) DEFAULT 0,
    pending_days DECIMAL(5,1) DEFAULT 0, -- Days in pending leave requests
    carried_forward DECIMAL(5,1) DEFAULT 0,
    
    -- Computed balance = entitled + carried_forward - used - pending
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(employee_id, leave_type_id, year)
);

-- =============================================
-- 8. INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);

CREATE INDEX IF NOT EXISTS idx_employee_licenses_employee ON employee_licenses(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_licenses_expiry ON employee_licenses(expiry_date);
CREATE INDEX IF NOT EXISTS idx_employee_licenses_status ON employee_licenses(status);

CREATE INDEX IF NOT EXISTS idx_employee_permits_employee ON employee_permits(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_permits_expiry ON employee_permits(expiry_date);
CREATE INDEX IF NOT EXISTS idx_employee_permits_status ON employee_permits(status);

CREATE INDEX IF NOT EXISTS idx_employee_leaves_employee ON employee_leaves(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_leaves_dates ON employee_leaves(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_employee_leaves_status ON employee_leaves(status);

CREATE INDEX IF NOT EXISTS idx_hr_alerts_type ON hr_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_hr_alerts_employee ON hr_alerts(employee_id);
CREATE INDEX IF NOT EXISTS idx_hr_alerts_scheduled ON hr_alerts(scheduled_for);

-- =============================================
-- 9. VIEWS FOR COMMON QUERIES
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
JOIN employees e ON el.employee_id = e.employee_id
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
JOIN employees e ON ep.employee_id = e.employee_id
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
JOIN employees e ON el.employee_id = e.employee_id
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
JOIN employees e ON el.employee_id = e.employee_id
JOIN leave_types lt ON el.leave_type_id = lt.leave_type_id
WHERE el.status = 'pending'
ORDER BY el.requested_at ASC;

-- =============================================
-- 10. FUNCTIONS FOR AUTOMATIC UPDATES
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

CREATE OR REPLACE TRIGGER trigger_update_license_status
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

CREATE OR REPLACE TRIGGER trigger_update_permit_status
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

CREATE OR REPLACE TRIGGER trigger_calculate_leave_days
BEFORE INSERT OR UPDATE ON employee_leaves
FOR EACH ROW EXECUTE FUNCTION calculate_leave_days();

-- =============================================
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_permits ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_leave_balances ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read (will be filtered in application)
CREATE POLICY "Allow read for authenticated" ON employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read for authenticated" ON employee_licenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read for authenticated" ON employee_permits FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read for authenticated" ON employee_leaves FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read for authenticated" ON hr_alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read for authenticated" ON leave_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read for authenticated" ON employee_leave_balances FOR SELECT TO authenticated USING (true);

-- Allow all operations for authenticated (managed by application-level permissions)
CREATE POLICY "Allow all for authenticated" ON employees FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated" ON employee_licenses FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated" ON employee_permits FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated" ON employee_leaves FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated" ON hr_alerts FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated" ON employee_leave_balances FOR ALL TO authenticated USING (true);

-- =============================================
-- MIGRATION COMPLETE
-- =============================================
