-- =============================================
-- ENHANCED SOFT DELETE SYSTEM FOR JOBS
-- =============================================
-- This migration enhances the job deletion system to:
-- 1. Add deletion_reason field to track why jobs were deleted
-- 2. Add deleted_by_name for audit trail
-- 3. Handle hourmeter reversion when job is deleted (mark as cancelled)
-- 4. Create function to get recently deleted jobs (admin/supervisor only)
-- =============================================

-- Step 1: Add enhanced deletion fields to jobs table
-- =============================================
DO $$ 
BEGIN
  -- Add deleted_by_name if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'jobs' AND column_name = 'deleted_by_name'
  ) THEN
    ALTER TABLE jobs ADD COLUMN deleted_by_name TEXT;
    RAISE NOTICE 'Added deleted_by_name column';
  END IF;

  -- Add deletion_reason if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'jobs' AND column_name = 'deletion_reason'
  ) THEN
    ALTER TABLE jobs ADD COLUMN deletion_reason TEXT;
    RAISE NOTICE 'Added deletion_reason column';
  END IF;

  -- Add hourmeter_before_delete to store the reading before job was cancelled
  -- This allows us to show what hourmeter was recorded but mark it as invalid
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'jobs' AND column_name = 'hourmeter_before_delete'
  ) THEN
    ALTER TABLE jobs ADD COLUMN hourmeter_before_delete INTEGER;
    RAISE NOTICE 'Added hourmeter_before_delete column';
  END IF;
END $$;

-- Step 2: Create function to handle job deletion with hourmeter handling
-- =============================================
CREATE OR REPLACE FUNCTION delete_job_with_hourmeter_handling(
  p_job_id UUID,
  p_deleted_by_id UUID DEFAULT NULL,
  p_deleted_by_name TEXT DEFAULT NULL,
  p_deletion_reason TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_forklift_id UUID;
  v_hourmeter_reading INTEGER;
  v_forklift_current_hourmeter INTEGER;
  v_previous_job_hourmeter INTEGER;
BEGIN
  -- Get the job's forklift and hourmeter reading
  SELECT forklift_id, hourmeter_reading 
  INTO v_forklift_id, v_hourmeter_reading
  FROM jobs 
  WHERE job_id = p_job_id;

  -- If this job had a hourmeter reading and a forklift
  IF v_forklift_id IS NOT NULL AND v_hourmeter_reading IS NOT NULL THEN
    -- Get the current forklift hourmeter
    SELECT hourmeter INTO v_forklift_current_hourmeter
    FROM forklifts 
    WHERE forklift_id = v_forklift_id;

    -- If the forklift's current hourmeter matches this job's reading,
    -- we should revert to the previous job's hourmeter (or keep as is with a note)
    IF v_forklift_current_hourmeter = v_hourmeter_reading THEN
      -- Find the most recent completed job's hourmeter for this forklift (excluding this job)
      SELECT hourmeter_reading INTO v_previous_job_hourmeter
      FROM jobs
      WHERE forklift_id = v_forklift_id
        AND job_id != p_job_id
        AND deleted_at IS NULL
        AND hourmeter_reading IS NOT NULL
        AND status IN ('Completed', 'Awaiting Finalization')
      ORDER BY completed_at DESC NULLS LAST, created_at DESC
      LIMIT 1;

      -- If we found a previous hourmeter reading, revert to it
      IF v_previous_job_hourmeter IS NOT NULL THEN
        UPDATE forklifts 
        SET hourmeter = v_previous_job_hourmeter,
            updated_at = NOW()
        WHERE forklift_id = v_forklift_id;
        
        RAISE NOTICE 'Reverted forklift hourmeter from % to %', 
          v_forklift_current_hourmeter, v_previous_job_hourmeter;
      END IF;
    END IF;
  END IF;

  -- Soft delete the job
  UPDATE jobs SET
    deleted_at = NOW(),
    deleted_by = p_deleted_by_id,
    deleted_by_name = p_deleted_by_name,
    deletion_reason = p_deletion_reason,
    hourmeter_before_delete = v_hourmeter_reading
  WHERE job_id = p_job_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Create view for recently deleted jobs (admin/supervisor access)
-- =============================================
CREATE OR REPLACE VIEW recently_deleted_jobs AS
SELECT 
  j.job_id,
  j.title,
  j.description,
  j.status,
  j.job_type,
  j.priority,
  j.deleted_at,
  j.deleted_by,
  j.deleted_by_name,
  j.deletion_reason,
  j.hourmeter_before_delete,
  j.forklift_id,
  j.customer_id,
  j.assigned_technician_name,
  j.created_at,
  c.name as customer_name,
  f.serial_number as forklift_serial,
  f.make as forklift_make,
  f.model as forklift_model
FROM jobs j
LEFT JOIN customers c ON j.customer_id = c.customer_id
LEFT JOIN forklifts f ON j.forklift_id = f.forklift_id
WHERE j.deleted_at IS NOT NULL
  AND j.deleted_at > NOW() - INTERVAL '30 days'  -- Only show last 30 days
ORDER BY j.deleted_at DESC;

-- Step 4: Create RLS policy for deleted jobs view (admin/supervisor only)
-- =============================================
-- Note: This is handled at the application level since views have different RLS handling

-- Step 5: Create index for efficient deleted job queries
-- =============================================
CREATE INDEX IF NOT EXISTS idx_jobs_deleted_at 
ON jobs(deleted_at) 
WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_forklift_deleted 
ON jobs(forklift_id, deleted_at);

-- Step 6: Grant execute on the function
-- =============================================
GRANT EXECUTE ON FUNCTION delete_job_with_hourmeter_handling TO authenticated;

-- Log completion
DO $$ 
BEGIN
  RAISE NOTICE '=============================================';
  RAISE NOTICE 'ENHANCED SOFT DELETE SYSTEM MIGRATION COMPLETE';
  RAISE NOTICE '=============================================';
  RAISE NOTICE 'Changes made:';
  RAISE NOTICE '  - Added deleted_by_name column';
  RAISE NOTICE '  - Added deletion_reason column';
  RAISE NOTICE '  - Added hourmeter_before_delete column';
  RAISE NOTICE '  - Created delete_job_with_hourmeter_handling function';
  RAISE NOTICE '  - Created recently_deleted_jobs view';
  RAISE NOTICE '  - Added indexes for efficient queries';
END $$;
