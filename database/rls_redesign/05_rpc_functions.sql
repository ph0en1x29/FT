-- ============================================
-- FieldPro RLS Redesign - Step 5: RPC Functions
-- ============================================
-- Helper functions for workflow operations
-- Run this AFTER 04_triggers_and_functions.sql
--
-- IMPORTANT: Uses EXISTING status values:
-- 'New', 'Assigned', 'In Progress', 'Awaiting Finalization', 'Completed'

-- =====================
-- 1. START JOB RPC
-- =====================
-- Technician starts working on an assigned job

CREATE OR REPLACE FUNCTION start_job(
    p_job_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_job RECORD;
    v_user_role TEXT;
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    SELECT role INTO v_user_role FROM users WHERE user_id = v_user_id;
    
    -- Get job
    SELECT * INTO v_job FROM jobs WHERE job_id = p_job_id;
    
    IF v_job IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Job not found');
    END IF;
    
    -- Validate status
    IF v_job.status != 'Assigned' THEN
        RETURN jsonb_build_object('success', false, 'error', 
            format('Job must be in Assigned status to start. Current: %s', v_job.status));
    END IF;
    
    -- Validate user is assigned or admin/supervisor
    IF v_user_role = 'technician' AND v_job.assigned_technician_id != v_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'You are not assigned to this job');
    END IF;
    
    -- Update job
    UPDATE jobs
    SET 
        status = 'In Progress',
        started_at = NOW(),
        started_by_id = v_user_id,
        started_by_name = (SELECT name FROM users WHERE user_id = v_user_id),
        arrival_time = NOW()
    WHERE job_id = p_job_id;
    
    -- Update service record
    UPDATE job_service_records
    SET 
        started_at = NOW(),
        updated_at = NOW()
    WHERE job_id = p_job_id;
    
    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Job started successfully',
        'job_id', p_job_id,
        'new_status', 'In Progress'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================
-- 2. COMPLETE JOB RPC
-- =====================
-- Technician submits job for finalization

CREATE OR REPLACE FUNCTION complete_job(
    p_job_id UUID,
    p_force BOOLEAN DEFAULT FALSE
)
RETURNS JSONB AS $$
DECLARE
    v_job RECORD;
    v_service_record RECORD;
    v_user_role TEXT;
    v_user_id UUID;
    v_missing_fields TEXT[];
    v_has_parts BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    SELECT role INTO v_user_role FROM users WHERE user_id = v_user_id;
    
    -- Get job
    SELECT * INTO v_job FROM jobs WHERE job_id = p_job_id;
    
    IF v_job IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Job not found');
    END IF;
    
    -- Validate status
    IF v_job.status != 'In Progress' THEN
        RETURN jsonb_build_object('success', false, 'error', 
            format('Job must be In Progress to complete. Current: %s', v_job.status));
    END IF;
    
    -- Validate user
    IF v_user_role = 'technician' AND v_job.assigned_technician_id != v_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'You are not assigned to this job');
    END IF;
    
    -- Get service record
    SELECT * INTO v_service_record 
    FROM job_service_records 
    WHERE job_id = p_job_id;
    
    -- Check completion requirements (unless force and admin)
    v_missing_fields := ARRAY[]::TEXT[];
    
    IF v_service_record IS NULL THEN
        v_missing_fields := array_append(v_missing_fields, 'service_record');
    ELSE
        IF v_service_record.started_at IS NULL THEN
            v_missing_fields := array_append(v_missing_fields, 'started_at');
        END IF;
        
        IF v_service_record.checklist_data IS NULL OR v_service_record.checklist_data = '{}'::JSONB THEN
            v_missing_fields := array_append(v_missing_fields, 'checklist');
        END IF;
        
        IF (v_service_record.service_notes IS NULL OR trim(v_service_record.service_notes) = '')
           AND (v_service_record.job_carried_out IS NULL OR trim(v_service_record.job_carried_out) = '') THEN
            v_missing_fields := array_append(v_missing_fields, 'service_notes');
        END IF;
        
        -- Check parts
        v_has_parts := EXISTS (SELECT 1 FROM job_inventory_usage WHERE job_id = p_job_id)
                    OR EXISTS (SELECT 1 FROM job_parts WHERE job_id = p_job_id);
        IF NOT v_has_parts AND NOT COALESCE(v_service_record.no_parts_used, FALSE) THEN
            v_missing_fields := array_append(v_missing_fields, 'parts_used');
        END IF;
        
        IF v_service_record.technician_signature IS NULL THEN
            v_missing_fields := array_append(v_missing_fields, 'technician_signature');
        END IF;
        
        IF v_service_record.customer_signature IS NULL THEN
            v_missing_fields := array_append(v_missing_fields, 'customer_signature');
        END IF;
    END IF;
    
    -- If missing fields and not forcing
    IF array_length(v_missing_fields, 1) > 0 THEN
        IF p_force AND v_user_role = 'admin' THEN
            -- Admin override - continue
            NULL;
        ELSE
            RETURN jsonb_build_object(
                'success', false, 
                'error', 'Missing required fields',
                'missing_fields', v_missing_fields
            );
        END IF;
    END IF;
    
    -- Update job
    UPDATE jobs
    SET 
        status = 'Awaiting Finalization',
        completed_at = NOW(),
        completed_by_id = v_user_id,
        completed_by_name = (SELECT name FROM users WHERE user_id = v_user_id),
        completion_time = NOW(),
        repair_end_time = COALESCE(repair_end_time, NOW())
    WHERE job_id = p_job_id;
    
    -- Update service record
    UPDATE job_service_records
    SET 
        completed_at = NOW(),
        updated_at = NOW()
    WHERE job_id = p_job_id;
    
    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Job submitted for finalization',
        'job_id', p_job_id,
        'new_status', 'Awaiting Finalization'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================
-- 3. FINALIZE INVOICE RPC
-- =====================
-- Accountant finalizes the invoice

CREATE OR REPLACE FUNCTION finalize_invoice(
    p_job_id UUID,
    p_invoice_number TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_job RECORD;
    v_user_role TEXT;
    v_user_id UUID;
    v_user_name TEXT;
    v_invoice_id UUID;
    v_invoice_number TEXT;
BEGIN
    v_user_id := auth.uid();
    SELECT role, name INTO v_user_role, v_user_name FROM users WHERE user_id = v_user_id;
    
    -- Only accountant or admin can finalize
    IF v_user_role NOT IN ('accountant', 'admin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only accountant or admin can finalize invoices');
    END IF;
    
    -- Get job
    SELECT * INTO v_job FROM jobs WHERE job_id = p_job_id;
    
    IF v_job IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Job not found');
    END IF;
    
    -- Validate status
    IF v_job.status != 'Awaiting Finalization' THEN
        RETURN jsonb_build_object('success', false, 'error', 
            format('Job must be Awaiting Finalization to invoice. Current: %s', v_job.status));
    END IF;
    
    -- Generate invoice number if not provided
    v_invoice_number := p_invoice_number;
    IF v_invoice_number IS NULL THEN
        SELECT 'INV-' || TO_CHAR(NOW(), 'YYYY') || '-' || 
               LPAD((COUNT(*) + 1)::TEXT, 4, '0')
        INTO v_invoice_number
        FROM job_invoices
        WHERE invoice_number LIKE 'INV-' || TO_CHAR(NOW(), 'YYYY') || '-%';
    END IF;
    
    -- Create or update invoice
    INSERT INTO job_invoices (
        job_id,
        invoice_number,
        finalized_at,
        finalized_by,
        finalized_by_name,
        prepared_by,
        prepared_by_name,
        created_at,
        updated_at
    )
    VALUES (
        p_job_id,
        v_invoice_number,
        NOW(),
        v_user_id,
        v_user_name,
        v_user_id,
        v_user_name,
        NOW(),
        NOW()
    )
    ON CONFLICT (job_id) DO UPDATE
    SET 
        invoice_number = COALESCE(EXCLUDED.invoice_number, job_invoices.invoice_number),
        finalized_at = NOW(),
        finalized_by = v_user_id,
        finalized_by_name = v_user_name,
        updated_at = NOW()
    RETURNING invoice_id INTO v_invoice_id;
    
    -- Update job status to Completed
    UPDATE jobs
    SET 
        status = 'Completed',
        invoiced_at = NOW(),
        invoiced_by_id = v_user_id,
        invoiced_by_name = v_user_name
    WHERE job_id = p_job_id;
    
    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Invoice finalized successfully',
        'job_id', p_job_id,
        'invoice_id', v_invoice_id,
        'invoice_number', v_invoice_number,
        'new_status', 'Completed'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================
-- 4. ADMIN OVERRIDE LOCK RPC
-- =====================
-- Admin can unlock records with a reason

CREATE OR REPLACE FUNCTION admin_override_lock(
    p_job_id UUID,
    p_reason TEXT,
    p_action TEXT DEFAULT 'unlock' -- 'unlock', 'rollback_status', 'edit_service', 'edit_invoice'
)
RETURNS JSONB AS $$
DECLARE
    v_user_role TEXT;
    v_user_id UUID;
    v_user_name TEXT;
BEGIN
    v_user_id := auth.uid();
    SELECT role, name INTO v_user_role, v_user_name FROM users WHERE user_id = v_user_id;
    
    -- Only admin can override
    IF v_user_role != 'admin' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only admin can override locks');
    END IF;
    
    -- Require reason
    IF p_reason IS NULL OR trim(p_reason) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Reason is required for admin override');
    END IF;
    
    -- Log the override
    INSERT INTO job_audit_log (
        job_id,
        event_type,
        event_description,
        new_value,
        performed_by,
        performed_by_name,
        performed_by_role
    ) VALUES (
        p_job_id,
        'admin_override'::audit_event_type,
        format('Admin override: %s', p_action),
        jsonb_build_object('action', p_action, 'reason', p_reason),
        v_user_id,
        v_user_name,
        v_user_role
    );
    
    -- Perform action
    CASE p_action
        WHEN 'unlock' THEN
            -- Unlock service record
            UPDATE job_service_records
            SET locked_at = NULL, locked_by = NULL, lock_reason = NULL
            WHERE job_id = p_job_id;
            
            -- Unlock invoice
            UPDATE job_invoices
            SET locked_at = NULL
            WHERE job_id = p_job_id;
            
        WHEN 'rollback_status' THEN
            -- Unlock and rollback to Awaiting Finalization
            UPDATE job_service_records
            SET locked_at = NULL, locked_by = NULL, lock_reason = NULL
            WHERE job_id = p_job_id;
            
            UPDATE job_invoices
            SET locked_at = NULL, finalized_at = NULL
            WHERE job_id = p_job_id;
            
            UPDATE jobs
            SET 
                status = 'Awaiting Finalization',
                invoiced_at = NULL,
                invoiced_by_id = NULL,
                invoiced_by_name = NULL
            WHERE job_id = p_job_id;
            
        WHEN 'edit_service' THEN
            -- Temporarily unlock service record
            UPDATE job_service_records
            SET locked_at = NULL, lock_reason = format('Unlocked by admin: %s', p_reason)
            WHERE job_id = p_job_id;
            
        WHEN 'edit_invoice' THEN
            -- Temporarily unlock invoice
            UPDATE job_invoices
            SET locked_at = NULL
            WHERE job_id = p_job_id;
            
        ELSE
            RETURN jsonb_build_object('success', false, 'error', 'Invalid action');
    END CASE;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', format('Admin override successful: %s', p_action),
        'job_id', p_job_id,
        'action', p_action,
        'reason', p_reason
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================
-- 5. CANCEL JOB RPC
-- =====================
-- Admin/Supervisor can cancel jobs in New/Assigned status

CREATE OR REPLACE FUNCTION cancel_job(
    p_job_id UUID,
    p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_job RECORD;
    v_user_role TEXT;
    v_user_id UUID;
    v_user_name TEXT;
BEGIN
    v_user_id := auth.uid();
    SELECT role, name INTO v_user_role, v_user_name FROM users WHERE user_id = v_user_id;
    
    -- Only admin/supervisor can cancel
    IF v_user_role NOT IN ('admin', 'supervisor') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only admin or supervisor can cancel jobs');
    END IF;
    
    -- Get job
    SELECT * INTO v_job FROM jobs WHERE job_id = p_job_id;
    
    IF v_job IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Job not found');
    END IF;
    
    -- Can only cancel New or Assigned jobs
    IF v_job.status NOT IN ('New', 'Assigned') THEN
        RETURN jsonb_build_object('success', false, 'error', 
            format('Can only cancel jobs in New or Assigned status. Current: %s', v_job.status));
    END IF;
    
    -- Require reason
    IF p_reason IS NULL OR trim(p_reason) = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Reason is required for cancellation');
    END IF;
    
    -- Soft delete the job
    UPDATE jobs
    SET 
        deleted_at = NOW(),
        deleted_by = v_user_id
    WHERE job_id = p_job_id;
    
    -- Log cancellation
    INSERT INTO job_audit_log (
        job_id,
        event_type,
        event_description,
        new_value,
        performed_by,
        performed_by_name,
        performed_by_role
    ) VALUES (
        p_job_id,
        'job_cancelled'::audit_event_type,
        'Job cancelled',
        jsonb_build_object('reason', p_reason, 'previous_status', v_job.status),
        v_user_id,
        v_user_name,
        v_user_role
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Job cancelled successfully',
        'job_id', p_job_id,
        'reason', p_reason
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================
-- 6. RECORD PAYMENT RPC
-- =====================
-- Record payment against an invoice

CREATE OR REPLACE FUNCTION record_payment(
    p_job_id UUID,
    p_amount DECIMAL,
    p_payment_method TEXT DEFAULT 'cash',
    p_reference TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_job RECORD;
    v_invoice RECORD;
    v_user_role TEXT;
    v_user_id UUID;
    v_user_name TEXT;
    v_new_amount_paid DECIMAL;
    v_new_status payment_status;
BEGIN
    v_user_id := auth.uid();
    SELECT role, name INTO v_user_role, v_user_name FROM users WHERE user_id = v_user_id;
    
    -- Only accountant or admin can record payments
    IF v_user_role NOT IN ('accountant', 'admin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only accountant or admin can record payments');
    END IF;
    
    -- Get job and invoice
    SELECT * INTO v_job FROM jobs WHERE job_id = p_job_id;
    SELECT * INTO v_invoice FROM job_invoices WHERE job_id = p_job_id;
    
    IF v_job IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Job not found');
    END IF;
    
    IF v_invoice IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
    END IF;
    
    -- Job must be Completed (invoiced)
    IF v_job.status != 'Completed' THEN
        RETURN jsonb_build_object('success', false, 'error', 
            format('Job must be Completed to record payment. Current: %s', v_job.status));
    END IF;
    
    -- Calculate new amount
    v_new_amount_paid := COALESCE(v_invoice.amount_paid, 0) + p_amount;
    
    -- Determine payment status
    IF v_new_amount_paid >= COALESCE(v_invoice.total, 0) THEN
        v_new_status := 'paid';
    ELSIF v_new_amount_paid > 0 THEN
        v_new_status := 'partial';
    ELSE
        v_new_status := 'pending';
    END IF;
    
    -- Update invoice
    UPDATE job_invoices
    SET 
        amount_paid = v_new_amount_paid,
        payment_status = v_new_status,
        last_payment_at = NOW(),
        last_payment_method = p_payment_method,
        last_payment_reference = p_reference,
        updated_at = NOW()
    WHERE job_id = p_job_id;
    
    -- Log payment
    INSERT INTO job_audit_log (
        job_id,
        event_type,
        event_description,
        new_value,
        performed_by,
        performed_by_name,
        performed_by_role
    ) VALUES (
        p_job_id,
        'payment_recorded'::audit_event_type,
        format('Payment recorded: %s', p_amount),
        jsonb_build_object(
            'amount', p_amount,
            'method', p_payment_method,
            'reference', p_reference,
            'total_paid', v_new_amount_paid,
            'status', v_new_status
        ),
        v_user_id,
        v_user_name,
        v_user_role
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Payment recorded successfully',
        'job_id', p_job_id,
        'amount', p_amount,
        'total_paid', v_new_amount_paid,
        'payment_status', v_new_status
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================
-- GRANT EXECUTE PERMISSIONS
-- =====================

GRANT EXECUTE ON FUNCTION start_job(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_job(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION finalize_invoice(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_override_lock(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_job(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION record_payment(UUID, DECIMAL, TEXT, TEXT, TEXT) TO authenticated;

-- =====================
-- COMMENTS
-- =====================

COMMENT ON FUNCTION start_job IS 'Start a job - moves from Assigned to In Progress';
COMMENT ON FUNCTION complete_job IS 'Complete a job - moves from In Progress to Awaiting Finalization';
COMMENT ON FUNCTION finalize_invoice IS 'Finalize invoice - moves from Awaiting Finalization to Completed';
COMMENT ON FUNCTION admin_override_lock IS 'Admin override for locked records';
COMMENT ON FUNCTION cancel_job IS 'Cancel a job in New/Assigned status';
COMMENT ON FUNCTION record_payment IS 'Record payment against an invoice';
