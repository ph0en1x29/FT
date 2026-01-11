-- =============================================
-- Migration: Admin Create User RPC Function
-- Date: 2026-01-10
-- Purpose: Fix RLS violation when admin creates new users
-- =============================================
-- 
-- PROBLEM:
-- When admin calls supabase.auth.signUp(), Supabase switches the session
-- context to the newly created user. The subsequent INSERT into users table
-- then runs as the new user (who has no role), causing RLS violation.
--
-- SOLUTION:
-- Use a SECURITY DEFINER function that checks the caller's role from the
-- users table before inserting. This runs with elevated permissions.
--
-- RUN THIS IN SUPABASE SQL EDITOR
-- =============================================

CREATE OR REPLACE FUNCTION admin_create_user(
    p_auth_id UUID,
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
    v_caller_role TEXT;
BEGIN
    -- Get caller's role from users table using their auth.uid()
    SELECT role INTO v_caller_role
    FROM users
    WHERE auth_id = auth.uid();
    
    -- Check caller is admin
    IF v_caller_role IS NULL OR v_caller_role != 'admin' THEN
        RAISE EXCEPTION 'Only admins can create users';
    END IF;
    
    -- Insert the user
    INSERT INTO users (auth_id, name, email, role, is_active)
    VALUES (p_auth_id, p_name, p_email, p_role, p_is_active)
    RETURNING user_id INTO v_user_id;
    
    RETURN v_user_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION admin_create_user TO authenticated;

-- Add comment
COMMENT ON FUNCTION admin_create_user IS 'Admin-only function to create user records after auth.signUp()';
