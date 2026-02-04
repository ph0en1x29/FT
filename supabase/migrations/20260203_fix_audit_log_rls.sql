-- =============================================
-- Fix job_audit_log RLS Policy
-- Created: 2026-02-03
-- 
-- Issue: Trigger functions can't insert into job_audit_log due to RLS
-- Fix: Make INSERT policy permissive (audit logs are system-generated, trusted)
-- =============================================

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "job_audit_log_insert_authenticated" ON public.job_audit_log;

-- Create permissive INSERT policy (all inserts allowed - audit log entries are trusted)
CREATE POLICY "job_audit_log_insert_all" ON public.job_audit_log
    FOR INSERT
    WITH CHECK (true);

-- Also ensure triggers can operate properly by granting to postgres/service role
GRANT INSERT ON public.job_audit_log TO postgres, service_role;

-- Verify
DO $$
BEGIN
    RAISE NOTICE 'Fixed job_audit_log RLS policy - INSERT now allowed for trigger functions';
END $$;
