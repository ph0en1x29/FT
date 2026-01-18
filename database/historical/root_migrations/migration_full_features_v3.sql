-- ============================================
-- FieldPro Full Features Migration V3
-- Includes: Notifications, Rental Amounts, Preventive Maintenance, Supervisor Role
-- ============================================

-- =====================
-- 1. ADD SUPERVISOR ROLE
-- =====================
-- Note: The UserRole enum should be updated in TypeScript
-- Supervisor is between Admin and Technician

-- =====================
-- 2. NOTIFICATIONS TABLE
-- =====================
CREATE TABLE IF NOT EXISTS notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'job_assigned', 'job_pending', 'service_due', 'rental_ending', 'low_stock'
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    reference_type VARCHAR(50), -- 'job', 'forklift', 'rental', 'inventory'
    reference_id UUID,
    is_read BOOLEAN DEFAULT FALSE,
    priority VARCHAR(20) DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);


-- =====================
-- 3. RENTAL AMOUNTS TABLE (Monthly Rental Fees)
-- =====================
CREATE TABLE IF NOT EXISTS rental_amounts (
    rental_amount_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rental_id UUID NOT NULL REFERENCES forklift_rentals(rental_id) ON DELETE CASCADE,
    monthly_rate DECIMAL(12, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'RM',
    billing_cycle VARCHAR(20) DEFAULT 'monthly', -- 'monthly', 'quarterly', 'yearly'
    effective_from DATE NOT NULL,
    effective_to DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by_id UUID REFERENCES users(user_id),
    created_by_name VARCHAR(255),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rental_amounts_rental ON rental_amounts(rental_id);

-- Alternative: Add monthly_rate directly to forklift_rentals
ALTER TABLE forklift_rentals 
ADD COLUMN IF NOT EXISTS monthly_rental_rate DECIMAL(12, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'RM';

-- =====================
-- 4. SCHEDULED/PREVENTIVE MAINTENANCE TABLE
-- =====================
CREATE TABLE IF NOT EXISTS scheduled_services (
    scheduled_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    forklift_id UUID NOT NULL REFERENCES forklifts(forklift_id) ON DELETE CASCADE,
    service_type VARCHAR(100) NOT NULL, -- 'PM Service', 'Oil Change', 'Annual Inspection', etc.
    due_date DATE NOT NULL,
    due_hourmeter INTEGER,
    estimated_hours DECIMAL(4, 2),
    status VARCHAR(30) DEFAULT 'pending', -- 'pending', 'scheduled', 'completed', 'overdue', 'cancelled'
    priority VARCHAR(20) DEFAULT 'Medium',
    assigned_technician_id UUID REFERENCES users(user_id),
    assigned_technician_name VARCHAR(255),
    job_id UUID REFERENCES jobs(job_id), -- Linked job when created
    notes TEXT,
    auto_create_job BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by_id UUID REFERENCES users(user_id),
    created_by_name VARCHAR(255),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_scheduled_services_forklift ON scheduled_services(forklift_id);
CREATE INDEX idx_scheduled_services_due ON scheduled_services(due_date) WHERE status IN ('pending', 'scheduled');
CREATE INDEX idx_scheduled_services_status ON scheduled_services(status);

-- =====================
-- 5. SERVICE INTERVALS CONFIGURATION
-- =====================
CREATE TABLE IF NOT EXISTS service_intervals (
    interval_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    forklift_type VARCHAR(50), -- NULL means applies to all types
    service_type VARCHAR(100) NOT NULL,
    hourmeter_interval INTEGER, -- Every X hours
    calendar_interval_days INTEGER, -- Or every X days
    priority VARCHAR(20) DEFAULT 'Medium',
    checklist_items JSONB,
    estimated_duration_hours DECIMAL(4, 2),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default service intervals
INSERT INTO service_intervals (name, service_type, hourmeter_interval, calendar_interval_days, priority, estimated_duration_hours) VALUES
('PM Service (250 hrs)', 'PM Service', 250, NULL, 'Medium', 2),
('PM Service (500 hrs)', 'PM Service', 500, NULL, 'Medium', 3),
('PM Service (1000 hrs)', 'Full Inspection', 1000, NULL, 'High', 4),
('Annual Safety Inspection', 'Safety Inspection', NULL, 365, 'High', 3),
('Quarterly Check', 'Routine Check', NULL, 90, 'Low', 1),
('Oil Change', 'Oil Change', 200, NULL, 'Medium', 1.5)
ON CONFLICT DO NOTHING;


-- =====================
-- 6. ADD NEXT SERVICE FIELDS TO FORKLIFTS
-- =====================
ALTER TABLE forklifts 
ADD COLUMN IF NOT EXISTS next_service_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS next_service_hourmeter INTEGER,
ADD COLUMN IF NOT EXISTS service_notes TEXT;

-- =====================
-- 7. TECHNICIAN KPI SNAPSHOTS (for historical tracking)
-- =====================
CREATE TABLE IF NOT EXISTS technician_kpi_snapshots (
    snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    technician_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    -- Core Metrics
    total_jobs_assigned INTEGER DEFAULT 0,
    total_jobs_completed INTEGER DEFAULT 0,
    completion_rate DECIMAL(5, 2) DEFAULT 0,
    -- Time Metrics (in hours)
    avg_response_time DECIMAL(6, 2) DEFAULT 0,
    avg_completion_time DECIMAL(6, 2) DEFAULT 0,
    avg_repair_time DECIMAL(6, 2) DEFAULT 0, -- Actual wrench time
    total_hours_worked DECIMAL(8, 2) DEFAULT 0,
    -- Industry Standard KPIs
    first_time_fix_rate DECIMAL(5, 2) DEFAULT 0, -- Jobs resolved without return visits
    mean_time_to_repair DECIMAL(6, 2) DEFAULT 0, -- MTTR
    technician_utilization DECIMAL(5, 2) DEFAULT 0, -- Billable hours / Total hours
    jobs_per_day DECIMAL(4, 2) DEFAULT 0,
    -- Quality Metrics
    repeat_visit_count INTEGER DEFAULT 0,
    customer_satisfaction_avg DECIMAL(3, 2),
    -- Revenue Metrics
    total_revenue_generated DECIMAL(12, 2) DEFAULT 0,
    avg_job_value DECIMAL(10, 2) DEFAULT 0,
    total_parts_value DECIMAL(12, 2) DEFAULT 0,
    -- Priority Breakdown
    emergency_jobs INTEGER DEFAULT 0,
    high_priority_jobs INTEGER DEFAULT 0,
    medium_priority_jobs INTEGER DEFAULT 0,
    low_priority_jobs INTEGER DEFAULT 0,
    -- Job Type Breakdown
    service_jobs INTEGER DEFAULT 0,
    repair_jobs INTEGER DEFAULT 0,
    checking_jobs INTEGER DEFAULT 0,
    accident_jobs INTEGER DEFAULT 0,
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_kpi_snapshots_tech ON technician_kpi_snapshots(technician_id);
CREATE INDEX idx_kpi_snapshots_period ON technician_kpi_snapshots(period_start, period_end);

-- =====================
-- 8. JOB CALLBACKS/FOLLOW-UPS TRACKING
-- =====================
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS is_callback BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS original_job_id UUID REFERENCES jobs(job_id),
ADD COLUMN IF NOT EXISTS callback_reason TEXT;

-- =====================
-- 9. INDEXES FOR PERFORMANCE
-- =====================
CREATE INDEX IF NOT EXISTS idx_jobs_technician_status ON jobs(assigned_technician_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_forklift ON jobs(forklift_id);

-- =====================
-- 10. FUNCTION TO AUTO-UPDATE FORKLIFT NEXT SERVICE
-- =====================
CREATE OR REPLACE FUNCTION update_forklift_next_service()
RETURNS TRIGGER AS $$
BEGIN
    -- Update forklift's next_service_due when a job is completed
    IF NEW.status = 'Completed' AND NEW.forklift_id IS NOT NULL THEN
        -- Get the next scheduled service for this forklift
        UPDATE forklifts 
        SET 
            last_service_date = NEW.completed_at,
            updated_at = NOW()
        WHERE forklift_id = NEW.forklift_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (if not exists check via exception handling)
DO $$
BEGIN
    CREATE TRIGGER trg_update_forklift_service
    AFTER UPDATE ON jobs
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION update_forklift_next_service();
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

