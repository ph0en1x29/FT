-- ============================================
-- Fix Role Case Mismatch in RLS
-- ============================================
-- ISSUE 1: Database stores roles as lowercase ('admin', 'supervisor')
-- but RLS policies compare against Title case ('Admin', 'Supervisor')
--
-- ISSUE 2: get_current_user_role() uses user_id but should use auth_id
-- (user_id is the table PK, auth_id links to auth.users)
--
-- FIX: Update role functions to:
-- 1. Use correct column (auth_id)
-- 2. Return Title case using initcap()
--
-- Run this in Supabase SQL Editor

-- Fix get_my_role() to return Title case
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT initcap(role::text) FROM users WHERE auth_id = (select auth.uid())
$$;

-- Fix get_current_user_role() - use auth_id AND return Title case
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT initcap(role::text) INTO user_role 
    FROM users 
    WHERE auth_id = auth.uid();  -- Changed from user_id to auth_id
    RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Update has_role() to compare with Title case
CREATE OR REPLACE FUNCTION has_role(required_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_current_user_role() = initcap(required_role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Update has_any_role() similarly
CREATE OR REPLACE FUNCTION has_any_role(required_roles TEXT[])
RETURNS BOOLEAN AS $$
DECLARE
    v_current_role TEXT;
    role_to_check TEXT;
BEGIN
    v_current_role := get_current_user_role();
    FOREACH role_to_check IN ARRAY required_roles LOOP
        IF v_current_role = initcap(role_to_check) THEN
            RETURN TRUE;
        END IF;
    END LOOP;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Update is_admin_or_supervisor()
CREATE OR REPLACE FUNCTION is_admin_or_supervisor()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_current_user_role() IN ('Admin', 'Supervisor');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- ============================================
-- VERIFICATION
-- ============================================
-- Test the fix by running:
-- 
-- SELECT 
--   auth.uid() as auth_uid,
--   (SELECT role FROM users WHERE auth_id = auth.uid()) as raw_role,
--   get_my_role() as get_my_role_result,
--   get_current_user_role() as get_current_user_role_result,
--   has_role('admin') as has_admin_role;
--
-- Expected: raw_role = 'admin', get_my_role_result = 'Admin', has_admin_role = true
