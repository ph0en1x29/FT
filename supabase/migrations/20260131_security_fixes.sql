-- =============================================
-- Security Fixes - Supabase Linter Issues
-- Created: 2026-01-31
-- Author: Phoenix (Clawdbot)
-- 
-- Fixes:
-- 1. Remove SECURITY DEFINER from views (13 views)
-- 2. Enable RLS on tables missing it (18 tables)
-- 3. Fix function search_path (10 functions)
-- =============================================

-- =============================================
-- PART 1: Fix SECURITY DEFINER Views
-- These views bypass RLS which is a security risk
-- Recreating without SECURITY DEFINER
-- =============================================

-- 1. most_active_forklifts
DROP VIEW IF EXISTS public.most_active_forklifts CASCADE;
CREATE VIEW public.most_active_forklifts AS
SELECT 
  f.forklift_id,
  f.fleet_number,
  f.model,
  f.serial_number,
  COUNT(j.job_id) as job_count,
  MAX(j.completed_at) as last_service
FROM forklifts f
LEFT JOIN jobs j ON f.forklift_id = j.forklift_id 
  AND j.status IN ('Completed', 'Completed Awaiting Ack')
  AND j.completed_at >= NOW() - INTERVAL '30 days'
GROUP BY f.forklift_id, f.fleet_number, f.model, f.serial_number
ORDER BY job_count DESC;

-- 2. pending_hourmeter_amendments
DROP VIEW IF EXISTS public.pending_hourmeter_amendments CASCADE;
CREATE VIEW public.pending_hourmeter_amendments AS
SELECT *
FROM hourmeter_history
WHERE amendment_status = 'pending'
ORDER BY created_at DESC;

-- 3. flagged_hourmeter_readings
DROP VIEW IF EXISTS public.flagged_hourmeter_readings CASCADE;
CREATE VIEW public.flagged_hourmeter_readings AS
SELECT *
FROM hourmeter_history
WHERE is_flagged = true
ORDER BY created_at DESC;

-- 4. jobs_monthly_summary
DROP VIEW IF EXISTS public.jobs_monthly_summary CASCADE;
CREATE VIEW public.jobs_monthly_summary AS
SELECT 
  DATE_TRUNC('month', created_at) as month,
  COUNT(*) as total_jobs,
  COUNT(*) FILTER (WHERE status IN ('Completed', 'Completed Awaiting Ack')) as completed,
  COUNT(*) FILTER (WHERE status = 'Cancelled') as cancelled,
  COUNT(*) FILTER (WHERE job_type = 'Slot-In') as slot_in_count,
  COUNT(*) FILTER (WHERE job_type = 'Scheduled') as scheduled_count
FROM jobs
WHERE created_at >= NOW() - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;

-- 5. slot_in_sla_metrics
DROP VIEW IF EXISTS public.slot_in_sla_metrics CASCADE;
CREATE VIEW public.slot_in_sla_metrics AS
SELECT 
  j.job_id,
  j.job_number,
  j.created_at,
  j.started_at,
  j.completed_at,
  j.slot_in_sla_status,
  j.slot_in_response_time_minutes,
  CASE 
    WHEN j.slot_in_sla_status = 'met' THEN true
    WHEN j.slot_in_sla_status = 'breached' THEN false
    ELSE NULL
  END as sla_met
FROM jobs j
WHERE j.job_type = 'Slot-In'
ORDER BY j.created_at DESC;

-- 6. flagged_photos
DROP VIEW IF EXISTS public.flagged_photos CASCADE;
CREATE VIEW public.flagged_photos AS
SELECT 
  jm.*,
  j.job_number,
  j.title as job_title
FROM job_media jm
JOIN jobs j ON jm.job_id = j.job_id
WHERE jm.is_flagged = true
ORDER BY jm.created_at DESC;

-- 7. pending_van_stock_approvals
DROP VIEW IF EXISTS public.pending_van_stock_approvals CASCADE;
CREATE VIEW public.pending_van_stock_approvals AS
SELECT 
  vsr.*,
  u.full_name as technician_name,
  vs.name as van_stock_name
FROM van_stock_replenishments vsr
JOIN van_stocks vs ON vsr.van_stock_id = vs.id
JOIN users u ON vs.technician_id = u.id
WHERE vsr.status = 'pending'
ORDER BY vsr.created_at DESC;

-- 8. fleet_dashboard_summary
DROP VIEW IF EXISTS public.fleet_dashboard_summary CASCADE;
CREATE VIEW public.fleet_dashboard_summary AS
SELECT 
  COUNT(*) as total_forklifts,
  COUNT(*) FILTER (WHERE status = 'Available') as available,
  COUNT(*) FILTER (WHERE status = 'Rented Out') as rented_out,
  COUNT(*) FILTER (WHERE status = 'In Service') as in_service,
  COUNT(*) FILTER (WHERE status = 'Out of Service') as out_of_service,
  COUNT(*) FILTER (WHERE next_service_date <= CURRENT_DATE) as service_due
FROM forklifts
WHERE deleted_at IS NULL;

-- 9. autocount_export_history
DROP VIEW IF EXISTS public.autocount_export_history CASCADE;
CREATE VIEW public.autocount_export_history AS
SELECT 
  ae.*,
  u.full_name as exported_by_name
FROM autocount_exports ae
LEFT JOIN users u ON ae.exported_by = u.id
ORDER BY ae.created_at DESC;

-- 10. pending_camera_fallbacks
DROP VIEW IF EXISTS public.pending_camera_fallbacks CASCADE;
CREATE VIEW public.pending_camera_fallbacks AS
SELECT 
  jm.*,
  j.job_number,
  j.title as job_title
FROM job_media jm
JOIN jobs j ON jm.job_id = j.job_id
WHERE jm.camera_fallback_used = true
  AND jm.fallback_approved_at IS NULL
ORDER BY jm.created_at DESC;

-- 11. pending_autocount_exports
DROP VIEW IF EXISTS public.pending_autocount_exports CASCADE;
CREATE VIEW public.pending_autocount_exports AS
SELECT 
  j.*,
  c.name as customer_name
FROM jobs j
LEFT JOIN customers c ON j.customer_id = c.customer_id
WHERE j.status = 'Completed'
  AND j.autocount_exported_at IS NULL
  AND j.invoice_finalized_at IS NOT NULL
ORDER BY j.invoice_finalized_at DESC;

-- 12. pending_parts_confirmations
DROP VIEW IF EXISTS public.pending_parts_confirmations CASCADE;
CREATE VIEW public.pending_parts_confirmations AS
SELECT 
  j.*,
  c.name as customer_name,
  u.full_name as technician_name
FROM jobs j
LEFT JOIN customers c ON j.customer_id = c.customer_id
LEFT JOIN users u ON j.technician_id = u.id
WHERE j.status = 'Awaiting Finalization'
  AND j.parts_confirmed_at IS NULL
  AND EXISTS (SELECT 1 FROM job_parts jp WHERE jp.job_id = j.job_id)
ORDER BY j.completed_at DESC;

-- 13. van_stock_summary
DROP VIEW IF EXISTS public.van_stock_summary CASCADE;
CREATE VIEW public.van_stock_summary AS
SELECT 
  vs.id as van_stock_id,
  vs.name,
  u.full_name as technician_name,
  vs.max_items,
  COUNT(vsi.id) as current_items,
  SUM(vsi.quantity) as total_quantity,
  COUNT(*) FILTER (WHERE vsi.quantity <= vsi.min_quantity) as low_stock_items
FROM van_stocks vs
JOIN users u ON vs.technician_id = u.id
LEFT JOIN van_stock_items vsi ON vs.id = vsi.van_stock_id
WHERE vs.is_active = true
GROUP BY vs.id, vs.name, u.full_name, vs.max_items;

-- =============================================
-- PART 2: Enable RLS on Tables
-- =============================================

-- Van Stock tables
ALTER TABLE public.van_stock_replenishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.van_stock_replenishment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.van_stock_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.van_stock_audit_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.van_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.van_stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.van_stock_usage ENABLE ROW LEVEL SECURITY;

-- Job related tables
ALTER TABLE public.job_type_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_type_change_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_duration_alerts ENABLE ROW LEVEL SECURITY;

-- Config tables
ALTER TABLE public.duration_alert_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hourmeter_validation_configs ENABLE ROW LEVEL SECURITY;

-- AutoCount tables
ALTER TABLE public.autocount_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autocount_customer_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autocount_item_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autocount_settings ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PART 3: Create RLS Policies for New Tables
-- =============================================

-- Helper function to check if user is admin/supervisor
CREATE OR REPLACE FUNCTION public.is_admin_or_supervisor()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role IN ('Admin', 'admin', 'Supervisor', 'supervisor', 'admin_service', 'admin_store')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Helper function to check if user is technician owner
CREATE OR REPLACE FUNCTION public.is_technician_owner(tech_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN auth.uid() = tech_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Van Stock Replenishments
CREATE POLICY "Admin/Supervisor full access to replenishments"
  ON public.van_stock_replenishments FOR ALL
  USING (is_admin_or_supervisor());

CREATE POLICY "Technician view own replenishments"
  ON public.van_stock_replenishments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM van_stocks vs
      WHERE vs.id = van_stock_id
      AND vs.technician_id = auth.uid()
    )
  );

-- Van Stock Replenishment Items
CREATE POLICY "Admin/Supervisor full access to replenishment items"
  ON public.van_stock_replenishment_items FOR ALL
  USING (is_admin_or_supervisor());

CREATE POLICY "Technician view own replenishment items"
  ON public.van_stock_replenishment_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM van_stock_replenishments vsr
      JOIN van_stocks vs ON vsr.van_stock_id = vs.id
      WHERE vsr.id = replenishment_id
      AND vs.technician_id = auth.uid()
    )
  );

-- Van Stock Audits
CREATE POLICY "Admin/Supervisor full access to audits"
  ON public.van_stock_audits FOR ALL
  USING (is_admin_or_supervisor());

CREATE POLICY "Technician view own audits"
  ON public.van_stock_audits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM van_stocks vs
      WHERE vs.id = van_stock_id
      AND vs.technician_id = auth.uid()
    )
  );

-- Van Stock Audit Items
CREATE POLICY "Admin/Supervisor full access to audit items"
  ON public.van_stock_audit_items FOR ALL
  USING (is_admin_or_supervisor());

-- Van Stocks
CREATE POLICY "Admin/Supervisor full access to van stocks"
  ON public.van_stocks FOR ALL
  USING (is_admin_or_supervisor());

CREATE POLICY "Technician view/manage own van stock"
  ON public.van_stocks FOR ALL
  USING (technician_id = auth.uid());

-- Van Stock Items
CREATE POLICY "Admin/Supervisor full access to van stock items"
  ON public.van_stock_items FOR ALL
  USING (is_admin_or_supervisor());

CREATE POLICY "Technician manage own van stock items"
  ON public.van_stock_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM van_stocks vs
      WHERE vs.id = van_stock_id
      AND vs.technician_id = auth.uid()
    )
  );

-- Van Stock Usage
CREATE POLICY "Admin/Supervisor full access to usage"
  ON public.van_stock_usage FOR ALL
  USING (is_admin_or_supervisor());

CREATE POLICY "Technician view own usage"
  ON public.van_stock_usage FOR SELECT
  USING (used_by = auth.uid());

CREATE POLICY "Technician insert own usage"
  ON public.van_stock_usage FOR INSERT
  WITH CHECK (used_by = auth.uid());

-- Job Type Change Requests
CREATE POLICY "Admin/Supervisor full access to type change requests"
  ON public.job_type_change_requests FOR ALL
  USING (is_admin_or_supervisor());

CREATE POLICY "Technician view own type change requests"
  ON public.job_type_change_requests FOR SELECT
  USING (requested_by = auth.uid());

CREATE POLICY "Technician create type change requests"
  ON public.job_type_change_requests FOR INSERT
  WITH CHECK (requested_by = auth.uid());

-- Job Type Change Log (read-only for non-admins)
CREATE POLICY "Admin/Supervisor full access to type change log"
  ON public.job_type_change_log FOR ALL
  USING (is_admin_or_supervisor());

CREATE POLICY "Authenticated read type change log"
  ON public.job_type_change_log FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Duration Alert Configs (admin only)
CREATE POLICY "Admin only access to alert configs"
  ON public.duration_alert_configs FOR ALL
  USING (is_admin_or_supervisor());

-- Job Duration Alerts
CREATE POLICY "Admin/Supervisor full access to duration alerts"
  ON public.job_duration_alerts FOR ALL
  USING (is_admin_or_supervisor());

CREATE POLICY "Technician view own job alerts"
  ON public.job_duration_alerts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.job_id = job_id
      AND j.technician_id = auth.uid()
    )
  );

-- Hourmeter Validation Configs (admin only)
CREATE POLICY "Admin only access to hourmeter configs"
  ON public.hourmeter_validation_configs FOR ALL
  USING (is_admin_or_supervisor());

-- AutoCount Exports (admin/accountant)
CREATE POLICY "Admin/Accountant access to exports"
  ON public.autocount_exports FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('Admin', 'admin', 'Accountant', 'accountant', 'admin_service', 'admin_store')
    )
  );

-- AutoCount Customer Mappings (admin/accountant)
CREATE POLICY "Admin/Accountant access to customer mappings"
  ON public.autocount_customer_mappings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('Admin', 'admin', 'Accountant', 'accountant', 'admin_service', 'admin_store')
    )
  );

-- AutoCount Item Mappings (admin/accountant)
CREATE POLICY "Admin/Accountant access to item mappings"
  ON public.autocount_item_mappings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('Admin', 'admin', 'Accountant', 'accountant', 'admin_service', 'admin_store')
    )
  );

-- AutoCount Settings (admin/accountant)
CREATE POLICY "Admin/Accountant access to settings"
  ON public.autocount_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('Admin', 'admin', 'Accountant', 'accountant', 'admin_service', 'admin_store')
    )
  );

-- =============================================
-- PART 4: Fix Function Search Paths
-- =============================================

-- 1. update_job_assignments_updated_at
CREATE OR REPLACE FUNCTION public.update_job_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 2. update_user_timestamp
CREATE OR REPLACE FUNCTION public.update_user_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 3. calculate_slot_in_sla
CREATE OR REPLACE FUNCTION public.calculate_slot_in_sla()
RETURNS TRIGGER AS $$
DECLARE
  sla_threshold_minutes INT := 60; -- Default 1 hour SLA
BEGIN
  -- Only process Slot-In jobs when started
  IF NEW.job_type = 'Slot-In' AND NEW.started_at IS NOT NULL AND OLD.started_at IS NULL THEN
    NEW.slot_in_response_time_minutes := EXTRACT(EPOCH FROM (NEW.started_at - NEW.created_at)) / 60;
    
    IF NEW.slot_in_response_time_minutes <= sla_threshold_minutes THEN
      NEW.slot_in_sla_status := 'met';
    ELSE
      NEW.slot_in_sla_status := 'breached';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 4. update_job_requests_updated_at
CREATE OR REPLACE FUNCTION public.update_job_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 5. check_parts_confirmation_needed
CREATE OR REPLACE FUNCTION public.check_parts_confirmation_needed()
RETURNS TRIGGER AS $$
BEGIN
  -- If job is being completed and has parts, require confirmation
  IF NEW.status = 'Awaiting Finalization' 
     AND OLD.status != 'Awaiting Finalization'
     AND EXISTS (SELECT 1 FROM job_parts WHERE job_id = NEW.job_id) THEN
    NEW.parts_confirmation_needed := true;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 6. prepare_autocount_export
CREATE OR REPLACE FUNCTION public.prepare_autocount_export(job_ids UUID[])
RETURNS UUID AS $$
DECLARE
  export_id UUID;
BEGIN
  INSERT INTO autocount_exports (job_ids, status)
  VALUES (job_ids, 'pending')
  RETURNING id INTO export_id;
  
  RETURN export_id;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 7. escalate_pending_confirmations
CREATE OR REPLACE FUNCTION public.escalate_pending_confirmations()
RETURNS void AS $$
BEGIN
  -- Mark jobs as escalated if pending confirmation for too long
  UPDATE jobs
  SET is_escalated = true,
      escalation_reason = 'Pending confirmation for over 24 hours'
  WHERE status = 'Awaiting Finalization'
    AND completed_at < NOW() - INTERVAL '24 hours'
    AND is_escalated = false;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 8. get_my_user_id
CREATE OR REPLACE FUNCTION public.get_my_user_id()
RETURNS UUID AS $$
BEGIN
  RETURN auth.uid();
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;

-- 9. get_user_id_from_auth
CREATE OR REPLACE FUNCTION public.get_user_id_from_auth()
RETURNS UUID AS $$
BEGIN
  RETURN auth.uid();
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;

-- 10. validate_hourmeter_reading
CREATE OR REPLACE FUNCTION public.validate_hourmeter_reading()
RETURNS TRIGGER AS $$
DECLARE
  last_reading NUMERIC;
  max_jump NUMERIC := 500; -- Max reasonable hourmeter jump
BEGIN
  -- Get last reading for this forklift
  SELECT hourmeter INTO last_reading
  FROM jobs
  WHERE forklift_id = NEW.forklift_id
    AND job_id != NEW.job_id
    AND hourmeter IS NOT NULL
  ORDER BY completed_at DESC NULLS LAST, created_at DESC
  LIMIT 1;
  
  IF last_reading IS NOT NULL AND NEW.hourmeter IS NOT NULL THEN
    -- Flag if reading is lower than previous
    IF NEW.hourmeter < last_reading THEN
      NEW.hourmeter_flagged := true;
      NEW.hourmeter_flag_reason := 'Reading lower than previous';
    -- Flag if jump is too large
    ELSIF NEW.hourmeter - last_reading > max_jump THEN
      NEW.hourmeter_flagged := true;
      NEW.hourmeter_flag_reason := 'Excessive jump from previous reading';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =============================================
-- Done!
-- =============================================
COMMENT ON FUNCTION public.is_admin_or_supervisor() IS 'Helper: Returns true if current user is admin or supervisor';
COMMENT ON FUNCTION public.is_technician_owner(UUID) IS 'Helper: Returns true if current user matches the given technician ID';
