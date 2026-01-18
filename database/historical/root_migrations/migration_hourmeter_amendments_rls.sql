-- ============================================
-- RLS Policies for Hourmeter Amendments
-- ============================================
-- Enables proper access control for hourmeter amendment workflow:
-- - Technicians can submit amendment requests (INSERT)
-- - Technicians can view their own requests (SELECT own)
-- - Admin/Supervisor can view all requests (SELECT all)
-- - Admin/Supervisor can approve/reject (UPDATE)

-- Enable RLS on the table
ALTER TABLE hourmeter_amendments ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies first
DROP POLICY IF EXISTS "admin_all_hourmeter_amendments" ON hourmeter_amendments;
DROP POLICY IF EXISTS "supervisor_all_hourmeter_amendments" ON hourmeter_amendments;
DROP POLICY IF EXISTS "technician_insert_hourmeter_amendments" ON hourmeter_amendments;
DROP POLICY IF EXISTS "technician_select_own_hourmeter_amendments" ON hourmeter_amendments;
DROP POLICY IF EXISTS "accountant_select_hourmeter_amendments" ON hourmeter_amendments;

-- ADMIN: Full access to all amendments
CREATE POLICY "admin_all_hourmeter_amendments" ON hourmeter_amendments
    FOR ALL
    TO authenticated
    USING (LOWER(get_current_user_role()) IN ('admin', 'admin_service', 'admin_store'))
    WITH CHECK (LOWER(get_current_user_role()) IN ('admin', 'admin_service', 'admin_store'));

-- SUPERVISOR: Full access to all amendments
CREATE POLICY "supervisor_all_hourmeter_amendments" ON hourmeter_amendments
    FOR ALL
    TO authenticated
    USING (LOWER(get_current_user_role()) = 'supervisor')
    WITH CHECK (LOWER(get_current_user_role()) = 'supervisor');

-- TECHNICIAN: Can insert new amendment requests
CREATE POLICY "technician_insert_hourmeter_amendments" ON hourmeter_amendments
    FOR INSERT
    TO authenticated
    WITH CHECK (
        LOWER(get_current_user_role()) = 'technician'
        AND requested_by_id = auth.uid()
    );

-- TECHNICIAN: Can view their own amendment requests
CREATE POLICY "technician_select_own_hourmeter_amendments" ON hourmeter_amendments
    FOR SELECT
    TO authenticated
    USING (
        LOWER(get_current_user_role()) = 'technician'
        AND requested_by_id = auth.uid()
    );

-- ACCOUNTANT: Can view all amendments (for audit purposes)
CREATE POLICY "accountant_select_hourmeter_amendments" ON hourmeter_amendments
    FOR SELECT
    TO authenticated
    USING (LOWER(get_current_user_role()) = 'accountant');

-- Grant table access to authenticated users
GRANT SELECT, INSERT, UPDATE ON hourmeter_amendments TO authenticated;

-- ============================================
-- Also add RLS for hourmeter_history table
-- ============================================
ALTER TABLE hourmeter_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_hourmeter_history" ON hourmeter_history;
DROP POLICY IF EXISTS "supervisor_all_hourmeter_history" ON hourmeter_history;
DROP POLICY IF EXISTS "technician_select_hourmeter_history" ON hourmeter_history;
DROP POLICY IF EXISTS "accountant_select_hourmeter_history" ON hourmeter_history;

-- Admin/Supervisor: Full access
CREATE POLICY "admin_all_hourmeter_history" ON hourmeter_history
    FOR ALL
    TO authenticated
    USING (LOWER(get_current_user_role()) IN ('admin', 'admin_service', 'admin_store', 'supervisor'))
    WITH CHECK (LOWER(get_current_user_role()) IN ('admin', 'admin_service', 'admin_store', 'supervisor'));

-- Technician: Can view history (read-only)
CREATE POLICY "technician_select_hourmeter_history" ON hourmeter_history
    FOR SELECT
    TO authenticated
    USING (LOWER(get_current_user_role()) = 'technician');

-- Accountant: Can view history (read-only)
CREATE POLICY "accountant_select_hourmeter_history" ON hourmeter_history
    FOR SELECT
    TO authenticated
    USING (LOWER(get_current_user_role()) = 'accountant');

GRANT SELECT, INSERT ON hourmeter_history TO authenticated;

-- Verify policies
-- SELECT * FROM pg_policies WHERE tablename IN ('hourmeter_amendments', 'hourmeter_history');
