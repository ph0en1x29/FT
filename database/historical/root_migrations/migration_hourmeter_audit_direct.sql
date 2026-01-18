-- ============================================
-- Migration: Hourmeter Audit for Direct Updates
-- ============================================
-- This trigger captures direct forklift hourmeter updates
-- that bypass the job workflow (e.g., admin direct edits)
--
-- Run this in Supabase SQL Editor

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_audit_direct_hourmeter_update ON forklifts;
DROP FUNCTION IF EXISTS audit_direct_hourmeter_update();

-- Create the audit function
CREATE OR REPLACE FUNCTION audit_direct_hourmeter_update()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_user_name TEXT;
BEGIN
  -- Only trigger if hourmeter actually changed
  IF OLD.hourmeter IS DISTINCT FROM NEW.hourmeter THEN
    -- Try to get the current user from auth context
    v_user_id := auth.uid();

    -- Get user name
    IF v_user_id IS NOT NULL THEN
      SELECT name INTO v_user_name FROM users WHERE user_id = v_user_id;
    END IF;

    -- Default values if no auth context
    v_user_id := COALESCE(v_user_id, '00000000-0000-0000-0000-000000000000'::UUID);
    v_user_name := COALESCE(v_user_name, 'System');

    -- Check if this update was already logged by application
    -- (within last 5 seconds to avoid duplicates)
    IF NOT EXISTS (
      SELECT 1 FROM hourmeter_history
      WHERE forklift_id = NEW.forklift_id
        AND reading = NEW.hourmeter
        AND recorded_at > NOW() - INTERVAL '5 seconds'
    ) THEN
      -- Insert audit record
      INSERT INTO hourmeter_history (
        forklift_id,
        reading,
        previous_reading,
        hours_since_last,
        recorded_by_id,
        recorded_by_name,
        source
      ) VALUES (
        NEW.forklift_id,
        NEW.hourmeter,
        OLD.hourmeter,
        NEW.hourmeter - COALESCE(OLD.hourmeter, 0),
        v_user_id,
        v_user_name,
        'manual'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
CREATE TRIGGER trigger_audit_direct_hourmeter_update
  AFTER UPDATE OF hourmeter ON forklifts
  FOR EACH ROW
  EXECUTE FUNCTION audit_direct_hourmeter_update();

-- Grant permissions
GRANT EXECUTE ON FUNCTION audit_direct_hourmeter_update() TO authenticated;

-- Add RLS policy for hourmeter_history if not exists
-- (Allows admins to insert via trigger)
DO $$
BEGIN
  -- Check if policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'hourmeter_history'
    AND policyname = 'admin_insert_hourmeter_history'
  ) THEN
    CREATE POLICY "admin_insert_hourmeter_history" ON hourmeter_history
      FOR INSERT
      TO authenticated
      WITH CHECK (
        LOWER(get_current_user_role()) IN ('admin', 'admin_service', 'admin_store', 'supervisor')
      );
  END IF;
END $$;

-- Verify the trigger was created
-- SELECT * FROM pg_trigger WHERE tgname = 'trigger_audit_direct_hourmeter_update';

-- Test: Update a forklift's hourmeter and check hourmeter_history
-- UPDATE forklifts SET hourmeter = hourmeter + 1 WHERE forklift_id = 'your-forklift-id';
-- SELECT * FROM hourmeter_history WHERE forklift_id = 'your-forklift-id' ORDER BY recorded_at DESC LIMIT 5;
