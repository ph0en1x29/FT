-- Migration: Add van selection to jobs
-- Allows technicians to select which van they're using for a job
-- instead of always deducting from their default assigned van.

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_van_stock_id UUID REFERENCES van_stocks(van_stock_id);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_jobs_van_stock_id ON jobs(job_van_stock_id) WHERE job_van_stock_id IS NOT NULL;

COMMENT ON COLUMN jobs.job_van_stock_id IS 'Van stock used for this job. NULL = technician default van.';
