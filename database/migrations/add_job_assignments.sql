-- Migration: Add job_assignments table for Helper Technician support
-- Purpose: Track lead and assistant technician assignments per job
-- Date: 2026-01-04
-- Environment: Production-safe, idempotent

-- Step 1: Create job_assignments table
CREATE TABLE IF NOT EXISTS job_assignments (
  assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  assignment_type TEXT NOT NULL DEFAULT 'lead' CHECK (assignment_type IN ('lead', 'assistant')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID REFERENCES users(user_id),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 2: Create indexes
CREATE INDEX IF NOT EXISTS idx_job_assignments_job_id ON job_assignments(job_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_technician_id ON job_assignments(technician_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_active ON job_assignments(job_id, is_active) WHERE is_active = true;

-- Step 3: Unique constraint - only 1 active lead and 1 active assistant per job
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_assignments_unique_active_type 
ON job_assignments(job_id, assignment_type) 
WHERE is_active = true;

-- Step 4: Add is_helper_photo column to job_media
ALTER TABLE job_media 
ADD COLUMN IF NOT EXISTS is_helper_photo BOOLEAN DEFAULT false;

-- Step 5: Add helper_technician_id to jobs for quick lookup (denormalized)
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS helper_technician_id UUID REFERENCES users(user_id);

-- Step 6: Enable RLS
ALTER TABLE job_assignments ENABLE ROW LEVEL SECURITY;

-- Step 7: RLS Policies
-- Admin/Supervisor: Full access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'job_assignments_admin_all' AND tablename = 'job_assignments'
  ) THEN
    CREATE POLICY job_assignments_admin_all ON job_assignments
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM users 
          WHERE users.user_id = auth.uid() 
          AND users.role IN ('Admin', 'Supervisor')
        )
      );
  END IF;
END $$;

-- Technicians: View their own assignments, update started_at/ended_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'job_assignments_tech_select' AND tablename = 'job_assignments'
  ) THEN
    CREATE POLICY job_assignments_tech_select ON job_assignments
      FOR SELECT
      TO authenticated
      USING (technician_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'job_assignments_tech_update' AND tablename = 'job_assignments'
  ) THEN
    CREATE POLICY job_assignments_tech_update ON job_assignments
      FOR UPDATE
      TO authenticated
      USING (technician_id = auth.uid())
      WITH CHECK (technician_id = auth.uid());
  END IF;
END $$;

-- Step 8: Trigger for updated_at
CREATE OR REPLACE FUNCTION update_job_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_job_assignments_updated_at ON job_assignments;
CREATE TRIGGER trigger_job_assignments_updated_at
  BEFORE UPDATE ON job_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_job_assignments_updated_at();

-- Step 9: Comments
COMMENT ON TABLE job_assignments IS 'Tracks lead and assistant technician assignments for each job';
COMMENT ON COLUMN job_assignments.assignment_type IS 'lead = primary technician, assistant = helper technician';
COMMENT ON COLUMN job_assignments.is_active IS 'false when assignment ends (replaced or job completed)';
COMMENT ON COLUMN job_media.is_helper_photo IS 'true if photo was uploaded by helper technician';
COMMENT ON COLUMN jobs.helper_technician_id IS 'Denormalized: current active helper for quick lookup';
