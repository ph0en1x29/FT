-- =============================================
-- FIX: Function Search Path Warnings
-- Date: 2026-01-05
-- Issues: 3 functions missing search_path setting
-- =============================================

-- Fix: update_job_assignments_updated_at
CREATE OR REPLACE FUNCTION update_job_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Fix: update_user_timestamp
CREATE OR REPLACE FUNCTION update_user_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Fix: update_job_requests_updated_at
CREATE OR REPLACE FUNCTION update_job_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- =============================================
-- MANUAL ACTION REQUIRED (Supabase Dashboard):
-- =============================================
-- Enable Leaked Password Protection:
-- 1. Go to Supabase Dashboard
-- 2. Authentication → Settings
-- 3. Enable "Leaked Password Protection"
-- =============================================
