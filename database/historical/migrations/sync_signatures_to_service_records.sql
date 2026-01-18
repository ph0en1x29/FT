-- =====================================================
-- Migration: Sync signatures from jobs to job_service_records
-- Issue: Signatures were being saved to jobs table but validation 
-- trigger checks job_service_records table
-- Date: 2024
-- =====================================================

-- Step 0: Add missing 'signature_added' value to audit_event_type enum if it doesn't exist
DO $$ 
BEGIN
    -- Check if the value exists, if not add it
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'signature_added' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'audit_event_type')
    ) THEN
        ALTER TYPE audit_event_type ADD VALUE IF NOT EXISTS 'signature_added';
    END IF;
EXCEPTION WHEN duplicate_object THEN
    -- Value already exists, ignore
    NULL;
END $$;

-- Step 1: Sync technician signatures from jobs to job_service_records
UPDATE job_service_records jsr
SET 
    technician_signature = j.technician_signature,
    technician_signature_at = (j.technician_signature->>'signed_at')::TIMESTAMPTZ,
    updated_at = NOW()
FROM jobs j
WHERE jsr.job_id = j.job_id
  AND j.technician_signature IS NOT NULL
  AND jsr.technician_signature IS NULL;

-- Step 2: Sync customer signatures from jobs to job_service_records
UPDATE job_service_records jsr
SET 
    customer_signature = j.customer_signature,
    customer_signature_at = (j.customer_signature->>'signed_at')::TIMESTAMPTZ,
    updated_at = NOW()
FROM jobs j
WHERE jsr.job_id = j.job_id
  AND j.customer_signature IS NOT NULL
  AND jsr.customer_signature IS NULL;

-- Step 3: Create service records for jobs that have signatures but no service record yet
INSERT INTO job_service_records (job_id, technician_signature, technician_signature_at, customer_signature, customer_signature_at, created_at, updated_at)
SELECT 
    j.job_id,
    j.technician_signature,
    CASE WHEN j.technician_signature IS NOT NULL 
         THEN (j.technician_signature->>'signed_at')::TIMESTAMPTZ 
         ELSE NULL END,
    j.customer_signature,
    CASE WHEN j.customer_signature IS NOT NULL 
         THEN (j.customer_signature->>'signed_at')::TIMESTAMPTZ 
         ELSE NULL END,
    NOW(),
    NOW()
FROM jobs j
LEFT JOIN job_service_records jsr ON j.job_id = jsr.job_id
WHERE jsr.job_id IS NULL
  AND (j.technician_signature IS NOT NULL OR j.customer_signature IS NOT NULL);

-- Verify the sync
SELECT 
    'Jobs with signatures' as category,
    COUNT(*) as count
FROM jobs 
WHERE technician_signature IS NOT NULL OR customer_signature IS NOT NULL
UNION ALL
SELECT 
    'Service records with signatures' as category,
    COUNT(*) as count
FROM job_service_records 
WHERE technician_signature IS NOT NULL OR customer_signature IS NOT NULL;
