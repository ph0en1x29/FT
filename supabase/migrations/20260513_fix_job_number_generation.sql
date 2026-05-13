-- 20260513_fix_job_number_generation.sql
--
-- Problem
-- -------
-- The `generate_job_number()` trigger function uses `COUNT(*) + 1` of jobs
-- created today (UTC) to compute the daily sequence:
--
--   SELECT COUNT(*) + 1 INTO seq_num
--     FROM jobs
--    WHERE DATE(created_at AT TIME ZONE 'UTC') = DATE(NOW() AT TIME ZONE 'UTC');
--
-- This breaks when ANY job from today is deleted. The COUNT drops by 1, but
-- the maximum existing seq does not. The next INSERT generates a sequence
-- number that already exists, producing:
--
--   "duplicate key value violates unique constraint jobs_job_number_key"
--
-- Symptom (2026-05-13 ~08:09 UTC, live DB):
--   After deleting orphan clone JOB-260511-034-D (created today,
--   2026-05-13T01:08:52Z), today's count dropped from 44 → 43. The trigger
--   then tried to generate JOB-260513-044 — which still existed — blocking
--   ALL new job creation. Discovered when a user reported "Failed to
--   create job — duplicate key value violates unique constraint
--   jobs_job_number_key".
--
-- The original 20260407_shorten_job_number_format.sql migration explicitly
-- acknowledged a related (but separate) race condition in COUNT(*)+1:
-- two concurrent inserts could collide. This delete-driven collision is
-- a closely-related class of bug.
--
-- Fix
-- ---
-- Use `MAX(numeric_seq) + 1` extracted from existing job_numbers for
-- today, excluding suffixed clone numbers (JOB-YYMMDD-NNN-B etc.) which
-- aren't part of the regular sequence.
--
-- Why this is safer:
--   - Deletes no longer break the sequence (MAX is a watermark, not a count).
--   - Race conditions between concurrent INSERTs are still possible because
--     two simultaneous SELECTs can both read the same MAX. That class of
--     bug needs an advisory lock or a sequence table — out of scope here.
--     The IMMEDIATE blocker is the delete-driven collision, and MAX+1
--     fixes it.

CREATE OR REPLACE FUNCTION public.generate_job_number()
RETURNS TRIGGER AS $$
DECLARE
  today_str TEXT;
  seq_num   INT;
BEGIN
  today_str := TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYMMDD');

  -- Highest existing sequence for today's prefix (excluding suffixed clones
  -- like JOB-YYMMDD-NNN-B / -C / -D — those follow a separate naming scheme
  -- and must not influence the main sequence).
  SELECT COALESCE(
           MAX(CAST(SPLIT_PART(job_number, '-', 3) AS INTEGER)),
           0
         ) + 1
    INTO seq_num
    FROM jobs
   WHERE job_number ~ ('^JOB-' || today_str || '-[0-9]+$');

  NEW.job_number := 'JOB-' || today_str || '-' || LPAD(seq_num::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Post-apply sanity check: simulated computation matches what the trigger
-- would produce on the next insert, using current live data.
DO $$
DECLARE
  today_str TEXT;
  next_seq  INT;
  proposed  TEXT;
  collision BOOLEAN;
BEGIN
  today_str := TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYMMDD');
  SELECT COALESCE(MAX(CAST(SPLIT_PART(job_number, '-', 3) AS INTEGER)), 0) + 1
    INTO next_seq
    FROM jobs
   WHERE job_number ~ ('^JOB-' || today_str || '-[0-9]+$');
  proposed := 'JOB-' || today_str || '-' || LPAD(next_seq::TEXT, 3, '0');
  SELECT EXISTS (SELECT 1 FROM jobs WHERE job_number = proposed) INTO collision;
  IF collision THEN
    RAISE EXCEPTION 'Sanity check failed: proposed % already exists', proposed;
  END IF;
  RAISE NOTICE 'Next job_number will be % (seq=%, no collision).', proposed, next_seq;
END $$;
