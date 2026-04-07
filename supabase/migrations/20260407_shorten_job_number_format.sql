-- Shorten job_number format from JOB-YYYYMMDD-NNNN (17 chars) to JOB-YYMMDD-NNN (14 chars)
--
-- Why
-- ---
-- Per Jay's feedback after the demo: "shorten to 26 [year], the 4 digit work I don't think
-- it might reach up to 1k jobs so we can simplify that as well." Two-digit year and three-
-- digit per-day sequence (max 999 jobs/day, comfortably above any realistic dispatch volume).
-- Saves 3 characters of horizontal space in the JobBoard list and reduces visual weight on
-- printed reports and customer-facing documents.
--
-- Format change
-- -------------
--   Old: JOB-20260407-0027  (17 chars)
--   New: JOB-260407-028     (14 chars)
--
-- Existing rows
-- -------------
-- This migration only replaces the trigger function. The 29 existing jobs in the live DB
-- (all from 2026-04-06 onwards after today's purge) keep their old 17-char numbers. There is
-- no collision risk because the lengths differ. The list view's column width stays at 180px
-- so both formats render cleanly side-by-side until the old ones age out naturally.
--
-- Sequence semantics preserved
-- ----------------------------
-- Per-day reset (counts jobs created today, +1) is unchanged. The pre-existing race condition
-- in COUNT(*)+1 (two concurrent inserts could collide on the unique constraint) is also
-- unchanged — that's a separate refactor for another day.

CREATE OR REPLACE FUNCTION public.generate_job_number()
RETURNS TRIGGER AS $$
DECLARE
  today_str TEXT;
  seq_num   INT;
BEGIN
  -- Two-digit year + 4-digit MMDD using NOW() AT TIME ZONE 'UTC' for transaction-consistent date
  today_str := TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYMMDD');

  -- Per-day sequence reset, same as before
  SELECT COUNT(*) + 1
    INTO seq_num
    FROM jobs
   WHERE DATE(created_at AT TIME ZONE 'UTC') = DATE(NOW() AT TIME ZONE 'UTC');

  -- 3-digit zero-padded sequence (max 999/day)
  NEW.job_number := 'JOB-' || today_str || '-' || LPAD(seq_num::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
