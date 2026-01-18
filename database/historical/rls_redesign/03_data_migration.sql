-- ============================================
-- FieldPro RLS Redesign - Step 3: Data Migration
-- ============================================
-- Migrates existing data from jobs table to new structure
-- Run this AFTER 02_new_tables.sql
-- NOTE: This is for dev/prototype - adjust for production if needed
--
-- EXISTING STATUS VALUES: 'New', 'Assigned', 'In Progress', 'Awaiting Finalization', 'Completed'

-- =====================
-- 1. MIGRATE SERVICE DATA TO job_service_records
-- =====================

INSERT INTO job_service_records (
    job_id,
    technician_id,
    started_at,
    completed_at,
    repair_start_time,
    repair_end_time,
    checklist_data,
    service_notes,
    job_carried_out,
    recommendation,
    hourmeter_reading,
    no_parts_used,
    technician_signature,
    technician_signature_at,
    customer_signature,
    customer_signature_at,
    created_at,
    updated_at
)
SELECT 
    j.job_id,
    j.assigned_technician_id,
    j.started_at,
    j.completed_at,
    j.repair_start_time,
    j.repair_end_time,
    COALESCE(j.condition_checklist, '{}')::JSONB,
    COALESCE(j.job_carried_out, ''), -- Use job_carried_out as service_notes
    j.job_carried_out,
    j.recommendation,
    j.hourmeter_reading,
    FALSE, -- no_parts_used - will be updated based on parts_used
    j.technician_signature::JSONB,
    CASE WHEN j.technician_signature IS NOT NULL 
         THEN (j.technician_signature->>'signed_at')::TIMESTAMPTZ 
         ELSE NULL END,
    j.customer_signature::JSONB,
    CASE WHEN j.customer_signature IS NOT NULL 
         THEN (j.customer_signature->>'signed_at')::TIMESTAMPTZ 
         ELSE NULL END,
    j.created_at,
    NOW()
FROM jobs j
WHERE j.assigned_technician_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM job_service_records sr WHERE sr.job_id = j.job_id
)
ON CONFLICT (job_id) DO NOTHING;

-- Update no_parts_used for jobs without parts
UPDATE job_service_records sr
SET no_parts_used = TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM job_parts jp WHERE jp.job_id = sr.job_id
);

-- =====================
-- 2. MIGRATE INVOICE DATA TO job_invoices
-- =====================

INSERT INTO job_invoices (
    job_id,
    invoice_number,
    service_report_number,
    labor_total,
    labor_hours,
    prepared_by,
    prepared_by_name,
    finalized_at,
    finalized_by,
    finalized_by_name,
    sent_at,
    sent_via,
    created_at,
    updated_at
)
SELECT 
    j.job_id,
    NULL, -- invoice_number - typically generated
    j.service_report_number,
    COALESCE(j.labor_cost, 0),
    NULL, -- labor_hours - not tracked in old schema
    j.invoiced_by_id,
    j.invoiced_by_name,
    j.invoiced_at,
    j.invoiced_by_id,
    j.invoiced_by_name,
    j.invoice_sent_at,
    j.invoice_sent_via,
    COALESCE(j.invoiced_at, j.created_at),
    NOW()
FROM jobs j
WHERE (j.status IN ('Completed', 'Awaiting Finalization') OR j.invoiced_at IS NOT NULL)
AND NOT EXISTS (
    SELECT 1 FROM job_invoices ji WHERE ji.job_id = j.job_id
)
ON CONFLICT (job_id) DO NOTHING;

-- =====================
-- 3. MIGRATE EXTRA CHARGES
-- =====================

INSERT INTO job_invoice_extra_charges (
    job_id,
    invoice_id,
    description,
    amount,
    quantity,
    unit_price,
    is_approved,
    created_at,
    created_by,
    created_by_name
)
SELECT 
    ec.job_id,
    ji.invoice_id,
    COALESCE(ec.description, ec.name),
    ec.amount,
    1,
    ec.amount,
    TRUE, -- existing charges are considered approved
    ec.created_at,
    COALESCE(ji.prepared_by, (SELECT user_id FROM users WHERE role = 'admin' LIMIT 1)),
    'Migrated'
FROM extra_charges ec
JOIN job_invoices ji ON ji.job_id = ec.job_id
WHERE NOT EXISTS (
    SELECT 1 FROM job_invoice_extra_charges jec 
    WHERE jec.job_id = ec.job_id AND jec.description = COALESCE(ec.description, ec.name)
);

-- =====================
-- 4. MIGRATE PARTS USED TO job_inventory_usage
-- =====================

INSERT INTO job_inventory_usage (
    job_id,
    service_record_id,
    inventory_item_id,
    part_name,
    part_code,
    quantity_used,
    unit_price,
    total_price,
    stock_deducted,
    recorded_by,
    recorded_by_name,
    recorded_at
)
SELECT 
    jp.job_id,
    sr.service_record_id,
    jp.part_id,
    jp.part_name,
    (SELECT part_code FROM parts WHERE part_id = jp.part_id),
    jp.quantity,
    jp.sell_price_at_time,
    jp.quantity * jp.sell_price_at_time,
    TRUE, -- Assume existing parts were already deducted
    COALESCE(j.assigned_technician_id, j.created_by_id),
    COALESCE(j.assigned_technician_name, 'Migrated'),
    COALESCE(j.completed_at, j.created_at)
FROM job_parts jp
JOIN jobs j ON j.job_id = jp.job_id
LEFT JOIN job_service_records sr ON sr.job_id = jp.job_id
WHERE NOT EXISTS (
    SELECT 1 FROM job_inventory_usage jiu 
    WHERE jiu.job_id = jp.job_id AND jiu.inventory_item_id = jp.part_id
);

-- =====================
-- 5. CREATE INITIAL STATUS HISTORY
-- =====================

INSERT INTO job_status_history (
    job_id,
    old_status,
    new_status,
    changed_by,
    changed_by_name,
    changed_at,
    reason
)
SELECT 
    j.job_id,
    NULL,
    j.status,
    COALESCE(j.created_by_id, j.assigned_by_id),
    COALESCE(j.created_by_name, j.assigned_by_name, 'System Migration'),
    j.created_at,
    'Initial status from migration'
FROM jobs j
WHERE NOT EXISTS (
    SELECT 1 FROM job_status_history jsh WHERE jsh.job_id = j.job_id
);

-- =====================
-- 6. UPDATE INVOICE TOTALS
-- =====================

UPDATE job_invoices ji
SET 
    parts_total = COALESCE((
        SELECT SUM(total_price) 
        FROM job_inventory_usage jiu 
        WHERE jiu.job_id = ji.job_id
    ), 0),
    subtotal = COALESCE(labor_total, 0) + COALESCE((
        SELECT SUM(total_price) 
        FROM job_inventory_usage jiu 
        WHERE jiu.job_id = ji.job_id
    ), 0) + COALESCE((
        SELECT SUM(amount) 
        FROM job_invoice_extra_charges jec 
        WHERE jec.invoice_id = ji.invoice_id
    ), 0),
    total = COALESCE(labor_total, 0) + COALESCE((
        SELECT SUM(total_price) 
        FROM job_inventory_usage jiu 
        WHERE jiu.job_id = ji.job_id
    ), 0) + COALESCE((
        SELECT SUM(amount) 
        FROM job_invoice_extra_charges jec 
        WHERE jec.invoice_id = ji.invoice_id
    ), 0);

-- =====================
-- 7. LOCK COMPLETED SERVICE RECORDS
-- =====================
-- Lock service records for jobs that are already Completed (invoiced)

UPDATE job_service_records sr
SET 
    locked_at = NOW(),
    locked_by = (SELECT user_id FROM users WHERE role = 'admin' LIMIT 1),
    lock_reason = 'Migration - job already completed/invoiced'
WHERE EXISTS (
    SELECT 1 FROM jobs j 
    WHERE j.job_id = sr.job_id 
    AND (j.status = 'Completed' OR j.invoiced_at IS NOT NULL)
)
AND sr.locked_at IS NULL;

-- =====================
-- 8. CREATE AUDIT LOG ENTRIES FOR MIGRATION
-- =====================

INSERT INTO job_audit_log (
    job_id,
    event_type,
    event_description,
    new_value,
    performed_by_name,
    performed_by_role,
    performed_at
)
SELECT 
    job_id,
    'job_created'::audit_event_type,
    'Job migrated to new schema',
    jsonb_build_object('migration_date', NOW()::text, 'original_status', status),
    'System Migration',
    'system',
    NOW()
FROM jobs
WHERE NOT EXISTS (
    SELECT 1 FROM job_audit_log jal 
    WHERE jal.job_id = jobs.job_id 
    AND jal.event_type = 'job_created'
);

-- =====================
-- 9. ADD SOFT DELETE COLUMNS IF NOT EXISTS
-- =====================

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(user_id);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS locked_reason TEXT;

-- =====================
-- VERIFICATION QUERIES (Run manually to check migration)
-- =====================

-- Check service records created
-- SELECT COUNT(*) as service_records FROM job_service_records;

-- Check invoices created
-- SELECT COUNT(*) as invoices FROM job_invoices;

-- Check inventory usage migrated
-- SELECT COUNT(*) as inventory_usage FROM job_inventory_usage;

-- Check status distribution
-- SELECT status, COUNT(*) FROM jobs GROUP BY status;

-- Check locked records
-- SELECT COUNT(*) as locked_records FROM job_service_records WHERE locked_at IS NOT NULL;

-- =====================
-- MIGRATION COMPLETE
-- =====================

DO $$
BEGIN
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE 'Service records migrated: %', (SELECT COUNT(*) FROM job_service_records);
    RAISE NOTICE 'Invoices created: %', (SELECT COUNT(*) FROM job_invoices);
    RAISE NOTICE 'Inventory usage migrated: %', (SELECT COUNT(*) FROM job_inventory_usage);
    RAISE NOTICE 'Locked service records: %', (SELECT COUNT(*) FROM job_service_records WHERE locked_at IS NOT NULL);
END $$;
