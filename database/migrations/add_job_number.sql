-- Migration: Add auto-generated job_number to jobs table
-- Format: JOB-YYYYMMDD-XXXX (zero-padded 4 digits, sequential per day)

-- 1. Add job_number column (nullable, unique)
ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS job_number VARCHAR(20) UNIQUE;

-- 2. Function to generate next job_number for today
CREATE OR REPLACE FUNCTION generate_job_number()
RETURNS TRIGGER AS $$
DECLARE
  today_str TEXT;
  seq_num   INT;
BEGIN
  -- Get today's date in YYYYMMDD format (using NOW() so it's consistent per transaction)
  today_str := TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYYMMDD');

  -- Count jobs created today (including this new one being inserted, minus 1 since it's BEFORE INSERT)
  SELECT COUNT(*) + 1
    INTO seq_num
    FROM jobs
   WHERE DATE(created_at AT TIME ZONE 'UTC') = DATE(NOW() AT TIME ZONE 'UTC');

  NEW.job_number := 'JOB-' || today_str || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. BEFORE INSERT trigger to auto-assign job_number
DROP TRIGGER IF EXISTS trg_generate_job_number ON jobs;
CREATE TRIGGER trg_generate_job_number
  BEFORE INSERT ON jobs
  FOR EACH ROW
  WHEN (NEW.job_number IS NULL)
  EXECUTE FUNCTION generate_job_number();

-- 4. Backfill existing jobs: assign job_number based on created_at date and row order per day
WITH ordered AS (
  SELECT
    job_id,
    TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYYMMDD') AS day_str,
    ROW_NUMBER() OVER (
      PARTITION BY DATE(created_at AT TIME ZONE 'UTC')
      ORDER BY created_at ASC, job_id ASC
    ) AS seq
  FROM jobs
  WHERE job_number IS NULL
)
UPDATE jobs j
   SET job_number = 'JOB-' || o.day_str || '-' || LPAD(o.seq::TEXT, 4, '0')
  FROM ordered o
 WHERE j.job_id = o.job_id;
