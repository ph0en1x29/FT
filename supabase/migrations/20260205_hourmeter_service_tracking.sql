-- =============================================
-- HOURMETER SERVICE TRACKING ENHANCEMENT
-- Date: 2026-02-05
-- Description: Customer feedback implementation
--   - Two hourmeter fields (Last Serviced + Next Target)
--   - Service intervals by forklift type
--   - Stale data tracking
--   - Full Service reset logic
-- =============================================

-- 1. Add service tracking columns to forklifts table
-- =============================================
ALTER TABLE forklifts ADD COLUMN IF NOT EXISTS last_serviced_hourmeter INTEGER;
ALTER TABLE forklifts ADD COLUMN IF NOT EXISTS next_target_service_hour INTEGER;
ALTER TABLE forklifts ADD COLUMN IF NOT EXISTS last_hourmeter_update TIMESTAMPTZ;

-- Add comments for documentation
COMMENT ON COLUMN forklifts.last_serviced_hourmeter IS 'Hourmeter reading when last Full Service was completed';
COMMENT ON COLUMN forklifts.next_target_service_hour IS 'Calculated: last_serviced_hourmeter + service_interval. Auto-updated by trigger.';
COMMENT ON COLUMN forklifts.last_hourmeter_update IS 'Timestamp of last hourmeter reading. Used for stale data detection (>60 days).';

-- 2. Create trigger to auto-calculate next_target_service_hour
-- =============================================
CREATE OR REPLACE FUNCTION update_next_target_service()
RETURNS TRIGGER AS $$
DECLARE
  interval_hours INTEGER;
BEGIN
  -- Validate hourmeter is non-negative
  IF NEW.hourmeter IS NOT NULL AND NEW.hourmeter < 0 THEN
    RAISE EXCEPTION 'Hourmeter reading cannot be negative';
  END IF;
  
  IF NEW.last_serviced_hourmeter IS NOT NULL AND NEW.last_serviced_hourmeter < 0 THEN
    RAISE EXCEPTION 'Last serviced hourmeter cannot be negative';
  END IF;

  -- Calculate next_target on INSERT or when last_serviced_hourmeter changes
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.last_serviced_hourmeter IS DISTINCT FROM OLD.last_serviced_hourmeter) THEN
    IF NEW.last_serviced_hourmeter IS NOT NULL THEN
      -- Get interval based on forklift type, default to 500
      SELECT COALESCE(si.hourmeter_interval, 500) INTO interval_hours
      FROM service_intervals si
      WHERE si.forklift_type = NEW.type 
        AND si.service_type = 'Full Service'
        AND si.is_active = true
      LIMIT 1;
      
      -- Fallback to forklift's own service_interval_hours or default 500
      IF interval_hours IS NULL THEN
        interval_hours := COALESCE(NEW.service_interval_hours, 500);
      END IF;
      
      NEW.next_target_service_hour := NEW.last_serviced_hourmeter + interval_hours;
    END IF;
  END IF;
  
  -- Update last_hourmeter_update when current hourmeter changes
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.hourmeter IS DISTINCT FROM OLD.hourmeter) THEN
    NEW.last_hourmeter_update := NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if exists, then create for both INSERT and UPDATE
DROP TRIGGER IF EXISTS trg_update_next_target ON forklifts;
CREATE TRIGGER trg_update_next_target
BEFORE UPDATE ON forklifts
FOR EACH ROW
EXECUTE FUNCTION update_next_target_service();

DROP TRIGGER IF EXISTS trg_insert_next_target ON forklifts;
CREATE TRIGGER trg_insert_next_target
BEFORE INSERT ON forklifts
FOR EACH ROW
EXECUTE FUNCTION update_next_target_service();

-- 3. Ensure service_intervals table has correct defaults by forklift type
-- =============================================
-- Check if service_intervals table exists, create if not
CREATE TABLE IF NOT EXISTS service_intervals (
  interval_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forklift_type TEXT NOT NULL,
  service_type TEXT NOT NULL,
  hourmeter_interval INTEGER,
  calendar_interval_days INTEGER,
  priority TEXT DEFAULT 'Medium',
  checklist_items JSONB DEFAULT '[]',
  estimated_duration_hours NUMERIC,
  name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(forklift_type, service_type)
);

-- Insert default service intervals by type
INSERT INTO service_intervals (forklift_type, service_type, hourmeter_interval, calendar_interval_days, name, priority)
VALUES 
  ('Diesel', 'Full Service', 500, NULL, 'Diesel Full Service', 'High'),
  ('LPG', 'Full Service', 350, NULL, 'LPG Full Service', 'High'),
  ('Electric', 'Full Service', NULL, 90, 'Electric Full Service', 'High'),
  ('Petrol', 'Full Service', 500, NULL, 'Petrol Full Service', 'High'),
  ('Diesel', 'Minor Service', 250, NULL, 'Diesel Minor Service', 'Medium'),
  ('LPG', 'Minor Service', 175, NULL, 'LPG Minor Service', 'Medium'),
  ('Electric', 'Minor Service', NULL, 45, 'Electric Minor Service', 'Medium'),
  ('Petrol', 'Minor Service', 250, NULL, 'Petrol Minor Service', 'Medium')
ON CONFLICT (forklift_type, service_type) DO UPDATE
SET hourmeter_interval = EXCLUDED.hourmeter_interval,
    calendar_interval_days = EXCLUDED.calendar_interval_days,
    name = EXCLUDED.name;

-- 4. Create settings table if not exists, add daily usage period setting
-- =============================================
CREATE TABLE IF NOT EXISTS app_settings (
  setting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO app_settings (key, value, description)
VALUES ('daily_usage_period_days', '14', 'Number of days for calculating daily hourmeter usage average')
ON CONFLICT (key) DO NOTHING;

-- 5. Create view for fleet overview with service tracking data
-- =============================================
DROP VIEW IF EXISTS fleet_service_overview;
CREATE VIEW fleet_service_overview AS
SELECT 
  f.forklift_id,
  f.serial_number,
  f.make,
  f.model,
  f.type,
  f.status,
  f.hourmeter AS current_hourmeter,
  f.last_serviced_hourmeter,
  f.next_target_service_hour,
  f.service_interval_hours,
  f.last_hourmeter_update,
  f.ownership,
  f.current_customer_id,
  -- Service due calculation
  CASE 
    WHEN f.next_target_service_hour IS NOT NULL AND f.hourmeter >= f.next_target_service_hour THEN true
    ELSE false
  END AS is_service_overdue,
  -- Hours overdue (negative means still has time)
  CASE 
    WHEN f.next_target_service_hour IS NOT NULL THEN f.hourmeter - f.next_target_service_hour
    ELSE NULL
  END AS hours_overdue,
  -- Stale data detection (no update in 60+ days)
  CASE 
    WHEN f.last_hourmeter_update IS NULL THEN true
    WHEN f.last_hourmeter_update < NOW() - INTERVAL '60 days' THEN true
    ELSE false
  END AS is_stale_data,
  -- Days since last update
  CASE 
    WHEN f.last_hourmeter_update IS NOT NULL 
    THEN EXTRACT(DAY FROM NOW() - f.last_hourmeter_update)::INTEGER
    ELSE NULL
  END AS days_since_update
FROM forklifts f
WHERE f.status != 'Inactive';

-- 6. Create function to calculate daily usage from hourmeter history
-- =============================================
CREATE OR REPLACE FUNCTION get_forklift_daily_usage(
  p_forklift_id UUID,
  p_days INTEGER DEFAULT 14
)
RETURNS TABLE (
  avg_daily_hours NUMERIC,
  usage_trend TEXT,
  reading_count INTEGER
) AS $$
DECLARE
  first_reading NUMERIC;
  last_reading NUMERIC;
  first_date TIMESTAMPTZ;
  last_date TIMESTAMPTZ;
  days_diff NUMERIC;
  mid_point_avg NUMERIC;
  recent_avg NUMERIC;
BEGIN
  -- Get readings from the period
  SELECT 
    MIN(reading), MAX(reading),
    MIN(recorded_at), MAX(recorded_at),
    COUNT(*)::INTEGER
  INTO first_reading, last_reading, first_date, last_date, reading_count
  FROM hourmeter_history
  WHERE forklift_id = p_forklift_id
    AND recorded_at >= NOW() - (p_days || ' days')::INTERVAL;
  
  IF reading_count < 2 THEN
    RETURN QUERY SELECT NULL::NUMERIC, 'insufficient_data'::TEXT, reading_count;
    RETURN;
  END IF;
  
  days_diff := GREATEST(EXTRACT(EPOCH FROM (last_date - first_date)) / 86400, 1);
  avg_daily_hours := ROUND((last_reading - first_reading) / days_diff, 1);
  
  -- Determine trend (compare first half vs second half averages)
  -- Simplified: if recent readings are higher rate, trending up
  SELECT AVG(reading) INTO mid_point_avg
  FROM hourmeter_history
  WHERE forklift_id = p_forklift_id
    AND recorded_at >= NOW() - (p_days || ' days')::INTERVAL
    AND recorded_at < NOW() - (p_days / 2 || ' days')::INTERVAL;
    
  SELECT AVG(reading) INTO recent_avg
  FROM hourmeter_history
  WHERE forklift_id = p_forklift_id
    AND recorded_at >= NOW() - (p_days / 2 || ' days')::INTERVAL;
  
  IF recent_avg > mid_point_avg * 1.1 THEN
    usage_trend := 'increasing';
  ELSIF recent_avg < mid_point_avg * 0.9 THEN
    usage_trend := 'decreasing';
  ELSE
    usage_trend := 'stable';
  END IF;
  
  RETURN QUERY SELECT avg_daily_hours, usage_trend, reading_count;
END;
$$ LANGUAGE plpgsql;

-- 7. Create table for logging service upgrade decisions
-- =============================================
CREATE TABLE IF NOT EXISTS service_upgrade_logs (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(job_id),
  forklift_id UUID NOT NULL REFERENCES forklifts(forklift_id),
  technician_id UUID REFERENCES users(user_id),
  technician_name TEXT,
  decision TEXT NOT NULL CHECK (decision IN ('upgraded', 'declined')),
  current_hourmeter INTEGER,
  target_hourmeter INTEGER,
  hours_overdue INTEGER,
  original_job_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for quick lookups
CREATE INDEX IF NOT EXISTS idx_service_upgrade_logs_forklift 
ON service_upgrade_logs(forklift_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_service_upgrade_logs_job
ON service_upgrade_logs(job_id);

-- RLS for service_upgrade_logs
ALTER TABLE service_upgrade_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view service upgrade logs"
ON service_upgrade_logs FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert service upgrade logs"
ON service_upgrade_logs FOR INSERT
TO authenticated
WITH CHECK (true);

-- 8. Function to handle Full Service completion and reset baseline
-- =============================================
CREATE OR REPLACE FUNCTION complete_full_service(
  p_job_id UUID,
  p_hourmeter_reading INTEGER
)
RETURNS void AS $$
DECLARE
  v_forklift_id UUID;
  v_job_type TEXT;
BEGIN
  -- Get job details
  SELECT forklift_id, job_type INTO v_forklift_id, v_job_type
  FROM jobs
  WHERE job_id = p_job_id;
  
  IF v_forklift_id IS NULL THEN
    RAISE EXCEPTION 'Job not found or no forklift assigned';
  END IF;
  
  -- Only update baseline for Full Service jobs
  IF v_job_type = 'Full Service' THEN
    UPDATE forklifts
    SET 
      last_serviced_hourmeter = p_hourmeter_reading,
      hourmeter = p_hourmeter_reading,
      last_service_date = NOW(),
      last_hourmeter_update = NOW()
    WHERE forklift_id = v_forklift_id;
  ELSE
    -- For other job types, just update current hourmeter
    UPDATE forklifts
    SET 
      hourmeter = p_hourmeter_reading,
      last_hourmeter_update = NOW()
    WHERE forklift_id = v_forklift_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 9. Initialize existing forklifts with calculated next_target
-- =============================================
UPDATE forklifts
SET 
  last_hourmeter_update = COALESCE(updated_at, created_at),
  next_target_service_hour = COALESCE(last_serviced_hourmeter, last_service_hourmeter, 0) + COALESCE(service_interval_hours, 500)
WHERE next_target_service_hour IS NULL;

-- Grant permissions
GRANT SELECT ON fleet_service_overview TO authenticated;
GRANT EXECUTE ON FUNCTION get_forklift_daily_usage TO authenticated;
GRANT EXECUTE ON FUNCTION complete_full_service TO authenticated;
