/**
 * Job Request Approval Service
 * 
 * Handles approval/rejection of job requests.
 * Split from jobRequestService.ts for maintainability.
 */

import { NotificationType } from '../types';
import { assignHelper } from './jobAssignmentService';
import {
  createNotification,
  notifyRequestApproved,
  notifyRequestRejected,
} from './notificationService';
import { supabase } from './supabaseClient';

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
  } catch (_e) {
    return false;
  }
};


/**
 * Mark request as out of stock — sets job to "Pending Parts" and creates supplier order
 */
export const markOutOfStock = async (
  requestId: string,
  adminUserId: string,
  partId: string,
  supplierNotes?: string
): Promise<boolean> => {
  try {
    const { data: request, error: reqError } = await supabase
      .from('job_requests')
      .select('job_id, requested_by, request_type')
      .eq('request_id', requestId)
      .single();

    if (reqError || !request) return false;

    const { data: part } = await supabase
      .from('parts')
      .select('part_name')
      .eq('part_id', partId)
      .single();

    // Update request to out_of_stock → part_ordered
    const { error: updateError } = await supabase
      .from('job_requests')
      .update({
        status: 'part_ordered',
        admin_response_part_id: partId,
        admin_response_notes: supplierNotes || `${part?.part_name || 'Part'} out of stock — ordered from supplier`,
        responded_by: adminUserId,
        responded_at: new Date().toISOString(),
        supplier_order_notes: supplierNotes || null,
        supplier_order_date: new Date().toISOString(),
      })
      .eq('request_id', requestId);

    if (updateError) return false;

    // Set job to "Pending Parts"
    await supabase
      .from('jobs')
      .update({ status: 'Pending Parts' })
      .eq('job_id', request.job_id);

    // Notify technician
    await notifyRequestRejected(
      request.requested_by,
      request.request_type,
      request.job_id,
      `Part out of stock — ordered from supplier. Job on hold until parts arrive.`
    );

    return true;
  } catch (_e) {
    return false;
  }
};

/**
 * Mark ordered part as received — updates request status and notifies tech
 */
export const markPartReceived = async (
  requestId: string,
  adminUserId: string,
  notes?: string
): Promise<boolean> => {
  try {
    const { data: request, error: reqError } = await supabase
      .from('job_requests')
      .select('job_id, requested_by, admin_response_part_id, admin_response_quantity')
      .eq('request_id', requestId)
      .single();

    if (reqError || !request) return false;

    // Update request
    const { error } = await supabase
      .from('job_requests')
      .update({
        status: 'approved',
        part_received_at: new Date().toISOString(),
        admin_response_notes: notes || 'Part received from supplier — ready for issuance',
      })
      .eq('request_id', requestId);

    if (error) return false;

    // Notify tech
    await notifyRequestApproved(
      request.requested_by,
      'spare_part',
      request.job_id,
      'Ordered part has arrived! Ready for collection.'
    );

    return true;
  } catch (_e) {
    return false;
  }
};

/**
 * Issue approved parts to technician — confirms physical handover
 */
export const issuePartToTechnician = async (
  requestId: string,
  adminUserId: string,
  adminUserName: string
): Promise<boolean> => {
  try {
    const { data: request, error: reqError } = await supabase
      .from('job_requests')
      .select('job_id, requested_by, admin_response_part_id, admin_response_quantity')
      .eq('request_id', requestId)
      .single();

    if (reqError || !request) return false;

    const partId = request.admin_response_part_id;
    const quantity = request.admin_response_quantity || 1;

    if (!partId) return false;

    // Get part details
    const { data: part } = await supabase
      .from('parts')
      .select('part_name, sell_price, stock_quantity')
      .eq('part_id', partId)
      .single();

    if (!part) return false;

    // Reserve stock atomically
    const { data: stockReserved, error: stockError } = await supabase
      .rpc('reserve_part_stock', { p_part_id: partId, p_quantity: quantity });

    if (stockError || !stockReserved) return false;

    // Mark as issued
    const { error: updateError } = await supabase
      .from('job_requests')
      .update({
        status: 'issued',
        issued_by: adminUserId,
        issued_at: new Date().toISOString(),
      })
      .eq('request_id', requestId);

    if (updateError) {
      // Rollback stock
      await supabase.rpc('rollback_part_stock', { p_part_id: partId, p_quantity: quantity });
      return false;
    }

    // Add parts to job
    const { error: insertError } = await supabase
      .from('job_parts')
      .insert({
        job_id: request.job_id,
        part_id: partId,
        part_name: part.part_name,
        quantity,
        sell_price_at_time: part.sell_price,
      });

    if (insertError) {
      await supabase.rpc('rollback_part_stock', { p_part_id: partId, p_quantity: quantity });
      await supabase.from('job_requests').update({ status: 'approved', issued_by: null, issued_at: null }).eq('request_id', requestId);
      return false;
    }

    // Auto-confirm parts
    await supabase
      .from('jobs')
      .update({
        parts_confirmed_at: new Date().toISOString(),
        parts_confirmed_by_id: adminUserId,
        parts_confirmed_by_name: adminUserName,
      })
      .eq('job_id', request.job_id);

    // If job was on Pending Parts, move back to In Progress
    const { data: job } = await supabase
      .from('jobs')
      .select('status')
      .eq('job_id', request.job_id)
      .single();

    if (job?.status === 'Pending Parts') {
      await supabase
        .from('jobs')
        .update({ status: 'In Progress' })
        .eq('job_id', request.job_id);
    }

    // Notify tech
    await notifyRequestApproved(
      request.requested_by,
      'spare_part',
      request.job_id,
      `${quantity}x ${part.part_name} issued — ready for collection`
    );

    return true;
  } catch (_e) {
    return false;
  }
};

/**
 * Technician confirms part collection
 */
export const confirmPartCollection = async (
  requestId: string,
  technicianId: string
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('job_requests')
      .update({
        collected_at: new Date().toISOString(),
      })
      .eq('request_id', requestId)
      .eq('requested_by', technicianId);

    return !error;
  } catch (_e) {
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
  } catch (_e) {
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
  } catch (_e) {
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
  } catch (_e) {
    return false;
  }
};

