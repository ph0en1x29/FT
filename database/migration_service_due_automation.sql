-- =====================================================
-- FIELDPRO SERVICE DUE AUTOMATION
-- Complete automation for predictive service scheduling
-- =====================================================

-- =====================================================
-- 1. ADD MISSING COLUMNS TO FORKLIFTS TABLE
-- =====================================================

-- Service interval based on forklift type (in hourmeter hours)
ALTER TABLE forklifts ADD COLUMN IF NOT EXISTS service_interval_hours INTEGER DEFAULT 500;

-- Next service hourmeter threshold
ALTER TABLE forklifts ADD COLUMN IF NOT EXISTS next_service_hourmeter INTEGER;

-- Last service hourmeter reading
ALTER TABLE forklifts ADD COLUMN IF NOT EXISTS last_service_hourmeter INTEGER;

-- Average daily usage (calculated from history)
ALTER TABLE forklifts ADD COLUMN IF NOT EXISTS avg_daily_usage DECIMAL(6,2) DEFAULT 8.0;

-- =====================================================
-- 2. SET DEFAULT SERVICE INTERVALS BY TYPE
-- =====================================================

-- Update existing forklifts with default service intervals
UPDATE forklifts SET service_interval_hours = 
    CASE type
        WHEN 'Electric' THEN 500
        WHEN 'Diesel' THEN 250
        WHEN 'LPG' THEN 300
        WHEN 'Petrol' THEN 250
        ELSE 500
    END
WHERE service_interval_hours IS NULL OR service_interval_hours = 0;

-- =====================================================
-- 3. FUNCTION: Calculate Next Service Due
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_next_service_due(
    p_forklift_id UUID,
    p_current_hourmeter INTEGER,
    p_service_interval INTEGER,
    p_avg_daily_usage DECIMAL
)
RETURNS TIMESTAMPTZ AS $$
DECLARE
    v_next_hourmeter INTEGER;
    v_hours_remaining INTEGER;
    v_days_until_service INTEGER;
BEGIN
    -- Calculate next service hourmeter
    v_next_hourmeter := p_current_hourmeter + p_service_interval;
    
    -- Hours remaining until service
    v_hours_remaining := v_service_interval;
    
    -- Days until service (based on average daily usage)
    IF p_avg_daily_usage > 0 THEN
        v_days_until_service := CEIL(v_hours_remaining / p_avg_daily_usage);
    ELSE
        v_days_until_service := 90; -- Default to 90 days if no usage data
    END IF;
    
    RETURN CURRENT_DATE + (v_days_until_service || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4. TRIGGER: Update Service Schedule After Job Completion
-- =====================================================

CREATE OR REPLACE FUNCTION update_forklift_service_schedule()
RETURNS TRIGGER AS $$
DECLARE
    v_forklift RECORD;
    v_new_next_service_due TIMESTAMPTZ;
    v_new_next_service_hourmeter INTEGER;
BEGIN
    -- Only process when job is completed and has a forklift
    IF NEW.status = 'Completed' AND NEW.forklift_id IS NOT NULL THEN
        -- Get forklift details
        SELECT * INTO v_forklift FROM forklifts WHERE forklift_id = NEW.forklift_id;
        
        IF v_forklift IS NOT NULL THEN
            -- Calculate next service hourmeter
            v_new_next_service_hourmeter := COALESCE(NEW.hourmeter_reading, v_forklift.hourmeter) + v_forklift.service_interval_hours;
            
            -- Calculate next service due date
            IF v_forklift.avg_daily_usage > 0 THEN
                v_new_next_service_due := CURRENT_DATE + 
                    (CEIL(v_forklift.service_interval_hours / v_forklift.avg_daily_usage) || ' days')::INTERVAL;
            ELSE
                v_new_next_service_due := CURRENT_DATE + INTERVAL '90 days';
            END IF;
            
            -- Update forklift record
            UPDATE forklifts SET
                hourmeter = COALESCE(NEW.hourmeter_reading, hourmeter),
                last_service_date = CURRENT_TIMESTAMP,
                last_service_hourmeter = COALESCE(NEW.hourmeter_reading, hourmeter),
                next_service_due = v_new_next_service_due,
                next_service_hourmeter = v_new_next_service_hourmeter,
                updated_at = NOW()
            WHERE forklift_id = NEW.forklift_id;
            
            -- Log the update
            RAISE NOTICE 'Updated forklift % service schedule: next due %, next hourmeter %',
                v_forklift.serial_number, v_new_next_service_due, v_new_next_service_hourmeter;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_update_forklift_service ON jobs;
CREATE TRIGGER trigger_update_forklift_service
AFTER UPDATE ON jobs
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM 'Completed' AND NEW.status = 'Completed')
EXECUTE FUNCTION update_forklift_service_schedule();

-- =====================================================
-- 5. FUNCTION: Check for Forklifts Due for Service
-- Returns forklifts due within specified days
-- =====================================================

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
        -- Due by date
        f.next_service_due <= (CURRENT_DATE + (p_days_ahead || ' days')::INTERVAL)
        OR
        -- Due by hourmeter (within 50 hours of threshold)
        (f.next_service_hourmeter IS NOT NULL AND f.hourmeter >= (f.next_service_hourmeter - 50))
    )
    ORDER BY 
        CASE WHEN f.next_service_due < CURRENT_DATE THEN 0 ELSE 1 END,
        f.next_service_due ASC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. FUNCTION: Auto-Create Service Jobs
-- Creates jobs for forklifts due within specified days
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
        
        -- Create the service job (notes is JSONB, so we skip it or use proper format)
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

-- =====================================================
-- 7. FUNCTION: Create Service Due Notifications
-- =====================================================

CREATE OR REPLACE FUNCTION create_service_due_notifications(
    p_days_ahead INTEGER DEFAULT 7
)
RETURNS INTEGER AS $$
DECLARE
    v_forklift RECORD;
    v_admin RECORD;
    v_count INTEGER := 0;
BEGIN
    -- Get all forklifts due for service
    FOR v_forklift IN 
        SELECT * FROM get_forklifts_due_for_service(p_days_ahead)
    LOOP
        -- Notify all admins and supervisors
        FOR v_admin IN 
            SELECT user_id FROM users 
            WHERE role IN ('admin', 'supervisor') 
            AND is_active = TRUE
        LOOP
            -- Check if notification already exists (avoid duplicates)
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

-- =====================================================
-- 8. FUNCTION: Daily Service Check (call via cron/scheduled job)
-- =====================================================

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
    
    -- Step 2: Auto-create jobs for services due in 7 days (optional - can be disabled)
    SELECT COUNT(*) INTO v_jobs_created FROM auto_create_service_jobs(7, 'System Automation');
    
    check_type := 'jobs_created';
    count := v_jobs_created;
    details := 'Auto-created ' || v_jobs_created || ' service jobs';
    RETURN NEXT;
    
    -- Step 3: Update overdue statuses
    UPDATE scheduled_services
    SET status = 'overdue'
    WHERE status = 'pending'
    AND due_date < CURRENT_DATE;
    
    GET DIAGNOSTICS v_jobs_created = ROW_COUNT;
    
    check_type := 'overdue_updated';
    count := v_jobs_created;
    details := 'Marked ' || v_jobs_created || ' scheduled services as overdue';
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 9. ADD service_due TO NOTIFICATION TYPE ENUM (if using enum)
-- =====================================================

-- Note: If notifications.type is a VARCHAR, this is not needed
-- If it's an enum, uncomment the following:
-- ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'service_due';

-- =====================================================
-- 10. INITIALIZE EXISTING FORKLIFTS
-- =====================================================

-- Set next_service_hourmeter for forklifts that don't have it
UPDATE forklifts 
SET next_service_hourmeter = hourmeter + service_interval_hours
WHERE next_service_hourmeter IS NULL;

-- Set next_service_due for forklifts that don't have it
UPDATE forklifts 
SET next_service_due = 
    CASE 
        WHEN last_service_date IS NOT NULL THEN 
            last_service_date + (service_interval_hours / COALESCE(NULLIF(avg_daily_usage, 0), 8.0) || ' days')::INTERVAL
        ELSE 
            CURRENT_DATE + INTERVAL '30 days'
    END
WHERE next_service_due IS NULL;

-- =====================================================
-- DONE! 
-- =====================================================

-- To test the automation:
-- 1. Check forklifts due: SELECT * FROM get_forklifts_due_for_service(30);
-- 2. Create notifications: SELECT create_service_due_notifications(7);
-- 3. Auto-create jobs: SELECT * FROM auto_create_service_jobs(7, 'Admin');
-- 4. Run daily check: SELECT * FROM daily_service_check();

DO $$
BEGIN
    RAISE NOTICE '✅ Service Due Automation migration complete!';
    RAISE NOTICE 'New functions:';
    RAISE NOTICE '  - get_forklifts_due_for_service(days)';
    RAISE NOTICE '  - auto_create_service_jobs(days, created_by)';
    RAISE NOTICE '  - create_service_due_notifications(days)';
    RAISE NOTICE '  - daily_service_check()';
END $$;
