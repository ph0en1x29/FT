-- ============================================
-- FieldPro RLS Redesign - Step 4: Triggers & Functions
-- ============================================
-- Workflow enforcement, audit logging, locking
-- Run this AFTER 03_data_migration.sql
--
-- IMPORTANT: Uses EXISTING status values:
-- 'New', 'Assigned', 'In Progress', 'Awaiting Finalization', 'Completed'

-- =====================
-- 1. STATUS TRANSITION VALIDATION
-- =====================
-- Enforces strict job status workflow at database level

CREATE OR REPLACE FUNCTION validate_job_status_transition()
RETURNS TRIGGER AS $$
DECLARE
    user_role TEXT;
    current_idx INTEGER;
    new_idx INTEGER;
BEGIN
    -- Get current user's role
    SELECT role INTO user_role FROM users WHERE user_id = auth.uid();
    
    -- Skip validation for system/service role operations
    IF user_role IS NULL THEN
        -- Check if service role
        BEGIN
            IF current_setting('request.jwt.claims', true)::json->>'role' = 'service_role' THEN
                RETURN NEW;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- If we can't get JWT claims, continue with validation
            NULL;
        END;
    END IF;
    
    -- If status hasn't changed, allow
    IF OLD.status = NEW.status OR (TG_OP = 'INSERT') THEN
        RETURN NEW;
    END IF;
    
    -- Get position of old and new status
    -- Status order: New(0) → Assigned(1) → In Progress(2) → Awaiting Finalization(3) → Completed(4)
    current_idx := get_status_order(OLD.status);
    new_idx := get_status_order(NEW.status);
    
    -- Forward transitions
    IF new_idx > current_idx THEN
        -- Must be sequential (only move one step forward, except admin can skip)
        IF new_idx - current_idx > 1 AND user_role != 'admin' THEN
            RAISE EXCEPTION 'Cannot skip status steps. Move from "%" to "%" is not allowed.', OLD.status, NEW.status;
        END IF;
        
        -- Technician can only move: Assigned → In Progress, In Progress → Awaiting Finalization
        IF user_role = 'technician' THEN
            IF NOT (
                (OLD.status = 'Assigned' AND NEW.status = 'In Progress') OR
                (OLD.status = 'In Progress' AND NEW.status = 'Awaiting Finalization')
            ) THEN
                RAISE EXCEPTION 'Technician can only move jobs from Assigned to In Progress, or In Progress to Awaiting Finalization';
            END IF;
        END IF;
        
        -- Accountant can only move: Awaiting Finalization → Completed
        IF user_role = 'accountant' THEN
            IF NOT (OLD.status = 'Awaiting Finalization' AND NEW.status = 'Completed') THEN
                RAISE EXCEPTION 'Accountant can only move jobs from Awaiting Finalization to Completed';
            END IF;
        END IF;
        
        RETURN NEW;
    END IF;
    
    -- Backward transitions: only admin/supervisor allowed
    IF new_idx < current_idx THEN
        IF user_role NOT IN ('admin', 'supervisor') THEN
            RAISE EXCEPTION 'Only admin or supervisor can move jobs backward. User role: %', user_role;
        END IF;
        
        RETURN NEW;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_validate_status_transition ON jobs;
CREATE TRIGGER trg_validate_status_transition
    BEFORE UPDATE ON jobs
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION validate_job_status_transition();

-- =====================
-- 2. COMPLETION REQUIREMENTS VALIDATION
-- =====================
-- Enforces all required fields before allowing Awaiting Finalization status

CREATE OR REPLACE FUNCTION validate_job_completion_requirements()
RETURNS TRIGGER AS $$
DECLARE
    service_record RECORD;
    has_parts BOOLEAN;
    user_role TEXT;
BEGIN
    -- Only validate when moving TO 'Awaiting Finalization' status
    IF NEW.status != 'Awaiting Finalization' OR OLD.status = 'Awaiting Finalization' THEN
        RETURN NEW;
    END IF;
    
    -- Get user role
    SELECT role INTO user_role FROM users WHERE user_id = auth.uid();
    
    -- Admin can bypass (but should use override RPC with reason)
    IF user_role = 'admin' THEN
        RETURN NEW;
    END IF;
    
    -- Get service record
    SELECT * INTO service_record 
    FROM job_service_records 
    WHERE job_id = NEW.job_id;
    
    -- Must have service record
    IF service_record IS NULL THEN
        RAISE EXCEPTION 'Cannot complete job: No service record found. Job must have service data recorded.';
    END IF;
    
    -- Must have started_at
    IF service_record.started_at IS NULL THEN
        RAISE EXCEPTION 'Cannot complete job: Job was never started (started_at is null).';
    END IF;
    
    -- Must have checklist filled (not empty JSON)
    IF service_record.checklist_data IS NULL OR service_record.checklist_data = '{}'::JSONB THEN
        RAISE EXCEPTION 'Cannot complete job: Checklist has not been filled.';
    END IF;
    
    -- Must have service notes OR job_carried_out
    IF (service_record.service_notes IS NULL OR trim(service_record.service_notes) = '') 
       AND (service_record.job_carried_out IS NULL OR trim(service_record.job_carried_out) = '') THEN
        RAISE EXCEPTION 'Cannot complete job: Service notes or job carried out description is required.';
    END IF;
    
    -- Must have parts recorded OR marked as no_parts_used
    has_parts := EXISTS (
        SELECT 1 FROM job_inventory_usage WHERE job_id = NEW.job_id
    );
    -- Also check old job_parts table for backwards compatibility
    IF NOT has_parts THEN
        has_parts := EXISTS (
            SELECT 1 FROM job_parts WHERE job_id = NEW.job_id
        );
    END IF;
    IF NOT has_parts AND NOT COALESCE(service_record.no_parts_used, FALSE) THEN
        RAISE EXCEPTION 'Cannot complete job: Parts must be recorded, or explicitly mark "no parts used".';
    END IF;
    
    -- Must have technician signature
    IF service_record.technician_signature IS NULL THEN
        RAISE EXCEPTION 'Cannot complete job: Technician signature is required.';
    END IF;
    
    -- Must have customer signature
    IF service_record.customer_signature IS NULL THEN
        RAISE EXCEPTION 'Cannot complete job: Customer signature is required.';
    END IF;
    
    -- All validations passed
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_validate_completion ON jobs;
CREATE TRIGGER trg_validate_completion
    BEFORE UPDATE ON jobs
    FOR EACH ROW
    WHEN (NEW.status = 'Awaiting Finalization' AND OLD.status != 'Awaiting Finalization')
    EXECUTE FUNCTION validate_job_completion_requirements();

-- =====================
-- 3. SERVICE RECORD LOCKING ON INVOICE (Completed status)
-- =====================
-- Locks service record when job becomes Completed (invoiced)

CREATE OR REPLACE FUNCTION lock_service_record_on_invoice()
RETURNS TRIGGER AS $$
BEGIN
    -- When job moves to Completed status (invoiced), lock the service record
    IF NEW.status = 'Completed' AND OLD.status != 'Completed' THEN
        UPDATE job_service_records
        SET 
            locked_at = NOW(),
            locked_by = auth.uid(),
            lock_reason = 'Job invoiced/completed'
        WHERE job_id = NEW.job_id
        AND locked_at IS NULL;
        
        -- Also update job locked flag if columns exist
        BEGIN
            NEW.is_locked := TRUE;
            NEW.locked_at := NOW();
            NEW.locked_reason := 'invoiced';
        EXCEPTION WHEN undefined_column THEN
            -- Columns don't exist yet, skip
            NULL;
        END;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_lock_on_invoice ON jobs;
CREATE TRIGGER trg_lock_on_invoice
    BEFORE UPDATE ON jobs
    FOR EACH ROW
    WHEN (NEW.status = 'Completed' AND OLD.status != 'Completed')
    EXECUTE FUNCTION lock_service_record_on_invoice();

-- =====================
-- 4. PREVENT LOCKED SERVICE RECORD EDITS
-- =====================
-- Prevents edits to locked service records except by admin

CREATE OR REPLACE FUNCTION prevent_locked_service_record_edit()
RETURNS TRIGGER AS $$
DECLARE
    user_role TEXT;
BEGIN
    -- Skip if not locked
    IF OLD.locked_at IS NULL THEN
        RETURN NEW;
    END IF;
    
    -- Get user role
    SELECT role INTO user_role FROM users WHERE user_id = auth.uid();
    
    -- Admin can edit (but should use override RPC)
    IF user_role = 'admin' THEN
        RETURN NEW;
    END IF;
    
    -- Block all other edits
    RAISE EXCEPTION 'Service record is locked (since %). Only admin can modify locked records.', OLD.locked_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_locked_edit ON job_service_records;
CREATE TRIGGER trg_prevent_locked_edit
    BEFORE UPDATE ON job_service_records
    FOR EACH ROW
    EXECUTE FUNCTION prevent_locked_service_record_edit();

-- =====================
-- 5. INVENTORY DEDUCTION ON COMPLETION
-- =====================
-- Deducts inventory when job reaches Awaiting Finalization status

CREATE OR REPLACE FUNCTION deduct_inventory_on_completion()
RETURNS TRIGGER AS $$
DECLARE
    usage_record RECORD;
    user_role TEXT;
BEGIN
    -- Only trigger when moving TO Awaiting Finalization
    IF NEW.status != 'Awaiting Finalization' OR OLD.status = 'Awaiting Finalization' THEN
        RETURN NEW;
    END IF;
    
    -- Get user role for override capability
    SELECT role INTO user_role FROM users WHERE user_id = auth.uid();
    
    -- Process each undeducted inventory usage
    FOR usage_record IN 
        SELECT jiu.*, p.stock_quantity, p.part_name as inv_part_name
        FROM job_inventory_usage jiu
        JOIN parts p ON p.part_id = jiu.inventory_item_id
        WHERE jiu.job_id = NEW.job_id
        AND jiu.stock_deducted = FALSE
    LOOP
        -- Check stock availability
        IF usage_record.stock_quantity < usage_record.quantity_used THEN
            -- Admin/Supervisor can override insufficient stock
            IF user_role NOT IN ('admin', 'supervisor') THEN
                RAISE EXCEPTION 'Insufficient stock for part "%". Available: %, Required: %', 
                    usage_record.inv_part_name, 
                    usage_record.stock_quantity, 
                    usage_record.quantity_used;
            END IF;
        END IF;
        
        -- Deduct from parts inventory
        UPDATE parts
        SET 
            stock_quantity = stock_quantity - usage_record.quantity_used,
            updated_at = NOW(),
            last_updated_by = auth.uid()
        WHERE part_id = usage_record.inventory_item_id;
        
        -- Mark usage as deducted
        UPDATE job_inventory_usage
        SET 
            stock_deducted = TRUE,
            deducted_at = NOW(),
            deducted_by = auth.uid()
        WHERE usage_id = usage_record.usage_id;
    END LOOP;
    
    -- Log inventory deduction in audit (if table exists)
    BEGIN
        INSERT INTO job_audit_log (
            job_id,
            event_type,
            event_description,
            new_value,
            performed_by,
            performed_by_role
        )
        SELECT 
            NEW.job_id,
            'inventory_deducted'::audit_event_type,
            'Inventory deducted on job completion',
            jsonb_agg(jsonb_build_object(
                'part_id', inventory_item_id,
                'part_name', part_name,
                'quantity', quantity_used
            )),
            auth.uid(),
            user_role
        FROM job_inventory_usage
        WHERE job_id = NEW.job_id
        AND stock_deducted = TRUE
        HAVING COUNT(*) > 0;
    EXCEPTION WHEN undefined_table THEN
        -- Audit table doesn't exist yet, skip
        NULL;
    END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_deduct_inventory ON jobs;
CREATE TRIGGER trg_deduct_inventory
    AFTER UPDATE ON jobs
    FOR EACH ROW
    WHEN (NEW.status = 'Awaiting Finalization' AND OLD.status != 'Awaiting Finalization')
    EXECUTE FUNCTION deduct_inventory_on_completion();

-- =====================
-- 6. AUDIT LOG TRIGGER FOR JOBS
-- =====================

CREATE OR REPLACE FUNCTION log_job_changes()
RETURNS TRIGGER AS $$
DECLARE
    user_role TEXT;
    user_name TEXT;
    event audit_event_type;
    desc_text TEXT;
BEGIN
    -- Get user info
    SELECT role, name INTO user_role, user_name 
    FROM users WHERE user_id = auth.uid();
    
    -- Determine event type
    IF TG_OP = 'INSERT' THEN
        event := 'job_created';
        desc_text := 'Job created';
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            -- Status change
            IF get_status_order(NEW.status) < get_status_order(OLD.status) THEN
                event := 'status_rollback';
                desc_text := format('Status rolled back from %s to %s', OLD.status, NEW.status);
            ELSE
                event := 'status_changed';
                desc_text := format('Status changed from %s to %s', OLD.status, NEW.status);
            END IF;
        ELSIF OLD.assigned_technician_id IS DISTINCT FROM NEW.assigned_technician_id THEN
            IF OLD.assigned_technician_id IS NULL THEN
                event := 'job_assigned';
                desc_text := format('Job assigned to %s', NEW.assigned_technician_name);
            ELSE
                event := 'job_reassigned';
                desc_text := format('Job reassigned from %s to %s', 
                    OLD.assigned_technician_name, NEW.assigned_technician_name);
            END IF;
        ELSE
            -- Other update, don't log
            RETURN NEW;
        END IF;
    ELSE
        RETURN NEW;
    END IF;
    
    -- Insert audit record
    INSERT INTO job_audit_log (
        job_id,
        event_type,
        event_description,
        old_value,
        new_value,
        performed_by,
        performed_by_name,
        performed_by_role
    ) VALUES (
        COALESCE(NEW.job_id, OLD.job_id),
        event,
        desc_text,
        CASE WHEN TG_OP = 'UPDATE' THEN 
            jsonb_build_object('status', OLD.status, 'technician', OLD.assigned_technician_name)
        ELSE NULL END,
        jsonb_build_object('status', NEW.status, 'technician', NEW.assigned_technician_name),
        auth.uid(),
        user_name,
        user_role
    );
    
    RETURN NEW;
EXCEPTION WHEN undefined_table THEN
    -- Audit table doesn't exist yet, skip
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_audit_job_changes ON jobs;
CREATE TRIGGER trg_audit_job_changes
    AFTER INSERT OR UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION log_job_changes();

-- =====================
-- 7. AUDIT LOG TRIGGER FOR SERVICE RECORDS
-- =====================

CREATE OR REPLACE FUNCTION log_service_record_changes()
RETURNS TRIGGER AS $$
DECLARE
    user_role TEXT;
    user_name TEXT;
    event audit_event_type;
    desc_text TEXT;
BEGIN
    -- Get user info
    SELECT role, name INTO user_role, user_name 
    FROM users WHERE user_id = auth.uid();
    
    IF TG_OP = 'UPDATE' THEN
        -- Check for signature additions
        IF OLD.technician_signature IS NULL AND NEW.technician_signature IS NOT NULL THEN
            event := 'signature_added';
            desc_text := 'Technician signature added';
        ELSIF OLD.customer_signature IS NULL AND NEW.customer_signature IS NOT NULL THEN
            event := 'signature_added';
            desc_text := 'Customer signature added';
        ELSIF OLD.locked_at IS NULL AND NEW.locked_at IS NOT NULL THEN
            event := 'record_locked';
            desc_text := 'Service record locked';
        ELSIF OLD.locked_at IS NOT NULL AND NEW.locked_at IS NULL THEN
            event := 'record_unlocked';
            desc_text := 'Service record unlocked';
        ELSE
            -- Don't log other changes
            RETURN NEW;
        END IF;
        
        -- Insert audit record
        INSERT INTO job_audit_log (
            job_id,
            event_type,
            event_description,
            performed_by,
            performed_by_name,
            performed_by_role
        ) VALUES (
            NEW.job_id,
            event,
            desc_text,
            auth.uid(),
            user_name,
            user_role
        );
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN undefined_table THEN
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_audit_service_record ON job_service_records;
CREATE TRIGGER trg_audit_service_record
    AFTER UPDATE ON job_service_records
    FOR EACH ROW
    EXECUTE FUNCTION log_service_record_changes();

-- =====================
-- 8. AUDIT LOG TRIGGER FOR INVOICES
-- =====================

CREATE OR REPLACE FUNCTION log_invoice_changes()
RETURNS TRIGGER AS $$
DECLARE
    user_role TEXT;
    user_name TEXT;
    event audit_event_type;
    desc_text TEXT;
BEGIN
    -- Get user info
    SELECT role, name INTO user_role, user_name 
    FROM users WHERE user_id = auth.uid();
    
    IF TG_OP = 'INSERT' THEN
        event := 'invoice_created';
        desc_text := 'Invoice created';
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.finalized_at IS NULL AND NEW.finalized_at IS NOT NULL THEN
            event := 'invoice_finalized';
            desc_text := format('Invoice finalized: %s', COALESCE(NEW.invoice_number, 'N/A'));
        ELSIF OLD.sent_at IS NULL AND NEW.sent_at IS NOT NULL THEN
            event := 'invoice_sent';
            desc_text := format('Invoice sent via %s', array_to_string(NEW.sent_via, ', '));
        ELSIF OLD.amount_paid IS DISTINCT FROM NEW.amount_paid THEN
            event := 'payment_recorded';
            desc_text := format('Payment recorded: %s', NEW.amount_paid - COALESCE(OLD.amount_paid, 0));
        ELSE
            RETURN NEW;
        END IF;
    ELSE
        RETURN NEW;
    END IF;
    
    -- Insert audit record
    INSERT INTO job_audit_log (
        job_id,
        event_type,
        event_description,
        new_value,
        performed_by,
        performed_by_name,
        performed_by_role
    ) VALUES (
        NEW.job_id,
        event,
        desc_text,
        jsonb_build_object(
            'invoice_number', NEW.invoice_number,
            'total', NEW.total,
            'amount_paid', NEW.amount_paid
        ),
        auth.uid(),
        user_name,
        user_role
    );
    
    RETURN NEW;
EXCEPTION WHEN undefined_table THEN
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_audit_invoice ON job_invoices;
CREATE TRIGGER trg_audit_invoice
    AFTER INSERT OR UPDATE ON job_invoices
    FOR EACH ROW
    EXECUTE FUNCTION log_invoice_changes();

-- =====================
-- 9. AUTO-CREATE SERVICE RECORD ON ASSIGNMENT
-- =====================
-- Creates a service record when a job is first assigned

CREATE OR REPLACE FUNCTION auto_create_service_record()
RETURNS TRIGGER AS $$
BEGIN
    -- Only when assigning for first time
    IF OLD.assigned_technician_id IS NULL AND NEW.assigned_technician_id IS NOT NULL THEN
        -- Create service record if it doesn't exist
        INSERT INTO job_service_records (
            job_id,
            technician_id,
            created_at,
            updated_at
        )
        VALUES (
            NEW.job_id,
            NEW.assigned_technician_id,
            NOW(),
            NOW()
        )
        ON CONFLICT (job_id) DO UPDATE
        SET technician_id = NEW.assigned_technician_id,
            updated_at = NOW();
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN undefined_table THEN
    -- Table doesn't exist yet
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_service_record ON jobs;
CREATE TRIGGER trg_auto_service_record
    AFTER UPDATE ON jobs
    FOR EACH ROW
    WHEN (OLD.assigned_technician_id IS NULL AND NEW.assigned_technician_id IS NOT NULL)
    EXECUTE FUNCTION auto_create_service_record();

-- =====================
-- 10. SOFT DELETE ENFORCEMENT
-- =====================
-- Prevents hard deletes, enforces soft delete pattern

CREATE OR REPLACE FUNCTION enforce_soft_delete()
RETURNS TRIGGER AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role FROM users WHERE user_id = auth.uid();
    
    -- Only admin can hard delete
    IF user_role != 'admin' THEN
        RAISE EXCEPTION 'Hard delete not allowed. Use soft delete (set deleted_at) instead.';
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only apply to jobs table if we want to enforce soft deletes
-- Uncomment if needed:
-- DROP TRIGGER IF EXISTS trg_enforce_soft_delete ON jobs;
-- CREATE TRIGGER trg_enforce_soft_delete
--     BEFORE DELETE ON jobs
--     FOR EACH ROW
--     EXECUTE FUNCTION enforce_soft_delete();

-- =====================
-- 11. STATUS HISTORY TRACKING
-- =====================

CREATE OR REPLACE FUNCTION track_status_history()
RETURNS TRIGGER AS $$
DECLARE
    user_name TEXT;
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        SELECT name INTO user_name FROM users WHERE user_id = auth.uid();
        
        INSERT INTO job_status_history (
            job_id,
            old_status,
            new_status,
            changed_by,
            changed_by_name,
            changed_at
        ) VALUES (
            NEW.job_id,
            OLD.status,
            NEW.status,
            auth.uid(),
            user_name,
            NOW()
        );
    END IF;
    
    RETURN NEW;
EXCEPTION WHEN undefined_table THEN
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_track_status_history ON jobs;
CREATE TRIGGER trg_track_status_history
    AFTER UPDATE ON jobs
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION track_status_history();

-- =====================
-- COMMENTS
-- =====================

COMMENT ON FUNCTION validate_job_status_transition() IS 'Enforces sequential workflow and role-based status transitions';
COMMENT ON FUNCTION validate_job_completion_requirements() IS 'Ensures all required fields are filled before job completion';
COMMENT ON FUNCTION lock_service_record_on_invoice() IS 'Locks service records when job is invoiced';
COMMENT ON FUNCTION prevent_locked_service_record_edit() IS 'Prevents unauthorized edits to locked records';
COMMENT ON FUNCTION deduct_inventory_on_completion() IS 'Deducts parts from inventory when job is completed';
COMMENT ON FUNCTION log_job_changes() IS 'Creates audit trail for job changes';
COMMENT ON FUNCTION auto_create_service_record() IS 'Auto-creates service record on job assignment';
COMMENT ON FUNCTION track_status_history() IS 'Tracks job status changes over time';
