-- =============================================
-- Fix Jobs Table RLS Policies
-- Created: 2026-02-01
-- 
-- Issue: "new row violates row-level security policy for table 'jobs'"
-- Cause: RLS enabled but no INSERT policy for admins
-- =============================================

-- First check if RLS is enabled on jobs (if not, we need to enable it for policies to work)
DO $$
BEGIN
  -- Enable RLS if not already enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_class 
    WHERE relname = 'jobs' AND relrowsecurity = true
  ) THEN
    ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Drop existing policies if any to avoid conflicts
DROP POLICY IF EXISTS "jobs_select_all" ON public.jobs;
DROP POLICY IF EXISTS "jobs_insert_admin" ON public.jobs;
DROP POLICY IF EXISTS "jobs_update_all" ON public.jobs;
DROP POLICY IF EXISTS "jobs_delete_admin" ON public.jobs;

-- Create SELECT policy - everyone can view jobs
CREATE POLICY "jobs_select_all" ON public.jobs
  FOR SELECT
  USING (true);

-- Create INSERT policy - admins, supervisors can create jobs
CREATE POLICY "jobs_insert_admin" ON public.jobs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
      AND u.role IN ('admin', 'Admin 1', 'Admin 2', 'supervisor', 'Supervisor')
    )
  );

-- Create UPDATE policy - everyone can update (role-based restrictions handled in app)
CREATE POLICY "jobs_update_all" ON public.jobs
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Create DELETE policy - only admins
CREATE POLICY "jobs_delete_admin" ON public.jobs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.auth_id = auth.uid()
      AND u.role IN ('admin', 'Admin 1', 'Admin 2')
    )
  );

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT SELECT ON public.jobs TO anon;
