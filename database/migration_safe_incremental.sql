-- ============================================
-- FieldPro SAFE Incremental Migration v2
-- Run this - it will only add what's missing
-- ============================================

-- =====================
-- 1. NOTIFICATIONS TABLE (if not exists)
-- =====================
CREATE TABLE IF NOT EXISTS notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    reference_type VARCHAR(50),
    reference_id UUID,
    is_read BOOLEAN DEFAULT FALSE,
    priority VARCHAR(20) DEFAULT 'normal',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- =====================
-- 2. RENTAL AMOUNTS - Add monthly_rental_rate to forklift_rentals
-- =====================
ALTER TABLE forklift_rentals 
ADD COLUMN IF NOT EXISTS monthly_rental_rate DECIMAL(12, 2) DEFAULT 0;

ALTER TABLE forklift_rentals 
ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'RM';

-- =====================
-- 3. SCHEDULED SERVICES TABLE (if not exists)
-- =====================
CREATE TABLE IF NOT EXISTS scheduled_services (
    scheduled_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    forklift_id UUID NOT NULL REFERENCES forklifts(forklift_id) ON DELETE CASCADE,
    service_type VARCHAR(100) NOT NULL,
    due_date DATE NOT NULL,
    due_hourmeter INTEGER,
    estimated_hours DECIMAL(4, 2),
    status VARCHAR(30) DEFAULT 'pending',
    priority VARCHAR(20) DEFAULT 'Medium',
    assigned_technician_id UUID REFERENCES users(user_id),
    assigned_technician_name VARCHAR(255),
    job_id UUID REFERENCES jobs(job_id),
    notes TEXT,
    auto_create_job BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by_id UUID REFERENCES users(user_id),
    created_by_name VARCHAR(255),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Safe index creation (ignore if exists)
DO $$ BEGIN
    CREATE INDEX idx_scheduled_services_forklift ON scheduled_services(forklift_id);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    CREATE INDEX idx_scheduled_services_status ON scheduled_services(status);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

-- =====================
-- 4. SERVICE INTERVALS - Add name column if missing
-- =====================
ALTER TABLE service_intervals ADD COLUMN IF NOT EXISTS name VARCHAR(100);

-- Update existing rows to have a name if null
UPDATE service_intervals 
SET name = service_type || ' (' || COALESCE(hourmeter_interval::text || ' hrs', calendar_interval_days::text || ' days') || ')'
WHERE name IS NULL;

-- =====================
-- 5. ADD COLUMNS TO FORKLIFTS (for next service tracking)
-- =====================
ALTER TABLE forklifts ADD COLUMN IF NOT EXISTS next_service_type VARCHAR(100);
ALTER TABLE forklifts ADD COLUMN IF NOT EXISTS next_service_hourmeter INTEGER;
ALTER TABLE forklifts ADD COLUMN IF NOT EXISTS service_notes TEXT;

-- =====================
-- 6. ADD CALLBACK TRACKING TO JOBS
-- =====================
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_callback BOOLEAN DEFAULT FALSE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS original_job_id UUID;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS callback_reason TEXT;

-- =====================
-- 7. ADD REASSIGNMENT TRACKING TO JOBS
-- =====================
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS reassigned_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS reassigned_by_id UUID;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS reassigned_by_name VARCHAR(255);

-- =====================
-- 8. TECHNICIAN KPI SNAPSHOTS TABLE (for historical tracking)
-- =====================
CREATE TABLE IF NOT EXISTS technician_kpi_snapshots (
    snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    technician_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_jobs_assigned INTEGER DEFAULT 0,
    total_jobs_completed INTEGER DEFAULT 0,
    completion_rate DECIMAL(5, 2) DEFAULT 0,
    avg_response_time DECIMAL(6, 2) DEFAULT 0,
    avg_completion_time DECIMAL(6, 2) DEFAULT 0,
    avg_repair_time DECIMAL(6, 2) DEFAULT 0,
    total_hours_worked DECIMAL(8, 2) DEFAULT 0,
    first_time_fix_rate DECIMAL(5, 2) DEFAULT 0,
    mean_time_to_repair DECIMAL(6, 2) DEFAULT 0,
    technician_utilization DECIMAL(5, 2) DEFAULT 0,
    jobs_per_day DECIMAL(4, 2) DEFAULT 0,
    repeat_visit_count INTEGER DEFAULT 0,
    customer_satisfaction_avg DECIMAL(3, 2),
    total_revenue_generated DECIMAL(12, 2) DEFAULT 0,
    avg_job_value DECIMAL(10, 2) DEFAULT 0,
    total_parts_value DECIMAL(12, 2) DEFAULT 0,
    emergency_jobs INTEGER DEFAULT 0,
    high_priority_jobs INTEGER DEFAULT 0,
    medium_priority_jobs INTEGER DEFAULT 0,
    low_priority_jobs INTEGER DEFAULT 0,
    service_jobs INTEGER DEFAULT 0,
    repair_jobs INTEGER DEFAULT 0,
    checking_jobs INTEGER DEFAULT 0,
    accident_jobs INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$ BEGIN
    CREATE INDEX idx_kpi_snapshots_tech ON technician_kpi_snapshots(technician_id);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

-- =====================
-- 9. PERFORMANCE INDEXES
-- =====================
DO $$ BEGIN
    CREATE INDEX idx_jobs_technician_status ON jobs(assigned_technician_id, status);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    CREATE INDEX idx_jobs_created_at ON jobs(created_at DESC);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    CREATE INDEX idx_jobs_forklift ON jobs(forklift_id);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

-- =====================
-- DONE!
-- =====================
SELECT 'Migration completed successfully!' as status;
