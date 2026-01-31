-- =============================================
-- Security Fixes Part 2 - Additional Functions
-- Created: 2026-01-31
-- Author: Phoenix (Clawdbot)
-- 
-- Fixes remaining function search_path issues
-- =============================================

-- 1. is_admin_type
CREATE OR REPLACE FUNCTION public.is_admin_type()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role IN ('Admin', 'admin', 'admin_service', 'admin_store')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- 2. has_role
CREATE OR REPLACE FUNCTION public.has_role(required_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND LOWER(role::TEXT) = LOWER(required_role)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- 3. has_any_role
CREATE OR REPLACE FUNCTION public.has_any_role(required_roles TEXT[])
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND LOWER(role::TEXT) = ANY(SELECT LOWER(unnest(required_roles)))
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- 4. is_admin_or_supervisor (fix the one we just created)
CREATE OR REPLACE FUNCTION public.is_admin_or_supervisor()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role IN ('Admin', 'admin', 'Supervisor', 'supervisor', 'admin_service', 'admin_store')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- 5. is_technician_owner (ensure it has search_path)
CREATE OR REPLACE FUNCTION public.is_technician_owner(tech_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN auth.uid() = tech_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Comments
COMMENT ON FUNCTION public.is_admin_type() IS 'Returns true if current user is any admin type';
COMMENT ON FUNCTION public.has_role(TEXT) IS 'Returns true if current user has the specified role';
COMMENT ON FUNCTION public.has_any_role(TEXT[]) IS 'Returns true if current user has any of the specified roles';
