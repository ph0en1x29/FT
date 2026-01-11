-- =============================================
-- Migration: Secure Admin User Creation (v4) - Caller Binding Fix
-- Date: 2026-01-11
-- Purpose: Fix P1 privilege escalation - bind caller identity to pending request
-- =============================================
--
-- VULNERABILITY (v3):
-- complete_user_creation() verified that the STORED admin_auth_id was still
-- an active admin, but never checked that the CURRENT CALLER (auth.uid())
-- matched that admin_auth_id. Any authenticated user who learned a valid
-- pending_id could hijack the flow and create users under their own auth_id.
--
-- FIX (v4):
-- Add explicit check: auth.uid() MUST equal v_pending.admin_auth_id
-- This ensures only the admin who initiated the request can complete it.
--
-- IDEMPOTENT: Safe to run whether v3 is deployed or not.
--
-- RUN THIS IN SUPABASE SQL EDITOR
-- =============================================

-- Recreate complete_user_creation with caller binding fix
CREATE OR REPLACE FUNCTION complete_user_creation(
    p_pending_id UUID,
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
    v_pending RECORD;
BEGIN
    -- Find the pending request
    SELECT * INTO v_pending
    FROM pending_user_creations
    WHERE id = p_pending_id
      AND email = LOWER(p_email)
      AND used_at IS NULL
      AND created_at > NOW() - INTERVAL '10 minutes';
    
    IF v_pending IS NULL THEN
        RAISE EXCEPTION 'Invalid or expired user creation request';
    END IF;
    
    -- =============================================
    -- V4 FIX: Bind caller identity to pending request
    -- The CURRENT caller must be the same admin who prepared the request
    -- =============================================
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;
    
    IF auth.uid() != v_pending.admin_auth_id THEN
        RAISE EXCEPTION 'Only the admin who initiated this request can complete it';
    END IF;
    
    -- Verify the admin is still active and authorized
    -- (Handles case where admin was deactivated between prepare and complete)
    IF NOT EXISTS (
        SELECT 1 FROM users 
        WHERE auth_id = v_pending.admin_auth_id 
          AND role = 'admin' 
          AND is_active = true
    ) THEN
        RAISE EXCEPTION 'Admin no longer authorized';
    END IF;
    
    -- Mark as used
    UPDATE pending_user_creations 
    SET used_at = NOW() 
    WHERE id = p_pending_id;
    
    -- Insert the new user
    INSERT INTO users (auth_id, name, email, role, is_active)
    VALUES (p_auth_id, p_name, LOWER(p_email), p_role, p_is_active)
    RETURNING user_id INTO v_user_id;
    
    RETURN v_user_id;
END;
$$;

-- Update comment to reflect v4
COMMENT ON FUNCTION complete_user_creation IS 
'Step 2 of secure user creation (v4). Admin calls this after signUp() with pending_id. 
Validates: (1) pending_id exists and not expired, (2) caller is the same admin who prepared, (3) admin still active.';

-- =============================================
-- VERIFICATION QUERY (run after migration):
-- =============================================
-- SELECT prosrc FROM pg_proc WHERE proname = 'complete_user_creation';
-- Should contain: "IF auth.uid() != v_pending.admin_auth_id THEN"
