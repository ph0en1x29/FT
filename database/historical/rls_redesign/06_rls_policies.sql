-- ============================================
-- FieldPro RLS Redesign - Step 6: RLS Policies
-- ============================================
-- Clean, role-based Row Level Security policies
-- Run this AFTER 05_rpc_functions.sql
--
-- ROLES:
-- - admin: Full access to everything
-- - supervisor: View all, create/update most, limited delete
-- - accountant: View all jobs, finalize invoices, manage invoice data
-- - technician: View/update only assigned jobs, record service data

-- =============================================
-- ENABLE RLS ON ALL TABLES
-- =============================================

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_service_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_invoice_extra_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_inventory_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE forklifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE forklift_rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- =============================================
-- JOBS TABLE POLICIES
-- =============================================

-- Drop existing policies first
DROP POLICY IF EXISTS "admin_all_jobs" ON jobs;
DROP POLICY IF EXISTS "supervisor_all_jobs" ON jobs;
DROP POLICY IF EXISTS "accountant_jobs" ON jobs;
DROP POLICY IF EXISTS "technician_jobs" ON jobs;

-- ADMIN: Full access to all jobs
CREATE POLICY "admin_all_jobs" ON jobs
    FOR ALL
    TO authenticated
    USING (has_role('admin'))
    WITH CHECK (has_role('admin'));

-- SUPERVISOR: Can view all, create, update (but not delete completed)
CREATE POLICY "supervisor_select_jobs" ON jobs
    FOR SELECT
    TO authenticated
    USING (has_role('supervisor'));

CREATE POLICY "supervisor_insert_jobs" ON jobs
    FOR INSERT
    TO authenticated
    WITH CHECK (has_role('supervisor'));

CREATE POLICY "supervisor_update_jobs" ON jobs
    FOR UPDATE
    TO authenticated
    USING (has_role('supervisor'))
    WITH CHECK (has_role('supervisor'));

-- ACCOUNTANT: Can view all jobs, update only Awaiting Finalization → Completed
CREATE POLICY "accountant_select_jobs" ON jobs
    FOR SELECT
    TO authenticated
    USING (has_role('accountant'));

CREATE POLICY "accountant_update_jobs" ON jobs
    FOR UPDATE
    TO authenticated
    USING (
        has_role('accountant')
        AND status IN ('Awaiting Finalization', 'Completed')
    )
    WITH CHECK (
        has_role('accountant')
        AND status IN ('Awaiting Finalization', 'Completed')
    );

-- TECHNICIAN: Can only see and update their assigned jobs
CREATE POLICY "technician_select_jobs" ON jobs
    FOR SELECT
    TO authenticated
    USING (
        has_role('technician')
        AND assigned_technician_id = auth.uid()
    );

CREATE POLICY "technician_update_jobs" ON jobs
    FOR UPDATE
    TO authenticated
    USING (
        has_role('technician')
        AND assigned_technician_id = auth.uid()
        AND status IN ('Assigned', 'In Progress')
    )
    WITH CHECK (
        has_role('technician')
        AND assigned_technician_id = auth.uid()
        AND status IN ('Assigned', 'In Progress', 'Awaiting Finalization')
    );

-- =============================================
-- JOB_SERVICE_RECORDS TABLE POLICIES
-- =============================================

DROP POLICY IF EXISTS "admin_all_service_records" ON job_service_records;
DROP POLICY IF EXISTS "supervisor_service_records" ON job_service_records;
DROP POLICY IF EXISTS "accountant_service_records" ON job_service_records;
DROP POLICY IF EXISTS "technician_service_records" ON job_service_records;

-- ADMIN: Full access
CREATE POLICY "admin_all_service_records" ON job_service_records
    FOR ALL
    TO authenticated
    USING (has_role('admin'))
    WITH CHECK (has_role('admin'));

-- SUPERVISOR: Select only (view service records)
CREATE POLICY "supervisor_select_service_records" ON job_service_records
    FOR SELECT
    TO authenticated
    USING (has_role('supervisor'));

-- ACCOUNTANT: Select only (view for invoicing)
CREATE POLICY "accountant_select_service_records" ON job_service_records
    FOR SELECT
    TO authenticated
    USING (has_role('accountant'));

-- TECHNICIAN: Full access to own job's service records (if not locked)
CREATE POLICY "technician_select_service_records" ON job_service_records
    FOR SELECT
    TO authenticated
    USING (
        has_role('technician')
        AND EXISTS (
            SELECT 1 FROM jobs 
            WHERE jobs.job_id = job_service_records.job_id
            AND jobs.assigned_technician_id = auth.uid()
        )
    );

CREATE POLICY "technician_insert_service_records" ON job_service_records
    FOR INSERT
    TO authenticated
    WITH CHECK (
        has_role('technician')
        AND EXISTS (
            SELECT 1 FROM jobs 
            WHERE jobs.job_id = job_service_records.job_id
            AND jobs.assigned_technician_id = auth.uid()
        )
    );

CREATE POLICY "technician_update_service_records" ON job_service_records
    FOR UPDATE
    TO authenticated
    USING (
        has_role('technician')
        AND locked_at IS NULL
        AND EXISTS (
            SELECT 1 FROM jobs 
            WHERE jobs.job_id = job_service_records.job_id
            AND jobs.assigned_technician_id = auth.uid()
        )
    )
    WITH CHECK (
        has_role('technician')
        AND locked_at IS NULL
    );

-- =============================================
-- JOB_INVOICES TABLE POLICIES
-- =============================================

DROP POLICY IF EXISTS "admin_all_invoices" ON job_invoices;
DROP POLICY IF EXISTS "supervisor_invoices" ON job_invoices;
DROP POLICY IF EXISTS "accountant_invoices" ON job_invoices;
DROP POLICY IF EXISTS "technician_invoices" ON job_invoices;

-- ADMIN: Full access
CREATE POLICY "admin_all_invoices" ON job_invoices
    FOR ALL
    TO authenticated
    USING (has_role('admin'))
    WITH CHECK (has_role('admin'));

-- SUPERVISOR: Select only
CREATE POLICY "supervisor_select_invoices" ON job_invoices
    FOR SELECT
    TO authenticated
    USING (has_role('supervisor'));

-- ACCOUNTANT: Full access (manage invoices)
CREATE POLICY "accountant_all_invoices" ON job_invoices
    FOR ALL
    TO authenticated
    USING (has_role('accountant'))
    WITH CHECK (has_role('accountant'));

-- TECHNICIAN: Select only (view their job's invoices)
CREATE POLICY "technician_select_invoices" ON job_invoices
    FOR SELECT
    TO authenticated
    USING (
        has_role('technician')
        AND EXISTS (
            SELECT 1 FROM jobs 
            WHERE jobs.job_id = job_invoices.job_id
            AND jobs.assigned_technician_id = auth.uid()
        )
    );

-- =============================================
-- JOB_INVOICE_EXTRA_CHARGES TABLE POLICIES
-- =============================================

DROP POLICY IF EXISTS "admin_all_extra_charges" ON job_invoice_extra_charges;
DROP POLICY IF EXISTS "supervisor_extra_charges" ON job_invoice_extra_charges;
DROP POLICY IF EXISTS "accountant_extra_charges" ON job_invoice_extra_charges;
DROP POLICY IF EXISTS "technician_extra_charges" ON job_invoice_extra_charges;

-- ADMIN: Full access
CREATE POLICY "admin_all_extra_charges" ON job_invoice_extra_charges
    FOR ALL
    TO authenticated
    USING (has_role('admin'))
    WITH CHECK (has_role('admin'));

-- SUPERVISOR: Select and delete
CREATE POLICY "supervisor_select_extra_charges" ON job_invoice_extra_charges
    FOR SELECT
    TO authenticated
    USING (has_role('supervisor'));

CREATE POLICY "supervisor_delete_extra_charges" ON job_invoice_extra_charges
    FOR DELETE
    TO authenticated
    USING (has_role('supervisor'));

-- ACCOUNTANT: Full access
CREATE POLICY "accountant_all_extra_charges" ON job_invoice_extra_charges
    FOR ALL
    TO authenticated
    USING (has_role('accountant'))
    WITH CHECK (has_role('accountant'));

-- TECHNICIAN: Can add extra charges to their in-progress jobs
CREATE POLICY "technician_select_extra_charges" ON job_invoice_extra_charges
    FOR SELECT
    TO authenticated
    USING (
        has_role('technician')
        AND EXISTS (
            SELECT 1 FROM jobs 
            WHERE jobs.job_id = job_invoice_extra_charges.job_id
            AND jobs.assigned_technician_id = auth.uid()
        )
    );

CREATE POLICY "technician_insert_extra_charges" ON job_invoice_extra_charges
    FOR INSERT
    TO authenticated
    WITH CHECK (
        has_role('technician')
        AND EXISTS (
            SELECT 1 FROM jobs 
            WHERE jobs.job_id = job_invoice_extra_charges.job_id
            AND jobs.assigned_technician_id = auth.uid()
            AND jobs.status IN ('In Progress', 'Awaiting Finalization')
        )
    );

-- =============================================
-- JOB_AUDIT_LOG TABLE POLICIES
-- =============================================
-- Audit log is APPEND ONLY - no updates or deletes allowed via RLS
-- Writes happen through triggers (SECURITY DEFINER)

DROP POLICY IF EXISTS "all_select_audit_log" ON job_audit_log;

-- All authenticated users can READ audit logs
CREATE POLICY "all_select_audit_log" ON job_audit_log
    FOR SELECT
    TO authenticated
    USING (true);

-- No INSERT/UPDATE/DELETE policies - writes only through triggers

-- =============================================
-- JOB_INVENTORY_USAGE TABLE POLICIES
-- =============================================

DROP POLICY IF EXISTS "admin_all_inventory_usage" ON job_inventory_usage;
DROP POLICY IF EXISTS "supervisor_inventory_usage" ON job_inventory_usage;
DROP POLICY IF EXISTS "accountant_inventory_usage" ON job_inventory_usage;
DROP POLICY IF EXISTS "technician_inventory_usage" ON job_inventory_usage;

-- ADMIN: Full access
CREATE POLICY "admin_all_inventory_usage" ON job_inventory_usage
    FOR ALL
    TO authenticated
    USING (has_role('admin'))
    WITH CHECK (has_role('admin'));

-- SUPERVISOR: Full access
CREATE POLICY "supervisor_all_inventory_usage" ON job_inventory_usage
    FOR ALL
    TO authenticated
    USING (has_role('supervisor'))
    WITH CHECK (has_role('supervisor'));

-- ACCOUNTANT: Select only
CREATE POLICY "accountant_select_inventory_usage" ON job_inventory_usage
    FOR SELECT
    TO authenticated
    USING (has_role('accountant'));

-- TECHNICIAN: Can manage parts on their in-progress jobs (if not deducted)
CREATE POLICY "technician_select_inventory_usage" ON job_inventory_usage
    FOR SELECT
    TO authenticated
    USING (
        has_role('technician')
        AND EXISTS (
            SELECT 1 FROM jobs 
            WHERE jobs.job_id = job_inventory_usage.job_id
            AND jobs.assigned_technician_id = auth.uid()
        )
    );

CREATE POLICY "technician_insert_inventory_usage" ON job_inventory_usage
    FOR INSERT
    TO authenticated
    WITH CHECK (
        has_role('technician')
        AND EXISTS (
            SELECT 1 FROM jobs 
            WHERE jobs.job_id = job_inventory_usage.job_id
            AND jobs.assigned_technician_id = auth.uid()
            AND jobs.status = 'In Progress'
        )
    );

CREATE POLICY "technician_delete_inventory_usage" ON job_inventory_usage
    FOR DELETE
    TO authenticated
    USING (
        has_role('technician')
        AND stock_deducted = FALSE
        AND EXISTS (
            SELECT 1 FROM jobs 
            WHERE jobs.job_id = job_inventory_usage.job_id
            AND jobs.assigned_technician_id = auth.uid()
            AND jobs.status = 'In Progress'
        )
    );

-- =============================================
-- JOB_STATUS_HISTORY TABLE POLICIES
-- =============================================
-- Read-only for all, writes through triggers

DROP POLICY IF EXISTS "all_select_status_history" ON job_status_history;

CREATE POLICY "all_select_status_history" ON job_status_history
    FOR SELECT
    TO authenticated
    USING (true);

-- =============================================
-- CUSTOMERS TABLE POLICIES
-- =============================================

DROP POLICY IF EXISTS "admin_all_customers" ON customers;
DROP POLICY IF EXISTS "supervisor_all_customers" ON customers;
DROP POLICY IF EXISTS "accountant_customers" ON customers;
DROP POLICY IF EXISTS "technician_customers" ON customers;

-- ADMIN: Full access
CREATE POLICY "admin_all_customers" ON customers
    FOR ALL
    TO authenticated
    USING (has_role('admin'))
    WITH CHECK (has_role('admin'));

-- SUPERVISOR: Full access
CREATE POLICY "supervisor_all_customers" ON customers
    FOR ALL
    TO authenticated
    USING (has_role('supervisor'))
    WITH CHECK (has_role('supervisor'));

-- ACCOUNTANT: Select, insert, update (no delete)
CREATE POLICY "accountant_select_customers" ON customers
    FOR SELECT
    TO authenticated
    USING (has_role('accountant'));

CREATE POLICY "accountant_insert_customers" ON customers
    FOR INSERT
    TO authenticated
    WITH CHECK (has_role('accountant'));

CREATE POLICY "accountant_update_customers" ON customers
    FOR UPDATE
    TO authenticated
    USING (has_role('accountant'))
    WITH CHECK (has_role('accountant'));

-- TECHNICIAN: Select only
CREATE POLICY "technician_select_customers" ON customers
    FOR SELECT
    TO authenticated
    USING (has_role('technician'));

-- =============================================
-- FORKLIFTS TABLE POLICIES
-- =============================================

DROP POLICY IF EXISTS "admin_all_forklifts" ON forklifts;
DROP POLICY IF EXISTS "supervisor_all_forklifts" ON forklifts;
DROP POLICY IF EXISTS "accountant_forklifts" ON forklifts;
DROP POLICY IF EXISTS "technician_forklifts" ON forklifts;

-- ADMIN: Full access
CREATE POLICY "admin_all_forklifts" ON forklifts
    FOR ALL
    TO authenticated
    USING (has_role('admin'))
    WITH CHECK (has_role('admin'));

-- SUPERVISOR: Full access
CREATE POLICY "supervisor_all_forklifts" ON forklifts
    FOR ALL
    TO authenticated
    USING (has_role('supervisor'))
    WITH CHECK (has_role('supervisor'));

-- ACCOUNTANT: Select only
CREATE POLICY "accountant_select_forklifts" ON forklifts
    FOR SELECT
    TO authenticated
    USING (has_role('accountant'));

-- TECHNICIAN: Select only
CREATE POLICY "technician_select_forklifts" ON forklifts
    FOR SELECT
    TO authenticated
    USING (has_role('technician'));

-- =============================================
-- PARTS TABLE POLICIES
-- =============================================

DROP POLICY IF EXISTS "admin_all_parts" ON parts;
DROP POLICY IF EXISTS "supervisor_all_parts" ON parts;
DROP POLICY IF EXISTS "accountant_parts" ON parts;
DROP POLICY IF EXISTS "technician_parts" ON parts;

-- ADMIN: Full access
CREATE POLICY "admin_all_parts" ON parts
    FOR ALL
    TO authenticated
    USING (has_role('admin'))
    WITH CHECK (has_role('admin'));

-- SUPERVISOR: Full access
CREATE POLICY "supervisor_all_parts" ON parts
    FOR ALL
    TO authenticated
    USING (has_role('supervisor'))
    WITH CHECK (has_role('supervisor'));

-- ACCOUNTANT: Select only
CREATE POLICY "accountant_select_parts" ON parts
    FOR SELECT
    TO authenticated
    USING (has_role('accountant'));

-- TECHNICIAN: Select only
CREATE POLICY "technician_select_parts" ON parts
    FOR SELECT
    TO authenticated
    USING (has_role('technician'));

-- =============================================
-- FORKLIFT_RENTALS TABLE POLICIES
-- =============================================

DROP POLICY IF EXISTS "admin_all_rentals" ON forklift_rentals;
DROP POLICY IF EXISTS "supervisor_all_rentals" ON forklift_rentals;
DROP POLICY IF EXISTS "accountant_rentals" ON forklift_rentals;
DROP POLICY IF EXISTS "technician_rentals" ON forklift_rentals;

-- ADMIN: Full access
CREATE POLICY "admin_all_rentals" ON forklift_rentals
    FOR ALL
    TO authenticated
    USING (has_role('admin'))
    WITH CHECK (has_role('admin'));

-- SUPERVISOR: Full access
CREATE POLICY "supervisor_all_rentals" ON forklift_rentals
    FOR ALL
    TO authenticated
    USING (has_role('supervisor'))
    WITH CHECK (has_role('supervisor'));

-- ACCOUNTANT: Select only (for billing purposes)
CREATE POLICY "accountant_select_rentals" ON forklift_rentals
    FOR SELECT
    TO authenticated
    USING (has_role('accountant'));

-- TECHNICIAN: Select only (to see where forklifts are)
CREATE POLICY "technician_select_rentals" ON forklift_rentals
    FOR SELECT
    TO authenticated
    USING (has_role('technician'));

-- =============================================
-- USERS TABLE POLICIES
-- =============================================

DROP POLICY IF EXISTS "admin_all_users" ON users;
DROP POLICY IF EXISTS "users_select_all" ON users;
DROP POLICY IF EXISTS "users_update_self" ON users;

-- ADMIN: Full access to all users
CREATE POLICY "admin_all_users" ON users
    FOR ALL
    TO authenticated
    USING (has_role('admin'))
    WITH CHECK (has_role('admin'));

-- All authenticated users can view user list (for assignment dropdowns, etc.)
CREATE POLICY "users_select_all" ON users
    FOR SELECT
    TO authenticated
    USING (true);

-- Users can update their own profile (but not role or is_active)
CREATE POLICY "users_update_self" ON users
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (
        user_id = auth.uid()
        -- Cannot change own role or active status
        -- This is enforced by trigger, not policy
    );

-- =============================================
-- REVOKE PUBLIC ACCESS
-- =============================================
-- Remove any public access that might exist

REVOKE ALL ON jobs FROM public;
REVOKE ALL ON job_service_records FROM public;
REVOKE ALL ON job_invoices FROM public;
REVOKE ALL ON job_invoice_extra_charges FROM public;
REVOKE ALL ON job_audit_log FROM public;
REVOKE ALL ON job_inventory_usage FROM public;
REVOKE ALL ON job_status_history FROM public;
REVOKE ALL ON customers FROM public;
REVOKE ALL ON forklifts FROM public;
REVOKE ALL ON parts FROM public;
REVOKE ALL ON forklift_rentals FROM public;
REVOKE ALL ON users FROM public;

-- Grant to authenticated role only
GRANT SELECT, INSERT, UPDATE, DELETE ON jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON job_service_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON job_invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON job_invoice_extra_charges TO authenticated;
GRANT SELECT ON job_audit_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON job_inventory_usage TO authenticated;
GRANT SELECT ON job_status_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON customers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON forklifts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON parts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON forklift_rentals TO authenticated;
GRANT SELECT, UPDATE ON users TO authenticated;

-- =============================================
-- POLICY COMMENTS
-- =============================================

COMMENT ON POLICY "admin_all_jobs" ON jobs IS 'Admin has full access to all jobs';
COMMENT ON POLICY "technician_select_jobs" ON jobs IS 'Technicians can only see jobs assigned to them';
COMMENT ON POLICY "technician_update_jobs" ON jobs IS 'Technicians can update their assigned jobs in Assigned/In Progress status';
COMMENT ON POLICY "accountant_select_jobs" ON jobs IS 'Accountants can view all jobs';
COMMENT ON POLICY "accountant_update_jobs" ON jobs IS 'Accountants can update jobs in Awaiting Finalization/Completed status';
