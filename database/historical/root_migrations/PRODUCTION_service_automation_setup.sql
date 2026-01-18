-- =====================================================
-- FIELDPRO SERVICE AUTOMATION - PRODUCTION SETUP
-- Run this ONCE in Supabase SQL Editor to enable
-- automatic service scheduling
-- =====================================================

-- =====================================================
-- STEP 1: Initialize all forklifts with proper values
-- =====================================================

-- Set service intervals by forklift type (if not already set)
UPDATE forklifts 
SET service_interval_hours = CASE type
    WHEN 'Electric' THEN 500
    WHEN 'Diesel' THEN 250
    WHEN 'LPG' THEN 300
    WHEN 'Petrol' THEN 250
    ELSE 500
END
WHERE service_interval_hours IS NULL OR service_interval_hours = 0;

-- Set default average daily usage if not set
UPDATE forklifts 
SET avg_daily_usage = 8.0
WHERE avg_daily_usage IS NULL OR avg_daily_usage = 0;

-- Initialize next_service_hourmeter for all active forklifts
UPDATE forklifts 
SET next_service_hourmeter = hourmeter + COALESCE(service_interval_hours, 500)
WHERE status = 'Active'
AND (next_service_hourmeter IS NULL OR next_service_hourmeter <= hourmeter);

-- Initialize next_service_due based on usage patterns
UPDATE forklifts 
SET next_service_due = CURRENT_DATE + (
    COALESCE(service_interval_hours, 500)::FLOAT / 
    COALESCE(NULLIF(avg_daily_usage, 0), 8.0)
)::INTEGER
WHERE status = 'Active'
AND (next_service_due IS NULL OR next_service_due < CURRENT_DATE - INTERVAL '1 year');

-- =====================================================
-- STEP 2: Fix the RPC functions (uuid = text error)
-- =====================================================

-- Drop and recreate get_forklifts_due_for_service with proper types
CREATE OR REPLACE FUNCTION get_forklifts_due_for_service(
    p_days_ahead INTEGER DEFAULT 7
)
RETURNS TABLE (
    forklift_id UUID,
    serial_number VARCHAR,
    make VARCHAR,
    model VARCHAR,
    type VARCHAR,
    hourmeter INTEGER,
    next_service_due TIMESTAMPTZ,
    next_service_hourmeter INTEGER,
    current_customer_id UUID,
    days_until_due INTEGER,
    hours_until_due INTEGER,
    is_overdue BOOLEAN,
    has_open_job BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        f.forklift_id,
        f.serial_number,
        f.make,
        f.model,
        f.type,
        f.hourmeter,
        f.next_service_due,
        f.next_service_hourmeter,
        f.current_customer_id,
        EXTRACT(DAY FROM (f.next_service_due - CURRENT_DATE))::INTEGER AS days_until_due,
        (f.next_service_hourmeter - f.hourmeter)::INTEGER AS hours_until_due,
        (f.next_service_due < CURRENT_DATE OR f.hourmeter >= COALESCE(f.next_service_hourmeter, 999999)) AS is_overdue,
        EXISTS (
            SELECT 1 FROM jobs j 
            WHERE j.forklift_id = f.forklift_id 
            AND j.status NOT IN ('Completed', 'Cancelled')
            AND j.job_type = 'Service'
        ) AS has_open_job
    FROM forklifts f
    WHERE f.status = 'Active'
    AND (
        f.next_service_due <= (CURRENT_DATE + (p_days_ahead || ' days')::INTERVAL)
        OR
        (f.next_service_hourmeter IS NOT NULL AND f.hourmeter >= (f.next_service_hourmeter - 50))
    )
    ORDER BY 
        CASE WHEN f.next_service_due < CURRENT_DATE THEN 0 ELSE 1 END,
        f.next_service_due ASC;
END;
$$ LANGUAGE plpgsql;

-- Fix auto_create_service_jobs function
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
        -- Get customer ID from active rental or forklift record
        SELECT COALESCE(fr.customer_id, v_forklift.current_customer_id) INTO v_customer_id
        FROM forklift_rentals fr
        WHERE fr.forklift_id = v_forklift.forklift_id
        AND fr.status = 'active'
        LIMIT 1;
        
        -- If no rental found, just use forklift's current_customer_id
        IF v_customer_id IS NULL THEN
            v_customer_id := v_forklift.current_customer_id;
        END IF;
        
        -- Create the service job
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

-- Fix create_service_due_notifications function
CREATE OR REPLACE FUNCTION create_service_due_notifications(
    p_days_ahead INTEGER DEFAULT 7
)
RETURNS INTEGER AS $$
DECLARE
    v_forklift RECORD;
    v_admin RECORD;
    v_count INTEGER := 0;
BEGIN
    FOR v_forklift IN 
        SELECT * FROM get_forklifts_due_for_service(p_days_ahead)
    LOOP
        FOR v_admin IN 
            SELECT user_id FROM users 
            WHERE role IN ('admin', 'supervisor', 'Admin', 'Supervisor') 
            AND is_active = TRUE
        LOOP
            IF NOT EXISTS (
                SELECT 1 FROM notifications n
                WHERE n.user_id = v_admin.user_id
                AND n.reference_type = 'forklift'
                AND n.reference_id = v_forklift.forklift_id::TEXT
                AND n.type = 'service_due'
                AND n.created_at > CURRENT_DATE - INTERVAL '1 day'
            ) THEN
                INSERT INTO notifications (
                    user_id,
                    type,
                    title,
                    message,
                    reference_type,
                    reference_id,
                    priority
                ) VALUES (
                    v_admin.user_id,
                    'service_due',
                    CASE 
                        WHEN v_forklift.is_overdue THEN '⚠️ Service OVERDUE: ' || v_forklift.serial_number
                        ELSE '🔧 Service Due: ' || v_forklift.serial_number
                    END,
                    v_forklift.make || ' ' || v_forklift.model || 
                    CASE 
                        WHEN v_forklift.is_overdue THEN ' is OVERDUE for service!'
                        ELSE ' needs service in ' || v_forklift.days_until_due || ' days.'
                    END ||
                    ' Current: ' || v_forklift.hourmeter || ' hrs.',
                    'forklift',
                    v_forklift.forklift_id::TEXT,
                    CASE 
                        WHEN v_forklift.is_overdue THEN 'urgent'
                        WHEN v_forklift.days_until_due <= 3 THEN 'high'
                        ELSE 'normal'
                    END
                );
                v_count := v_count + 1;
            END IF;
        END LOOP;
    END LOOP;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Fix daily_service_check function
CREATE OR REPLACE FUNCTION daily_service_check()
RETURNS TABLE (
    check_type VARCHAR,
    count INTEGER,
    details TEXT
) AS $$
DECLARE
    v_notifications_created INTEGER;
    v_jobs_created INTEGER;
BEGIN
    -- Step 1: Create notifications for services due in 7 days
    SELECT create_service_due_notifications(7) INTO v_notifications_created;
    
    check_type := 'notifications';
    count := v_notifications_created;
    details := 'Created ' || v_notifications_created || ' service due notifications';
    RETURN NEXT;
    
    -- Step 2: Auto-create jobs for services due in 7 days
    SELECT COUNT(*) INTO v_jobs_created FROM auto_create_service_jobs(7, 'System Automation');
    
    check_type := 'jobs_created';
    count := v_jobs_created;
    details := 'Auto-created ' || v_jobs_created || ' service jobs';
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 3: Set up automatic daily cron job
-- =====================================================

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove existing job if any
SELECT cron.unschedule('daily-service-check') 
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-service-check');

-- Schedule daily check at 8:00 AM Malaysian Time (UTC+8 = 00:00 UTC)
SELECT cron.schedule(
    'daily-service-check',
    '0 0 * * *',  -- 00:00 UTC = 08:00 AM MYT
    $$SELECT * FROM daily_service_check()$$
);

-- =====================================================
-- STEP 4: Verify setup
-- =====================================================

-- Show current forklift service status
DO $$
DECLARE
    v_total_forklifts INTEGER;
    v_with_schedule INTEGER;
    v_due_soon INTEGER;
    v_overdue INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_total_forklifts FROM forklifts WHERE status = 'Active';
    
    SELECT COUNT(*) INTO v_with_schedule FROM forklifts 
    WHERE status = 'Active' 
    AND next_service_due IS NOT NULL 
    AND next_service_hourmeter IS NOT NULL;
    
    SELECT COUNT(*) INTO v_due_soon FROM forklifts 
    WHERE status = 'Active' 
    AND next_service_due <= CURRENT_DATE + INTERVAL '7 days';
    
    SELECT COUNT(*) INTO v_overdue FROM forklifts 
    WHERE status = 'Active' 
    AND (next_service_due < CURRENT_DATE OR hourmeter >= next_service_hourmeter);
    
    RAISE NOTICE '';
    RAISE NOTICE '╔══════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║     ✅ SERVICE AUTOMATION PRODUCTION SETUP COMPLETE      ║';
    RAISE NOTICE '╠══════════════════════════════════════════════════════════╣';
    RAISE NOTICE '║  Total Active Forklifts:     %                          ║', LPAD(v_total_forklifts::TEXT, 4);
    RAISE NOTICE '║  With Service Schedule:      %                          ║', LPAD(v_with_schedule::TEXT, 4);
    RAISE NOTICE '║  Due Within 7 Days:          %                          ║', LPAD(v_due_soon::TEXT, 4);
    RAISE NOTICE '║  Currently Overdue:          %                          ║', LPAD(v_overdue::TEXT, 4);
    RAISE NOTICE '╠══════════════════════════════════════════════════════════╣';
    RAISE NOTICE '║  🕐 Daily Check: 8:00 AM MYT (automatic)                 ║';
    RAISE NOTICE '║  📋 Jobs created 7 days before service due               ║';
    RAISE NOTICE '║  🔔 Admins notified of upcoming services                 ║';
    RAISE NOTICE '╚══════════════════════════════════════════════════════════╝';
END $$;

-- Show scheduled cron jobs
SELECT jobid, jobname, schedule, command FROM cron.job WHERE jobname = 'daily-service-check';
