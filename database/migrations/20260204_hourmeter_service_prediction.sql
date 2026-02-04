-- =============================================
-- Hour Meter Service Prediction System
-- Created: 2026-02-04
-- Purpose: Enable predictive maintenance based on engine hourmeter readings
-- =============================================

-- Step 1: Add service tracking columns to forklifts table
ALTER TABLE forklifts 
ADD COLUMN IF NOT EXISTS last_service_hourmeter NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS service_interval_hours NUMERIC DEFAULT 500;

-- Add comments for documentation
COMMENT ON COLUMN forklifts.last_service_hourmeter IS 'Hourmeter reading recorded after last service completion';
COMMENT ON COLUMN forklifts.service_interval_hours IS 'Hours between scheduled services (default 500)';

-- Step 2: Create hourmeter_readings table for tracking history
CREATE TABLE IF NOT EXISTS hourmeter_readings (
  reading_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  forklift_id UUID NOT NULL REFERENCES forklifts(forklift_id) ON DELETE CASCADE,
  hourmeter_value NUMERIC NOT NULL CHECK (hourmeter_value >= 0),
  reading_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_by_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  recorded_by_name TEXT,
  job_id UUID REFERENCES jobs(job_id) ON DELETE SET NULL,
  is_service_reading BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_hourmeter_readings_forklift 
  ON hourmeter_readings(forklift_id);
CREATE INDEX IF NOT EXISTS idx_hourmeter_readings_date 
  ON hourmeter_readings(forklift_id, reading_date DESC);
CREATE INDEX IF NOT EXISTS idx_hourmeter_readings_service 
  ON hourmeter_readings(forklift_id, is_service_reading) 
  WHERE is_service_reading = TRUE;

-- Comments
COMMENT ON TABLE hourmeter_readings IS 'Tracks hourmeter readings for predictive maintenance calculations';
COMMENT ON COLUMN hourmeter_readings.is_service_reading IS 'True if this reading was taken immediately after a service';

-- Step 3: Enable RLS
ALTER TABLE hourmeter_readings ENABLE ROW LEVEL SECURITY;

-- RLS Policies (permissive for authenticated users)
CREATE POLICY "hourmeter_readings_select_policy" 
  ON hourmeter_readings FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "hourmeter_readings_insert_policy" 
  ON hourmeter_readings FOR INSERT 
  TO authenticated 
  WITH CHECK (true);

CREATE POLICY "hourmeter_readings_update_policy" 
  ON hourmeter_readings FOR UPDATE 
  TO authenticated 
  USING (true);

CREATE POLICY "hourmeter_readings_delete_policy" 
  ON hourmeter_readings FOR DELETE 
  TO authenticated 
  USING (true);

-- Step 4: Function to calculate predicted next service date
CREATE OR REPLACE FUNCTION calculate_predicted_service_date(p_forklift_id UUID)
RETURNS TABLE (
  predicted_date DATE,
  days_remaining INTEGER,
  hours_until_service NUMERIC,
  avg_daily_hours NUMERIC,
  next_service_hourmeter NUMERIC,
  confidence TEXT
) 
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_hourmeter NUMERIC;
  v_last_service_hourmeter NUMERIC;
  v_last_service_date DATE;
  v_service_interval NUMERIC;
  v_hours_used NUMERIC;
  v_days_since_service INTEGER;
  v_avg_daily_hours NUMERIC;
  v_next_service_hourmeter NUMERIC;
  v_hours_until_service NUMERIC;
  v_days_remaining INTEGER;
  v_reading_count INTEGER;
  v_confidence TEXT;
BEGIN
  -- Get forklift data
  SELECT 
    f.hourmeter,
    COALESCE(f.last_service_hourmeter, 0),
    f.last_service_date::DATE,
    COALESCE(f.service_interval_hours, 500)
  INTO 
    v_current_hourmeter,
    v_last_service_hourmeter,
    v_last_service_date,
    v_service_interval
  FROM forklifts f
  WHERE f.forklift_id = p_forklift_id;
  
  -- If no forklift found
  IF v_current_hourmeter IS NULL THEN
    RETURN;
  END IF;
  
  -- Calculate next service hourmeter
  v_next_service_hourmeter := v_last_service_hourmeter + v_service_interval;
  v_hours_until_service := v_next_service_hourmeter - v_current_hourmeter;
  
  -- Count readings for confidence calculation
  SELECT COUNT(*) INTO v_reading_count 
  FROM hourmeter_readings 
  WHERE forklift_id = p_forklift_id 
    AND reading_date > COALESCE(v_last_service_date, '1970-01-01')::TIMESTAMPTZ;
  
  -- Calculate average daily usage from readings
  SELECT 
    CASE 
      WHEN COUNT(*) >= 2 AND MAX(reading_date) > MIN(reading_date) THEN
        (MAX(hourmeter_value) - MIN(hourmeter_value)) / 
        NULLIF(EXTRACT(EPOCH FROM (MAX(reading_date) - MIN(reading_date))) / 86400, 0)
      ELSE NULL
    END
  INTO v_avg_daily_hours
  FROM hourmeter_readings
  WHERE forklift_id = p_forklift_id
    AND reading_date > COALESCE(v_last_service_date, '1970-01-01')::TIMESTAMPTZ;
  
  -- Fallback: calculate from last service if no readings
  IF v_avg_daily_hours IS NULL AND v_last_service_date IS NOT NULL THEN
    v_days_since_service := CURRENT_DATE - v_last_service_date;
    IF v_days_since_service > 0 THEN
      v_hours_used := v_current_hourmeter - v_last_service_hourmeter;
      v_avg_daily_hours := v_hours_used / v_days_since_service;
    END IF;
  END IF;
  
  -- Default fallback: assume 8 hours/day if no data
  IF v_avg_daily_hours IS NULL OR v_avg_daily_hours <= 0 THEN
    v_avg_daily_hours := 8;
    v_confidence := 'low';
  ELSIF v_reading_count < 3 THEN
    v_confidence := 'medium';
  ELSE
    v_confidence := 'high';
  END IF;
  
  -- Calculate days remaining
  v_days_remaining := CEIL(v_hours_until_service / v_avg_daily_hours);
  
  -- Handle overdue case
  IF v_days_remaining < 0 THEN
    v_days_remaining := 0;
  END IF;
  
  RETURN QUERY SELECT 
    (CURRENT_DATE + v_days_remaining)::DATE AS predicted_date,
    v_days_remaining AS days_remaining,
    v_hours_until_service AS hours_until_service,
    ROUND(v_avg_daily_hours, 1) AS avg_daily_hours,
    v_next_service_hourmeter AS next_service_hourmeter,
    v_confidence AS confidence;
END;
$$;

COMMENT ON FUNCTION calculate_predicted_service_date IS 'Calculates predicted next service date based on hourmeter usage patterns';

-- Step 5: Function to update forklift after service completion
CREATE OR REPLACE FUNCTION complete_forklift_service(
  p_forklift_id UUID,
  p_hourmeter_reading NUMERIC,
  p_user_id UUID DEFAULT NULL,
  p_user_name TEXT DEFAULT NULL,
  p_job_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update forklift with new service hourmeter
  UPDATE forklifts
  SET 
    last_service_hourmeter = p_hourmeter_reading,
    last_service_date = CURRENT_DATE,
    hourmeter = p_hourmeter_reading,
    updated_at = NOW()
  WHERE forklift_id = p_forklift_id;
  
  -- Record the service reading
  INSERT INTO hourmeter_readings (
    forklift_id,
    hourmeter_value,
    recorded_by_id,
    recorded_by_name,
    job_id,
    is_service_reading,
    notes
  ) VALUES (
    p_forklift_id,
    p_hourmeter_reading,
    p_user_id,
    p_user_name,
    p_job_id,
    TRUE,
    'Service completed - hourmeter reset point'
  );
END;
$$;

COMMENT ON FUNCTION complete_forklift_service IS 'Updates forklift service tracking after PM completion';

-- Step 6: View for dashboard - forklifts with service predictions
CREATE OR REPLACE VIEW v_forklift_service_predictions AS
SELECT 
  f.forklift_id,
  f.serial_number,
  f.make,
  f.model,
  f.type,
  f.status,
  f.hourmeter AS current_hourmeter,
  f.last_service_hourmeter,
  f.last_service_date,
  f.service_interval_hours,
  f.customer_id,
  f.current_customer_id,
  pred.predicted_date,
  pred.days_remaining,
  pred.hours_until_service,
  pred.avg_daily_hours,
  pred.next_service_hourmeter,
  pred.confidence,
  CASE 
    WHEN pred.days_remaining <= 0 THEN 'overdue'
    WHEN pred.days_remaining <= 7 THEN 'due_soon'
    WHEN pred.days_remaining <= 14 THEN 'upcoming'
    ELSE 'ok'
  END AS service_urgency
FROM forklifts f
LEFT JOIN LATERAL calculate_predicted_service_date(f.forklift_id) pred ON true
WHERE f.type IN ('Diesel', 'LPG', 'Petrol'); -- Only engine-based forklifts

COMMENT ON VIEW v_forklift_service_predictions IS 'Dashboard view showing service predictions for all engine-based forklifts';
