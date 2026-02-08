/**
 * Job Status Service
 *
 * Handles job status transitions and multi-day job flow.
 */

import type { Job,JobStatus } from '../types';
import { ForkliftStatus,JobStatus as JobStatusEnum } from '../types';
import { notifyPendingFinalization } from './notificationService';
import { logDebug,supabase } from './supabaseClient';

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
  
  // Validation for status transitions
  if (status === JobStatusEnum.IN_PROGRESS && previousStatus !== JobStatusEnum.IN_PROGRESS) {
    if (!currentJob?.assigned_technician_id) {
      throw new Error('Cannot start job: No technician assigned');
    }
    if (!currentJob?.forklift_id) {
      throw new Error('Cannot start job: No forklift assigned');
    }
  }
  
  if (status === JobStatusEnum.AWAITING_FINALIZATION) {
    if (!currentJob?.hourmeter_reading) {
      throw new Error('Cannot complete job: Hourmeter reading is required');
    }
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
      media:job_media(*),
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
 * Mark job to continue tomorrow (multi-day job support)
 */
export const markJobContinueTomorrow = async (
  jobId: string,
  hourmeter: number | undefined,
  _userId: string,
  _userName: string
): Promise<Job> => {
  logDebug('[JobService] markJobContinueTomorrow called for job:', jobId);
  
  const updateData: Record<string, unknown> = {
    status: 'continue_tomorrow',
    updated_at: new Date().toISOString()
  };
  
  if (hourmeter !== undefined) {
    updateData.hourmeter_reading = hourmeter;
  }
  
  const { data, error } = await supabase
    .from('jobs')
    .update(updateData)
    .eq('job_id', jobId)
    .select()
    .single();
  
  if (error) throw new Error(error.message);
  return data as Job;
};

/**
 * Resume a multi-day job
 */
export const resumeMultiDayJob = async (
  jobId: string,
  _userId: string,
  _userName: string
): Promise<Job> => {
  logDebug('[JobService] resumeMultiDayJob called for job:', jobId);
  
  const { data, error } = await supabase
    .from('jobs')
    .update({
      status: 'in_progress',
      updated_at: new Date().toISOString()
    })
    .eq('job_id', jobId)
    .select()
    .single();
  
  if (error) throw new Error(error.message);
  return data as Job;
};
