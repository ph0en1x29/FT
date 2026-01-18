-- =============================================
-- FIX: Duplicate Service Intervals
-- Date: 2026-01-05
-- Issue: Multiple identical service interval records
-- =============================================

-- Step 1: View duplicates before cleanup (run this first to verify)
-- SELECT 
--   forklift_type,
--   service_type,
--   hourmeter_interval,
--   COUNT(*) as duplicate_count
-- FROM service_intervals
-- WHERE is_active = true
-- GROUP BY forklift_type, service_type, hourmeter_interval
-- HAVING COUNT(*) > 1
-- ORDER BY forklift_type, service_type;

-- Step 2: Delete duplicates, keeping the oldest record (by created_at)
DELETE FROM service_intervals
WHERE interval_id IN (
  SELECT interval_id FROM (
    SELECT 
      interval_id,
      ROW_NUMBER() OVER (
        PARTITION BY forklift_type, service_type, hourmeter_interval 
        ORDER BY created_at ASC
      ) as rn
    FROM service_intervals
    WHERE is_active = true
  ) sub
  WHERE rn > 1
);

-- Step 3: Add unique constraint to prevent future duplicates
-- Only one active interval per (forklift_type, service_type, hourmeter_interval)
DROP INDEX IF EXISTS idx_service_intervals_unique_active;
CREATE UNIQUE INDEX idx_service_intervals_unique_active 
ON service_intervals (forklift_type, service_type, hourmeter_interval) 
WHERE is_active = true;

-- Step 4: Verify cleanup worked
-- SELECT 
--   forklift_type,
--   service_type,
--   hourmeter_interval,
--   name,
--   created_at
-- FROM service_intervals
-- WHERE is_active = true
-- ORDER BY forklift_type, hourmeter_interval;

-- =============================================
-- RESULT: 
-- - Duplicates removed (oldest kept)
-- - Unique index prevents future duplicates
-- - Inserting a duplicate will now fail with:
--   "duplicate key value violates unique constraint"
-- =============================================
