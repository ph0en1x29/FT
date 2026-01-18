-- ============================================
-- FieldPro RLS Redesign - Step 1: Enums and Types
-- ============================================
-- Creates the foundational types for the new security model
-- Run this FIRST before other migration files

-- =====================
-- 1. AUDIT EVENT TYPE ENUM
-- =====================
-- Used for tracking all changes in the audit log

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_event_type') THEN
        CREATE TYPE audit_event_type AS ENUM (
            'job_created',
            'job_assigned',
            'job_reassigned',
            'status_changed',
            'status_rollback',
            'service_started',
            'service_completed',
            'signature_added',
            'parts_added',
            'parts_removed',
            'invoice_created',
            'invoice_finalized',
            'invoice_sent',
            'payment_recorded',
            'admin_override',
            'record_locked',
            'record_unlocked',
            'inventory_deducted',
            'job_cancelled'
        );
    END IF;
END $$;

-- =====================
-- 2. PAYMENT STATUS ENUM
-- =====================

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
        CREATE TYPE payment_status AS ENUM (
            'pending',
            'partial',
            'paid',
            'overdue',
            'refunded'
        );
    END IF;
END $$;

-- =====================
-- 3. HELPER FUNCTIONS FOR ROLE CHECKING
-- =====================
-- These functions make RLS policies cleaner and more maintainable

-- Get current user's role
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role 
    FROM users 
    WHERE user_id = auth.uid();
    RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if current user has a specific role
CREATE OR REPLACE FUNCTION has_role(required_role TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_current_user_role() = required_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if current user has any of the specified roles
CREATE OR REPLACE FUNCTION has_any_role(required_roles TEXT[])
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_current_user_role() = ANY(required_roles);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user is admin or supervisor
CREATE OR REPLACE FUNCTION is_admin_or_supervisor()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_current_user_role() IN ('admin', 'supervisor');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if current user is assigned to a job
CREATE OR REPLACE FUNCTION is_assigned_to_job(job_id_param UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM jobs 
        WHERE job_id = job_id_param 
        AND assigned_technician_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================
-- 4. STATUS HELPER FUNCTIONS
-- =====================
-- Work with EXISTING status values: 'New', 'Assigned', 'In Progress', 'Awaiting Finalization', 'Completed'

-- Get status order for comparison
CREATE OR REPLACE FUNCTION get_status_order(status_val TEXT)
RETURNS INTEGER AS $$
BEGIN
    RETURN CASE status_val
        WHEN 'New' THEN 0
        WHEN 'Assigned' THEN 1
        WHEN 'In Progress' THEN 2
        WHEN 'Awaiting Finalization' THEN 3
        WHEN 'Completed' THEN 4
        ELSE -1
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Check if status transition is forward
CREATE OR REPLACE FUNCTION is_forward_transition(old_status TEXT, new_status TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_status_order(new_status) > get_status_order(old_status);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Check if status transition is backward
CREATE OR REPLACE FUNCTION is_backward_transition(old_status TEXT, new_status TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_status_order(new_status) < get_status_order(old_status);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================
-- COMMENTS
-- =====================

COMMENT ON FUNCTION get_current_user_role() IS 'Returns the role of the currently authenticated user';
COMMENT ON FUNCTION has_role(TEXT) IS 'Checks if the current user has the specified role';
COMMENT ON FUNCTION has_any_role(TEXT[]) IS 'Checks if the current user has any of the specified roles';
COMMENT ON FUNCTION is_admin_or_supervisor() IS 'Checks if the current user is an admin or supervisor';
COMMENT ON FUNCTION is_assigned_to_job(UUID) IS 'Checks if the current user is assigned to the specified job';
COMMENT ON FUNCTION get_status_order(TEXT) IS 'Returns numeric order for job status comparison';
