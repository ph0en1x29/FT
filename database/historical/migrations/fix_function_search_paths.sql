-- ============================================
-- Fix: Add search_path to all functions
-- ============================================
-- Fixes 44 functions missing SET search_path = public
-- This prevents search_path injection attacks
--
-- Run this in Supabase SQL Editor
-- ============================================

BEGIN;

-- =============================================
-- 1. TIMESTAMP/UTILITY FUNCTIONS
-- =============================================

ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.update_parts_timestamp() SET search_path = public;
ALTER FUNCTION public.update_employee_timestamp() SET search_path = public;

-- =============================================
-- 2. ROLE/AUTH HELPER FUNCTIONS
-- =============================================

ALTER FUNCTION public.get_user_role() SET search_path = public;
ALTER FUNCTION public.get_my_user_id() SET search_path = public;
ALTER FUNCTION public.is_hr_authorized() SET search_path = public;
ALTER FUNCTION public.has_any_role(text[]) SET search_path = public;
ALTER FUNCTION public.is_admin_or_supervisor() SET search_path = public;
ALTER FUNCTION public.is_assigned_to_job(uuid) SET search_path = public;

-- =============================================
-- 3. STATUS/WORKFLOW FUNCTIONS
-- =============================================

ALTER FUNCTION public.get_status_order(text) SET search_path = public;
ALTER FUNCTION public.is_forward_transition(text, text) SET search_path = public;
ALTER FUNCTION public.is_backward_transition(text, text) SET search_path = public;
ALTER FUNCTION public.validate_job_status_transition() SET search_path = public;
ALTER FUNCTION public.validate_job_completion_requirements() SET search_path = public;
ALTER FUNCTION public.track_status_history() SET search_path = public;

-- =============================================
-- 4. JOB FUNCTIONS
-- =============================================

ALTER FUNCTION public.start_job(uuid) SET search_path = public;
ALTER FUNCTION public.complete_job(uuid) SET search_path = public;
ALTER FUNCTION public.cancel_job(uuid, text) SET search_path = public;
ALTER FUNCTION public.log_job_changes() SET search_path = public;

-- =============================================
-- 5. SERVICE/MAINTENANCE FUNCTIONS
-- =============================================

ALTER FUNCTION public.get_service_interval(text) SET search_path = public;
ALTER FUNCTION public.set_forklift_service_interval(uuid, integer, integer) SET search_path = public;
ALTER FUNCTION public.calculate_next_service_due(uuid) SET search_path = public;
ALTER FUNCTION public.get_forklifts_due_for_service() SET search_path = public;
ALTER FUNCTION public.update_forklift_service_schedule() SET search_path = public;
ALTER FUNCTION public.update_overdue_services() SET search_path = public;
ALTER FUNCTION public.daily_service_check() SET search_path = public;
ALTER FUNCTION public.auto_create_service_jobs() SET search_path = public;
ALTER FUNCTION public.create_service_due_notifications() SET search_path = public;
ALTER FUNCTION public.generate_service_report_number() SET search_path = public;

-- =============================================
-- 6. SERVICE RECORD FUNCTIONS
-- =============================================

ALTER FUNCTION public.auto_create_service_record() SET search_path = public;
ALTER FUNCTION public.log_service_record_changes() SET search_path = public;
ALTER FUNCTION public.lock_service_record_on_invoice() SET search_path = public;
ALTER FUNCTION public.prevent_locked_service_record_edit() SET search_path = public;

-- =============================================
-- 7. INVOICE/PAYMENT FUNCTIONS
-- =============================================

ALTER FUNCTION public.finalize_invoice(uuid) SET search_path = public;
ALTER FUNCTION public.record_payment(uuid, numeric, text) SET search_path = public;
ALTER FUNCTION public.log_invoice_changes() SET search_path = public;
ALTER FUNCTION public.admin_override_lock(uuid, text) SET search_path = public;

-- =============================================
-- 8. INVENTORY FUNCTIONS
-- =============================================

ALTER FUNCTION public.deduct_inventory_on_completion() SET search_path = public;

-- =============================================
-- 9. FORKLIFT/HOURMETER FUNCTIONS
-- =============================================

ALTER FUNCTION public.log_hourmeter_change() SET search_path = public;

-- =============================================
-- 10. HR FUNCTIONS
-- =============================================

ALTER FUNCTION public.update_license_status() SET search_path = public;
ALTER FUNCTION public.update_permit_status() SET search_path = public;
ALTER FUNCTION public.calculate_leave_days(date, date, boolean) SET search_path = public;
ALTER FUNCTION public.create_employee_on_user_insert() SET search_path = public;

-- =============================================
-- 11. AUDIT/SECURITY FUNCTIONS
-- =============================================

ALTER FUNCTION public.prevent_audit_direct_modification() SET search_path = public;
ALTER FUNCTION public.enforce_soft_delete() SET search_path = public;

COMMIT;

-- ============================================
-- VERIFICATION: Check all functions have search_path set
-- ============================================
-- Run this after migration to verify:
--
-- SELECT p.proname AS function_name,
--        CASE WHEN p.proconfig IS NULL THEN 'MISSING' 
--             WHEN 'search_path=public' = ANY(p.proconfig) THEN 'OK'
--             ELSE 'CHECK' END AS search_path_status
-- FROM pg_proc p
-- JOIN pg_namespace n ON p.pronamespace = n.oid
-- WHERE n.nspname = 'public'
-- AND p.prokind = 'f'
-- ORDER BY function_name;
