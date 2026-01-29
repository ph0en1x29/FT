-- =============================================
-- FieldPro Migration: Add Technician Acceptance Columns
-- =============================================
-- Date: 2026-01-29
-- Purpose: Add columns to track when technicians accept/reject job assignments
-- =============================================

-- Add technician_accepted_at column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'jobs' AND column_name = 'technician_accepted_at'
    ) THEN
        ALTER TABLE jobs ADD COLUMN technician_accepted_at TIMESTAMPTZ;
        COMMENT ON COLUMN jobs.technician_accepted_at IS 'Timestamp when assigned technician accepted the job';
    END IF;
END $$;

-- Add technician_rejected_at column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'jobs' AND column_name = 'technician_rejected_at'
    ) THEN
        ALTER TABLE jobs ADD COLUMN technician_rejected_at TIMESTAMPTZ;
        COMMENT ON COLUMN jobs.technician_rejected_at IS 'Timestamp when assigned technician rejected the job';
    END IF;
END $$;

-- Add technician_rejection_reason column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'jobs' AND column_name = 'technician_rejection_reason'
    ) THEN
        ALTER TABLE jobs ADD COLUMN technician_rejection_reason TEXT;
        COMMENT ON COLUMN jobs.technician_rejection_reason IS 'Reason provided by technician when rejecting a job';
    END IF;
END $$;

-- Verify columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'jobs' 
AND column_name IN ('technician_accepted_at', 'technician_rejected_at', 'technician_rejection_reason');
