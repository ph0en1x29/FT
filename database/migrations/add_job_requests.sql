-- Migration: Add job_requests table for In-Job Request System
-- Purpose: Track assistance, spare parts, and skillful technician requests
-- Date: 2026-01-04
-- Environment: Production-safe, idempotent

-- Step 1: Create job_requests table
CREATE TABLE IF NOT EXISTS job_requests (
  request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('assistance', 'spare_part', 'skillful_technician')),
  requested_by UUID NOT NULL REFERENCES users(user_id),
  description TEXT NOT NULL,
  photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_response_notes TEXT,
  admin_response_part_id UUID REFERENCES parts(part_id),
  admin_response_quantity INTEGER,
  responded_by UUID REFERENCES users(user_id),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 2: Create indexes
CREATE INDEX IF NOT EXISTS idx_job_requests_job_id ON job_requests(job_id);
CREATE INDEX IF NOT EXISTS idx_job_requests_status ON job_requests(status);
CREATE INDEX IF NOT EXISTS idx_job_requests_type_status ON job_requests(request_type, status);
CREATE INDEX IF NOT EXISTS idx_job_requests_requested_by ON job_requests(requested_by);

-- Step 3: Enable RLS
ALTER TABLE job_requests ENABLE ROW LEVEL SECURITY;

-- Step 4: RLS Policies

-- Admin/Supervisor: Full access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'job_requests_admin_all' AND tablename = 'job_requests'
  ) THEN
    CREATE POLICY job_requests_admin_all ON job_requests
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

-- Technicians: Can create requests and view their own
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'job_requests_tech_select' AND tablename = 'job_requests'
  ) THEN
    CREATE POLICY job_requests_tech_select ON job_requests
      FOR SELECT
      TO authenticated
      USING (
        requested_by IN (
          SELECT user_id FROM users WHERE auth_id = auth.uid()
        )
        OR
        job_id IN (
          SELECT job_id FROM jobs 
          WHERE assigned_technician_id IN (
            SELECT user_id FROM users WHERE auth_id = auth.uid()
          )
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'job_requests_tech_insert' AND tablename = 'job_requests'
  ) THEN
    CREATE POLICY job_requests_tech_insert ON job_requests
      FOR INSERT
      TO authenticated
      WITH CHECK (
        requested_by IN (
          SELECT user_id FROM users WHERE auth_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Step 5: Trigger for updated_at
CREATE OR REPLACE FUNCTION update_job_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

DROP TRIGGER IF EXISTS trigger_job_requests_updated_at ON job_requests;
CREATE TRIGGER trigger_job_requests_updated_at
  BEFORE UPDATE ON job_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_job_requests_updated_at();

-- Step 6: Comments
COMMENT ON TABLE job_requests IS 'In-job requests for assistance, spare parts, or skillful technician';
COMMENT ON COLUMN job_requests.request_type IS 'assistance = helper needed, spare_part = part needed, skillful_technician = skill escalation';
COMMENT ON COLUMN job_requests.status IS 'pending = awaiting admin, approved = actioned, rejected = declined';
COMMENT ON COLUMN job_requests.admin_response_part_id IS 'For spare_part requests: the part selected by admin';
COMMENT ON COLUMN job_requests.admin_response_quantity IS 'For spare_part requests: quantity approved';
