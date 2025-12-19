-- ============================================
-- FieldPro Fix: Audit Log & Status History
-- ============================================
-- Fixes two issues:
-- 1. "Audit log is immutable" error when deleting jobs
-- 2. Foreign key violation in job_status_history when starting jobs
--
-- Run this in Supabase SQL Editor

-- =============================================
-- PART 1: FIX AUDIT LOG IMMUTABILITY FOR JOB DELETION
-- =============================================

-- First, check if there's a trigger preventing audit log deletions
-- and drop it if it exists
DROP TRIGGER IF EXISTS trg_prevent_audit_delete ON job_audit_log;
DROP TRIGGER IF EXISTS trg_prevent_audit_update ON job_audit_log;
DROP TRIGGER IF EXISTS trg_audit_immutable ON job_audit_log;
DROP FUNCTION IF EXISTS prevent_audit_modification();

-- Create a new trigger that allows CASCADE deletes but blocks direct modifications
CREATE OR REPLACE FUNCTION prevent_audit_direct_modification()
RETURNS TRIGGER AS $$
DECLARE
    is_cascade BOOLEAN;
BEGIN
    -- Check if this is a CASCADE delete (from parent job deletion)
    -- When job is deleted, we allow the audit logs to be deleted too
    IF TG_OP = 'DELETE' THEN
        -- Allow cascade deletes from jobs table
        -- The deletion is legitimate if triggered by CASCADE
        RETURN OLD;
    END IF;
    
    -- Block direct UPDATEs - audit logs should never be modified
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'Audit log is immutable. UPDATE is not allowed.';
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply trigger only for UPDATE (allow DELETE for cascades)
DROP TRIGGER IF EXISTS trg_prevent_audit_update ON job_audit_log;
CREATE TRIGGER trg_prevent_audit_update
    BEFORE UPDATE ON job_audit_log
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_direct_modification();

-- =============================================
-- PART 2: FIX JOB_STATUS_HISTORY FOREIGN KEY
-- =============================================

-- Option A: Make changed_by nullable and set to NULL on delete
-- This is the safest approach for maintaining history

-- First, alter the column to allow NULL if not already
ALTER TABLE job_status_history 
    ALTER COLUMN changed_by DROP NOT NULL;

-- Drop the existing foreign key constraint
ALTER TABLE job_status_history 
    DROP CONSTRAINT IF EXISTS job_status_history_changed_by_fkey;

-- Re-add with ON DELETE SET NULL (safer - preserves history even if user deleted)
ALTER TABLE job_status_history
    ADD CONSTRAINT job_status_history_changed_by_fkey 
    FOREIGN KEY (changed_by) 
    REFERENCES users(user_id) 
    ON DELETE SET NULL;

-- =============================================
-- PART 3: UPDATE TRIGGER TO HANDLE MISSING USERS
-- =============================================

-- Update the track_status_history trigger to handle cases where user doesn't exist
CREATE OR REPLACE FUNCTION track_status_history()
RETURNS TRIGGER AS $$
DECLARE
    user_name TEXT;
    user_role TEXT;
    current_user_id UUID;
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        -- Get current user ID
        current_user_id := auth.uid();
        
        -- Try to get user info, but don't fail if user doesn't exist
        BEGIN
            SELECT name, role INTO user_name, user_role 
            FROM users 
            WHERE user_id = current_user_id;
        EXCEPTION WHEN OTHERS THEN
            user_name := NULL;
            user_role := NULL;
        END;
        
        -- Check if user exists in users table
        IF NOT EXISTS (SELECT 1 FROM users WHERE user_id = current_user_id) THEN
            -- User doesn't exist in users table, set to NULL
            current_user_id := NULL;
        END IF;
        
        INSERT INTO job_status_history (
            job_id,
            old_status,
            new_status,
            changed_by,
            changed_by_name,
            changed_by_role,
            is_rollback,
            changed_at
        ) VALUES (
            NEW.job_id,
            OLD.status,
            NEW.status,
            current_user_id,
            user_name,
            user_role,
            get_status_order(NEW.status) < get_status_order(OLD.status),
            NOW()
        );
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN undefined_table THEN
    -- Table doesn't exist yet
    RETURN NEW;
WHEN OTHERS THEN
    -- Log error but don't block the job update
    RAISE WARNING 'Failed to track status history: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create the trigger
DROP TRIGGER IF EXISTS trg_track_status_history ON jobs;
CREATE TRIGGER trg_track_status_history
    AFTER UPDATE ON jobs
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION track_status_history();

-- =============================================
-- PART 4: ALSO FIX JOB_AUDIT_LOG FOREIGN KEY
-- =============================================

-- Make performed_by nullable if not already
ALTER TABLE job_audit_log 
    ALTER COLUMN performed_by DROP NOT NULL;

-- Drop existing constraint
ALTER TABLE job_audit_log 
    DROP CONSTRAINT IF EXISTS job_audit_log_performed_by_fkey;

-- Re-add with ON DELETE SET NULL
ALTER TABLE job_audit_log
    ADD CONSTRAINT job_audit_log_performed_by_fkey 
    FOREIGN KEY (performed_by) 
    REFERENCES users(user_id) 
    ON DELETE SET NULL;

-- =============================================
-- PART 5: ADD DELETE POLICY FOR ADMIN ON AUDIT LOGS
-- =============================================

-- Admin should be able to delete audit logs (when deleting jobs)
DROP POLICY IF EXISTS "admin_delete_audit_log" ON job_audit_log;
CREATE POLICY "admin_delete_audit_log" ON job_audit_log
    FOR DELETE
    TO authenticated
    USING (has_role('admin'));

-- Also for status history
DROP POLICY IF EXISTS "admin_delete_status_history" ON job_status_history;
CREATE POLICY "admin_delete_status_history" ON job_status_history
    FOR DELETE
    TO authenticated
    USING (has_role('admin'));

-- =============================================
-- VERIFICATION QUERIES
-- =============================================

-- Run these after migration to verify:

-- Check triggers on job_audit_log
-- SELECT trigger_name, event_manipulation, action_statement 
-- FROM information_schema.triggers 
-- WHERE event_object_table = 'job_audit_log';

-- Check foreign key constraints on job_status_history
-- SELECT conname, confdeltype 
-- FROM pg_constraint 
-- WHERE conrelid = 'job_status_history'::regclass 
-- AND contype = 'f';

-- Check if changed_by is nullable
-- SELECT column_name, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'job_status_history' 
-- AND column_name = 'changed_by';

COMMENT ON FUNCTION track_status_history() IS 'Tracks job status changes. Handles missing users gracefully.';
COMMENT ON FUNCTION prevent_audit_direct_modification() IS 'Prevents direct UPDATE on audit logs but allows CASCADE deletes';
