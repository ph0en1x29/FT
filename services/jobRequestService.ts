/**
 * Job Request Service
 * 
 * Handles in-job requests: spare parts, assistance, skillful technician.
 */

import { notifyAdminsOfRequest } from './notificationService';
import { supabase } from './supabaseClient';

// =====================
// JOB REQUESTS
// =====================

export const createJobRequest = async (
  jobId: string,
  requestType: 'assistance' | 'spare_part' | 'skillful_technician',
  requestedBy: string,
  description: string,
  photoUrl?: string
): Promise<{ request_id: string } | null> => {
  try {
    const { data, error } = await supabase
      .from('job_requests')
      .insert({
        job_id: jobId,
        request_type: requestType,
        requested_by: requestedBy,
        description: description,
        photo_url: photoUrl || null,
        status: 'pending',
      })
      .select('request_id')
      .single();

    if (error) {
      return null;
    }

    const { data: technician } = await supabase
      .from('users')
      .select('name, full_name')
      .eq('user_id', requestedBy)
      .single();
    
    const techName = technician?.full_name || technician?.name || 'Technician';
    await notifyAdminsOfRequest(requestType, techName, jobId, description);

    return data;
  } catch (_e) {
    return null;
  }
};

export const updateJobRequest = async (
  requestId: string,
  requestedBy: string,
  updates: {
    description?: string;
    request_type?: 'assistance' | 'spare_part' | 'skillful_technician';
    photo_url?: string | null;
  }
): Promise<boolean> => {
  try {
    const { data: existing, error: checkError } = await supabase
      .from('job_requests')
      .select('request_id, status, requested_by')
      .eq('request_id', requestId)
      .single();

    if (checkError || !existing) {
      return false;
    }

    if (existing.status !== 'pending') {
      return false;
    }

    if (existing.requested_by !== requestedBy) {
      return false;
    }

    const { error } = await supabase
      .from('job_requests')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('request_id', requestId);

    if (error) {
      return false;
    }

    return true;
  } catch (_e) {
    return false;
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getJobRequests = async (jobId: string): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from('job_requests')
      .select(`
        *,
        requested_by_user:users!job_requests_requested_by_fkey(user_id, name, full_name),
        responded_by_user:users!job_requests_responded_by_fkey(user_id, name, full_name),
        admin_response_part:parts!job_requests_admin_response_part_id_fkey(part_id, part_name, sell_price)
      `)
      .eq('job_id', jobId)
      .order('created_at', { ascending: false });

    if (error) {
      return [];
    }
    return data || [];
  } catch (_e) {
    return [];
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getPendingRequests = async (): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from('job_requests')
      .select(`
        *,
        job:jobs(job_id, description, status, forklift:forklifts!forklift_id(serial_number, make, model)),
        requested_by_user:users!job_requests_requested_by_fkey(user_id, name, full_name)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) {
      return [];
    }

    return data || [];
  } catch (_e) {
    return [];
  }
};


// Re-export from jobRequestApprovalService
export {
  approveSparePartRequest,
  rejectRequest,
  acknowledgeSkillfulTechRequest,
  approveAssistanceRequest,
  markOutOfStock,
  markPartReceived,
  issuePartToTechnician,
  confirmPartCollection,
} from './jobRequestApprovalService';

export const getRequestCounts = async (): Promise<{ pending: number; total: number }> => {
  try {
    const { count: pending, error: pendingError } = await supabase
      .from('job_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    const { count: total, error: totalError } = await supabase
      .from('job_requests')
      .select('*', { count: 'exact', head: true });

    if (pendingError || totalError) return { pending: 0, total: 0 };

    return { pending: pending || 0, total: total || 0 };
  } catch (_e) {
    return { pending: 0, total: 0 };
  }
};
