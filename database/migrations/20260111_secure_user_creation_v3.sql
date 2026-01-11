-- =============================================
-- Migration: Secure Admin User Creation (v3)
-- Date: 2026-01-11
-- Purpose: Fix privilege escalation vulnerability
-- =============================================
-- 
-- PROBLEM (v2):
-- The RPC trusted caller-supplied admin_user_id without binding to auth.uid().
-- Any authenticated user who knew an admin's user_id could create users.
--
-- SOLUTION (v3):
-- Two-step process with session-bound verification:
-- 1. Admin calls prepare_user_creation() - stores intent tied to auth.uid()
-- 2. Admin calls signUp() - session may or may not switch
-- 3. Admin calls complete_user_creation() - verifies pending intent exists
--
-- The pending_user_creations table ties the creation intent to the ACTUAL
-- authenticated user at the time of preparation, not a caller-supplied ID.
--
-- RUN THIS IN SUPABASE SQL EDITOR
-- =============================================

-- Drop old function
DROP FUNCTION IF EXISTS admin_create_user(UUID, UUID, TEXT, TEXT, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS admin_create_user(UUID, TEXT, TEXT, TEXT, BOOLEAN);

-- Create table for pending user creations
CREATE TABLE IF NOT EXISTS pending_user_creations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    admin_auth_id UUID NOT NULL,  -- The auth.uid() of the admin who initiated
    created_at TIMESTAMPTZ DEFAULT NOW(),
    used_at TIMESTAMPTZ,  -- Set when creation completes
    CONSTRAINT unique_pending_email UNIQUE (email)
);

-- Enable RLS
ALTER TABLE pending_user_creations ENABLE ROW LEVEL SECURITY;

-- Only the system (via SECURITY DEFINER functions) can access this table
-- No direct access policies for users

-- Clean up old pending requests (older than 10 minutes)
CREATE OR REPLACE FUNCTION cleanup_pending_user_creations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    DELETE FROM pending_user_creations 
    WHERE created_at < NOW() - INTERVAL '10 minutes'
       OR used_at IS NOT NULL;
END;
$$;

-- Step 1: Prepare user creation (admin calls this BEFORE signUp)
-- This binds the creation intent to the ACTUAL authenticated user
CREATE OR REPLACE FUNCTION prepare_user_creation(p_email TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_role TEXT;
    v_pending_id UUID;
BEGIN
    -- Verify caller is admin using their ACTUAL auth.uid()
    SELECT role INTO v_admin_role
    FROM users
    WHERE auth_id = auth.uid()
      AND is_active = true;
    
    IF v_admin_role IS NULL OR v_admin_role != 'admin' THEN
        RAISE EXCEPTION 'Only admins can create users';
    END IF;
    
    -- Clean up old pending requests
    PERFORM cleanup_pending_user_creations();
    
    -- Remove any existing pending request for this email
    DELETE FROM pending_user_creations WHERE email = LOWER(p_email);
    
    -- Create pending request tied to this admin's auth.uid()
    INSERT INTO pending_user_creations (email, admin_auth_id)
    VALUES (LOWER(p_email), auth.uid())
    RETURNING id INTO v_pending_id;
    
    RETURN v_pending_id;
END;
$$;

-- Step 2: Complete user creation (admin calls this AFTER signUp)
-- Verifies a valid pending request exists
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
    
    -- Verify the pending request was created by an admin
    -- (Double-check the admin_auth_id still belongs to an active admin)
    IF NOT EXISTS (
        SELECT 1 FROM users 
        WHERE auth_id = v_pending.admin_auth_id 
          AND role = 'admin' 
          AND is_active = true
    ) THEN
        RAISE EXCEPTION 'Original admin no longer authorized';
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION prepare_user_creation(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_user_creation(UUID, UUID, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;

-- Add comments
COMMENT ON FUNCTION prepare_user_creation IS 
'Step 1 of secure user creation. Admin calls this before signUp() to register intent. Returns pending_id.';

COMMENT ON FUNCTION complete_user_creation IS 
'Step 2 of secure user creation. Admin calls this after signUp() with pending_id to complete creation.';

COMMENT ON TABLE pending_user_creations IS 
'Temporary storage for user creation intents. Ties creation to actual admin auth.uid() at request time.';
