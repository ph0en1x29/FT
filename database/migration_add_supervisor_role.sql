-- ============================================
-- FieldPro Migration: Add Supervisor Role
-- Description: Adds 'supervisor' to the users table role constraint
-- Run this in Supabase SQL Editor
-- ============================================

-- =============================================
-- STEP 1: Check current constraint (for debugging)
-- =============================================
-- Run this first to see what constraint exists:
-- SELECT conname, pg_get_constraintdef(oid) 
-- FROM pg_constraint 
-- WHERE conrelid = 'users'::regclass AND contype = 'c';

-- =============================================
-- STEP 2: Drop the existing role check constraint
-- =============================================
-- The constraint name might be different in your database.
-- Common names: users_role_check, chk_users_role, etc.

DO $$ 
DECLARE
    constraint_name TEXT;
BEGIN
    -- Find the constraint name for the role column
    SELECT c.conname INTO constraint_name
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
    WHERE c.conrelid = 'users'::regclass 
    AND c.contype = 'c'
    AND a.attname = 'role';
    
    -- If found, drop it
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE users DROP CONSTRAINT ' || constraint_name;
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
    ELSE
        RAISE NOTICE 'No check constraint found on role column';
    END IF;
END $$;

-- =============================================
-- STEP 3: Add new constraint with supervisor role
-- =============================================
ALTER TABLE users 
ADD CONSTRAINT users_role_check 
CHECK (role IN ('admin', 'supervisor', 'technician', 'accountant'));

-- =============================================
-- STEP 4: Verify the constraint was added
-- =============================================
-- Run this to confirm:
-- SELECT conname, pg_get_constraintdef(oid) 
-- FROM pg_constraint 
-- WHERE conrelid = 'users'::regclass AND contype = 'c';

-- =============================================
-- STEP 5: Update helper functions for supervisor role
-- =============================================

-- Update the get_user_role function if it exists
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role
    FROM users
    WHERE auth_id = auth.uid();
    
    RETURN COALESCE(user_role, 'unknown');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Update is_admin_or_supervisor function
CREATE OR REPLACE FUNCTION is_admin_or_supervisor()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_user_role() IN ('admin', 'supervisor');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Update is_hr_authorized function (admin, supervisor, or accountant)
CREATE OR REPLACE FUNCTION is_hr_authorized()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_user_role() IN ('admin', 'supervisor', 'accountant');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================
-- DONE!
-- =============================================
SELECT 'Supervisor role migration completed successfully!' as status;
