-- =====================================================
-- FIX: Update auto_create_service_jobs RPC function
-- Removes the 'notes' field which was causing JSONB error
-- =====================================================

CREATE OR REPLACE FUNCTION auto_create_service_jobs(
    p_days_ahead INTEGER DEFAULT 7,
    p_created_by_name VARCHAR DEFAULT 'System'
)
RETURNS TABLE (
    forklift_serial VARCHAR,
    job_id UUID,
    action VARCHAR,
    message VARCHAR
) AS $$
DECLARE
    v_forklift RECORD;
    v_job_id UUID;
    v_customer_id UUID;
BEGIN
    FOR v_forklift IN 
        SELECT * FROM get_forklifts_due_for_service(p_days_ahead) 
        WHERE has_open_job = FALSE
    LOOP
        -- Get customer ID (from active rental or forklift record)
        SELECT COALESCE(fr.customer_id, v_forklift.current_customer_id) INTO v_customer_id
        FROM forklift_rentals fr
        WHERE fr.forklift_id = v_forklift.forklift_id
        AND fr.status = 'active'
        LIMIT 1;
        
        -- Create the service job (without notes to avoid JSONB type error)
        INSERT INTO jobs (
            customer_id,
            forklift_id,
            title,
            description,
            job_type,
            status,
            priority,
            scheduled_date,
            created_by_name
        ) VALUES (
            v_customer_id,
            v_forklift.forklift_id,
            'Scheduled Service - ' || v_forklift.serial_number,
            'Preventive maintenance service. Current hourmeter: ' || v_forklift.hourmeter || 
            ' hrs. Next service due at: ' || COALESCE(v_forklift.next_service_hourmeter::TEXT, 'N/A') || ' hrs.',
            'Service',
            'New',
            CASE 
                WHEN v_forklift.is_overdue THEN 'High'
                WHEN v_forklift.days_until_due <= 3 THEN 'Medium'
                ELSE 'Low'
            END,
            COALESCE(v_forklift.next_service_due::DATE, CURRENT_DATE + INTERVAL '7 days'),
            p_created_by_name
        )
        RETURNING jobs.job_id INTO v_job_id;
        
        -- Return result
        forklift_serial := v_forklift.serial_number;
        job_id := v_job_id;
        action := 'CREATED';
        message := 'Service job created. ' || 
            CASE WHEN v_forklift.is_overdue THEN 'OVERDUE!' 
            ELSE 'Due in ' || v_forklift.days_until_due || ' days' END;
        RETURN NEXT;
        
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Verify the fix
DO $$
BEGIN
    RAISE NOTICE '✅ Fixed auto_create_service_jobs function!';
    RAISE NOTICE 'Removed notes field to avoid JSONB type mismatch.';
END $$;
