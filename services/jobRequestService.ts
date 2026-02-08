/**
 * Job Request Service
 * 
 * Handles in-job requests: spare parts, assistance, skillful technician.
 */

import { NotificationType } from '../types';
import { assignHelper } from './jobAssignmentService';
import {
createNotification,
notifyAdminsOfRequest,
notifyRequestApproved,
notifyRequestRejected,
} from './notificationService';
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
  } catch (e) {
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
  } catch (e) {
    return false;
  }
};

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
  } catch (e) {
    return [];
  }
};

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
  } catch (e) {
    return [];
  }
};

export const approveSparePartRequest = async (
  requestId: string,
  adminUserId: string,
  partId: string,
  quantity: number,
  notes?: string,
  adminUserName?: string
): Promise<boolean> => {
  try {
    const { data: request, error: reqError } = await supabase
      .from('job_requests')
      .select('job_id, requested_by')
      .eq('request_id', requestId)
      .single();

    if (reqError || !request) {
      return false;
    }

    const { data: part, error: partError } = await supabase
      .from('parts')
      .select('part_name, sell_price, stock_quantity')
      .eq('part_id', partId)
      .single();

    if (partError || !part) {
      return false;
    }

    if (part.stock_quantity < quantity) {
      return false;
    }

    // ATOMIC stock reservation using database function
    // Prevents race conditions with row-level locking
    const { data: stockReserved, error: stockError } = await supabase
      .rpc('reserve_part_stock', { p_part_id: partId, p_quantity: quantity });

    if (stockError || !stockReserved) {
      // Stock was modified by another request or insufficient
      console.warn('Stock reservation failed:', stockError?.message || 'insufficient stock');
      return false;
    }

    // Stock reserved successfully, now update request and add to job
    const { error: updateError } = await supabase
      .from('job_requests')
      .update({
        status: 'approved',
        admin_response_part_id: partId,
        admin_response_quantity: quantity,
        admin_response_notes: notes || null,
        responded_by: adminUserId,
        responded_at: new Date().toISOString(),
      })
      .eq('request_id', requestId);

    if (updateError) {
      // Rollback stock reservation
      await supabase.rpc('rollback_part_stock', { p_part_id: partId, p_quantity: quantity });
      return false;
    }

    const { error: insertError } = await supabase
      .from('job_parts')
      .insert({
        job_id: request.job_id,
        part_id: partId,
        part_name: part.part_name,
        quantity: quantity,
        sell_price_at_time: part.sell_price,
      });

    if (insertError) {
      // Rollback stock and request status
      await supabase.rpc('rollback_part_stock', { p_part_id: partId, p_quantity: quantity });
      await supabase
        .from('job_requests')
        .update({ status: 'pending', responded_by: null, responded_at: null })
        .eq('request_id', requestId);
      return false;
    }

    // Auto-confirm parts when admin approves request (unified admin workflow)
    if (adminUserName) {
      const { error: confirmError } = await supabase
        .from('jobs')
        .update({
          parts_confirmed_at: new Date().toISOString(),
          parts_confirmed_by_id: adminUserId,
          parts_confirmed_by_name: adminUserName,
        })
        .eq('job_id', request.job_id);
      if (confirmError) {
        console.warn('Part added, but auto-confirm failed:', confirmError.message);
      }
    }

    await notifyRequestApproved(
      request.requested_by,
      'spare_part',
      request.job_id,
      notes || `${quantity}x ${part.part_name} added to your job`
    );

    return true;
  } catch (e) {
    return false;
  }
};

export const rejectRequest = async (
  requestId: string,
  adminUserId: string,
  reason: string
): Promise<boolean> => {
  try {
    const { data: request, error: reqError } = await supabase
      .from('job_requests')
      .select('job_id, requested_by, request_type')
      .eq('request_id', requestId)
      .single();

    if (reqError || !request) {
      return false;
    }

    const { error } = await supabase
      .from('job_requests')
      .update({
        status: 'rejected',
        admin_response_notes: reason,
        responded_by: adminUserId,
        responded_at: new Date().toISOString(),
      })
      .eq('request_id', requestId);

    if (error) {
      return false;
    }

    await notifyRequestRejected(
      request.requested_by,
      request.request_type,
      request.job_id,
      reason
    );

    return true;
  } catch (e) {
    return false;
  }
};

export const acknowledgeSkillfulTechRequest = async (
  requestId: string,
  adminUserId: string,
  notes?: string
): Promise<boolean> => {
  try {
    const { data: request, error: reqError } = await supabase
      .from('job_requests')
      .select('job_id, requested_by, request_type')
      .eq('request_id', requestId)
      .single();

    if (reqError || !request) {
      return false;
    }

    const { error } = await supabase
      .from('job_requests')
      .update({
        status: 'approved',
        admin_response_notes: notes || 'Acknowledged - Job will be reassigned to skilled technician',
        responded_by: adminUserId,
        responded_at: new Date().toISOString(),
      })
      .eq('request_id', requestId);

    if (error) {
      return false;
    }

    await notifyRequestApproved(
      request.requested_by,
      'skillful_technician',
      request.job_id,
      notes || 'Your request has been acknowledged. Job will be reassigned.'
    );

    return true;
  } catch (e) {
    return false;
  }
};

export const approveAssistanceRequest = async (
  requestId: string,
  adminUserId: string,
  helperTechnicianId: string,
  notes?: string
): Promise<boolean> => {
  try {
    const { data: request, error: reqError } = await supabase
      .from('job_requests')
      .select('job_id, requested_by')
      .eq('request_id', requestId)
      .single();

    if (reqError || !request) {
      return false;
    }

    const { data: job } = await supabase
      .from('jobs')
      .select('title, description')
      .eq('job_id', request.job_id)
      .single();

    const { data: helper } = await supabase
      .from('users')
      .select('name, full_name')
      .eq('user_id', helperTechnicianId)
      .single();

    const helperName = helper?.full_name || helper?.name || 'Helper';
    const jobTitle = job?.title || 'Job';

    // FIXED: Assign helper FIRST, only mark approved if successful
    const assignmentResult = await assignHelper(
      request.job_id,
      helperTechnicianId,
      adminUserId,
      notes || 'Assigned via assistance request'
    );

    // If helper assignment failed, don't mark request as approved
    if (!assignmentResult) {
      console.warn('Helper assignment failed for request:', requestId);
      return false;
    }

    // Helper assigned successfully, now mark request as approved
    const { error: updateError } = await supabase
      .from('job_requests')
      .update({
        status: 'approved',
        admin_response_notes: notes || null,
        responded_by: adminUserId,
        responded_at: new Date().toISOString(),
      })
      .eq('request_id', requestId);

    if (updateError) {
      // Helper was assigned but request update failed - log but don't fail
      // The helper IS assigned, so the work was done
      console.warn('Request status update failed after helper assignment:', updateError.message);
    }

    // Send notifications
    await notifyRequestApproved(
      request.requested_by,
      'assistance',
      request.job_id,
      `${helperName} has been assigned to help you.`
    );

    await createNotification({
      user_id: helperTechnicianId,
      type: NotificationType.JOB_ASSIGNED,
      title: 'Helper Assignment',
      message: `You have been assigned to help with: ${jobTitle}`,
      reference_type: 'job',
      reference_id: request.job_id,
      priority: 'high',
    });

    return true;
  } catch (e) {
    return false;
  }
};

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
  } catch (e) {
    return { pending: 0, total: 0 };
  }
};
