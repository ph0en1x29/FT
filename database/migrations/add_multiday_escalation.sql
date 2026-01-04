-- Migration: Add Multi-Day Escalation Support (#7)
-- Purpose: Track job cutoff times, overtime status, escalation triggers, and public holidays
-- Date: 2026-01-04
-- Environment: Production-safe, idempotent

-- =============================================================================
-- STEP 1: Add columns to jobs table for multi-day tracking
-- =============================================================================

-- Cutoff time: When technician marked job to continue next day
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS cutoff_time TIMESTAMPTZ;

-- Overtime flag: Saturday OT jobs don't escalate
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_overtime BOOLEAN DEFAULT false;

-- Escalation timestamp: When escalation was triggered (null = not escalated)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS escalation_triggered_at TIMESTAMPTZ;

-- =============================================================================
-- STEP 2: Create public_holidays table for business day calculations
-- =============================================================================

CREATE TABLE IF NOT EXISTS public_holidays (
  holiday_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date DATE NOT NULL UNIQUE,
  name TEXT NOT NULL,
  year INTEGER GENERATED ALWAYS AS (EXTRACT(YEAR FROM holiday_date)) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast date lookups
CREATE INDEX IF NOT EXISTS idx_public_holidays_date ON public_holidays(holiday_date);
CREATE INDEX IF NOT EXISTS idx_public_holidays_year ON public_holidays(year);

-- =============================================================================
-- STEP 3: Create index for escalation queue scans
-- =============================================================================

-- Index jobs that need escalation checking (not yet escalated, active status)
CREATE INDEX IF NOT EXISTS idx_jobs_pending_escalation ON jobs(escalation_triggered_at) 
WHERE escalation_triggered_at IS NULL 
  AND status IN ('Assigned', 'In Progress');

-- =============================================================================
-- STEP 4: Seed Malaysian Public Holidays 2025-2026
-- =============================================================================

INSERT INTO public_holidays (holiday_date, name) VALUES
  -- 2025
  ('2025-01-01', 'New Year''s Day'),
  ('2025-01-29', 'Thaipusam'),
  ('2025-01-30', 'Chinese New Year'),
  ('2025-01-31', 'Chinese New Year (Day 2)'),
  ('2025-03-30', 'Hari Raya Aidilfitri'),
  ('2025-03-31', 'Hari Raya Aidilfitri (Day 2)'),
  ('2025-05-01', 'Labour Day'),
  ('2025-05-12', 'Wesak Day'),
  ('2025-06-02', 'Agong''s Birthday'),
  ('2025-06-06', 'Hari Raya Haji'),
  ('2025-06-27', 'Awal Muharram'),
  ('2025-08-31', 'Merdeka Day'),
  ('2025-09-05', 'Maulidur Rasul'),
  ('2025-09-16', 'Malaysia Day'),
  ('2025-10-20', 'Deepavali'),
  ('2025-12-25', 'Christmas'),
  -- 2026
  ('2026-01-01', 'New Year''s Day'),
  ('2026-01-17', 'Thaipusam'),
  ('2026-02-17', 'Chinese New Year'),
  ('2026-02-18', 'Chinese New Year (Day 2)'),
  ('2026-03-20', 'Hari Raya Aidilfitri'),
  ('2026-03-21', 'Hari Raya Aidilfitri (Day 2)'),
  ('2026-05-01', 'Labour Day / Wesak Day'),
  ('2026-05-27', 'Hari Raya Haji'),
  ('2026-06-01', 'Agong''s Birthday'),
  ('2026-06-17', 'Awal Muharram'),
  ('2026-08-26', 'Maulidur Rasul'),
  ('2026-08-31', 'Merdeka Day'),
  ('2026-09-16', 'Malaysia Day'),
  ('2026-11-08', 'Deepavali'),
  ('2026-12-25', 'Christmas')
ON CONFLICT (holiday_date) DO NOTHING;

-- =============================================================================
-- STEP 5: Add app_settings entry for deferred acknowledgement SLA
-- =============================================================================

-- Create app_settings table if not exists
CREATE TABLE IF NOT EXISTS app_settings (
  setting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES users(user_id)
);

-- Insert default SLA setting
INSERT INTO app_settings (key, value, description) VALUES
  ('deferred_ack_sla_days', '5', 'Number of business days for customer to acknowledge deferred completion')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- STEP 6: RLS for public_holidays (read-only for all authenticated)
-- =============================================================================

ALTER TABLE public_holidays ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'public_holidays_read_all' AND tablename = 'public_holidays'
  ) THEN
    CREATE POLICY public_holidays_read_all ON public_holidays
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- Admin-only write access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'public_holidays_admin_write' AND tablename = 'public_holidays'
  ) THEN
    CREATE POLICY public_holidays_admin_write ON public_holidays
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users 
          WHERE users.auth_id = auth.uid() 
          AND users.role = 'admin'
        )
      );
  END IF;
END $$;

-- =============================================================================
-- STEP 7: RLS for app_settings
-- =============================================================================

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'app_settings_read_all' AND tablename = 'app_settings'
  ) THEN
    CREATE POLICY app_settings_read_all ON app_settings
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'app_settings_admin_write' AND tablename = 'app_settings'
  ) THEN
    CREATE POLICY app_settings_admin_write ON app_settings
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users 
          WHERE users.auth_id = auth.uid() 
          AND users.role = 'admin'
        )
      );
  END IF;
END $$;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- Check columns added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'jobs' 
AND column_name IN ('cutoff_time', 'is_overtime', 'escalation_triggered_at');

-- Check holidays count
SELECT COUNT(*) as holiday_count FROM public_holidays;

-- Check settings
SELECT * FROM app_settings WHERE key = 'deferred_ack_sla_days';
