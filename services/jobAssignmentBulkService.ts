/**
 * Job Assignment Bulk/Helper Service
 *
 * Handles helper technician assignments, work tracking,
 * and user assignment type lookups on the job_assignments table.
 */

import type { JobAssignment } from '../types';
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
