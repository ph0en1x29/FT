-- Migration: Add Deferred Acknowledgement Support (#8)
-- Purpose: Track customer verification type, deferred reasons, evidence, and SLA deadlines
-- Date: 2026-01-05
-- Timezone: Malaysia (UTC+8)
-- Environment: Production-safe, idempotent

-- =============================================================================
-- STEP 1: Add columns to jobs table for deferred acknowledgement
-- =============================================================================

-- Verification type: how the job was completed/acknowledged
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS verification_type TEXT DEFAULT 'signed_onsite'
  CHECK (verification_type IN ('signed_onsite', 'deferred', 'auto_completed', 'disputed'));

-- Deferred reason: why customer couldn't sign onsite
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS deferred_reason TEXT;

-- Evidence photo IDs: references to job_media for proof of work
-- Using UUID[] array - FK not enforced at DB level, validated in application
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS evidence_photo_ids UUID[];

-- Customer notification timestamp
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer_notified_at TIMESTAMPTZ;

-- Customer response deadline (calculated: notified_at + SLA business days)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS customer_response_deadline TIMESTAMPTZ;

-- Auto-completion timestamp (when SLA expired and job was auto-completed)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS auto_completed_at TIMESTAMPTZ;

-- Dispute notes: if customer disputed the work
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS dispute_notes TEXT;

-- Dispute tracking
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS disputed_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS dispute_resolved_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS dispute_resolution TEXT;

-- =============================================================================
-- STEP 2: Create customer_acknowledgements table
-- =============================================================================

CREATE TABLE IF NOT EXISTS customer_acknowledgements (
  ack_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(job_id),
  customer_id UUID NOT NULL REFERENCES customers(customer_id),
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'acknowledged', 'disputed', 'auto_completed', 'expired')),
  
  -- Access token for customer portal (URL-safe)
  access_token TEXT DEFAULT encode(gen_random_bytes(32), 'hex'),
  token_expires_at TIMESTAMPTZ,
  
  -- Customer response
  responded_at TIMESTAMPTZ,
  response_method TEXT CHECK (response_method IN ('portal', 'email', 'phone', 'auto')),
  response_notes TEXT,
  
  -- Signature if provided
  customer_signature TEXT, -- base64 encoded
  signed_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: one ack record per job
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_ack_job ON customer_acknowledgements(job_id);

-- Index for token lookup (customer portal access)
-- Note: Can't use WHERE token_expires_at > NOW() as NOW() isn't IMMUTABLE
-- Expiry check done in application layer
CREATE INDEX IF NOT EXISTS idx_customer_ack_token ON customer_acknowledgements(access_token);

-- =============================================================================
-- STEP 3: RLS for customer_acknowledgements
-- =============================================================================

ALTER TABLE customer_acknowledgements ENABLE ROW LEVEL SECURITY;

-- Admin/Supervisor can read all
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'customer_ack_admin_read' AND tablename = 'customer_acknowledgements'
  ) THEN
    CREATE POLICY customer_ack_admin_read ON customer_acknowledgements
      FOR SELECT
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

-- Admin/Supervisor can write
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'customer_ack_admin_write' AND tablename = 'customer_acknowledgements'
  ) THEN
    CREATE POLICY customer_ack_admin_write ON customer_acknowledgements
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

-- Technician can read their own job acks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'customer_ack_tech_read' AND tablename = 'customer_acknowledgements'
  ) THEN
    CREATE POLICY customer_ack_tech_read ON customer_acknowledgements
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM jobs 
          WHERE jobs.job_id = customer_acknowledgements.job_id
          AND jobs.assigned_technician_id = (
            SELECT user_id FROM users WHERE auth_id = auth.uid()
          )
        )
      );
  END IF;
END $$;

-- =============================================================================
-- STEP 4: Index for finding jobs awaiting acknowledgement
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_jobs_awaiting_ack ON jobs(customer_response_deadline)
WHERE verification_type = 'deferred' 
  AND status = 'Completed Awaiting Acknowledgement'
  AND auto_completed_at IS NULL;

-- =============================================================================
-- STEP 5: Index for disputed jobs
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_jobs_disputed ON jobs(disputed_at)
WHERE status = 'Disputed';

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- Check jobs columns added
SELECT column_name, data_type, column_default
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
