-- FieldPro Database Migration: Forklift Service Features
-- Run this migration in Supabase SQL Editor

-- ============================================
-- 1. ADD NEW COLUMNS TO JOBS TABLE
-- ============================================

-- Condition checklist (JSONB to store all checklist items)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS condition_checklist JSONB DEFAULT '{}';

-- Job description fields
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_carried_out TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS recommendation TEXT;

-- Repair time tracking
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS repair_start_time TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS repair_end_time TIMESTAMPTZ;

-- Service report number (auto-generated)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS service_report_number VARCHAR(50);

-- Quotation fields
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS quotation_number VARCHAR(50);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS quotation_date TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS quotation_validity VARCHAR(100);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS delivery_term VARCHAR(200);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS payment_term VARCHAR(200);

-- Audit Trail: Job Creation
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS created_by_id UUID REFERENCES users(user_id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS created_by_name VARCHAR(100);

-- Audit Trail: Job Started
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS started_by_id UUID REFERENCES users(user_id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS started_by_name VARCHAR(100);

-- Audit Trail: Job Completed
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS completed_by_id UUID REFERENCES users(user_id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS completed_by_name VARCHAR(100);

-- Audit Trail: Job Assigned
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS assigned_by_id UUID REFERENCES users(user_id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS assigned_by_name VARCHAR(100);

-- ============================================
-- 2. ADD NEW COLUMNS TO PARTS TABLE
-- ============================================

-- Inventory tracking fields
ALTER TABLE parts ADD COLUMN IF NOT EXISTS last_updated_by UUID REFERENCES users(user_id);
ALTER TABLE parts ADD COLUMN IF NOT EXISTS last_updated_by_name VARCHAR(100);
ALTER TABLE parts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE parts ADD COLUMN IF NOT EXISTS min_stock_level INTEGER DEFAULT 10;
ALTER TABLE parts ADD COLUMN IF NOT EXISTS supplier VARCHAR(200);
ALTER TABLE parts ADD COLUMN IF NOT EXISTS location VARCHAR(100);

-- ============================================
-- 3. ADD NEW COLUMNS TO CUSTOMERS TABLE
-- ============================================

-- Contact and account info
ALTER TABLE customers ADD COLUMN IF NOT EXISTS contact_person VARCHAR(100);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS account_number VARCHAR(50);

-- ============================================
-- 4. ADD NEW COLUMNS TO FORKLIFTS TABLE
-- ============================================

-- Customer relationship for rental tracking
ALTER TABLE forklifts ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(customer_id);
ALTER TABLE forklifts ADD COLUMN IF NOT EXISTS forklift_no VARCHAR(50);

-- ============================================
-- 5. CREATE QUOTATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS quotations (
    quotation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_number VARCHAR(50) NOT NULL UNIQUE,
    customer_id UUID REFERENCES customers(customer_id),
    forklift_id UUID REFERENCES forklifts(forklift_id),
    date TIMESTAMPTZ DEFAULT NOW(),
    attention VARCHAR(200),
    reference TEXT,
    items JSONB DEFAULT '[]',
    sub_total DECIMAL(12,2) DEFAULT 0,
    tax_rate DECIMAL(5,2) DEFAULT 0,
    tax_amount DECIMAL(12,2) DEFAULT 0,
    total DECIMAL(12,2) DEFAULT 0,
    validity VARCHAR(100) DEFAULT '14 DAYS',
    delivery_site TEXT,
    delivery_term VARCHAR(200) DEFAULT 'EX-STOCK',
    payment_term VARCHAR(200) DEFAULT 'UPON DELIVERY',
    remark TEXT,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected')),
    created_by_id UUID REFERENCES users(user_id),
    created_by_name VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    job_id UUID REFERENCES jobs(job_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_quotations_customer ON quotations(customer_id);
CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);

-- ============================================
-- 6. CREATE SERVICE INTERVALS TABLE (for predictive maintenance)
-- ============================================

CREATE TABLE IF NOT EXISTS service_intervals (
    interval_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    forklift_type VARCHAR(50) NOT NULL,
    service_type VARCHAR(100) NOT NULL,
    hourmeter_interval INTEGER NOT NULL,
    calendar_interval_days INTEGER,
    priority VARCHAR(20) DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Emergency')),
    checklist_items JSONB DEFAULT '[]',
    estimated_duration_hours DECIMAL(4,2),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default service intervals
INSERT INTO service_intervals (forklift_type, service_type, hourmeter_interval, calendar_interval_days, priority, estimated_duration_hours)
VALUES 
    ('Electric', 'PM Service', 500, 90, 'Medium', 2.0),
    ('Electric', 'Full Inspection', 2000, 365, 'High', 4.0),
    ('Diesel', 'PM Service', 250, 60, 'Medium', 2.5),
    ('Diesel', 'Oil Change', 500, 90, 'Medium', 1.5),
    ('Diesel', 'Full Inspection', 1000, 180, 'High', 4.0),
    ('LPG', 'PM Service', 300, 75, 'Medium', 2.0),
    ('LPG', 'Full Inspection', 1200, 200, 'High', 4.0),
    ('Petrol', 'PM Service', 250, 60, 'Medium', 2.0),
    ('Petrol', 'Full Inspection', 1000, 180, 'High', 4.0)
ON CONFLICT DO NOTHING;

-- ============================================
-- 7. CREATE SCHEDULED SERVICES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS scheduled_services (
    scheduled_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    forklift_id UUID REFERENCES forklifts(forklift_id) NOT NULL,
    service_interval_id UUID REFERENCES service_intervals(interval_id),
    due_date DATE NOT NULL,
    due_hourmeter INTEGER,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'completed', 'overdue')),
    assigned_technician_id UUID REFERENCES users(user_id),
    assigned_technician_name VARCHAR(100),
    job_id UUID REFERENCES jobs(job_id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_scheduled_services_forklift ON scheduled_services(forklift_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_services_status ON scheduled_services(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_services_due_date ON scheduled_services(due_date);

-- ============================================
-- 8. CREATE FUNCTION FOR AUTO SERVICE REPORT NUMBER
-- ============================================

CREATE OR REPLACE FUNCTION generate_service_report_number()
RETURNS TRIGGER AS $$
DECLARE
    year_str VARCHAR(4);
    next_num INTEGER;
BEGIN
    year_str := TO_CHAR(NOW(), 'YYYY');
    
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(service_report_number FROM 'SR-' || year_str || '-(\d+)') AS INTEGER)
    ), 0) + 1
    INTO next_num
    FROM jobs
    WHERE service_report_number LIKE 'SR-' || year_str || '-%';
    
    NEW.service_report_number := 'SR-' || year_str || '-' || LPAD(next_num::TEXT, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate service report number when job starts
DROP TRIGGER IF EXISTS auto_service_report_number ON jobs;
CREATE TRIGGER auto_service_report_number
    BEFORE UPDATE ON jobs
    FOR EACH ROW
    WHEN (OLD.status != 'In Progress' AND NEW.status = 'In Progress' AND NEW.service_report_number IS NULL)
    EXECUTE FUNCTION generate_service_report_number();

-- ============================================
-- 9. CREATE FUNCTION TO CHECK OVERDUE SERVICES
-- ============================================

CREATE OR REPLACE FUNCTION update_overdue_services()
RETURNS void AS $$
BEGIN
    UPDATE scheduled_services
    SET status = 'overdue'
    WHERE status = 'pending'
    AND due_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 10. UPDATE PARTS TABLE TRIGGER FOR UPDATED_AT
-- ============================================

CREATE OR REPLACE FUNCTION update_parts_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS parts_updated_at ON parts;
CREATE TRIGGER parts_updated_at
    BEFORE UPDATE ON parts
    FOR EACH ROW
    EXECUTE FUNCTION update_parts_timestamp();

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Verify migration
DO $$
BEGIN
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE 'New columns added to: jobs, parts, customers, forklifts';
    RAISE NOTICE 'New tables created: quotations, service_intervals, scheduled_services';
END $$;
