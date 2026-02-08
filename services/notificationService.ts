/**
 * Notification Service
 * 
 * Handles notification CRUD and various notification triggers
 */

import type { Job,Notification } from '../types';
import { NotificationType,UserRole } from '../types';
import { supabase } from './supabaseClient';

// =====================
// NOTIFICATION CRUD
// =====================

export const getNotifications = async (userId: string, unreadOnly: boolean = false): Promise<Notification[]> => {
  try {
    let query = supabase
      .from('notifications')
      .select(`
        notification_id,
        user_id,
        type,
        title,
        message,
        reference_type,
        reference_id,
        is_read,
        priority,
        created_at
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    const { data, error } = await query;
    if (error) {
      return [];
    }
    return data as Notification[];
  } catch (_e) {
    return [];
  }
};

export const getUnreadNotificationCount = async (userId: string): Promise<number> => {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('notification_id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) return 0;
    return count || 0;
  } catch (_e) {
    return 0;
  }
};

/**
 * Creates a notification for a user.
 * Returns true on success, false on failure.
 * Note: Does not return the created notification object due to RLS constraints
 */
export const createNotification = async (notification: Partial<Notification>): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: notification.user_id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        reference_type: notification.reference_type,
        reference_id: notification.reference_id,
        priority: notification.priority || 'normal',
      });

    if (error) {
      return false;
    }
    return true;
  } catch (_e) {
    return false;
  }
};

export const markNotificationRead = async (notificationId: string): Promise<void> => {
  try {
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('notification_id', notificationId);
  } catch (_e) {
    /* Silently ignore */
  }
};

export const markAllNotificationsRead = async (userId: string): Promise<void> => {
  try {
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_read', false);
  } catch (_e) {
    /* Silently ignore */
  }
};

// =====================
// USER GROUP FETCHERS (for notifications)
// =====================

export const getAccountants = async (): Promise<{ user_id: string; name: string }[]> => {
  const { data, error } = await supabase
    .from('users')
    .select('user_id, name')
    .eq('role', UserRole.ACCOUNTANT)
    .eq('is_active', true);

  if (error) {
    return [];
  }
  return data || [];
};

export const getAdminsAndSupervisors = async (): Promise<{ user_id: string; name: string }[]> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('user_id, name')
      .in('role', [UserRole.ADMIN, UserRole.SUPERVISOR])
      .eq('is_active', true);

    if (error) {
      return [];
    }
    return data || [];
  } catch (_e) {
    return [];
  }
};

// =====================
// NOTIFICATION TRIGGERS
// =====================

export const notifyJobAssignment = async (technicianId: string, job: Job): Promise<void> => {
  await createNotification({
    user_id: technicianId,
    type: NotificationType.JOB_ASSIGNED,
    title: 'New Job Assigned',
    message: `You have been assigned to: ${job.title} - ${job.customer?.name || 'Unknown Customer'}`,
    reference_type: 'job',
    reference_id: job.job_id,
    priority: job.priority === 'Emergency' ? 'urgent' : job.priority === 'High' ? 'high' : 'normal',
  });
};

export const notifyPendingFinalization = async (job: Job): Promise<void> => {
  try {
    const accountants = await getAccountants();
    const { data: admins } = await supabase
      .from('users')
      .select('user_id, name')
      .eq('role', UserRole.ADMIN)
      .eq('is_active', true);

    const usersToNotify = [...accountants, ...(admins || [])];

    for (const user of usersToNotify) {
      await createNotification({
        user_id: user.user_id,
        type: NotificationType.JOB_PENDING,
        title: 'Job Pending Finalization',
        message: `Job "${job.title}" for ${job.customer?.name || 'Unknown Customer'} is ready for invoice finalization.`,
        reference_type: 'job',
        reference_id: job.job_id,
        priority: job.priority === 'Emergency' ? 'urgent' : job.priority === 'High' ? 'high' : 'normal',
      });
    }
  } catch (_e) {
    /* Silently ignore */
  }
};

export const notifyAdminsOfRequest = async (
  requestType: 'assistance' | 'spare_part' | 'skillful_technician',
  technicianName: string,
  jobId: string,
  description: string
): Promise<void> => {
  try {
    const admins = await getAdminsAndSupervisors();
    
    const typeLabels: Record<string, { title: string; type: NotificationType }> = {
      'assistance': { title: 'Helper Request', type: NotificationType.HELPER_REQUEST },
      'spare_part': { title: 'Spare Part Request', type: NotificationType.SPARE_PART_REQUEST },
      'skillful_technician': { title: 'Skillful Technician Request', type: NotificationType.SKILLFUL_TECH_REQUEST },
    };

    const { title, type } = typeLabels[requestType] || { title: 'New Request', type: NotificationType.JOB_PENDING };

    for (const admin of admins) {
      await createNotification({
        user_id: admin.user_id,
        type: type,
        title: title,
        message: `${technicianName} requests ${requestType.replace('_', ' ')}: ${description.substring(0, 100)}${description.length > 100 ? '...' : ''}`,
        reference_type: 'job',
        reference_id: jobId,
        priority: requestType === 'assistance' ? 'high' : 'normal',
      });
    }
  } catch (_e) {
    /* Silently ignore */
  }
};

export const notifyRequestApproved = async (
  technicianId: string,
  requestType: string,
  jobId: string,
  adminNotes?: string
): Promise<void> => {
  try {
    await createNotification({
      user_id: technicianId,
      type: NotificationType.REQUEST_APPROVED,
      title: 'Request Approved ✓',
      message: `Your ${requestType.replace('_', ' ')} request has been approved.${adminNotes ? ` Note: ${adminNotes}` : ''}`,
      reference_type: 'job',
      reference_id: jobId,
      priority: 'high',
    });
  } catch (_e) {
    /* Silently ignore */
  }
};

export const notifyRequestRejected = async (
  technicianId: string,
  requestType: string,
  jobId: string,
  reason: string
): Promise<void> => {
  try {
    await createNotification({
      user_id: technicianId,
      type: NotificationType.REQUEST_REJECTED,
      title: 'Request Rejected',
      message: `Your ${requestType.replace('_', ' ')} request was rejected. Reason: ${reason}`,
      reference_type: 'job',
      reference_id: jobId,
      priority: 'high',
    });
  } catch (_e) {
    /* Silently ignore */
  }
};

export const notifyJobReassigned = async (
  newTechnicianId: string,
  jobTitle: string,
  jobId: string,
  previousTechnicianName?: string
): Promise<void> => {
  try {
    await createNotification({
      user_id: newTechnicianId,
      type: NotificationType.JOB_REASSIGNED,
      title: 'Job Reassigned to You',
      message: `Job "${jobTitle}" has been reassigned to you${previousTechnicianName ? ` from ${previousTechnicianName}` : ''}.`,
      reference_type: 'job',
      reference_id: jobId,
      priority: 'high',
    });
  } catch (_e) {
    /* Silently ignore */
  }
};

export const notifyJobRejectedByTech = async (
  jobId: string,
  jobTitle: string,
  technicianName: string,
  reason: string
): Promise<void> => {
  try {
    const admins = await getAdminsAndSupervisors();
    
    for (const admin of admins) {
      await createNotification({
        user_id: admin.user_id,
        type: NotificationType.JOB_PENDING,
        title: 'Job Rejected - Needs Reassignment',
        message: `${technicianName} rejected job "${jobTitle}". Reason: ${reason}`,
        reference_type: 'job',
        reference_id: jobId,
        priority: 'high',
      });
    }
  } catch (_e) {
    /* Silently ignore */
  }
};

export const notifyNoResponseFromTech = async (
  jobId: string,
  jobTitle: string,
  technicianName: string
): Promise<void> => {
  try {
    const admins = await getAdminsAndSupervisors();
    
    for (const admin of admins) {
      await createNotification({
        user_id: admin.user_id,
        type: NotificationType.JOB_PENDING,
        title: 'No Response - Job Acceptance Expired',
        message: `${technicianName} did not respond to job "${jobTitle}" within 15 minutes. Consider reassigning.`,
        reference_type: 'job',
        reference_id: jobId,
        priority: 'urgent',
      });
    }
  } catch (_e) {
    /* Silently ignore */
  }
};
