-- ============================================
-- FIX FOR ALL + SELECT OVERLAP
-- Date: 2026-01-31
-- Issue: FOR ALL policies overlap with FOR SELECT policies,
-- creating multiple permissive policies for SELECT action
-- ============================================

-- ============================================
-- TABLE: app_settings
-- ============================================
DROP POLICY IF EXISTS "app_settings_modify" ON app_settings;
DROP POLICY IF EXISTS "app_settings_select" ON app_settings;

CREATE POLICY "app_settings_select" ON app_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "app_settings_insert" ON app_settings
  FOR INSERT TO authenticated
  WITH CHECK ((select get_my_role()) = 'Admin');

CREATE POLICY "app_settings_update" ON app_settings
  FOR UPDATE TO authenticated
  USING ((select get_my_role()) = 'Admin');

CREATE POLICY "app_settings_delete" ON app_settings
  FOR DELETE TO authenticated
  USING ((select get_my_role()) = 'Admin');

-- ============================================
-- TABLE: autocount_customer_mappings
-- ============================================
DROP POLICY IF EXISTS "autocount_customer_mappings_modify" ON autocount_customer_mappings;
DROP POLICY IF EXISTS "autocount_customer_mappings_select" ON autocount_customer_mappings;

CREATE POLICY "autocount_customer_mappings_select" ON autocount_customer_mappings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "autocount_customer_mappings_insert" ON autocount_customer_mappings
  FOR INSERT TO authenticated
  WITH CHECK ((select get_my_role()) = 'Admin');

CREATE POLICY "autocount_customer_mappings_update" ON autocount_customer_mappings
  FOR UPDATE TO authenticated
  USING ((select get_my_role()) = 'Admin');

CREATE POLICY "autocount_customer_mappings_delete" ON autocount_customer_mappings
  FOR DELETE TO authenticated
  USING ((select get_my_role()) = 'Admin');

-- ============================================
-- TABLE: autocount_exports
-- ============================================
DROP POLICY IF EXISTS "autocount_exports_modify" ON autocount_exports;
DROP POLICY IF EXISTS "autocount_exports_select" ON autocount_exports;

CREATE POLICY "autocount_exports_select" ON autocount_exports
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "autocount_exports_insert" ON autocount_exports
  FOR INSERT TO authenticated
  WITH CHECK ((select get_my_role()) IN ('Admin', 'Accountant'));

CREATE POLICY "autocount_exports_update" ON autocount_exports
  FOR UPDATE TO authenticated
  USING ((select get_my_role()) IN ('Admin', 'Accountant'));

CREATE POLICY "autocount_exports_delete" ON autocount_exports
  FOR DELETE TO authenticated
  USING ((select get_my_role()) IN ('Admin', 'Accountant'));

-- ============================================
-- TABLE: autocount_item_mappings
-- ============================================
DROP POLICY IF EXISTS "autocount_item_mappings_modify" ON autocount_item_mappings;
DROP POLICY IF EXISTS "autocount_item_mappings_select" ON autocount_item_mappings;

CREATE POLICY "autocount_item_mappings_select" ON autocount_item_mappings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "autocount_item_mappings_insert" ON autocount_item_mappings
  FOR INSERT TO authenticated
  WITH CHECK ((select get_my_role()) = 'Admin');

CREATE POLICY "autocount_item_mappings_update" ON autocount_item_mappings
  FOR UPDATE TO authenticated
  USING ((select get_my_role()) = 'Admin');

CREATE POLICY "autocount_item_mappings_delete" ON autocount_item_mappings
  FOR DELETE TO authenticated
  USING ((select get_my_role()) = 'Admin');

-- ============================================
-- TABLE: autocount_settings
-- ============================================
DROP POLICY IF EXISTS "autocount_settings_modify" ON autocount_settings;
DROP POLICY IF EXISTS "autocount_settings_select" ON autocount_settings;

CREATE POLICY "autocount_settings_select" ON autocount_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "autocount_settings_insert" ON autocount_settings
  FOR INSERT TO authenticated
  WITH CHECK ((select get_my_role()) = 'Admin');

CREATE POLICY "autocount_settings_update" ON autocount_settings
  FOR UPDATE TO authenticated
  USING ((select get_my_role()) = 'Admin');

CREATE POLICY "autocount_settings_delete" ON autocount_settings
  FOR DELETE TO authenticated
  USING ((select get_my_role()) = 'Admin');

-- ============================================
-- TABLE: duration_alert_configs
-- ============================================
DROP POLICY IF EXISTS "duration_alert_configs_modify" ON duration_alert_configs;
DROP POLICY IF EXISTS "duration_alert_configs_select" ON duration_alert_configs;

CREATE POLICY "duration_alert_configs_select" ON duration_alert_configs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "duration_alert_configs_insert" ON duration_alert_configs
  FOR INSERT TO authenticated
  WITH CHECK ((select get_my_role()) = 'Admin');

CREATE POLICY "duration_alert_configs_update" ON duration_alert_configs
  FOR UPDATE TO authenticated
  USING ((select get_my_role()) = 'Admin');

CREATE POLICY "duration_alert_configs_delete" ON duration_alert_configs
  FOR DELETE TO authenticated
  USING ((select get_my_role()) = 'Admin');

-- ============================================
-- TABLE: hourmeter_validation_configs
-- ============================================
DROP POLICY IF EXISTS "hourmeter_validation_configs_modify" ON hourmeter_validation_configs;
DROP POLICY IF EXISTS "hourmeter_validation_configs_select" ON hourmeter_validation_configs;

CREATE POLICY "hourmeter_validation_configs_select" ON hourmeter_validation_configs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "hourmeter_validation_configs_insert" ON hourmeter_validation_configs
  FOR INSERT TO authenticated
  WITH CHECK ((select get_my_role()) = 'Admin');

CREATE POLICY "hourmeter_validation_configs_update" ON hourmeter_validation_configs
  FOR UPDATE TO authenticated
  USING ((select get_my_role()) = 'Admin');

CREATE POLICY "hourmeter_validation_configs_delete" ON hourmeter_validation_configs
  FOR DELETE TO authenticated
  USING ((select get_my_role()) = 'Admin');

-- ============================================
-- TABLE: job_duration_alerts
-- ============================================
DROP POLICY IF EXISTS "job_duration_alerts_modify" ON job_duration_alerts;
DROP POLICY IF EXISTS "job_duration_alerts_select" ON job_duration_alerts;

CREATE POLICY "job_duration_alerts_select" ON job_duration_alerts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "job_duration_alerts_insert" ON job_duration_alerts
  FOR INSERT TO authenticated
  WITH CHECK ((select get_my_role()) = 'Admin');

CREATE POLICY "job_duration_alerts_update" ON job_duration_alerts
  FOR UPDATE TO authenticated
  USING ((select get_my_role()) = 'Admin');

CREATE POLICY "job_duration_alerts_delete" ON job_duration_alerts
  FOR DELETE TO authenticated
  USING ((select get_my_role()) = 'Admin');

-- ============================================
-- TABLE: job_type_change_log
-- ============================================
DROP POLICY IF EXISTS "job_type_change_log_modify" ON job_type_change_log;
DROP POLICY IF EXISTS "job_type_change_log_select" ON job_type_change_log;

CREATE POLICY "job_type_change_log_select" ON job_type_change_log
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "job_type_change_log_insert" ON job_type_change_log
  FOR INSERT TO authenticated
  WITH CHECK ((select get_my_role()) = 'Admin');

CREATE POLICY "job_type_change_log_update" ON job_type_change_log
  FOR UPDATE TO authenticated
  USING ((select get_my_role()) = 'Admin');

CREATE POLICY "job_type_change_log_delete" ON job_type_change_log
  FOR DELETE TO authenticated
  USING ((select get_my_role()) = 'Admin');

-- ============================================
-- TABLE: public_holidays
-- ============================================
DROP POLICY IF EXISTS "public_holidays_modify" ON public_holidays;
DROP POLICY IF EXISTS "public_holidays_select" ON public_holidays;

CREATE POLICY "public_holidays_select" ON public_holidays
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "public_holidays_insert" ON public_holidays
  FOR INSERT TO authenticated
  WITH CHECK ((select get_my_role()) = 'Admin');

CREATE POLICY "public_holidays_update" ON public_holidays
  FOR UPDATE TO authenticated
  USING ((select get_my_role()) = 'Admin');

CREATE POLICY "public_holidays_delete" ON public_holidays
  FOR DELETE TO authenticated
  USING ((select get_my_role()) = 'Admin');

-- ============================================
-- TABLE: van_stock_audit_items
-- ============================================
DROP POLICY IF EXISTS "van_stock_audit_items_modify" ON van_stock_audit_items;
DROP POLICY IF EXISTS "van_stock_audit_items_select" ON van_stock_audit_items;

CREATE POLICY "van_stock_audit_items_select" ON van_stock_audit_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "van_stock_audit_items_insert" ON van_stock_audit_items
  FOR INSERT TO authenticated
  WITH CHECK ((select get_my_role()) IN ('Admin', 'Supervisor'));

CREATE POLICY "van_stock_audit_items_update" ON van_stock_audit_items
  FOR UPDATE TO authenticated
  USING ((select get_my_role()) IN ('Admin', 'Supervisor'));

CREATE POLICY "van_stock_audit_items_delete" ON van_stock_audit_items
  FOR DELETE TO authenticated
  USING ((select get_my_role()) IN ('Admin', 'Supervisor'));

-- ============================================
-- TABLE: van_stock_audits
-- ============================================
DROP POLICY IF EXISTS "van_stock_audits_modify" ON van_stock_audits;
DROP POLICY IF EXISTS "van_stock_audits_select" ON van_stock_audits;

CREATE POLICY "van_stock_audits_select" ON van_stock_audits
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "van_stock_audits_insert" ON van_stock_audits
  FOR INSERT TO authenticated
  WITH CHECK ((select get_my_role()) IN ('Admin', 'Supervisor'));

CREATE POLICY "van_stock_audits_update" ON van_stock_audits
  FOR UPDATE TO authenticated
  USING ((select get_my_role()) IN ('Admin', 'Supervisor'));

CREATE POLICY "van_stock_audits_delete" ON van_stock_audits
  FOR DELETE TO authenticated
  USING ((select get_my_role()) IN ('Admin', 'Supervisor'));

-- ============================================
-- TABLE: van_stock_items
-- ============================================
DROP POLICY IF EXISTS "van_stock_items_modify" ON van_stock_items;
DROP POLICY IF EXISTS "van_stock_items_select" ON van_stock_items;

CREATE POLICY "van_stock_items_select" ON van_stock_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "van_stock_items_insert" ON van_stock_items
  FOR INSERT TO authenticated
  WITH CHECK ((select get_my_role()) IN ('Admin', 'Supervisor', 'Technician'));

CREATE POLICY "van_stock_items_update" ON van_stock_items
  FOR UPDATE TO authenticated
  USING ((select get_my_role()) IN ('Admin', 'Supervisor', 'Technician'));

CREATE POLICY "van_stock_items_delete" ON van_stock_items
  FOR DELETE TO authenticated
  USING ((select get_my_role()) IN ('Admin', 'Supervisor', 'Technician'));

-- ============================================
-- TABLE: van_stock_replenishment_items
-- ============================================
DROP POLICY IF EXISTS "van_stock_replenishment_items_modify" ON van_stock_replenishment_items;
DROP POLICY IF EXISTS "van_stock_replenishment_items_select" ON van_stock_replenishment_items;

CREATE POLICY "van_stock_replenishment_items_select" ON van_stock_replenishment_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "van_stock_replenishment_items_insert" ON van_stock_replenishment_items
  FOR INSERT TO authenticated
  WITH CHECK ((select get_my_role()) IN ('Admin', 'Supervisor'));

CREATE POLICY "van_stock_replenishment_items_update" ON van_stock_replenishment_items
  FOR UPDATE TO authenticated
  USING ((select get_my_role()) IN ('Admin', 'Supervisor'));

CREATE POLICY "van_stock_replenishment_items_delete" ON van_stock_replenishment_items
  FOR DELETE TO authenticated
  USING ((select get_my_role()) IN ('Admin', 'Supervisor'));

-- ============================================
-- TABLE: van_stock_replenishments
-- ============================================
DROP POLICY IF EXISTS "van_stock_replenishments_modify" ON van_stock_replenishments;
DROP POLICY IF EXISTS "van_stock_replenishments_select" ON van_stock_replenishments;

CREATE POLICY "van_stock_replenishments_select" ON van_stock_replenishments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "van_stock_replenishments_insert" ON van_stock_replenishments
  FOR INSERT TO authenticated
  WITH CHECK ((select get_my_role()) IN ('Admin', 'Supervisor'));

CREATE POLICY "van_stock_replenishments_update" ON van_stock_replenishments
  FOR UPDATE TO authenticated
  USING ((select get_my_role()) IN ('Admin', 'Supervisor'));

CREATE POLICY "van_stock_replenishments_delete" ON van_stock_replenishments
  FOR DELETE TO authenticated
  USING ((select get_my_role()) IN ('Admin', 'Supervisor'));

-- ============================================
-- TABLE: van_stock_usage
-- ============================================
DROP POLICY IF EXISTS "van_stock_usage_modify" ON van_stock_usage;
DROP POLICY IF EXISTS "van_stock_usage_select" ON van_stock_usage;

CREATE POLICY "van_stock_usage_select" ON van_stock_usage
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "van_stock_usage_insert" ON van_stock_usage
  FOR INSERT TO authenticated
  WITH CHECK ((select get_my_role()) IN ('Admin', 'Supervisor', 'Technician'));

CREATE POLICY "van_stock_usage_update" ON van_stock_usage
  FOR UPDATE TO authenticated
  USING ((select get_my_role()) IN ('Admin', 'Supervisor', 'Technician'));

CREATE POLICY "van_stock_usage_delete" ON van_stock_usage
  FOR DELETE TO authenticated
  USING ((select get_my_role()) IN ('Admin', 'Supervisor', 'Technician'));

-- ============================================
-- TABLE: van_stocks
-- ============================================
DROP POLICY IF EXISTS "van_stocks_modify" ON van_stocks;
DROP POLICY IF EXISTS "van_stocks_select" ON van_stocks;

CREATE POLICY "van_stocks_select" ON van_stocks
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "van_stocks_insert" ON van_stocks
  FOR INSERT TO authenticated
  WITH CHECK ((select get_my_role()) IN ('Admin', 'Supervisor', 'Technician'));

CREATE POLICY "van_stocks_update" ON van_stocks
  FOR UPDATE TO authenticated
  USING ((select get_my_role()) IN ('Admin', 'Supervisor', 'Technician'));

CREATE POLICY "van_stocks_delete" ON van_stocks
  FOR DELETE TO authenticated
  USING ((select get_my_role()) IN ('Admin', 'Supervisor', 'Technician'));

-- ============================================
-- DONE - replaced 17 FOR ALL policies with explicit CRUD policies
-- ============================================
