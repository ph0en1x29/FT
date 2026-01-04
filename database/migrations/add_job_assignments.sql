-- Migration: Add job_assignments table for Helper Technician support
-- Purpose: ACWER workflow - allows 1 helper per job with restricted permissions
-- Date: 2026-01-04
-- Environment: Production-safe, idempotent

-- ===================
-- JOB ASSIGNMENTS TABLE
-- ===================

-- Create job_assignments table
CREATE TABLE IF NOT EXISTS job_assignments (
  assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES users(user_id),
  assignment_type TEXT NOT NULL CHECK (assignment_type IN ('lead', 'assistant')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES users(user_id),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Comments
COMMENT ON TABLE job_assignments IS 'Tracks technician assignments to jobs (lead and assistant/helper)';
COMMENT ON COLUMN job_assignments.assignment_type IS 'lead = primary technician, assistant = helper with restricted permissions';
COMMENT ON COLUMN job_assignments.is_active IS 'False when helper is removed/replaced';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_job_assignments_job_id ON job_assignments(job_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_technician_id ON job_assignments(technician_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_active ON job_assignments(job_id, is_active) WHERE is_active = true;

-- Constraint: Max 1 active assistant per job
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_assignments_one_active_assistant 
ON job_assignments(job_id) 
WHERE assignment_type = 'assistant' AND is_active = true;

-- ===================
-- HELPER PHOTO TRACKING
-- ===================

-- Add is_helper_photo column to job_media
ALTER TABLE job_media
ADD COLUMN IF NOT EXISTS is_helper_photo BOOLEAN DEFAULT false;

-- Add uploaded_by_assignment_id to track which assignment uploaded the photo
ALTER TABLE job_media
ADD COLUMN IF NOT EXISTS uploaded_by_assignment_id UUID REFERENCES job_assignments(assignment_id);

COMMENT ON COLUMN job_media.is_helper_photo IS 'True if photo was uploaded by helper/assistant technician';
COMMENT ON COLUMN job_media.uploaded_by_assignment_id IS 'Links photo to specific job assignment';

-- Index for filtering helper photos
CREATE INDEX IF NOT EXISTS idx_job_media_helper ON job_media(job_id, is_helper_photo) WHERE is_helper_photo = true;

-- ===================
-- RLS POLICIES
-- ===================

-- Enable RLS on job_assignments
ALTER TABLE job_assignments ENABLE ROW LEVEL SECURITY;

-- Admin/Supervisor: Full access
CREATE POLICY IF NOT EXISTS "admin_supervisor_full_access_assignments" ON job_assignments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.user_id = auth.uid() 
      AND users.role IN ('Admin', 'Supervisor')
    )
  );

-- Technician: Can view their own assignments
CREATE POLICY IF NOT EXISTS "technician_view_own_assignments" ON job_assignments
  FOR SELECT
  TO authenticated
  USING (
    technician_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users 
      WHERE users.user_id = auth.uid() 
      AND users.role IN ('Admin', 'Supervisor')
    )
  );

-- ===================
-- UPDATED_AT TRIGGER
-- ===================

-- Trigger function (reuse if exists)
CREATE OR REPLACE FUNCTION update_job_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_job_assignments_updated_at ON job_assignments;
CREATE TRIGGER trigger_job_assignments_updated_at
  BEFORE UPDATE ON job_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_job_assignments_updated_at();

-- ===================
-- MIGRATION FOR EXISTING JOBS
-- ===================

-- Create lead assignments for all existing jobs that have assigned_to set
-- This ensures backward compatibility
INSERT INTO job_assignments (job_id, technician_id, assignment_type, assigned_at, is_active)
SELECT 
  j.job_id,
  j.assigned_to,
  'lead',
  COALESCE(j.created_at, now()),
  true
FROM jobs j
WHERE j.assigned_to IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM job_assignments ja 
  WHERE ja.job_id = j.job_id 
  AND ja.assignment_type = 'lead'
)
ON CONFLICT DO NOTHING;
