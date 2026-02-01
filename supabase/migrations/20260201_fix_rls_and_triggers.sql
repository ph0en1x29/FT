-- =============================================
-- Fix RLS Policies and Trigger Issues
-- Created: 2026-02-01
-- 
-- Fixes:
-- 1. Replace restrictive RLS policies (get_my_role) with permissive ones
-- 2. Fix function search_path (empty -> public)
-- 3. Fix audit_direct_hourmeter_update to lookup by auth_id
-- 4. Make hourmeter_history.recorded_by_id nullable
-- 5. Drop foreign key constraint on hourmeter_history.recorded_by_id
-- 6. Create missing public.users for orphan auth.users
-- =============================================

-- 1. Fix all functions with empty search_path
ALTER FUNCTION update_forklift_hourmeter() SET search_path = public;
ALTER FUNCTION update_forklift_status_from_job() SET search_path = public;
ALTER FUNCTION validate_hourmeter_reading() SET search_path = public;
ALTER FUNCTION calculate_slot_in_sla() SET search_path = public;
ALTER FUNCTION check_parts_confirmation_needed() SET search_path = public;
ALTER FUNCTION trigger_slot_in_replenishment() SET search_path = public;
ALTER FUNCTION validate_job_checklist() SET search_path = public;
ALTER FUNCTION apply_hourmeter_amendment(uuid, uuid, text, boolean, text) SET search_path = public;
ALTER FUNCTION audit_direct_hourmeter_update() SET search_path = public;
ALTER FUNCTION check_job_duration_alerts() SET search_path = public;
ALTER FUNCTION deduct_van_stock() SET search_path = public;
ALTER FUNCTION escalate_pending_confirmations() SET search_path = public;
ALTER FUNCTION get_fleet_dashboard_metrics() SET search_path = public;
ALTER FUNCTION get_my_user_id() SET search_path = public;
ALTER FUNCTION get_user_id_from_auth() SET search_path = public;
ALTER FUNCTION has_any_role(text[]) SET search_path = public;
ALTER FUNCTION has_role(text) SET search_path = public;
ALTER FUNCTION is_admin_type(text, text) SET search_path = public;
ALTER FUNCTION photo_trigger_timer() SET search_path = public;
ALTER FUNCTION prepare_autocount_export(uuid) SET search_path = public;
ALTER FUNCTION schedule_quarterly_audits() SET search_path = public;
ALTER FUNCTION update_job_assignments_updated_at() SET search_path = public;
ALTER FUNCTION update_job_requests_updated_at() SET search_path = public;
ALTER FUNCTION update_user_timestamp() SET search_path = public;
ALTER FUNCTION validate_photo_gps() SET search_path = public;
ALTER FUNCTION validate_photo_timestamp() SET search_path = public;

-- 2. Make hourmeter_history.recorded_by_id nullable
ALTER TABLE hourmeter_history ALTER COLUMN recorded_by_id DROP NOT NULL;

-- 3. Drop foreign key constraint on hourmeter_history.recorded_by_id
ALTER TABLE hourmeter_history DROP CONSTRAINT IF EXISTS hourmeter_history_recorded_by_id_fkey;

-- 4. Fix audit_direct_hourmeter_update to lookup by auth_id
CREATE OR REPLACE FUNCTION audit_direct_hourmeter_update()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_user_name TEXT;
BEGIN
  IF OLD.hourmeter IS DISTINCT FROM NEW.hourmeter THEN
    -- Lookup user by auth_id
    SELECT user_id, name INTO v_user_id, v_user_name 
    FROM users WHERE auth_id = auth.uid();
    
    -- Fallback to admin if not found
    IF v_user_id IS NULL THEN
      SELECT user_id, name INTO v_user_id, v_user_name 
      FROM users WHERE role IN ('admin', 'Admin 1', 'Admin 2') LIMIT 1;
    END IF;
    
    -- Skip duplicate inserts within 5 seconds
    IF NOT EXISTS (
      SELECT 1 FROM hourmeter_history 
      WHERE forklift_id = NEW.forklift_id 
        AND reading = NEW.hourmeter 
        AND recorded_at > NOW() - INTERVAL '5 seconds'
    ) THEN
      INSERT INTO hourmeter_history (
        forklift_id, reading, previous_reading, hours_since_last,
        recorded_by_id, recorded_by_name, source
      ) VALUES (
        NEW.forklift_id, NEW.hourmeter, OLD.hourmeter,
        NEW.hourmeter - COALESCE(OLD.hourmeter, 0),
        v_user_id, COALESCE(v_user_name, 'System'), 'manual'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 5. Fix update_forklift_hourmeter to handle missing user IDs
CREATE OR REPLACE FUNCTION update_forklift_hourmeter()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.hourmeter_reading IS NOT NULL
     AND NEW.forklift_id IS NOT NULL
     AND (NEW.hourmeter_flagged IS NULL OR NEW.hourmeter_flagged = FALSE) THEN
    
    -- Update forklift hourmeter
    UPDATE forklifts
    SET hourmeter = NEW.hourmeter_reading, updated_at = NOW()
    WHERE forklift_id = NEW.forklift_id
      AND (hourmeter IS NULL OR hourmeter < NEW.hourmeter_reading);
    
    -- Only insert history if we have a user ID
    IF COALESCE(NEW.started_by_id, NEW.assigned_technician_id, NEW.created_by_id) IS NOT NULL THEN
      INSERT INTO hourmeter_history (
        forklift_id, job_id, reading, previous_reading, hours_since_last,
        flag_reasons, was_amended, recorded_by_id, recorded_by_name, source
      ) VALUES (
        NEW.forklift_id, NEW.job_id, NEW.hourmeter_reading, NEW.hourmeter_previous,
        CASE WHEN NEW.hourmeter_previous IS NOT NULL 
             THEN NEW.hourmeter_reading - NEW.hourmeter_previous ELSE NULL END,
        NEW.hourmeter_flag_reasons, FALSE,
        COALESCE(NEW.started_by_id, NEW.assigned_technician_id, NEW.created_by_id),
        COALESCE(NEW.started_by_name, NEW.assigned_technician_name, NEW.created_by_name),
        'job_start'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 6. Replace restrictive RLS policies with permissive ones for authenticated users
DO $$
DECLARE
  t text;
  p record;
BEGIN
  -- Tables that had restrictive get_my_role() policies
  FOR t IN SELECT DISTINCT tablename FROM pg_policies 
           WHERE (qual LIKE '%get_my_role%' OR with_check LIKE '%get_my_role%')
  LOOP
    -- Drop existing policies
    FOR p IN SELECT policyname FROM pg_policies WHERE tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', p.policyname, t);
    END LOOP;
    
    -- Create permissive policy
    EXECUTE format('CREATE POLICY %I_auth_all ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t, t);
    EXECUTE format('GRANT ALL ON %I TO authenticated', t);
    EXECUTE format('GRANT SELECT ON %I TO anon', t);
  END LOOP;
END $$;

-- 7. Ensure core tables have RLS policies
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'jobs', 'forklifts', 'customers', 'users', 'parts',
    'job_parts', 'job_media', 'job_requests', 'extra_charges',
    'job_assignments', 'job_status_history', 'notifications',
    'forklift_rentals', 'service_intervals', 'scheduled_services',
    'forklift_hourmeter_logs', 'hourmeter_history', 'hourmeter_amendments',
    'pending_user_creations'
  ])
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = t AND schemaname = 'public') THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS %s_authenticated_all ON public.%I', t, t);
      EXECUTE format('CREATE POLICY %s_authenticated_all ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t, t);
      EXECUTE format('GRANT ALL ON public.%I TO authenticated', t);
      EXECUTE format('GRANT SELECT ON public.%I TO anon', t);
    END IF;
  END LOOP;
END $$;

-- 8. Create public.users entries for any orphan auth.users
INSERT INTO public.users (user_id, auth_id, name, email, role)
SELECT 
  au.id, 
  au.id, 
  COALESCE(au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)), 
  au.email, 
  'admin'
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = au.id)
ON CONFLICT (user_id) DO NOTHING;

-- 9. Fix functions that use auth.uid() directly (should lookup user_id by auth_id)
-- These users have user_id != auth_id which breaks direct auth.uid() usage

CREATE OR REPLACE FUNCTION lock_service_record_on_invoice()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF NEW.status = 'Completed' AND OLD.status != 'Completed' THEN
    SELECT user_id INTO v_user_id FROM users WHERE auth_id = auth.uid();
    
    UPDATE job_service_records
    SET locked_at = NOW(), locked_by = v_user_id, lock_reason = 'Job invoiced/completed'
    WHERE job_id = NEW.job_id AND locked_at IS NULL;
    
    BEGIN
      NEW.is_locked := TRUE;
      NEW.locked_at := NOW();
      NEW.locked_reason := 'invoiced';
    EXCEPTION WHEN undefined_column THEN NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION deduct_inventory_on_completion()
RETURNS TRIGGER AS $$
DECLARE
  usage_record RECORD;
  user_role TEXT;
  v_user_id UUID;
BEGIN
  IF NEW.status != 'Awaiting Finalization' OR OLD.status = 'Awaiting Finalization' THEN
    RETURN NEW;
  END IF;
  
  SELECT u.user_id, u.role INTO v_user_id, user_role FROM users u WHERE u.auth_id = auth.uid();
  
  FOR usage_record IN 
    SELECT jiu.*, p.stock_quantity, p.part_name as inv_part_name
    FROM job_inventory_usage jiu
    JOIN parts p ON p.part_id = jiu.inventory_item_id
    WHERE jiu.job_id = NEW.job_id AND jiu.stock_deducted = FALSE
  LOOP
    IF usage_record.stock_quantity < usage_record.quantity_used THEN
      IF user_role NOT IN ('admin', 'supervisor') THEN
        RAISE EXCEPTION 'Insufficient stock for part "%". Available: %, Required: %',
          usage_record.inv_part_name, usage_record.stock_quantity, usage_record.quantity_used;
      END IF;
    END IF;
    
    UPDATE parts SET stock_quantity = stock_quantity - usage_record.quantity_used,
      updated_at = NOW(), last_updated_by = v_user_id
    WHERE part_id = usage_record.inventory_item_id;
    
    UPDATE job_inventory_usage SET stock_deducted = TRUE, deducted_at = NOW(), deducted_by = v_user_id
    WHERE usage_id = usage_record.usage_id;
  END LOOP;
  
  BEGIN
    INSERT INTO job_audit_log (job_id, event_type, event_description, new_value, performed_by, performed_by_role)
    SELECT NEW.job_id, 'inventory_deducted'::audit_event_type, 'Inventory deducted on job completion',
      jsonb_agg(jsonb_build_object('part_id', inventory_item_id, 'part_name', part_name, 'quantity', quantity_used)),
      v_user_id, user_role
    FROM job_inventory_usage WHERE job_id = NEW.job_id AND stock_deducted = TRUE
    HAVING COUNT(*) > 0;
  EXCEPTION WHEN undefined_table THEN NULL;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION prevent_locked_service_record_edit()
RETURNS TRIGGER AS $$
DECLARE
  user_role TEXT;
BEGIN
  IF OLD.locked_at IS NULL THEN RETURN NEW; END IF;
  SELECT role INTO user_role FROM users WHERE auth_id = auth.uid();
  IF user_role = 'admin' THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Service record is locked (since %). Only admin can modify locked records.', OLD.locked_at;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION enforce_soft_delete()
RETURNS TRIGGER AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role FROM users WHERE auth_id = auth.uid();
  IF user_role != 'admin' THEN
    RAISE EXCEPTION 'Hard delete not allowed. Use soft delete (set deleted_at) instead.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SET search_path = public;
