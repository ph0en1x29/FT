-- Add is_pinned_by column to jobs table
-- Stores an array of user IDs who have pinned this job
-- Each user's pin is independent — pinning/unpinning only affects their own view

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS is_pinned_by text[] NOT NULL DEFAULT '{}';

-- Index for fast lookup (used when filtering/sorting pinned jobs per user)
CREATE INDEX IF NOT EXISTS idx_jobs_is_pinned_by ON jobs USING GIN (is_pinned_by);
