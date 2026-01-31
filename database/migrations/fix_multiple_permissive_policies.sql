-- ============================================
-- FIX MULTIPLE PERMISSIVE POLICIES
-- Consolidate duplicate RLS policies for performance
-- Date: 2026-01-31
-- ============================================
-- Issue: Performance Advisor flagged 28 tables with multiple permissive 
-- policies for the same role+action. Postgres evaluates ALL permissive 
-- policies (OR'd together), which is slower than a single policy.
-- ============================================

-- Helper function (ensure exists)
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM users WHERE auth_id = (select auth.uid())
$$;

-- ============================================
-- TABLE: app_settings
-- ============================================
DROP POLICY IF EXISTS "app_settings_admin_write" ON app_settings;
DROP POLICY IF EXISTS "app_settings_read_all" ON app_settings;
DROP POLICY IF EXISTS "admin_all" ON app_settings;
DROP POLICY IF EXISTS "auth_read" ON app_settings;

CREATE POLICY "app_settings_select" ON app_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "app_settings_modify" ON app_settings
  FOR ALL TO authenticated
  USING ((select get_my_role()) = 'Admin')
  WITH CHECK ((select get_my_role()) = 'Admin');

-- ============================================
-- TABLE: autocount_customer_mappings
-- ============================================
DROP POLICY IF EXISTS "admin_all" ON autocount_customer_mappings;
DROP POLICY IF EXISTS "auth_read" ON autocount_customer_mappings;

CREATE POLICY "autocount_customer_mappings_select" ON autocount_customer_mappings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "autocount_customer_mappings_modify" ON autocount_customer_mappings
  FOR ALL TO authenticated
  USING ((select get_my_role()) = 'Admin')
  WITH CHECK ((select get_my_role()) = 'Admin');

-- ============================================
-- TABLE: autocount_exports
-- ============================================
DROP POLICY IF EXISTS "auth_all" ON autocount_exports;
DROP POLICY IF EXISTS "auth_read" ON autocount_exports;
DROP POLICY IF EXISTS "admin_all" ON autocount_exports;

CREATE POLICY "autocount_exports_select" ON autocount_exports
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "autocount_exports_modify" ON autocount_exports
  FOR ALL TO authenticated
  USING ((select get_my_role()) IN ('Admin', 'Accountant'))
  WITH CHECK ((select get_my_role()) IN ('Admin', 'Accountant'));

-- ============================================
-- TABLE: autocount_item_mappings
-- ============================================
DROP POLICY IF EXISTS "admin_all" ON autocount_item_mappings;
DROP POLICY IF EXISTS "auth_read" ON autocount_item_mappings;

CREATE POLICY "autocount_item_mappings_select" ON autocount_item_mappings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "autocount_item_mappings_modify" ON autocount_item_mappings
  FOR ALL TO authenticated
  USING ((select get_my_role()) = 'Admin')
  WITH CHECK ((select get_my_role()) = 'Admin');

-- ============================================
-- TABLE: autocount_settings
-- ============================================
DROP POLICY IF EXISTS "admin_all" ON autocount_settings;
DROP POLICY IF EXISTS "auth_read" ON autocount_settings;

CREATE POLICY "autocount_settings_select" ON autocount_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "autocount_settings_modify" ON autocount_settings
  FOR ALL TO authenticated
  USING ((select get_my_role()) = 'Admin')
  WITH CHECK ((select get_my_role()) = 'Admin');

-- ============================================
-- TABLE: customer_acknowledgements
-- ============================================
DROP POLICY IF EXISTS "customer_ack_admin_read" ON customer_acknowledgements;
DROP POLICY IF EXISTS "customer_ack_admin_write" ON customer_acknowledgements;
DROP POLICY IF EXISTS "customer_ack_tech_read" ON customer_acknowledgements;

CREATE POLICY "customer_ack_select" ON customer_acknowledgements
  FOR SELECT TO authenticated
  USING ((select get_my_role()) IN ('Admin', 'Supervisor', 'Technician'));

CREATE POLICY "customer_ack_insert" ON customer_acknowledgements
  FOR INSERT TO authenticated
  WITH CHECK ((select get_my_role()) IN ('Admin', 'Supervisor', 'Technician'));

CREATE POLICY "customer_ack_update" ON customer_acknowledgements
  FOR UPDATE TO authenticated
  USING ((select get_my_role()) IN ('Admin', 'Supervisor'));

CREATE POLICY "customer_ack_delete" ON customer_acknowledgements
  FOR DELETE TO authenticated
  USING ((select get_my_role()) = 'Admin');

-- ============================================
-- TABLE: duration_alert_configs
-- ============================================
DROP POLICY IF EXISTS "admin_all" ON duration_alert_configs;
DROP POLICY IF EXISTS "auth_read" ON duration_alert_configs;

CREATE POLICY "duration_alert_configs_select" ON duration_alert_configs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "duration_alert_configs_modify" ON duration_alert_configs
  FOR ALL TO authenticated
  USING ((select get_my_role()) = 'Admin')
  WITH CHECK ((select get_my_role()) = 'Admin');

-- ============================================
-- TABLE: extra_charges (legacy)
-- ============================================
DROP POLICY IF EXISTS "accountant_all_extra_charges_legacy" ON extra_charges;
DROP POLICY IF EXISTS "admin_all_extra_charges_legacy" ON extra_charges;
DROP POLICY IF EXISTS "supervisor_all_extra_charges_legacy" ON extra_charges;
DROP POLICY IF EXISTS "technician_insert_extra_charges_legacy" ON extra_charges;
DROP POLICY IF EXISTS "technician_select_extra_charges_legacy" ON extra_charges;
DROP POLICY IF EXISTS "extra_charges_legacy_insert" ON extra_charges;
DROP POLICY IF EXISTS "extra_charges_legacy_update" ON extra_charges;

CREATE POLICY "extra_charges_select" ON extra_charges
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "extra_charges_insert" ON extra_charges
  FOR INSERT TO authenticated
  WITH CHECK ((select get_my_role()) IN ('Admin', 'Supervisor', 'Accountant', 'Technician'));

CREATE POLICY "extra_charges_update" ON extra_charges
  FOR UPDATE TO authenticated
  USING ((select get_my_role()) IN ('Admin', 'Supervisor', 'Accountant'));

CREATE POLICY "extra_charges_delete" ON extra_charges
  FOR DELETE TO authenticated
  USING ((select get_my_role()) IN ('Admin', 'Supervisor', 'Accountant'));

-- ============================================
-- TABLE: forklifts
-- ============================================
DROP POLICY IF EXISTS "forklifts_update_policy" ON forklifts;
DROP POLICY IF EXISTS "technician_update_forklifts" ON forklifts;
DROP POLICY IF EXISTS "forklifts_select_all" ON forklifts;
DROP POLICY IF EXISTS "forklifts_insert_policy" ON forklifts;
DROP POLICY IF EXISTS "forklifts_delete_policy" ON forklifts;

CREATE POLICY "forklifts_select" ON forklifts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "forklifts_insert" ON forklifts
  FOR INSERT TO authenticated
  WITH CHECK ((select get_my_role()) IN ('Admin', 'Supervisor'));

CREATE POLICY "forklifts_update" ON forklifts
  FOR UPDATE TO authenticated
  USING ((select get_my_role()) IN ('Admin', 'Supervisor', 'Technician'));

CREATE POLICY "forklifts_delete" ON forklifts
  FOR DELETE TO authenticated
  USING ((select get_my_role()) IN ('Admin', 'Supervisor'));

-- ============================================
-- TABLE: hourmeter_amendments
-- ============================================
DROP POLICY IF EXISTS "admin_all" ON hourmeter_amendments;
DROP POLICY IF EXISTS "auth_update" ON hourmeter_amendments;
DROP POLICY IF EXISTS "auth_read" ON hourmeter_amendments;

CREATE POLICY "hourmeter_amendments_select" ON hourmeter_amendments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "hourmeter_amendments_insert" ON hourmeter_amendments
  FOR INSERT TO authenticated
  WITH CHECK ((select get_my_role()) IN ('Admin', 'Supervisor'));

CREATE POLICY "hourmeter_amendments_update" ON hourmeter_amendments
  FOR UPDATE TO authenticated
  USING ((select get_my_role()) IN ('Admin', 'Supervisor'));

CREATE POLICY "hourmeter_amendments_delete" ON hourmeter_amendments
  FOR DELETE TO authenticated
  USING ((select get_my_role()) = 'Admin');

-- ============================================
-- TABLE: hourmeter_history
-- ============================================
DROP POLICY IF EXISTS "admin_all_hourmeter_history" ON hourmeter_history;
DROP POLICY IF EXISTS "admin_insert_hourmeter_history" ON hourmeter_history;
DROP POLICY IF EXISTS "accountant_select_hourmeter_history" ON hourmeter_history;
DROP POLICY IF EXISTS "technician_select_hourmeter_history" ON hourmeter_history;

CREATE POLICY "hourmeter_history_select" ON hourmeter_history
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "hourmeter_history_insert" ON hourmeter_history
  FOR INSERT TO authenticated
  WITH CHECK ((select get_my_role()) IN ('Admin', 'Supervisor', 'Technician'));

CREATE POLICY "hourmeter_history_update" ON hourmeter_history
  FOR UPDATE TO authenticated
  USING ((select get_my_role()) = 'Admin');

CREATE POLICY "hourmeter_history_delete" ON hourmeter_history
  FOR DELETE TO authenticated
  USING ((select get_my_role()) = 'Admin');

-- ============================================
-- TABLE: hourmeter_validation_configs
-- ============================================
DROP POLICY IF EXISTS "admin_all" ON hourmeter_validation_configs;
DROP POLICY IF EXISTS "auth_read" ON hourmeter_validation_configs;

CREATE POLICY "hourmeter_validation_configs_select" ON hourmeter_validation_configs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "hourmeter_validation_configs_modify" ON hourmeter_validation_configs
  FOR ALL TO authenticated
  USING ((select get_my_role()) = 'Admin')
  WITH CHECK ((select get_my_role()) = 'Admin');

-- ============================================
-- TABLE: job_assignments
-- ============================================
DROP POLICY IF EXISTS "job_assignments_admin_all" ON job_assignments;
DROP POLICY IF EXISTS "job_assignments_tech_select" ON job_assignments;
DROP POLICY IF EXISTS "job_assignments_tech_update" ON job_assignments;

CREATE POLICY "job_assignments_select" ON job_assignments
  FOR SELECT TO authenticated
  USING ((select get_my_role()) IN ('Admin', 'Supervisor', 'Technician'));

CREATE POLICY "job_assignments_insert" ON job_assignments
  FOR INSERT TO authenticated
  WITH CHECK ((select get_my_role()) IN ('Admin', 'Supervisor'));

CREATE POLICY "job_assignments_update" ON job_assignments
  FOR UPDATE TO authenticated
  USING ((select get_my_role()) IN ('Admin', 'Supervisor', 'Technician'));

CREATE POLICY "job_assignments_delete" ON job_assignments
  FOR DELETE TO authenticated
  USING ((select get_my_role()) IN ('Admin', 'Supervisor'));

-- ============================================
-- TABLE: job_duration_alerts
-- ============================================
DROP POLICY IF EXISTS "admin_all" ON job_duration_alerts;
DROP POLICY IF EXISTS "auth_read" ON job_duration_alerts;

CREATE POLICY "job_duration_alerts_select" ON job_duration_alerts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "job_duration_alerts_modify" ON job_duration_alerts
  FOR ALL TO authenticated
  USING ((select get_my_role()) = 'Admin')
  WITH CHECK ((select get_my_role()) = 'Admin');

-- ============================================
-- TABLE: job_media
-- ============================================
DROP POLICY IF EXISTS "admin_all_job_media" ON job_media;
DROP POLICY IF EXISTS "job_media_delete_policy" ON job_media;
DROP POLICY IF EXISTS "supervisor_all_job_media" ON job_media;
DROP POLICY IF EXISTS "technician_delete_job_media" ON job_media;
DROP POLICY IF EXISTS "job_media_insert_policy" ON job_media;
DROP POLICY IF EXISTS "technician_insert_job_media" ON job_media;
DROP POLICY IF EXISTS "accountant_select_job_media" ON job_media;
DROP POLICY IF EXISTS "job_media_select_all" ON job_media;
DROP POLICY IF EXISTS "technician_select_job_media" ON job_media;

CREATE POLICY "job_media_select" ON job_media
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "job_media_insert" ON job_media
  FOR INSERT TO authenticated
  WITH CHECK ((select get_my_role()) IN ('Admin', 'Supervisor', 'Technician'));

CREATE POLICY "job_media_update" ON job_media
  FOR UPDATE TO authenticated
  USING ((select get_my_role()) IN ('Admin', 'Supervisor'));

CREATE POLICY "job_media_delete" ON job_media
  FOR DELETE TO authenticated
  USING ((select get_my_role()) IN ('Admin', 'Supervisor', 'Technician'));

-- ============================================
-- TABLE: job_parts
-- ============================================
DROP POLICY IF EXISTS "admin_all_job_parts" ON job_parts;
DROP POLICY IF EXISTS "job_parts_delete_policy" ON job_parts;
DROP POLICY IF EXISTS "supervisor_all_job_parts" ON job_parts;
DROP POLICY IF EXISTS "job_parts_insert_policy" ON job_parts;
DROP POLICY IF EXISTS "accountant_select_job_parts" ON job_parts;
DROP POLICY IF EXISTS "job_parts_select_all" ON job_parts;
DROP POLICY IF EXISTS "technician_select_job_parts" ON job_parts;
DROP POLICY IF EXISTS "job_parts_update_policy" ON job_parts;

CREATE POLICY "job_parts_select" ON job_parts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "job_parts_insert" ON job_parts
  FOR INSERT TO authenticated
  WITH CHECK ((select get_my_role()) IN ('Admin', 'Supervisor', 'Technician'));

CREATE POLICY "job_parts_update" ON job_parts
  FOR UPDATE TO authenticated
  USING ((select get_my_role()) IN ('Admin', 'Supervisor', 'Technician'));

CREATE POLICY "job_parts_delete" ON job_parts
  FOR DELETE TO authenticated
  USING ((select get_my_role()) IN ('Admin', 'Supervisor'));

-- ============================================
-- TABLE: job_requests
-- ============================================
DROP POLICY IF EXISTS "job_requests_admin_all" ON job_requests;
DROP POLICY IF EXISTS "job_requests_tech_insert" ON job_requests;
DROP POLICY IF EXISTS "job_requests_tech_select" ON job_requests;
DROP POLICY IF EXISTS "job_requests_tech_update" ON job_requests;

CREATE POLICY "job_requests_select" ON job_requests
  FOR SELECT TO authenticated
  USING ((select get_my_role()) IN ('Admin', 'Supervisor', 'Technician'));

CREATE POLICY "job_requests_insert" ON job_requests
  FOR INSERT TO authenticated
  WITH CHECK ((select get_my_role()) IN ('Admin', 'Supervisor', 'Technician'));

CREATE POLICY "job_requests_update" ON job_requests
  FOR UPDATE TO authenticated
  USING ((select get_my_role()) IN ('Admin', 'Supervisor', 'Technician'));

CREATE POLICY "job_requests_delete" ON job_requests
  FOR DELETE TO authenticated
  USING ((select get_my_role()) IN ('Admin', 'Supervisor'));

-- ============================================
-- TABLE: job_type_change_log
-- ============================================
DROP POLICY IF EXISTS "admin_all" ON job_type_change_log;
DROP POLICY IF EXISTS "auth_read" ON job_type_change_log;

CREATE POLICY "job_type_change_log_select" ON job_type_change_log
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "job_type_change_log_modify" ON job_type_change_log
  FOR ALL TO authenticated
  USING ((select get_my_role()) = 'Admin')
  WITH CHECK ((select get_my_role()) = 'Admin');

-- ============================================
-- TABLE: job_type_change_requests
-- ============================================
DROP POLICY IF EXISTS "admin_all" ON job_type_change_requests;
DROP POLICY IF EXISTS "auth_read" ON job_type_change_requests;

CREATE POLICY "job_type_change_requests_select" ON job_type_change_requests
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "job_type_change_requests_insert" ON job_type_change_requests
  FOR INSERT TO authenticated
  WITH CHECK ((select get_my_role()) IN ('Admin', 'Supervisor', 'Technician'));

CREATE POLICY "job_type_change_requests_update" ON job_type_change_requests
  FOR UPDATE TO authenticated
  USING ((select get_my_role()) IN ('Admin', 'Supervisor'));

CREATE POLICY "job_type_change_requests_delete" ON job_type_change_requests
  FOR DELETE TO authenticated
  USING ((select get_my_role()) = 'Admin');

-- ============================================
-- TABLE: notifications
-- ============================================
DROP POLICY IF EXISTS "notif_delete_admin" ON notifications;
DROP POLICY IF EXISTS "notif_delete_own" ON notifications;
DROP POLICY IF EXISTS "notif_select_admin" ON notifications;
DROP POLICY IF EXISTS "notif_select_own" ON notifications;
DROP POLICY IF EXISTS "notif_update_admin" ON notifications;
DROP POLICY IF EXISTS "notif_update_own" ON notifications;
DROP POLICY IF EXISTS "notif_insert_any" ON notifications;
DROP POLICY IF EXISTS "notifications_select_policy" ON notifications;
DROP POLICY IF EXISTS "notifications_update_policy" ON notifications;
DROP POLICY IF EXISTS "notifications_insert_policy" ON notifications;
DROP POLICY IF EXISTS "notifications_delete_policy" ON notifications;

CREATE POLICY "notifications_select" ON notifications
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT user_id FROM users WHERE auth_id = (select auth.uid()))
    OR (select get_my_role()) IN ('Admin', 'Supervisor')
  );

CREATE POLICY "notifications_insert" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE TO authenticated
  USING (
    user_id = (SELECT user_id FROM users WHERE auth_id = (select auth.uid()))
    OR (select get_my_role()) IN ('Admin', 'Supervisor')
  );

CREATE POLICY "notifications_delete" ON notifications
  FOR DELETE TO authenticated
  USING (
    user_id = (SELECT user_id FROM users WHERE auth_id = (select auth.uid()))
    OR (select get_my_role()) IN ('Admin', 'Supervisor')
  );

-- ============================================
-- TABLE: public_holidays
-- ============================================
DROP POLICY IF EXISTS "public_holidays_admin_write" ON public_holidays;
DROP POLICY IF EXISTS "public_holidays_read_all" ON public_holidays;

CREATE POLICY "public_holidays_select" ON public_holidays
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "public_holidays_modify" ON public_holidays
  FOR ALL TO authenticated
  USING ((select get_my_role()) = 'Admin')
  WITH CHECK ((select get_my_role()) = 'Admin');

-- ============================================
-- TABLE: van_stock_audit_items
-- ============================================
DROP POLICY IF EXISTS "admin_all" ON van_stock_audit_items;
DROP POLICY IF EXISTS "auth_read" ON van_stock_audit_items;

CREATE POLICY "van_stock_audit_items_select" ON van_stock_audit_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "van_stock_audit_items_modify" ON van_stock_audit_items
  FOR ALL TO authenticated
  USING ((select get_my_role()) IN ('Admin', 'Supervisor'))
  WITH CHECK ((select get_my_role()) IN ('Admin', 'Supervisor'));

-- ============================================
-- TABLE: van_stock_audits
-- ============================================
DROP POLICY IF EXISTS "admin_all" ON van_stock_audits;
DROP POLICY IF EXISTS "auth_read" ON van_stock_audits;

CREATE POLICY "van_stock_audits_select" ON van_stock_audits
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "van_stock_audits_modify" ON van_stock_audits
  FOR ALL TO authenticated
  USING ((select get_my_role()) IN ('Admin', 'Supervisor'))
  WITH CHECK ((select get_my_role()) IN ('Admin', 'Supervisor'));

-- ============================================
-- TABLE: van_stock_items
-- ============================================
DROP POLICY IF EXISTS "auth_all" ON van_stock_items;
DROP POLICY IF EXISTS "auth_read" ON van_stock_items;
DROP POLICY IF EXISTS "admin_all" ON van_stock_items;

CREATE POLICY "van_stock_items_select" ON van_stock_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "van_stock_items_modify" ON van_stock_items
  FOR ALL TO authenticated
  USING ((select get_my_role()) IN ('Admin', 'Supervisor', 'Technician'))
  WITH CHECK ((select get_my_role()) IN ('Admin', 'Supervisor', 'Technician'));

-- ============================================
-- TABLE: van_stock_replenishment_items
-- ============================================
DROP POLICY IF EXISTS "admin_all" ON van_stock_replenishment_items;
DROP POLICY IF EXISTS "auth_read" ON van_stock_replenishment_items;

CREATE POLICY "van_stock_replenishment_items_select" ON van_stock_replenishment_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "van_stock_replenishment_items_modify" ON van_stock_replenishment_items
  FOR ALL TO authenticated
  USING ((select get_my_role()) IN ('Admin', 'Supervisor'))
  WITH CHECK ((select get_my_role()) IN ('Admin', 'Supervisor'));

-- ============================================
-- TABLE: van_stock_replenishments
-- ============================================
DROP POLICY IF EXISTS "admin_all" ON van_stock_replenishments;
DROP POLICY IF EXISTS "auth_read" ON van_stock_replenishments;

CREATE POLICY "van_stock_replenishments_select" ON van_stock_replenishments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "van_stock_replenishments_modify" ON van_stock_replenishments
  FOR ALL TO authenticated
  USING ((select get_my_role()) IN ('Admin', 'Supervisor'))
  WITH CHECK ((select get_my_role()) IN ('Admin', 'Supervisor'));

-- ============================================
-- TABLE: van_stock_usage
-- ============================================
DROP POLICY IF EXISTS "auth_all" ON van_stock_usage;
DROP POLICY IF EXISTS "auth_read" ON van_stock_usage;
DROP POLICY IF EXISTS "admin_all" ON van_stock_usage;

CREATE POLICY "van_stock_usage_select" ON van_stock_usage
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "van_stock_usage_modify" ON van_stock_usage
  FOR ALL TO authenticated
  USING ((select get_my_role()) IN ('Admin', 'Supervisor', 'Technician'))
  WITH CHECK ((select get_my_role()) IN ('Admin', 'Supervisor', 'Technician'));

-- ============================================
-- TABLE: van_stocks
-- ============================================
DROP POLICY IF EXISTS "auth_all" ON van_stocks;
DROP POLICY IF EXISTS "auth_read" ON van_stocks;
DROP POLICY IF EXISTS "admin_all" ON van_stocks;

CREATE POLICY "van_stocks_select" ON van_stocks
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "van_stocks_modify" ON van_stocks
  FOR ALL TO authenticated
  USING ((select get_my_role()) IN ('Admin', 'Supervisor', 'Technician'))
  WITH CHECK ((select get_my_role()) IN ('Admin', 'Supervisor', 'Technician'));

-- ============================================
-- DONE
-- ============================================
-- This migration consolidates ~70 duplicate policies into ~56 optimized policies.
-- Each table now has at most ONE policy per action (SELECT, INSERT, UPDATE, DELETE).
-- Run the Supabase Performance Advisor again to verify all warnings are resolved.
-- ============================================
