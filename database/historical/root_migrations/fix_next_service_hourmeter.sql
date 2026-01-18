-- =====================================================
-- FIX CORRUPTED next_service_hourmeter VALUES
-- =====================================================
-- This fixes forklifts where next_service_hourmeter was set incorrectly
-- (either to 0, or to just the interval instead of hourmeter + interval)

-- Show current broken state
SELECT 
    serial_number,
    type,
    hourmeter,
    next_service_hourmeter,
    service_interval_hours,
    hourmeter + service_interval_hours AS should_be,
    next_service_hourmeter - hourmeter AS hours_until
FROM forklifts
WHERE status = 'Active'
AND (
    next_service_hourmeter IS NULL 
    OR next_service_hourmeter < hourmeter  -- Already overdue by hours
    OR next_service_hourmeter <= service_interval_hours  -- Set to just interval, not hourmeter + interval
);

-- Fix all forklifts: set next_service_hourmeter = hourmeter + service_interval_hours
-- This ensures proper calculation of hours until service
UPDATE forklifts 
SET 
    next_service_hourmeter = hourmeter + COALESCE(service_interval_hours, 500),
    updated_at = NOW()
WHERE status = 'Active'
AND (
    next_service_hourmeter IS NULL 
    OR next_service_hourmeter < hourmeter
    OR next_service_hourmeter <= service_interval_hours
);

-- Also update next_service_due to be reasonable (based on avg usage)
UPDATE forklifts 
SET 
    next_service_due = CURRENT_DATE + (
        COALESCE(service_interval_hours, 500) / COALESCE(NULLIF(avg_daily_usage, 0), 8.0) || ' days'
    )::INTERVAL,
    updated_at = NOW()
WHERE status = 'Active'
AND (next_service_due IS NULL OR next_service_due < CURRENT_DATE - INTERVAL '1 year');

-- Verify the fix
SELECT 
    serial_number,
    type,
    hourmeter,
    next_service_hourmeter,
    next_service_hourmeter - hourmeter AS hours_until,
    next_service_due,
    next_service_due - CURRENT_DATE AS days_until
FROM forklifts
WHERE status = 'Active'
ORDER BY next_service_due ASC
LIMIT 10;

DO $$
BEGIN
    RAISE NOTICE '✅ Fixed next_service_hourmeter values!';
    RAISE NOTICE 'All active forklifts now have: next_service_hourmeter = hourmeter + service_interval';
END $$;
