-- ============================================
-- Fix Missing RLS Policies
-- ============================================
-- ISSUE: job_parts and job_media tables have RLS enabled
-- but NO policies were created after the RLS redesign,
-- causing all operations to fail with "violates row level security"
--
-- Run this migration to fix the issue.

-- =============================================
-- JOB_PARTS TABLE POLICIES
-- =============================================
-- job_parts is used for tracking parts used in jobs
-- Per WORKFLOW_SPECIFICATION.md:
-- - Technicians REQUEST parts (via spare_part_requests table)
-- - Admin/Supervisor SELECT and ADD parts to jobs
-- - Admin can amend Items Used before finalizing

-- First, ensure RLS is enabled
ALTER TABLE job_parts ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies (cleanup)
DROP POLICY IF EXISTS "admin_all_job_parts" ON job_parts;
DROP POLICY IF EXISTS "supervisor_all_job_parts" ON job_parts;
DROP POLICY IF EXISTS "accountant_select_job_parts" ON job_parts;
DROP POLICY IF EXISTS "technician_job_parts" ON job_parts;
DROP POLICY IF EXISTS "technician_select_job_parts" ON job_parts;
DROP POLICY IF EXISTS "technician_insert_job_parts" ON job_parts;
DROP POLICY IF EXISTS "technician_delete_job_parts" ON job_parts;

-- ADMIN: Full access
CREATE POLICY "admin_all_job_parts" ON job_parts
    FOR ALL
    TO authenticated
    USING (has_role('admin'))
    WITH CHECK (has_role('admin'));

-- SUPERVISOR: Full access
CREATE POLICY "supervisor_all_job_parts" ON job_parts
    FOR ALL
    TO authenticated
    USING (has_role('supervisor'))
    WITH CHECK (has_role('supervisor'));

-- ACCOUNTANT: Select only (for invoicing)
CREATE POLICY "accountant_select_job_parts" ON job_parts
    FOR SELECT
    TO authenticated
    USING (has_role('accountant'));

-- TECHNICIAN: Select only (can view parts on their jobs, but NOT add directly)
-- Technicians must use the spare_part_requests system instead
CREATE POLICY "technician_select_job_parts" ON job_parts
    FOR SELECT
    TO authenticated
    USING (
        has_role('technician')
        AND EXISTS (
            SELECT 1 FROM jobs 
            WHERE jobs.job_id = job_parts.job_id
            AND jobs.assigned_technician_id = auth.uid()
        )
    );

-- =============================================
-- JOB_MEDIA TABLE POLICIES
-- =============================================
-- job_media is used for photos/documents attached to jobs

-- First, ensure RLS is enabled
ALTER TABLE job_media ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies (cleanup)
DROP POLICY IF EXISTS "admin_all_job_media" ON job_media;
DROP POLICY IF EXISTS "supervisor_all_job_media" ON job_media;
DROP POLICY IF EXISTS "accountant_select_job_media" ON job_media;
DROP POLICY IF EXISTS "technician_job_media" ON job_media;
DROP POLICY IF EXISTS "technician_select_job_media" ON job_media;
DROP POLICY IF EXISTS "technician_insert_job_media" ON job_media;
DROP POLICY IF EXISTS "technician_delete_job_media" ON job_media;

-- ADMIN: Full access
CREATE POLICY "admin_all_job_media" ON job_media
    FOR ALL
    TO authenticated
    USING (has_role('admin'))
    WITH CHECK (has_role('admin'));

-- SUPERVISOR: Full access (can view and manage all job media)
CREATE POLICY "supervisor_all_job_media" ON job_media
    FOR ALL
    TO authenticated
    USING (has_role('supervisor'))
    WITH CHECK (has_role('supervisor'));

-- ACCOUNTANT: Select only
CREATE POLICY "accountant_select_job_media" ON job_media
    FOR SELECT
    TO authenticated
    USING (has_role('accountant'));

-- TECHNICIAN: Full access to media on their assigned jobs
CREATE POLICY "technician_select_job_media" ON job_media
    FOR SELECT
    TO authenticated
    USING (
        has_role('technician')
        AND EXISTS (
            SELECT 1 FROM jobs 
            WHERE jobs.job_id = job_media.job_id
            AND (
                jobs.assigned_technician_id = auth.uid()
                OR jobs.helper_technician_id = auth.uid()
            )
        )
    );

CREATE POLICY "technician_insert_job_media" ON job_media
    FOR INSERT
    TO authenticated
    WITH CHECK (
        has_role('technician')
        AND EXISTS (
            SELECT 1 FROM jobs 
            WHERE jobs.job_id = job_media.job_id
            AND (
                jobs.assigned_technician_id = auth.uid()
                OR jobs.helper_technician_id = auth.uid()
            )
            AND jobs.status IN ('In Progress', 'Awaiting Finalization')
        )
    );

CREATE POLICY "technician_delete_job_media" ON job_media
    FOR DELETE
    TO authenticated
    USING (
        has_role('technician')
        AND EXISTS (
            SELECT 1 FROM jobs 
            WHERE jobs.job_id = job_media.job_id
            AND jobs.assigned_technician_id = auth.uid()
            AND jobs.status = 'In Progress'
        )
        -- Can only delete their own uploads
        AND uploaded_by_id = auth.uid()
    );

-- =============================================
-- EXTRA_CHARGES TABLE POLICIES (if exists)
-- =============================================
-- extra_charges is a legacy table that may still be in use

DO $extra_charges_policies$
BEGIN
    -- Check if table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'extra_charges') THEN
        -- Enable RLS
        EXECUTE 'ALTER TABLE extra_charges ENABLE ROW LEVEL SECURITY';
        
        -- Drop existing policies (including technician select/insert)
        EXECUTE 'DROP POLICY IF EXISTS "admin_all_extra_charges_legacy" ON extra_charges';
        EXECUTE 'DROP POLICY IF EXISTS "supervisor_all_extra_charges_legacy" ON extra_charges';
        EXECUTE 'DROP POLICY IF EXISTS "accountant_all_extra_charges_legacy" ON extra_charges';
        EXECUTE 'DROP POLICY IF EXISTS "technician_extra_charges_legacy" ON extra_charges';
        EXECUTE 'DROP POLICY IF EXISTS "technician_select_extra_charges_legacy" ON extra_charges';
        EXECUTE 'DROP POLICY IF EXISTS "technician_insert_extra_charges_legacy" ON extra_charges';
        
        -- Create policies
        EXECUTE 'CREATE POLICY "admin_all_extra_charges_legacy" ON extra_charges
            FOR ALL TO authenticated
            USING (has_role(''admin''))
            WITH CHECK (has_role(''admin''))';
            
        EXECUTE 'CREATE POLICY "supervisor_all_extra_charges_legacy" ON extra_charges
            FOR ALL TO authenticated
            USING (has_role(''supervisor''))
            WITH CHECK (has_role(''supervisor''))';
            
        EXECUTE 'CREATE POLICY "accountant_all_extra_charges_legacy" ON extra_charges
            FOR ALL TO authenticated
            USING (has_role(''accountant''))
            WITH CHECK (has_role(''accountant''))';
            
        EXECUTE 'CREATE POLICY "technician_select_extra_charges_legacy" ON extra_charges
            FOR SELECT TO authenticated
            USING (has_role(''technician'') AND EXISTS (
                SELECT 1 FROM jobs WHERE jobs.job_id = extra_charges.job_id
                AND jobs.assigned_technician_id = auth.uid()
            ))';
            
        EXECUTE 'CREATE POLICY "technician_insert_extra_charges_legacy" ON extra_charges
            FOR INSERT TO authenticated
            WITH CHECK (has_role(''technician'') AND EXISTS (
                SELECT 1 FROM jobs WHERE jobs.job_id = extra_charges.job_id
                AND jobs.assigned_technician_id = auth.uid()
                AND jobs.status IN (''In Progress'', ''Awaiting Finalization'')
            ))';
    END IF;
END $extra_charges_policies$;

-- =============================================
-- GRANT PERMISSIONS
-- =============================================

GRANT SELECT, INSERT, UPDATE, DELETE ON job_parts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON job_media TO authenticated;

-- Grant on extra_charges if exists
DO $grant_extra$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'extra_charges') THEN
        EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON extra_charges TO authenticated';
    END IF;
END $grant_extra$;

-- =============================================
-- VERIFICATION
-- =============================================

-- Check that policies were created
SELECT 
    schemaname,
    tablename,
    policyname
FROM pg_policies 
WHERE tablename IN ('job_parts', 'job_media', 'extra_charges')
ORDER BY tablename, policyname;

COMMENT ON POLICY "admin_all_job_parts" ON job_parts IS 'Admin has full access to all job parts';
COMMENT ON POLICY "technician_select_job_parts" ON job_parts IS 'Technicians can view parts on their assigned jobs (must REQUEST parts via spare_part_requests)';
COMMENT ON POLICY "admin_all_job_media" ON job_media IS 'Admin has full access to all job media';
COMMENT ON POLICY "technician_insert_job_media" ON job_media IS 'Technicians can add media to their assigned jobs';
