-- =====================================================
-- Fix: RLS policy for technician job visibility
-- Issue: assigned_technician_id stores user_id, but RLS 
-- compares against auth.uid() which is auth_id
-- =====================================================

-- First, create a helper function to get user_id from auth_id
CREATE OR REPLACE FUNCTION get_user_id_from_auth()
RETURNS UUID AS $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT user_id INTO v_user_id
    FROM users
    WHERE auth_id = auth.uid();
    
    RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Drop the broken technician policy
DROP POLICY IF EXISTS "technician_select_jobs" ON jobs;
DROP POLICY IF EXISTS "technician_update_jobs" ON jobs;

-- Recreate with correct comparison using user_id
CREATE POLICY "technician_select_jobs" ON jobs
    FOR SELECT
    TO authenticated
    USING (
        has_role('technician')
        AND assigned_technician_id = get_user_id_from_auth()
    );

CREATE POLICY "technician_update_jobs" ON jobs
    FOR UPDATE
    TO authenticated
    USING (
        has_role('technician')
        AND assigned_technician_id = get_user_id_from_auth()
        AND status IN ('Assigned', 'In Progress')
    )
    WITH CHECK (
        has_role('technician')
        AND assigned_technician_id = get_user_id_from_auth()
        AND status IN ('Assigned', 'In Progress', 'Awaiting Finalization')
    );

-- Also fix job_service_records if it has the same issue
DROP POLICY IF EXISTS "technician_select_service_records" ON job_service_records;
DROP POLICY IF EXISTS "technician_update_service_records" ON job_service_records;

CREATE POLICY "technician_select_service_records" ON job_service_records
    FOR SELECT
    TO authenticated
    USING (
        has_role('technician')
        AND (
            technician_id = get_user_id_from_auth()
            OR EXISTS (
                SELECT 1 FROM jobs 
                WHERE jobs.job_id = job_service_records.job_id 
                AND jobs.assigned_technician_id = get_user_id_from_auth()
            )
        )
    );

CREATE POLICY "technician_update_service_records" ON job_service_records
    FOR UPDATE
    TO authenticated
    USING (
        has_role('technician')
        AND locked_at IS NULL
        AND (
            technician_id = get_user_id_from_auth()
            OR EXISTS (
                SELECT 1 FROM jobs 
                WHERE jobs.job_id = job_service_records.job_id 
                AND jobs.assigned_technician_id = get_user_id_from_auth()
            )
        )
    )
    WITH CHECK (
        has_role('technician')
        AND locked_at IS NULL
    );

CREATE POLICY "technician_insert_service_records" ON job_service_records
    FOR INSERT
    TO authenticated
    WITH CHECK (
        has_role('technician')
        AND EXISTS (
            SELECT 1 FROM jobs 
            WHERE jobs.job_id = job_service_records.job_id 
            AND jobs.assigned_technician_id = get_user_id_from_auth()
        )
    );
