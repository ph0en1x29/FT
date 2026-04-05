-- Replace per-user pin array with shared star flag
-- is_starred: shared attention signal visible to all users
-- Only admins/supervisors and the assigned technician can toggle it

ALTER TABLE jobs DROP COLUMN IF EXISTS is_pinned_by;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_starred boolean NOT NULL DEFAULT false;

-- Partial index — only indexes rows where is_starred = true (small, fast)
CREATE INDEX IF NOT EXISTS idx_jobs_is_starred ON jobs (is_starred) WHERE is_starred = true;
