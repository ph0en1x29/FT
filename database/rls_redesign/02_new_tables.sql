-- ============================================
-- FieldPro RLS Redesign - Step 2: New Tables
-- ============================================
-- Creates: job_service_records, job_invoices, job_invoice_extra_charges,
--          job_audit_log, job_inventory_usage, job_status_history
-- Run this AFTER 01_enums_and_types.sql

-- =====================
-- 1. JOB SERVICE RECORDS (Technician-owned)
-- =====================
-- Contains all service/field work data
-- Technicians can only modify their own records
-- Locked after job is invoiced

CREATE TABLE IF NOT EXISTS job_service_records (
    service_record_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL UNIQUE REFERENCES jobs(job_id) ON DELETE CASCADE,
    
    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    repair_start_time TIMESTAMPTZ,
    repair_end_time TIMESTAMPTZ,
    
    -- Service Data
    checklist_data JSONB DEFAULT '{}',
    service_notes TEXT,
    job_carried_out TEXT,
    recommendation TEXT,
    hourmeter_reading INTEGER,
    
    -- Parts tracking (summary - details in job_inventory_usage)
    no_parts_used BOOLEAN DEFAULT FALSE,
    parts_summary JSONB DEFAULT '[]', -- Cached summary for quick access
    
    -- Photos (array of storage paths)
    photos TEXT[] DEFAULT '{}',
    
    -- Signatures
    technician_signature JSONB, -- {signed_by_name, signed_at, signature_url, ic_no}
    technician_signature_at TIMESTAMPTZ,
    customer_signature JSONB, -- {signed_by_name, signed_at, signature_url, department, ic_no}
    customer_signature_at TIMESTAMPTZ,
    
    -- Ownership & Audit
    technician_id UUID REFERENCES users(user_id), -- Can be null initially
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES users(user_id),
    
    -- Locking
    locked_at TIMESTAMPTZ, -- Set when job becomes invoiced
    locked_by UUID REFERENCES users(user_id),
    lock_reason TEXT DEFAULT 'invoiced'
);

CREATE INDEX idx_service_records_job ON job_service_records(job_id);
CREATE INDEX idx_service_records_technician ON job_service_records(technician_id);
CREATE INDEX idx_service_records_locked ON job_service_records(locked_at) WHERE locked_at IS NOT NULL;

COMMENT ON TABLE job_service_records IS 'Technician-owned service data. Locked after invoicing.';
COMMENT ON COLUMN job_service_records.locked_at IS 'When set, record is immutable except via admin override';

-- =====================
-- 2. JOB INVOICES (Accountant-owned)
-- =====================
-- Contains all billing/invoice data
-- Accountants can modify until finalized

CREATE TABLE IF NOT EXISTS job_invoices (
    invoice_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL UNIQUE REFERENCES jobs(job_id) ON DELETE CASCADE,
    
    -- Invoice Identity
    invoice_number VARCHAR(50),
    invoice_date DATE,
    due_date DATE,
    
    -- Service Report Reference
    service_report_number VARCHAR(50),
    
    -- Line Items (parts + labor as structured data)
    line_items JSONB DEFAULT '[]',
    
    -- Pricing
    parts_total DECIMAL(12, 2) DEFAULT 0,
    labor_hours DECIMAL(6, 2) DEFAULT 0,
    labor_rate DECIMAL(10, 2) DEFAULT 0,
    labor_total DECIMAL(12, 2) DEFAULT 0,
    subtotal DECIMAL(12, 2) DEFAULT 0,
    tax_rate DECIMAL(5, 4) DEFAULT 0, -- e.g., 0.06 for 6%
    tax_amount DECIMAL(12, 2) DEFAULT 0,
    discount_amount DECIMAL(12, 2) DEFAULT 0,
    discount_reason TEXT,
    total DECIMAL(12, 2) DEFAULT 0,
    
    -- Payment Tracking
    payment_status payment_status DEFAULT 'pending',
    amount_paid DECIMAL(12, 2) DEFAULT 0,
    payment_date DATE,
    payment_method VARCHAR(50),
    payment_reference VARCHAR(100),
    payment_notes TEXT,
    
    -- Quotation Reference
    quotation_number VARCHAR(50),
    quotation_date DATE,
    quotation_validity VARCHAR(50),
    delivery_term TEXT,
    payment_term TEXT,
    
    -- Internal Notes (accountant can update even after finalization)
    internal_notes TEXT,
    
    -- Ownership & Audit
    prepared_by UUID REFERENCES users(user_id),
    prepared_by_name VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES users(user_id),
    
    -- Finalization (locks the invoice)
    finalized_at TIMESTAMPTZ,
    finalized_by UUID REFERENCES users(user_id),
    finalized_by_name VARCHAR(255),
    
    -- Sending/Export
    sent_at TIMESTAMPTZ,
    sent_via TEXT[], -- ['email', 'whatsapp', 'print']
    sent_to TEXT[],
    
    -- Locking
    locked_at TIMESTAMPTZ, -- Set when finalized
    locked_by UUID REFERENCES users(user_id)
);

CREATE INDEX idx_invoices_job ON job_invoices(job_id);
CREATE INDEX idx_invoices_number ON job_invoices(invoice_number);
CREATE INDEX idx_invoices_payment_status ON job_invoices(payment_status);
CREATE INDEX idx_invoices_finalized ON job_invoices(finalized_at) WHERE finalized_at IS NOT NULL;

COMMENT ON TABLE job_invoices IS 'Accountant-owned invoice data. Locked after finalization.';

-- =====================
-- 3. JOB INVOICE EXTRA CHARGES (Relational)
-- =====================
-- Extra charges linked to invoices
-- Technicians can add, accountants can edit/approve

CREATE TABLE IF NOT EXISTS job_invoice_extra_charges (
    charge_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES job_invoices(invoice_id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
    
    -- Charge Details
    description TEXT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    quantity DECIMAL(8, 2) DEFAULT 1,
    unit_price DECIMAL(12, 2),
    
    -- Status (for approval workflow if needed)
    is_approved BOOLEAN DEFAULT FALSE,
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES users(user_id),
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(user_id),
    created_by_name VARCHAR(255),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES users(user_id)
);

CREATE INDEX idx_extra_charges_invoice ON job_invoice_extra_charges(invoice_id);
CREATE INDEX idx_extra_charges_job ON job_invoice_extra_charges(job_id);

COMMENT ON TABLE job_invoice_extra_charges IS 'Extra charges added to job invoices. Technician can add, accountant approves.';

-- =====================
-- 4. JOB AUDIT LOG (Immutable)
-- =====================
-- All job-related events logged here
-- No direct client writes allowed

CREATE TABLE IF NOT EXISTS job_audit_log (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
    
    -- Event Details
    event_type audit_event_type NOT NULL,
    event_description TEXT,
    
    -- Status Change Details (for status transitions)
    old_status VARCHAR(50),
    new_status VARCHAR(50),
    
    -- General Change Tracking
    old_value JSONB,
    new_value JSONB,
    changed_fields TEXT[],
    
    -- Context
    reason TEXT, -- Required for admin overrides and rollbacks
    
    -- Actor
    performed_by UUID REFERENCES users(user_id),
    performed_by_name VARCHAR(255),
    performed_by_role VARCHAR(50),
    
    -- Timestamp (immutable)
    performed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Related Records
    service_record_id UUID REFERENCES job_service_records(service_record_id),
    invoice_id UUID REFERENCES job_invoices(invoice_id)
);

CREATE INDEX idx_audit_log_job ON job_audit_log(job_id);
CREATE INDEX idx_audit_log_event ON job_audit_log(event_type);
CREATE INDEX idx_audit_log_performed ON job_audit_log(performed_at DESC);
CREATE INDEX idx_audit_log_user ON job_audit_log(performed_by);

COMMENT ON TABLE job_audit_log IS 'Immutable audit trail. No direct INSERT/UPDATE/DELETE allowed - trigger only.';

-- =====================
-- 5. JOB INVENTORY USAGE (Parts Used)
-- =====================
-- Records parts used on each job
-- Linked to inventory for stock deduction

CREATE TABLE IF NOT EXISTS job_inventory_usage (
    usage_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
    service_record_id UUID REFERENCES job_service_records(service_record_id),
    
    -- Item Details
    inventory_item_id UUID NOT NULL REFERENCES parts(part_id),
    part_name VARCHAR(255) NOT NULL,
    part_code VARCHAR(100),
    
    -- Quantity & Pricing
    quantity_used DECIMAL(10, 2) NOT NULL DEFAULT 1,
    unit_price DECIMAL(12, 2) NOT NULL, -- Price at time of use
    total_price DECIMAL(12, 2) NOT NULL,
    
    -- Stock Deduction Status
    stock_deducted BOOLEAN DEFAULT FALSE,
    deducted_at TIMESTAMPTZ,
    deducted_by UUID REFERENCES users(user_id),
    
    -- Audit
    recorded_by UUID NOT NULL REFERENCES users(user_id),
    recorded_by_name VARCHAR(255),
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inventory_usage_job ON job_inventory_usage(job_id);
CREATE INDEX idx_inventory_usage_item ON job_inventory_usage(inventory_item_id);
CREATE INDEX idx_inventory_usage_deducted ON job_inventory_usage(stock_deducted) WHERE stock_deducted = FALSE;

COMMENT ON TABLE job_inventory_usage IS 'Tracks parts used on jobs. Stock deducted on job completion.';

-- =====================
-- 6. JOB STATUS HISTORY (Dedicated)
-- =====================
-- Clean status transition tracking
-- Simpler than filtering audit log

CREATE TABLE IF NOT EXISTS job_status_history (
    history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
    
    -- Status Transition
    old_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL,
    
    -- Actor
    changed_by UUID REFERENCES users(user_id),
    changed_by_name VARCHAR(255),
    changed_by_role VARCHAR(50),
    
    -- Context
    reason TEXT, -- Required for backward transitions
    is_rollback BOOLEAN DEFAULT FALSE,
    
    -- Timestamp
    changed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_status_history_job ON job_status_history(job_id);
CREATE INDEX idx_status_history_changed ON job_status_history(changed_at DESC);

COMMENT ON TABLE job_status_history IS 'Complete status transition history for each job';

-- =====================
-- 7. ADD NEW COLUMNS TO JOBS TABLE
-- =====================
-- Add columns needed for the new workflow

ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS branch_id UUID,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(user_id),
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS locked_reason TEXT;

-- Add index for soft delete queries
CREATE INDEX IF NOT EXISTS idx_jobs_not_deleted ON jobs(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);

COMMENT ON COLUMN jobs.deleted_at IS 'Soft delete timestamp. NULL means active.';
COMMENT ON COLUMN jobs.is_locked IS 'TRUE when job is invoiced/paid and locked from edits';

-- =====================
-- 8. ENABLE RLS ON NEW TABLES
-- =====================

ALTER TABLE job_service_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_invoice_extra_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_inventory_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_status_history ENABLE ROW LEVEL SECURITY;

-- =====================
-- 9. UPDATED_AT TRIGGERS
-- =====================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to new tables
DROP TRIGGER IF EXISTS trg_service_records_updated ON job_service_records;
CREATE TRIGGER trg_service_records_updated
    BEFORE UPDATE ON job_service_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_invoices_updated ON job_invoices;
CREATE TRIGGER trg_invoices_updated
    BEFORE UPDATE ON job_invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_extra_charges_updated ON job_invoice_extra_charges;
CREATE TRIGGER trg_extra_charges_updated
    BEFORE UPDATE ON job_invoice_extra_charges
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_inventory_usage_updated ON job_inventory_usage;
CREATE TRIGGER trg_inventory_usage_updated
    BEFORE UPDATE ON job_inventory_usage
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
