/**
 * Job Assignment CRUD Service
 *
 * Handles core job assignment, acceptance, rejection, reassignment,
 * and response deadline operations on the jobs table.
 */

import type { Job } from '../types';
import { JobStatus as JobStatusEnum, NotificationType } from '../types';
import {
  createNotification,
  notifyJobAssignment,
  notifyJobRejectedByTech,
  notifyNoResponseFromTech
} from './notificationService';
import { supabase } from './supabaseClient';

// =====================
// ON-CALL JOB ACCEPT/REJECT
// =====================

export const assignJob = async (jobId: string, technicianId: string, technicianName: string, assignedById?: string, assignedByName?: string): Promise<Job> => {
  const now = new Date();

  const { data, error } = await supabase
    .from('jobs')
    .update({
      assigned_technician_id: technicianId,
      assigned_technician_name: technicianName,
      status: JobStatusEnum.ASSIGNED,
      assigned_at: now.toISOString(),
      assigned_by_id: assignedById || null,
      assigned_by_name: assignedByName || null,
      technician_accepted_at: null,
      technician_rejected_at: null,
      technician_rejection_reason: null,
    })
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
  await notifyJobAssignment(technicianId, job);

  return job;
};

export const acceptJobAssignment = async (jobId: string, _technicianId: string, _technicianName: string): Promise<Job> => {
  // Admin/supervisor notification fan-out is handled by the Postgres trigger
  // `trg_notify_admins_on_accept` (migration 20260409_notify_admins_on_accept.sql).
  // That removes ~4 sequential round trips that used to block this call.
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('jobs')
    .update({ technician_accepted_at: now })
    .eq('job_id', jobId)
    .eq('assigned_technician_id', _technicianId)
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

  return data as Job;
};

export const rejectJobAssignment = async (
  jobId: string,
  technicianId: string,
  technicianName: string,
  reason: string,
  rejectionPhotoId?: string
): Promise<Job> => {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('jobs')
    .update({
      technician_rejected_at: now,
      technician_rejection_reason: reason,
      technician_rejection_photo_id: rejectionPhotoId ?? null,
      status: JobStatusEnum.NEW,
      assigned_technician_id: null,
      assigned_technician_name: null,
      assigned_at: null,
    })
    .eq('job_id', jobId)
    .eq('assigned_technician_id', technicianId)
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
  await notifyJobRejectedByTech(jobId, job.title, technicianName, reason);

  return job;
};

export const checkExpiredJobResponses = async (): Promise<{ alertedJobs: string[] }> => {
  const alertedJobs: string[] = [];

  try {
    const { data: expiredJobs, error } = await supabase
      .from('jobs')
      .select(`job_id, title, assigned_technician_id, assigned_technician_name, assigned_at, customer:customers(name)`)
      .is('deleted_at', null)
      .eq('status', JobStatusEnum.ASSIGNED)
      .is('technician_accepted_at', null)
      .is('technician_rejected_at', null);

    if (error) {
      return { alertedJobs };
    }

    for (const job of (expiredJobs || [])) {
      await notifyNoResponseFromTech(job.job_id, job.title, job.assigned_technician_name || 'Unknown');
      // Note: no_response_alerted_at column not in DB — skipping update
      alertedJobs.push(job.job_id);
    }

    return { alertedJobs };
  } catch (_e) {
    return { alertedJobs };
  }
};

export const getJobsPendingResponse = async (): Promise<Job[]> => {
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select(`*, customer:customers(*), forklift:forklifts!forklift_id(*)`)
      .is('deleted_at', null)
      .eq('status', JobStatusEnum.ASSIGNED)
      .is('technician_accepted_at', null)
      .is('technician_rejected_at', null)
      .order('assigned_at', { ascending: true });

    if (error) {
      return [];
    }

    return (data || []) as Job[];
  } catch (_e) {
    return [];
  }
};

// =====================
// JOB REASSIGNMENT
// =====================

export const reassignJob = async (
  jobId: string,
  newTechnicianId: string,
  newTechnicianName: string,
  reassignedById: string,
  reassignedByName: string
): Promise<Job | null> => {
  try {
    const { data: currentJob } = await supabase
      .from('jobs')
      .select('assigned_technician_id')
      .is('deleted_at', null)
      .eq('job_id', jobId)
      .single();

    const oldTechnicianId = currentJob?.assigned_technician_id;

    const now = new Date();

    const { data, error } = await supabase
      .from('jobs')
      .update({
        assigned_technician_id: newTechnicianId,
        assigned_technician_name: newTechnicianName,
        assigned_at: now.toISOString(),
        assigned_by_id: reassignedById,
        assigned_by_name: reassignedByName,
        technician_accepted_at: null,
        technician_rejected_at: null,
        technician_rejection_reason: null,
        technician_signature: null,
      })
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

    if (error) {
      return null;
    }

    const updatedJob = data as Job;

    await notifyJobAssignment(newTechnicianId, updatedJob);

    if (oldTechnicianId && oldTechnicianId !== newTechnicianId) {
      await createNotification({
        user_id: oldTechnicianId,
        type: NotificationType.JOB_UPDATED,
        title: 'Job Reassigned',
        message: `Job "${updatedJob.title}" has been reassigned to another technician.`,
        reference_type: 'job',
        reference_id: jobId,
        priority: 'normal',
      });
    }

    return updatedJob;
  } catch (_e) {
    return null;
  }
};
