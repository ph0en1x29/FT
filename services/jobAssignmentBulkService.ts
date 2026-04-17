/**
 * Job Assignment Bulk/Helper Service
 *
 * Handles helper technician assignments, work tracking,
 * and user assignment type lookups on the job_assignments table.
 */

import type { JobAssignment } from '../types';
import { NotificationType } from '../types';
import { createNotification } from './notificationService';
import { supabase } from './supabaseClient';

// =====================
// JOB ASSIGNMENTS (Helper Technician)
// =====================

export const getJobAssignments = async (jobId: string): Promise<JobAssignment[]> => {
  try {
    const { data, error } = await supabase
      .from('job_assignments')
      .select(`*, technician:users!job_assignments_technician_id_fkey(user_id, name, email, phone, role)`)
      .eq('job_id', jobId)
      .order('assigned_at', { ascending: false });

    if (error) {
      return [];
    }
    return data || [];
  } catch (_e) {
    return [];
  }
};

export const getActiveHelper = async (jobId: string): Promise<JobAssignment | null> => {
  try {
    const { data, error } = await supabase
      .from('job_assignments')
      .select(`*, technician:users!job_assignments_technician_id_fkey(user_id, name, email, phone, role)`)
      .eq('job_id', jobId)
      .eq('assignment_type', 'assistant')
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      return null;
    }
    return data || null;
  } catch (_e) {
    return null;
  }
};

export const assignHelper = async (
  jobId: string,
  technicianId: string,
  assignedById: string,
  notes?: string
): Promise<JobAssignment | null> => {
  try {
    await supabase
      .from('job_assignments')
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq('job_id', jobId)
      .eq('assignment_type', 'assistant')
      .eq('is_active', true);

    const { data, error } = await supabase
      .from('job_assignments')
      .insert({
        job_id: jobId,
        technician_id: technicianId,
        assignment_type: 'assistant',
        assigned_by: assignedById,
        notes: notes || null,
        is_active: true,
      })
      .select(`*, technician:users!job_assignments_technician_id_fkey(user_id, name, email, phone, role)`)
      .single();

    if (error) {
      return null;
    }

    // Notify the helper (new assignee) and the lead technician so both paths
    // (direct admin assign + request-approval) surface the assignment. The
    // notificationService has a 5-min dedup on (user_id, type, reference_id)
    // so concurrent callers can't double-post.
    try {
      const { data: job } = await supabase
        .from('jobs')
        .select('title, assigned_technician_id, assigned_technician_name')
        .eq('job_id', jobId)
        .single();

      const jobTitle = job?.title || 'a job';
      const helperTech = (data as JobAssignment & { technician?: { name?: string; full_name?: string } })?.technician;
      const helperName = helperTech?.full_name || helperTech?.name || 'A helper';

      await createNotification({
        user_id: technicianId,
        type: NotificationType.JOB_ASSIGNED,
        title: 'Helper Assignment',
        message: `You have been assigned to help with: ${jobTitle}`,
        reference_type: 'job',
        reference_id: jobId,
        priority: 'high',
      });

      if (job?.assigned_technician_id && job.assigned_technician_id !== technicianId) {
        await createNotification({
          user_id: job.assigned_technician_id,
          type: NotificationType.JOB_UPDATED,
          title: 'Helper Assigned',
          message: `${helperName} has been assigned to help you on: ${jobTitle}`,
          reference_type: 'job',
          reference_id: jobId,
          priority: 'normal',
        });
      }
    } catch {
      /* Notification failure must not roll back the assignment. */
    }

    return data;
  } catch (_e) {
    return null;
  }
};

export const removeHelper = async (jobId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('job_assignments')
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq('job_id', jobId)
      .eq('assignment_type', 'assistant')
      .eq('is_active', true);

    if (error) {
      return false;
    }
    return true;
  } catch (_e) {
    return false;
  }
};

export const startHelperWork = async (assignmentId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('job_assignments')
      .update({ started_at: new Date().toISOString() })
      .eq('assignment_id', assignmentId);

    if (error) {
      return false;
    }
    return true;
  } catch (_e) {
    return false;
  }
};

export const endHelperWork = async (assignmentId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('job_assignments')
      .update({ ended_at: new Date().toISOString() })
      .eq('assignment_id', assignmentId);

    if (error) {
      return false;
    }
    return true;
  } catch (_e) {
    return false;
  }
};

export const getHelperJobs = async (technicianId: string): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from('job_assignments')
      .select('job_id')
      .eq('technician_id', technicianId)
      .eq('assignment_type', 'assistant')
      .eq('is_active', true);

    if (error) {
      return [];
    }
    return data?.map(d => d.job_id) || [];
  } catch (_e) {
    return [];
  }
};

export const isUserHelperOnJob = async (jobId: string, userId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('job_assignments')
      .select('assignment_id')
      .eq('job_id', jobId)
      .eq('technician_id', userId)
      .eq('assignment_type', 'assistant')
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      return false;
    }
    return !!data;
  } catch (_e) {
    return false;
  }
};

export const getUserAssignmentType = async (jobId: string, userId: string): Promise<'lead' | 'assistant' | null> => {
  try {
    const { data: job } = await supabase
      .from('jobs')
      .select('assigned_technician_id')
      .is('deleted_at', null)
      .eq('job_id', jobId)
      .single();

    if (job?.assigned_technician_id === userId) return 'lead';

    const { data: assignment } = await supabase
      .from('job_assignments')
      .select('assignment_type')
      .eq('job_id', jobId)
      .eq('technician_id', userId)
      .eq('is_active', true)
      .single();

    if (assignment?.assignment_type === 'assistant') return 'assistant';

    return null;
  } catch (_e) {
    return null;
  }
};
