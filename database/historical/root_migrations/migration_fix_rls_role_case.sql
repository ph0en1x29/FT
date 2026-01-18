-- ============================================
-- Fix RLS Role Case Sensitivity Issue
-- ============================================
-- Problem: has_role() function uses exact case matching
-- but roles in DB are stored as 'Technician', 'Admin', etc.
-- while RLS policies check for 'technician', 'admin', etc.
--
-- Solution: Make has_role() case-insensitive

-- Update the has_role function to be case-insensitive
CREATE OR REPLACE FUNCTION has_role(required_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN LOWER(get_current_user_role()) = LOWER(required_role);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Update the has_any_role function to be case-insensitive
CREATE OR REPLACE FUNCTION has_any_role(required_roles TEXT[])
RETURNS BOOLEAN AS $$
BEGIN
    RETURN LOWER(get_current_user_role()) = ANY(SELECT LOWER(unnest(required_roles)));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Update the is_admin_or_supervisor function to be case-insensitive
CREATE OR REPLACE FUNCTION is_admin_or_supervisor()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN LOWER(get_current_user_role()) IN ('admin', 'supervisor', 'admin_service', 'admin_store');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Verify the fix works
-- SELECT has_role('technician'); -- Should return true for a Technician user
-- SELECT has_role('TECHNICIAN'); -- Should also return true
-- SELECT has_role('Technician'); -- Should also return true
