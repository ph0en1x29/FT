-- =============================================
-- FieldPro Migration: Add Jobs Table to Realtime Publication
-- =============================================
-- Fixes Issue: Job assignments not appearing in technician's app in real-time
-- 
-- Root Cause: The `jobs` table was not added to supabase_realtime publication
-- so WebSocket subscriptions for job changes never received events.
--
-- Related to: ACWER Troubleshooting Report (06/01/2025) Issue #3
-- "When admin assigns a request to Technician B, there is no notification,
--  and the job does not appear in Technician B's app"
-- =============================================

-- Enable replica identity for realtime (needed for postgres_changes)
-- FULL means the entire row is sent on UPDATE/DELETE, not just changed columns
ALTER TABLE jobs REPLICA IDENTITY FULL;

-- Add jobs to realtime publication if not already present
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'jobs'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE jobs;
        RAISE NOTICE 'Added jobs table to supabase_realtime publication';
    ELSE
        RAISE NOTICE 'jobs table already in supabase_realtime publication';
    END IF;
EXCEPTION 
    WHEN undefined_object THEN 
        RAISE NOTICE 'supabase_realtime publication does not exist';
    WHEN duplicate_object THEN 
        RAISE NOTICE 'jobs table already in publication (duplicate)';
END $$;

-- =============================================
-- VERIFY: Check what tables are in realtime publication
-- =============================================
SELECT 
    schemaname,
    tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- Expected output should now include:
-- public | jobs
-- public | job_requests  
-- public | notifications

SELECT 'Jobs table added to realtime publication successfully' as status;
