-- =============================================
-- Auto-Escalation Cron Jobs (pg_cron)
-- 1. Jobs in progress > 24 hours → escalate
-- 2. Slot-In jobs not acknowledged > 15 minutes → escalate
-- Runs every 5 minutes
-- =============================================

-- Function: Escalate overdue jobs (>24h in progress)
CREATE OR REPLACE FUNCTION escalate_overdue_jobs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  escalated_count INTEGER := 0;
  job_record RECORD;
  admin_record RECORD;
  hours_elapsed INTEGER;
BEGIN
  FOR job_record IN
    SELECT job_id, title, description, assigned_technician_name, repair_start_time
    FROM jobs
    WHERE status IN ('In Progress', 'Incomplete - Continuing')
      AND escalation_triggered_at IS NULL
      AND deleted_at IS NULL
      AND repair_start_time IS NOT NULL
      AND repair_start_time < NOW() - INTERVAL '24 hours'
  LOOP
    -- Mark as escalated
    UPDATE jobs
    SET escalation_triggered_at = NOW()
    WHERE job_id = job_record.job_id;

    hours_elapsed := EXTRACT(EPOCH FROM (NOW() - job_record.repair_start_time)) / 3600;

    -- Create notifications for all admins/supervisors
    FOR admin_record IN
      SELECT user_id FROM users
      WHERE role IN ('admin', 'admin_service', 'admin_store', 'supervisor')
        AND is_active = true
    LOOP
      INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id, priority)
      VALUES (
        admin_record.user_id,
        'escalation',
        '⚠️ Job Overdue — 24h Exceeded',
        COALESCE(job_record.title, LEFT(job_record.description, 50)) 
          || ' assigned to ' || COALESCE(job_record.assigned_technician_name, 'Unassigned')
          || ' has been in progress for ' || hours_elapsed || 'h. Immediate attention required.',
        'job',
        job_record.job_id,
        'urgent'
      );
    END LOOP;

    escalated_count := escalated_count + 1;
  END LOOP;

  RETURN escalated_count;
END;
$$;

-- Function: Escalate Slot-In SLA breaches (>15 min unacknowledged)
CREATE OR REPLACE FUNCTION escalate_slotin_sla()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  escalated_count INTEGER := 0;
  job_record RECORD;
  admin_record RECORD;
  minutes_waiting INTEGER;
BEGIN
  FOR job_record IN
    SELECT job_id, title, description, assigned_technician_name, created_at
    FROM jobs
    WHERE job_type = 'Slot-In'
      AND acknowledged_at IS NULL
      AND escalation_triggered_at IS NULL
      AND deleted_at IS NULL
      AND status NOT IN ('Completed', 'Cancelled')
      AND created_at < NOW() - INTERVAL '15 minutes'
  LOOP
    UPDATE jobs
    SET escalation_triggered_at = NOW()
    WHERE job_id = job_record.job_id;

    minutes_waiting := EXTRACT(EPOCH FROM (NOW() - job_record.created_at)) / 60;

    FOR admin_record IN
      SELECT user_id FROM users
      WHERE role IN ('admin', 'admin_service', 'supervisor')
        AND is_active = true
    LOOP
      INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id, priority)
      VALUES (
        admin_record.user_id,
        'escalation',
        '🚨 Slot-In SLA Breached — Not Acknowledged',
        COALESCE(job_record.title, LEFT(job_record.description, 50))
          || ' assigned to ' || COALESCE(job_record.assigned_technician_name, 'Unassigned')
          || ' not acknowledged after ' || minutes_waiting || ' minutes. 15-min SLA exceeded.',
        'job',
        job_record.job_id,
        'urgent'
      );
    END LOOP;

    escalated_count := escalated_count + 1;
  END LOOP;

  RETURN escalated_count;
END;
$$;

-- Combined escalation check function
CREATE OR REPLACE FUNCTION run_escalation_checks()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  overdue_count INTEGER;
  slotin_count INTEGER;
BEGIN
  overdue_count := escalate_overdue_jobs();
  slotin_count := escalate_slotin_sla();
  RETURN 'Escalated: ' || overdue_count || ' overdue, ' || slotin_count || ' slot-in SLA';
END;
$$;

-- Schedule: Run every 5 minutes
SELECT cron.schedule(
  'escalation-checks',
  '*/5 * * * *',
  $$SELECT run_escalation_checks()$$
);
