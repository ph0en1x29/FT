-- =============================================
-- FieldPro Migration: Performance Indexes
-- =============================================
-- Date: 2026-01-29
-- Purpose: Add indexes for frequently queried columns to improve performance
-- =============================================

-- Jobs table indexes
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_assigned_tech ON jobs(assigned_technician_id);
CREATE INDEX IF NOT EXISTS idx_jobs_customer ON jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_forklift ON jobs(forklift_id);
CREATE INDEX IF NOT EXISTS idx_jobs_created_desc ON jobs(created_at DESC);

-- Composite index for technician job queries (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_jobs_tech_status ON jobs(assigned_technician_id, status);

-- Notifications indexes (for unread badge - very frequent)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
  ON notifications(user_id, is_read) 
  WHERE is_read = false;

-- Job media index (for photo loading)
CREATE INDEX IF NOT EXISTS idx_job_media_job ON job_media(job_id);

-- Forklifts indexes
CREATE INDEX IF NOT EXISTS idx_forklifts_status ON forklifts(status);
CREATE INDEX IF NOT EXISTS idx_forklifts_customer ON forklifts(current_customer_id);

-- Customers index
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

-- Parts index (if part_number column exists)
-- CREATE INDEX IF NOT EXISTS idx_parts_number ON parts(part_number);

-- Job parts index
CREATE INDEX IF NOT EXISTS idx_job_parts_job ON job_parts(job_id);

-- Verify indexes created
SELECT 
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
