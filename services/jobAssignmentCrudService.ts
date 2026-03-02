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
  getAdminsAndSupervisors,
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
  const responseDeadline = new Date(now.getTime() + 15 * 60 * 1000);

  const { data, error } = await supabase
    .from('jobs')
    .update({
      assigned_technician_id: technicianId,
      assigned_technician_name: technicianName,
      status: JobStatusEnum.ASSIGNED,
      assigned_at: now.toISOString(),
      assigned_by_id: assignedById || null,
      assigned_by_name: assignedByName || null,
      technician_response_deadline: responseDeadline.toISOString(),
      technician_accepted_at: null,
      technician_rejected_at: null,
      technician_rejection_reason: null,
      no_response_alerted_at: null,
    })
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
  await notifyJobAssignment(technicianId, job);

  return job;
};

export const acceptJobAssignment = async (jobId: string, technicianId: string, technicianName: string): Promise<Job> => {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('jobs')
    .update({ technician_accepted_at: now })
    .eq('job_id', jobId)
    .eq('assigned_technician_id', technicianId)
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

  const admins = await getAdminsAndSupervisors();
  for (const admin of admins) {
    await createNotification({
      user_id: admin.user_id,
      type: NotificationType.JOB_UPDATED,
      title: 'Job Accepted',
      message: `${technicianName} accepted job "${job.title}".`,
      reference_type: 'job',
      reference_id: jobId,
      priority: 'normal',
    });
  }

  return job;
};

export const rejectJobAssignment = async (
  jobId: string,
  technicianId: string,
  technicianName: string,
  reason: string
): Promise<Job> => {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('jobs')
    .update({
      technician_rejected_at: now,
      technician_rejection_reason: reason,
      status: JobStatusEnum.NEW,
      assigned_technician_id: null,
      assigned_technician_name: null,
      assigned_at: null,
      technician_response_deadline: null,
    })
    .eq('job_id', jobId)
    .eq('assigned_technician_id', technicianId)
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
  await notifyJobRejectedByTech(jobId, job.title, technicianName, reason);

  return job;
};

export const checkExpiredJobResponses = async (): Promise<{ alertedJobs: string[] }> => {
  const alertedJobs: string[] = [];
  const now = new Date();

  try {
    const { data: expiredJobs, error } = await supabase
      .from('jobs')
      .select(`job_id, title, assigned_technician_id, assigned_technician_name, technician_response_deadline, customer:customers(name)`)
      .is('deleted_at', null)
      .eq('status', JobStatusEnum.ASSIGNED)
      .is('technician_accepted_at', null)
      .is('technician_rejected_at', null)
      .is('no_response_alerted_at', null)
      .not('technician_response_deadline', 'is', null)
      .lt('technician_response_deadline', now.toISOString());

    if (error) {
      return { alertedJobs };
    }

    for (const job of (expiredJobs || [])) {
      await notifyNoResponseFromTech(job.job_id, job.title, job.assigned_technician_name || 'Unknown');
      await supabase.from('jobs').update({ no_response_alerted_at: now.toISOString() }).eq('job_id', job.job_id);
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
      .not('technician_response_deadline', 'is', null)
      .order('technician_response_deadline', { ascending: true });

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
    const responseDeadline = new Date(now.getTime() + 15 * 60 * 1000);

    const { data, error } = await supabase
      .from('jobs')
      .update({
        assigned_technician_id: newTechnicianId,
        assigned_technician_name: newTechnicianName,
        assigned_at: now.toISOString(),
        assigned_by_id: reassignedById,
        assigned_by_name: reassignedByName,
        technician_response_deadline: responseDeadline.toISOString(),
        technician_accepted_at: null,
        technician_rejected_at: null,
        technician_rejection_reason: null,
        no_response_alerted_at: null,
      })
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
