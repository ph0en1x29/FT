-- ============================================
-- FieldPro RLS Redesign - Step 7: Drop Old Policies
-- ============================================
-- Removes old overpermissive policies
-- Run this AFTER 06_rls_policies.sql
-- Only run this after verifying new policies work correctly!

-- =============================================
-- WARNING: Review before running!
-- This removes ALL existing policies that don't match our new naming convention
-- =============================================

-- Drop old jobs policies (common old names)
DROP POLICY IF EXISTS "Enable read access for all users" ON jobs;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON jobs;
DROP POLICY IF EXISTS "Enable update for all authenticated users" ON jobs;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON jobs;
DROP POLICY IF EXISTS "Users can view their own jobs" ON jobs;
DROP POLICY IF EXISTS "Technicians can view assigned jobs" ON jobs;
DROP POLICY IF EXISTS "Authenticated users can insert jobs" ON jobs;
DROP POLICY IF EXISTS "Authenticated users can update jobs" ON jobs;
DROP POLICY IF EXISTS "jobs_select_policy" ON jobs;
DROP POLICY IF EXISTS "jobs_insert_policy" ON jobs;
DROP POLICY IF EXISTS "jobs_update_policy" ON jobs;
DROP POLICY IF EXISTS "jobs_delete_policy" ON jobs;
DROP POLICY IF EXISTS "all_authenticated_jobs" ON jobs;

-- Drop old customers policies
DROP POLICY IF EXISTS "Enable read access for all users" ON customers;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON customers;
DROP POLICY IF EXISTS "Enable update for all authenticated users" ON customers;
DROP POLICY IF EXISTS "Authenticated users can view customers" ON customers;
DROP POLICY IF EXISTS "Authenticated users can insert customers" ON customers;
DROP POLICY IF EXISTS "Authenticated users can update customers" ON customers;
DROP POLICY IF EXISTS "all_authenticated_customers" ON customers;

-- Drop old forklifts policies
DROP POLICY IF EXISTS "Enable read access for all users" ON forklifts;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON forklifts;
DROP POLICY IF EXISTS "Enable update for all authenticated users" ON forklifts;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON forklifts;
DROP POLICY IF EXISTS "Authenticated users can view forklifts" ON forklifts;
DROP POLICY IF EXISTS "Authenticated users can modify forklifts" ON forklifts;
DROP POLICY IF EXISTS "all_authenticated_forklifts" ON forklifts;
DROP POLICY IF EXISTS "forklifts_public_all" ON forklifts;
DROP POLICY IF EXISTS "Allow read access for authenticated users" ON forklifts;
DROP POLICY IF EXISTS "Allow full access for authenticated users" ON forklifts;

-- Drop old parts/inventory policies
DROP POLICY IF EXISTS "Enable read access for all users" ON parts;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON parts;
DROP POLICY IF EXISTS "Enable update for all authenticated users" ON parts;
DROP POLICY IF EXISTS "Authenticated users can view inventory" ON parts;
DROP POLICY IF EXISTS "Authenticated users can modify inventory" ON parts;
DROP POLICY IF EXISTS "all_authenticated_inventory" ON parts;
DROP POLICY IF EXISTS "all_authenticated_parts" ON parts;

-- Drop old forklift_rentals policies
DROP POLICY IF EXISTS "Enable read access for all users" ON forklift_rentals;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON forklift_rentals;
DROP POLICY IF EXISTS "Enable update for all authenticated users" ON forklift_rentals;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON forklift_rentals;
DROP POLICY IF EXISTS "all_authenticated_rentals" ON forklift_rentals;
DROP POLICY IF EXISTS "forklift_rentals_public_all" ON forklift_rentals;
DROP POLICY IF EXISTS "public_all_forklift_rentals" ON forklift_rentals;

-- Drop old extra_charges policies (old table)
DROP POLICY IF EXISTS "Enable read access for all users" ON extra_charges;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON extra_charges;
DROP POLICY IF EXISTS "Enable update for all authenticated users" ON extra_charges;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON extra_charges;
DROP POLICY IF EXISTS "all_authenticated_extra_charges" ON extra_charges;
DROP POLICY IF EXISTS "extra_charges_public_all" ON extra_charges;

-- Drop old users policies
DROP POLICY IF EXISTS "Enable read access for all users" ON users;
DROP POLICY IF EXISTS "Users can view all users" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "all_authenticated_users" ON users;

-- Drop old job_parts policies
DROP POLICY IF EXISTS "Enable read access for all users" ON job_parts;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON job_parts;
DROP POLICY IF EXISTS "Enable update for all authenticated users" ON job_parts;
DROP POLICY IF EXISTS "all_authenticated_job_parts" ON job_parts;
DROP POLICY IF EXISTS "all_authenticated_parts_used" ON job_parts;

-- Drop old job_media policies
DROP POLICY IF EXISTS "Enable read access for all users" ON job_media;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON job_media;
DROP POLICY IF EXISTS "all_authenticated_job_media" ON job_media;

-- =============================================
-- ENABLE RLS ON ALL TABLES
-- =============================================

-- Ensure RLS is enabled on all tables
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE forklifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE forklift_rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Enable RLS on optional tables if they exist
DO $enable_rls$
BEGIN
    EXECUTE 'ALTER TABLE extra_charges ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN undefined_table THEN NULL;
END $enable_rls$;

DO $enable_rls2$
BEGIN
    EXECUTE 'ALTER TABLE job_parts ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN undefined_table THEN NULL;
END $enable_rls2$;

DO $enable_rls3$
BEGIN
    EXECUTE 'ALTER TABLE job_media ENABLE ROW LEVEL SECURITY';
EXCEPTION WHEN undefined_table THEN NULL;
END $enable_rls3$;

-- =============================================
-- VERIFICATION QUERIES
-- =============================================

-- Run these to verify policies are correct:

-- List all policies on jobs table
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'jobs';

-- List all policies on job_service_records
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'job_service_records';

-- List all policies on job_invoices
-- SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'job_invoices';

-- Check for any remaining public access
-- SELECT tablename, policyname FROM pg_policies WHERE roles @> ARRAY['public']::name[];
