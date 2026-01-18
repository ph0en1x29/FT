-- =============================================
-- Migration: Admin Create User RPC Function (v2)
-- Date: 2026-01-10
-- Purpose: Fix RLS violation when admin creates new users
-- =============================================
-- 
-- PROBLEM:
-- When admin calls supabase.auth.signUp(), Supabase switches the session
-- context to the newly created user. auth.uid() then returns the NEW user's
-- ID, not the admin's, causing permission checks to fail.
--
-- SOLUTION:
-- 1. Frontend captures admin's user_id BEFORE calling signUp
-- 2. RPC function receives admin_user_id as parameter and verifies their role
-- 3. Function runs with SECURITY DEFINER to bypass RLS for the INSERT
--
-- RUN THIS IN SUPABASE SQL EDITOR
-- =============================================

-- Drop old versions of the function
DROP FUNCTION IF EXISTS admin_create_user(UUID, TEXT, TEXT, TEXT, BOOLEAN);

-- Create new function that accepts admin_user_id parameter
CREATE OR REPLACE FUNCTION admin_create_user(
    p_admin_user_id UUID,      -- The admin's user_id (captured before signUp)
    p_auth_id UUID,            -- The new user's auth_id from signUp
    p_name TEXT,
    p_email TEXT,
    p_role TEXT DEFAULT 'technician',
    p_is_active BOOLEAN DEFAULT TRUE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_admin_role TEXT;
BEGIN
    -- Verify the provided admin_user_id is actually an active admin
    SELECT role INTO v_admin_role
    FROM users
    WHERE user_id = p_admin_user_id
      AND is_active = true;
    
    IF v_admin_role IS NULL OR v_admin_role != 'admin' THEN
        RAISE EXCEPTION 'Only admins can create users';
    END IF;
    
    -- Insert the new user
    INSERT INTO users (auth_id, name, email, role, is_active)
    VALUES (p_auth_id, p_name, p_email, p_role, p_is_active)
    RETURNING user_id INTO v_user_id;
    
    RETURN v_user_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION admin_create_user(UUID, UUID, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION admin_create_user IS 
'Admin-only function to create user records after auth.signUp(). 
Requires admin_user_id parameter because auth.uid() returns wrong user after signUp() switches session.';
