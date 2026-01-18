-- ============================================
-- FieldPro RLS Redesign - ROLLBACK SCRIPT
-- ============================================
-- USE THIS ONLY IF SOMETHING GOES WRONG
-- This reverses the RLS redesign changes

-- =============================================
-- WARNING: This will:
-- 1. Drop new tables
-- 2. Remove new triggers
-- 3. Remove new functions
-- 4. Remove new policies
-- Data in new tables will be LOST!
-- =============================================

-- =====================
-- 1. DROP NEW POLICIES
-- =====================

-- Jobs
DROP POLICY IF EXISTS "admin_all_jobs" ON jobs;
DROP POLICY IF EXISTS "supervisor_select_jobs" ON jobs;
DROP POLICY IF EXISTS "supervisor_insert_jobs" ON jobs;
DROP POLICY IF EXISTS "supervisor_update_jobs" ON jobs;
DROP POLICY IF EXISTS "accountant_select_jobs" ON jobs;
DROP POLICY IF EXISTS "accountant_update_jobs" ON jobs;
DROP POLICY IF EXISTS "technician_select_own_jobs" ON jobs;
DROP POLICY IF EXISTS "technician_update_own_jobs" ON jobs;

-- Job Service Records
DROP POLICY IF EXISTS "admin_all_service_records" ON job_service_records;
DROP POLICY IF EXISTS "supervisor_select_service_records" ON job_service_records;
DROP POLICY IF EXISTS "accountant_select_service_records" ON job_service_records;
DROP POLICY IF EXISTS "technician_select_own_service_records" ON job_service_records;
DROP POLICY IF EXISTS "technician_insert_own_service_records" ON job_service_records;
DROP POLICY IF EXISTS "technician_update_own_service_records" ON job_service_records;

-- Job Invoices
DROP POLICY IF EXISTS "admin_all_invoices" ON job_invoices;
DROP POLICY IF EXISTS "supervisor_select_invoices" ON job_invoices;
DROP POLICY IF EXISTS "accountant_select_invoices" ON job_invoices;
DROP POLICY IF EXISTS "accountant_insert_invoices" ON job_invoices;
DROP POLICY IF EXISTS "accountant_update_invoices" ON job_invoices;
DROP POLICY IF EXISTS "technician_select_own_invoices" ON job_invoices;

-- Extra Charges
DROP POLICY IF EXISTS "admin_all_extra_charges" ON job_invoice_extra_charges;
DROP POLICY IF EXISTS "supervisor_select_extra_charges" ON job_invoice_extra_charges;
DROP POLICY IF EXISTS "supervisor_delete_extra_charges" ON job_invoice_extra_charges;
DROP POLICY IF EXISTS "accountant_all_extra_charges" ON job_invoice_extra_charges;
DROP POLICY IF EXISTS "technician_select_extra_charges" ON job_invoice_extra_charges;
DROP POLICY IF EXISTS "technician_insert_extra_charges" ON job_invoice_extra_charges;

-- Audit Log
DROP POLICY IF EXISTS "all_select_audit_log" ON job_audit_log;

-- Inventory Usage
DROP POLICY IF EXISTS "admin_all_inventory_usage" ON job_inventory_usage;
DROP POLICY IF EXISTS "supervisor_all_inventory_usage" ON job_inventory_usage;
DROP POLICY IF EXISTS "accountant_select_inventory_usage" ON job_inventory_usage;
DROP POLICY IF EXISTS "technician_select_inventory_usage" ON job_inventory_usage;
DROP POLICY IF EXISTS "technician_insert_inventory_usage" ON job_inventory_usage;
DROP POLICY IF EXISTS "technician_delete_inventory_usage" ON job_inventory_usage;

-- Status History
DROP POLICY IF EXISTS "all_select_status_history" ON job_status_history;

-- Customers
DROP POLICY IF EXISTS "admin_all_customers" ON customers;
DROP POLICY IF EXISTS "supervisor_all_customers" ON customers;
DROP POLICY IF EXISTS "accountant_select_customers" ON customers;
DROP POLICY IF EXISTS "accountant_insert_customers" ON customers;
DROP POLICY IF EXISTS "accountant_update_customers" ON customers;
DROP POLICY IF EXISTS "technician_select_customers" ON customers;

-- Forklifts
DROP POLICY IF EXISTS "admin_all_forklifts" ON forklifts;
DROP POLICY IF EXISTS "supervisor_all_forklifts" ON forklifts;
DROP POLICY IF EXISTS "accountant_select_forklifts" ON forklifts;
DROP POLICY IF EXISTS "technician_select_forklifts" ON forklifts;

-- Parts (Inventory)
DROP POLICY IF EXISTS "admin_all_parts" ON parts;
DROP POLICY IF EXISTS "supervisor_all_parts" ON parts;
DROP POLICY IF EXISTS "accountant_select_parts" ON parts;
DROP POLICY IF EXISTS "technician_select_parts" ON parts;

-- Rentals
DROP POLICY IF EXISTS "admin_all_rentals" ON forklift_rentals;
DROP POLICY IF EXISTS "supervisor_all_rentals" ON forklift_rentals;
DROP POLICY IF EXISTS "accountant_select_rentals" ON forklift_rentals;
DROP POLICY IF EXISTS "technician_select_rentals" ON forklift_rentals;

-- Users
DROP POLICY IF EXISTS "admin_all_users" ON users;
DROP POLICY IF EXISTS "authenticated_view_users" ON users;
DROP POLICY IF EXISTS "users_update_self" ON users;

-- =====================
-- 2. DROP TRIGGERS
-- =====================

DROP TRIGGER IF EXISTS trg_validate_status_transition ON jobs;
DROP TRIGGER IF EXISTS trg_validate_completion ON jobs;
DROP TRIGGER IF EXISTS trg_lock_on_invoice ON jobs;
DROP TRIGGER IF EXISTS trg_prevent_locked_edit ON job_service_records;
DROP TRIGGER IF EXISTS trg_deduct_inventory ON jobs;
DROP TRIGGER IF EXISTS trg_log_job_changes ON jobs;
DROP TRIGGER IF EXISTS trg_log_service_record ON job_service_records;
DROP TRIGGER IF EXISTS trg_log_invoice ON job_invoices;
DROP TRIGGER IF EXISTS trg_protect_audit_log ON job_audit_log;
DROP TRIGGER IF EXISTS trg_enforce_soft_delete ON jobs;
DROP TRIGGER IF EXISTS trg_auto_create_service_record ON jobs;
DROP TRIGGER IF EXISTS trg_service_records_updated ON job_service_records;
DROP TRIGGER IF EXISTS trg_invoices_updated ON job_invoices;
DROP TRIGGER IF EXISTS trg_extra_charges_updated ON job_invoice_extra_charges;
DROP TRIGGER IF EXISTS trg_inventory_usage_updated ON job_inventory_usage;

-- =====================
-- 3. DROP FUNCTIONS
-- =====================

DROP FUNCTION IF EXISTS validate_job_status_transition();
DROP FUNCTION IF EXISTS validate_job_completion_requirements();
DROP FUNCTION IF EXISTS lock_service_record_on_invoice();
DROP FUNCTION IF EXISTS prevent_locked_service_record_edit();
DROP FUNCTION IF EXISTS deduct_inventory_on_completion();
DROP FUNCTION IF EXISTS log_job_changes();
DROP FUNCTION IF EXISTS log_service_record_changes();
DROP FUNCTION IF EXISTS log_invoice_changes();
DROP FUNCTION IF EXISTS prevent_audit_log_modification();
DROP FUNCTION IF EXISTS enforce_soft_delete();
DROP FUNCTION IF EXISTS auto_create_service_record();
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop RPC functions
DROP FUNCTION IF EXISTS start_job(UUID);
DROP FUNCTION IF EXISTS complete_job(UUID, BOOLEAN);
DROP FUNCTION IF EXISTS finalize_invoice(UUID, VARCHAR);
DROP FUNCTION IF EXISTS admin_override_lock(UUID, TEXT, VARCHAR, VARCHAR, JSONB);
DROP FUNCTION IF EXISTS cancel_job(UUID, TEXT);
DROP FUNCTION IF EXISTS record_payment(UUID, DECIMAL, VARCHAR, VARCHAR, TEXT);

-- Drop helper functions
DROP FUNCTION IF EXISTS get_current_user_role();
DROP FUNCTION IF EXISTS has_role(TEXT);
DROP FUNCTION IF EXISTS has_any_role(TEXT[]);
DROP FUNCTION IF EXISTS is_admin_or_supervisor();

-- =====================
-- 4. DROP NEW TABLES
-- =====================

DROP TABLE IF EXISTS job_status_history CASCADE;
DROP TABLE IF EXISTS job_inventory_usage CASCADE;
DROP TABLE IF EXISTS job_audit_log CASCADE;
DROP TABLE IF EXISTS job_invoice_extra_charges CASCADE;
DROP TABLE IF EXISTS job_invoices CASCADE;
DROP TABLE IF EXISTS job_service_records CASCADE;

-- =====================
-- 5. DROP ENUMS
-- =====================

DROP TYPE IF EXISTS audit_event_type CASCADE;
DROP TYPE IF EXISTS payment_status CASCADE;

-- =====================
-- 6. REMOVE NEW COLUMNS FROM JOBS
-- =====================

ALTER TABLE jobs DROP COLUMN IF EXISTS branch_id;
ALTER TABLE jobs DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE jobs DROP COLUMN IF EXISTS deleted_by;
ALTER TABLE jobs DROP COLUMN IF EXISTS is_locked;
ALTER TABLE jobs DROP COLUMN IF EXISTS locked_at;
ALTER TABLE jobs DROP COLUMN IF EXISTS locked_reason;
ALTER TABLE jobs DROP COLUMN IF EXISTS status_v2;

-- =====================
-- 7. RESTORE ORIGINAL POLICIES
-- =====================
-- You may need to restore your original RLS policies here
-- This is a placeholder - add your original policies

-- Example: Restore basic authenticated access (NOT RECOMMENDED FOR PRODUCTION)
-- CREATE POLICY "temp_authenticated_all" ON jobs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =====================
-- DONE
-- =====================
-- After running this, you should restore your original RLS policies
-- or re-run the migration with fixes

RAISE NOTICE 'Rollback complete. Remember to restore original RLS policies if needed.';
