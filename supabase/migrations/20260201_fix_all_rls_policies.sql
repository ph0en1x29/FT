-- =============================================
-- Fix All RLS Policies
-- Created: 2026-02-01
-- 
-- Issue: Security migration enabled RLS but didn't add policies
-- Fix: Add permissive policies for authenticated users
-- Note: Role-based access control is handled in the application layer
-- =============================================

-- Helper function to create standard policies
DO $$
DECLARE
  tables_to_fix text[] := ARRAY[
    'jobs', 'forklifts', 'customers', 'users', 'parts',
    'job_parts', 'job_media', 'job_requests', 'extra_charges',
    'job_assignments', 'job_status_history', 'job_audit_log',
    'job_invoices', 'job_service_records', 'quotations',
    'forklift_rentals', 'forklift_hourmeter_logs',
    'van_stocks', 'van_stock_items', 'van_stock_usage',
    'van_stock_replenishments', 'van_stock_replenishment_items',
    'van_stock_audits', 'van_stock_audit_items',
    'job_type_change_requests', 'job_type_change_log',
    'job_duration_alerts', 'duration_alert_configs',
    'hourmeter_validation_configs', 'hourmeter_history', 'hourmeter_amendments',
    'autocount_exports', 'autocount_customer_mappings', 
    'autocount_item_mappings', 'autocount_settings',
    'notifications', 'service_intervals', 'scheduled_services',
    'service_predictions', 'employee_leaves', 'employee_licenses',
    'employee_permits', 'leave_types', 'employee_leave_balances',
    'public_holidays', 'hr_alerts', 'app_settings',
    'customer_acknowledgements', 'job_inventory_usage',
    'job_invoice_extra_charges', 'pending_user_creations',
    'technician_kpi_snapshots'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY tables_to_fix
  LOOP
    -- Check if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      -- Enable RLS if not already
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      
      -- Drop existing policies
      EXECUTE format('DROP POLICY IF EXISTS "%s_select_all" ON public.%I', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "%s_insert_authenticated" ON public.%I', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "%s_update_authenticated" ON public.%I', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "%s_delete_authenticated" ON public.%I', t, t);
      
      -- Create permissive policies
      EXECUTE format('CREATE POLICY "%s_select_all" ON public.%I FOR SELECT USING (true)', t, t);
      EXECUTE format('CREATE POLICY "%s_insert_authenticated" ON public.%I FOR INSERT WITH CHECK (auth.role() = ''authenticated'')', t, t);
      EXECUTE format('CREATE POLICY "%s_update_authenticated" ON public.%I FOR UPDATE USING (true) WITH CHECK (true)', t, t);
      EXECUTE format('CREATE POLICY "%s_delete_authenticated" ON public.%I FOR DELETE USING (auth.role() = ''authenticated'')', t, t);
      
      -- Grant permissions
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
      EXECUTE format('GRANT SELECT ON public.%I TO anon', t);
      
      RAISE NOTICE 'Fixed RLS policies for: %', t;
    ELSE
      RAISE NOTICE 'Table does not exist, skipping: %', t;
    END IF;
  END LOOP;
END $$;
