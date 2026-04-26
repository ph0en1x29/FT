/**
 * Job Status Service
 *
 * Handles job status transitions and multi-day job flow.
 */

import type { Job,JobStatus } from '../types';
import { ForkliftStatus,JobStatus as JobStatusEnum } from '../types';
import { notifyPendingFinalization } from './notificationService';
import { JOB_SELECT,logDebug,logError,supabase } from './supabaseClient';

// =====================
// STATUS TRANSITIONS
// =====================

export const updateJobStatus = async (jobId: string, status: JobStatus, completedById?: string, completedByName?: string): Promise<Job> => {
  const { data: currentJob, error: fetchError } = await supabase
    .from('jobs')
    .select('status, arrival_time, started_at, completion_time, repair_end_time, completed_at, assigned_technician_id, forklift_id, hourmeter_reading, technician_signature, customer_signature')
    .eq('job_id', jobId)
    .single();
  
  if (fetchError) throw new Error(fetchError.message);
  
  const previousStatus = currentJob?.status;
  
  // LAYERING CONTRACT — this service is generic CRUD only.
  //   Hourmeter gate  → UI (isHourmeterExemptJob helper, HOURMETER_EXEMPT_JOB_TYPES)
  //   Forklift gate   → UI (startJobWithCondition validates against forklift reading)
  //   Checklist gate  → DB trigger validate_job_completion_requirements (FTS + Repair exempt)
  //   Signature gate  → DB trigger (authoritative); mirrored below for a friendlier toast
  //   Parts gate      → DB trigger
  // NEVER add a job-type-specific throw here — services/ is intentionally
  // job-type-blind. If a policy needs enforcement, add it in the UI for UX
  // and/or the DB trigger for authority, then verify both stay in sync.
  if (status === JobStatusEnum.IN_PROGRESS && previousStatus !== JobStatusEnum.IN_PROGRESS) {
    if (!currentJob?.assigned_technician_id) {
      throw new Error('Cannot start job: No technician assigned');
    }
  }

  if (status === JobStatusEnum.AWAITING_FINALIZATION) {
    const hasTechSignature = !!currentJob?.technician_signature;
    const hasCustomerSignature = !!currentJob?.customer_signature;
    if (!hasTechSignature || !hasCustomerSignature) {
      throw new Error('Cannot complete job: Both technician and customer signatures are required');
    }
  }
  
  const updates: Partial<Job> = { status };
  const now = new Date().toISOString();

  // Set timestamps based on status
  if (status === JobStatusEnum.IN_PROGRESS) {
    if (!currentJob?.arrival_time) updates.arrival_time = now;
    if (!currentJob?.started_at) updates.started_at = now;
  }
  
  if (status === JobStatusEnum.AWAITING_FINALIZATION) {
    if (!currentJob?.completion_time) updates.completion_time = now;
    if (!currentJob?.repair_end_time) updates.repair_end_time = now;
    if (!currentJob?.completed_at) {
      updates.completed_at = now;
      updates.completed_by_id = completedById || null;
      updates.completed_by_name = completedByName || null;
    }
  }
  
  // Reset timestamps on status rollback
  if (status === JobStatusEnum.ASSIGNED && previousStatus === JobStatusEnum.IN_PROGRESS) {
    updates.arrival_time = null;
    updates.started_at = null;
  }
  
  if (status === JobStatusEnum.IN_PROGRESS && 
      (previousStatus === JobStatusEnum.AWAITING_FINALIZATION || previousStatus === JobStatusEnum.COMPLETED)) {
    updates.completion_time = null;
    updates.repair_end_time = null;
    updates.completed_at = null;
    updates.completed_by_id = null;
    updates.completed_by_name = null;
  }

  const { data, error } = await supabase
    .from('jobs')
    .update(updates)
    .eq('job_id', jobId)
    .select(`
      *,
      customer:customers(*),
      forklift:forklifts!forklift_id(*),
      parts_used:job_parts(*),
      media:job_media!job_media_job_id_fkey(*),
      extra_charges:extra_charges(*)
    `)
    .single();

  if (error) throw new Error(error.message);

  const job = data as Job;

  // Sync started_at to job_service_records when moving to IN_PROGRESS
  if (status === JobStatusEnum.IN_PROGRESS && previousStatus !== JobStatusEnum.IN_PROGRESS) {
    const now = new Date().toISOString();
    await supabase
      .from('job_service_records')
      .update({
        started_at: now,
        repair_start_time: job.repair_start_time || now,
        updated_at: now,
      })
      .eq('job_id', jobId)
      .is('started_at', null); // Only update if not already set
  }

  // Update forklift status
  if (currentJob?.forklift_id) {
    if (status === JobStatusEnum.IN_PROGRESS && previousStatus !== JobStatusEnum.IN_PROGRESS) {
      await supabase
        .from('forklifts')
        .update({ status: ForkliftStatus.IN_SERVICE, updated_at: new Date().toISOString() })
        .eq('forklift_id', currentJob.forklift_id);
    }

    if (status === JobStatusEnum.COMPLETED || status === JobStatusEnum.AWAITING_FINALIZATION) {
      const { data: forklift } = await supabase
        .from('forklifts')
        .select('hourmeter, next_service_due, next_service_hourmeter')
        .eq('forklift_id', currentJob.forklift_id)
        .single();

      if (forklift) {
        const now = new Date();
        const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const isServiceDueByDate = forklift.next_service_due && new Date(forklift.next_service_due) <= sevenDaysFromNow;
        const hoursUntilService = forklift.next_service_hourmeter ? forklift.next_service_hourmeter - (forklift.hourmeter || 0) : null;
        const isServiceDueByHours = hoursUntilService !== null && hoursUntilService <= 50;

        const newStatus = (isServiceDueByDate || isServiceDueByHours)
          ? ForkliftStatus.SERVICE_DUE
          : ForkliftStatus.AVAILABLE;

        await supabase
          .from('forklifts')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('forklift_id', currentJob.forklift_id);
      }
    }
  }

  // Notify on awaiting finalization
  if (status === JobStatusEnum.AWAITING_FINALIZATION) {
    await notifyPendingFinalization(job);
  }

  return job;
};

// =====================
// MULTI-DAY JOB SUPPORT
// =====================

/**
 * Mark job to continue tomorrow (multi-day job support). Returns the updated
 * Job row so callers can apply via setJob({...updated}) and feed the
 * realtime-echo dedupe (2026-04-08).
 */
export const markJobContinueTomorrow = async (
  jobId: string,
  reason: string,
  userId: string,
  userName: string
): Promise<Job | null> => {
  logDebug('[JobService] markJobContinueTomorrow called for job:', jobId);

  // Fetch current notes so we can append without overwriting
  const { data: currentJob } = await supabase
    .from('jobs')
    .select('notes')
    .eq('job_id', jobId)
    .single();

  const currentNotes: string[] = Array.isArray(currentJob?.notes) ? currentJob.notes : [];
  const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const noteEntry = `[Continue Tomorrow — ${dateStr} — ${userName}]: ${reason.trim()}`;

  const { data, error } = await supabase
    .from('jobs')
    .update({
      status: JobStatusEnum.INCOMPLETE_CONTINUING,
      notes: [...currentNotes, noteEntry],
    })
    .eq('job_id', jobId)
    .select(JOB_SELECT.DETAIL)
    .single();

  if (error) {
    logError('[JobService] markJobContinueTomorrow failed:', error.message);
    return null;
  }

  return data as unknown as Job;
};

/**
 * Resume a multi-day job. Returns the updated Job row so callers can apply
 * via setJob({...updated}) and feed the realtime-echo dedupe (2026-04-08).
 */
export const resumeMultiDayJob = async (
  jobId: string,
  _userId: string,
  _userName: string
): Promise<Job | null> => {
  logDebug('[JobService] resumeMultiDayJob called for job:', jobId);

  const { data, error } = await supabase
    .from('jobs')
    .update({
      status: 'In Progress',
    })
    .eq('job_id', jobId)
    .select(JOB_SELECT.DETAIL)
    .single();

  if (error) {
    logError('[JobService] resumeMultiDayJob failed:', error.message);
    return null;
  }
  return data as unknown as Job;
};
