-- Migration: Add Deferred Acknowledgement Support (#8)
-- Purpose: Allow job completion without customer signature, with evidence and SLA tracking
-- Date: 2026-01-05
-- Environment: Production-safe, idempotent

-- =============================================================================
-- STEP 1: Add columns to jobs table for deferred acknowledgement
-- =============================================================================

-- Verification type: how the job completion was verified
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS verification_type TEXT DEFAULT 'signed_onsite'
  CHECK (verification_type IN ('signed_onsite', 'deferred', 'auto_completed', 'disputed'));

-- Deferred reason: why customer couldn't sign on-site
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS deferred_reason TEXT;

-- Evidence photo IDs: references to job_media for proof of work
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS evidence_photo_ids UUID[];

-- Customer notification tracking
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer_notified_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer_response_deadline TIMESTAMPTZ;

-- Auto-completion tracking
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS auto_completed_at TIMESTAMPTZ;

-- Dispute handling
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS dispute_notes TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS disputed_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS dispute_resolved_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS dispute_resolution TEXT;

-- =============================================================================
-- STEP 2: Create customer_acknowledgements table for tracking responses
-- =============================================================================

CREATE TABLE IF NOT EXISTS customer_acknowledgements (
  ack_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(customer_id),
  
  -- Acknowledgement details
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'acknowledged', 'disputed', 'auto_completed')),
  
  -- Token for customer portal access (no login required)
  access_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  token_expires_at TIMESTAMPTZ,
  
  -- Response tracking
  responded_at TIMESTAMPTZ,
  response_method TEXT CHECK (response_method IN ('portal', 'email', 'phone', 'auto')),
  response_notes TEXT,
  
  -- Customer signature (if provided via portal)
  customer_signature TEXT,
  signed_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_customer_acks_job ON customer_acknowledgements(job_id);
CREATE INDEX IF NOT EXISTS idx_customer_acks_token ON customer_acknowledgements(access_token);
CREATE INDEX IF NOT EXISTS idx_customer_acks_status ON customer_acknowledgements(status);
CREATE INDEX IF NOT EXISTS idx_customer_acks_pending ON customer_acknowledgements(job_id) 
  WHERE status = 'pending';

-- =============================================================================
-- STEP 3: Index for deferred jobs needing auto-completion check
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_jobs_deferred_pending ON jobs(customer_response_deadline)
WHERE verification_type = 'deferred' 
  AND status = 'Completed Awaiting Acknowledgement'
  AND auto_completed_at IS NULL;

-- =============================================================================
-- STEP 4: RLS for customer_acknowledgements
-- =============================================================================

ALTER TABLE customer_acknowledgements ENABLE ROW LEVEL SECURITY;

-- All authenticated can read (for job detail views)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'customer_acks_read_all' AND tablename = 'customer_acknowledgements'
  ) THEN
    CREATE POLICY customer_acks_read_all ON customer_acknowledgements
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- Admin/Supervisor can manage
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'customer_acks_admin_manage' AND tablename = 'customer_acknowledgements'
  ) THEN
    CREATE POLICY customer_acks_admin_manage ON customer_acknowledgements
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users 
          WHERE users.auth_id = auth.uid() 
          AND users.role IN ('admin', 'supervisor')
        )
      );
  END IF;
END $$;

-- Technician can create (when deferring)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'customer_acks_tech_create' AND tablename = 'customer_acknowledgements'
  ) THEN
    CREATE POLICY customer_acks_tech_create ON customer_acknowledgements
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM users 
          WHERE users.auth_id = auth.uid() 
          AND users.role = 'technician'
        )
      );
  END IF;
END $$;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- Check columns added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'jobs' 
AND column_name IN (
  'verification_type', 'deferred_reason', 'evidence_photo_ids',
  'customer_notified_at', 'customer_response_deadline',
  'auto_completed_at', 'dispute_notes', 'disputed_at',
  'dispute_resolved_at', 'dispute_resolution'
);

-- Check customer_acknowledgements table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'customer_acknowledgements';
