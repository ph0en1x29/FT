import { supabase } from './supabaseClient';
import { Job, NotificationType, UserRole } from '../types';
import type { Notification } from '../types';

// =====================
// NOTIFICATION OPERATIONS
// =====================

export const NotificationService = {
  getNotifications: async (userId: string, unreadOnly: boolean = false): Promise<Notification[]> => {
    try {
      // OPTIMIZED: Fetch only needed fields, avoid SELECT *
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
        console.warn('Notifications query failed:', error.message);
        return [];
      }
      return data as Notification[];
    } catch (e) {
      console.warn('Notifications not available:', e);
      return [];
    }
  },

  getUnreadNotificationCount: async (userId: string): Promise<number> => {
    try {
      // OPTIMIZED: Use notification_id for count (smaller than *)
      const { count, error } = await supabase
        .from('notifications')
        .select('notification_id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) return 0;
      return count || 0;
    } catch (e) {
      return 0;
    }
  },

  /**
   * Creates a notification for a user.
   * Returns true on success, false on failure.
   * Note: Does not return the created notification object due to RLS constraints
   * (user A creating notification for user B cannot SELECT user B's notifications).
   */
  createNotification: async (notification: Partial<Notification>): Promise<boolean> => {
    try {
      // NOTE: Removed .select().single() to avoid RLS SELECT denial
      // When user A creates notification for user B, INSERT is allowed but
      // SELECT would fail because user A can't read user B's notifications
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
        console.warn('Failed to create notification:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.warn('Notification creation failed:', e);
      return false;
    }
  },

  markNotificationRead: async (notificationId: string): Promise<void> => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('notification_id', notificationId);
    } catch (e) {
      console.warn('Failed to mark notification read:', e);
    }
  },

  markAllNotificationsRead: async (userId: string): Promise<void> => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('is_read', false);
    } catch (e) {
      console.warn('Failed to mark all notifications read:', e);
    }
  },

  // Notify technician of new job assignment
  notifyJobAssignment: async (technicianId: string, job: Job): Promise<void> => {
    await NotificationService.createNotification({
      user_id: technicianId,
      type: NotificationType.JOB_ASSIGNED,
      title: 'New Job Assigned',
      message: `You have been assigned to: ${job.title} - ${job.customer?.name || 'Unknown Customer'}`,
      reference_type: 'job',
      reference_id: job.job_id,
      priority: job.priority === 'Emergency' ? 'urgent' : job.priority === 'High' ? 'high' : 'normal',
    });
  },

  // Notify all accountants of pending finalization
  notifyPendingFinalization: async (job: Job): Promise<void> => {
    try {
      // Get all active accountants
      const { data: accountants } = await supabase
        .from('users')
        .select('*')
        .eq('role', UserRole.ACCOUNTANT)
        .eq('is_active', true);
      
      // Also notify admins
      const { data: admins } = await supabase
        .from('users')
        .select('*')
        .eq('role', UserRole.ADMIN)
        .eq('is_active', true);

      const usersToNotify = [...(accountants || []), ...(admins || [])];

      // Create notification for each accountant/admin
      for (const user of usersToNotify) {
        await NotificationService.createNotification({
          user_id: user.user_id,
          type: NotificationType.JOB_PENDING,
          title: 'Job Pending Finalization',
          message: `Job "${job.title}" for ${job.customer?.name || 'Unknown Customer'} is ready for invoice finalization.`,
          reference_type: 'job',
          reference_id: job.job_id,
          priority: job.priority === 'Emergency' ? 'urgent' : job.priority === 'High' ? 'high' : 'normal',
        });
      }
    } catch (e) {
      console.warn('Failed to notify pending finalization:', e);
    }
  },

  // Notify all admins/supervisors of a new job request (helper, spare part, etc.)
  notifyAdminsOfRequest: async (
    requestType: 'assistance' | 'spare_part' | 'skillful_technician',
    technicianName: string,
    jobId: string,
    description: string
  ): Promise<void> => {
    try {
      const { data: admins } = await supabase
        .from('users')
        .select('*')
        .in('role', [UserRole.ADMIN, UserRole.SUPERVISOR])
        .eq('is_active', true);
      
      const typeLabels: Record<string, { title: string; type: NotificationType }> = {
        'assistance': { title: 'Helper Request', type: NotificationType.HELPER_REQUEST },
        'spare_part': { title: 'Spare Part Request', type: NotificationType.SPARE_PART_REQUEST },
        'skillful_technician': { title: 'Skillful Technician Request', type: NotificationType.SKILLFUL_TECH_REQUEST },
      };

      const { title, type } = typeLabels[requestType] || { title: 'New Request', type: NotificationType.JOB_PENDING };

      for (const admin of (admins || [])) {
        await NotificationService.createNotification({
          user_id: admin.user_id,
          type: type,
          title: title,
          message: `${technicianName} requests ${requestType.replace('_', ' ')}: ${description.substring(0, 100)}${description.length > 100 ? '...' : ''}`,
          reference_type: 'job',
          reference_id: jobId,
          priority: requestType === 'assistance' ? 'high' : 'normal',
        });
      }
    } catch (e) {
      console.warn('Failed to notify admins of request:', e);
    }
  },

  // Notify technician when their request is approved
  notifyRequestApproved: async (
    technicianId: string,
    requestType: string,
    jobId: string,
    adminNotes?: string
  ): Promise<void> => {
    try {
      await NotificationService.createNotification({
        user_id: technicianId,
        type: NotificationType.REQUEST_APPROVED,
        title: 'Request Approved ✓',
        message: `Your ${requestType.replace('_', ' ')} request has been approved.${adminNotes ? ` Note: ${adminNotes}` : ''}`,
        reference_type: 'job',
        reference_id: jobId,
        priority: 'high',
      });
    } catch (e) {
      console.warn('Failed to notify request approved:', e);
    }
  },

  // Notify technician when their request is rejected
  notifyRequestRejected: async (
    technicianId: string,
    requestType: string,
    jobId: string,
    reason: string
  ): Promise<void> => {
    try {
      await NotificationService.createNotification({
        user_id: technicianId,
        type: NotificationType.REQUEST_REJECTED,
        title: 'Request Rejected',
        message: `Your ${requestType.replace('_', ' ')} request was rejected. Reason: ${reason}`,
        reference_type: 'job',
        reference_id: jobId,
        priority: 'high',
      });
    } catch (e) {
      console.warn('Failed to notify request rejected:', e);
    }
  },

  // Notify technician when job is reassigned to them
  notifyJobReassigned: async (
    newTechnicianId: string,
    jobTitle: string,
    jobId: string,
    previousTechnicianName?: string
  ): Promise<void> => {
    try {
      await NotificationService.createNotification({
        user_id: newTechnicianId,
        type: NotificationType.JOB_REASSIGNED,
        title: 'Job Reassigned to You',
        message: `Job "${jobTitle}" has been reassigned to you${previousTechnicianName ? ` from ${previousTechnicianName}` : ''}.`,
        reference_type: 'job',
        reference_id: jobId,
        priority: 'high',
      });
    } catch (e) {
      console.warn('Failed to notify job reassigned:', e);
    }
  },

  // Notify admins when technician rejects a job assignment
  notifyJobRejectedByTech: async (
    jobId: string,
    jobTitle: string,
    technicianName: string,
    reason: string
  ): Promise<void> => {
    try {
      const { data: admins } = await supabase
        .from('users')
        .select('*')
        .in('role', [UserRole.ADMIN, UserRole.SUPERVISOR])
        .eq('is_active', true);
      
      for (const admin of (admins || [])) {
        await NotificationService.createNotification({
          user_id: admin.user_id,
          type: NotificationType.JOB_PENDING,
          title: 'Job Rejected - Needs Reassignment',
          message: `${technicianName} rejected job "${jobTitle}". Reason: ${reason}`,
          reference_type: 'job',
          reference_id: jobId,
          priority: 'high',
        });
      }
    } catch (e) {
      console.warn('Failed to notify job rejection:', e);
    }
  },

  // Notify admins when technician doesn't respond within 15 minutes
  notifyNoResponseFromTech: async (
    jobId: string,
    jobTitle: string,
    technicianName: string
  ): Promise<void> => {
    try {
      const { data: admins } = await supabase
        .from('users')
        .select('*')
        .in('role', [UserRole.ADMIN, UserRole.SUPERVISOR])
        .eq('is_active', true);
      
      for (const admin of (admins || [])) {
        await NotificationService.createNotification({
          user_id: admin.user_id,
          type: NotificationType.JOB_PENDING,
          title: 'No Response - Job Acceptance Expired',
          message: `${technicianName} did not respond to job "${jobTitle}" within 15 minutes. Consider reassigning.`,
          reference_type: 'job',
          reference_id: jobId,
          priority: 'urgent',
        });
      }
    } catch (e) {
      console.warn('Failed to notify no response:', e);
    }
  },

  // Create service due notifications
  createServiceDueNotifications: async (daysAhead: number = 7): Promise<number> => {
    try {
      const { data, error } = await supabase.rpc('create_service_due_notifications', {
        p_days_ahead: daysAhead
      });

      if (error) {
        console.warn('RPC create_service_due_notifications failed:', error.message);
        return await NotificationService.createServiceDueNotificationsFallback(daysAhead);
      }

      return data || 0;
    } catch (e) {
      console.warn('Create notifications failed:', e);
      return await NotificationService.createServiceDueNotificationsFallback(daysAhead);
    }
  },

  // Fallback for creating service due notifications
  createServiceDueNotificationsFallback: async (daysAhead: number = 7): Promise<number> => {
    let count = 0;
    try {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + daysAhead);

      // Get forklifts due by date
      const { data: forklifts } = await supabase
        .from('forklifts')
        .select('*')
        .eq('status', 'Active')
        .or(`next_service_due.lte.${futureDate.toISOString()}`);

      console.log(`[Notifications] Found ${forklifts?.length || 0} forklifts due`);
      
      // Get admins and supervisors
      const { data: admins, error: adminsError } = await supabase
        .from('users')
        .select('user_id, name, role')
        .in('role', ['admin', 'supervisor', 'Admin', 'Supervisor'])
        .eq('is_active', true);

      console.log(`[Notifications] Found ${admins?.length || 0} admin/supervisor users`);
      if (adminsError) {
        console.warn('[Notifications] Error fetching admins:', adminsError.message);
      }

      if (!admins || admins.length === 0) {
        console.warn('[Notifications] No admin/supervisor users found');
        return 0;
      }

      for (const forklift of (forklifts || [])) {
        const daysUntilDue = forklift.next_service_due 
          ? Math.floor((new Date(forklift.next_service_due).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
          : null;
        const isOverdue = daysUntilDue !== null && daysUntilDue < 0;

        for (const admin of admins) {
          // Check if notification already exists today
          const { data: existing } = await supabase
            .from('notifications')
            .select('notification_id')
            .eq('user_id', admin.user_id)
            .eq('reference_type', 'forklift')
            .eq('reference_id', forklift.forklift_id)
            .gte('created_at', new Date().toISOString().split('T')[0])
            .maybeSingle();

          if (!existing) {
            const result = await NotificationService.createNotification({
              user_id: admin.user_id,
              type: 'service_due' as any,
              title: isOverdue 
                ? `⚠️ Service OVERDUE: ${forklift.serial_number}`
                : `🔧 Service Due: ${forklift.serial_number}`,
              message: `${forklift.make} ${forklift.model} ${isOverdue ? 'is OVERDUE for service!' : `needs service in ${daysUntilDue} days.`} Current: ${forklift.hourmeter} hrs.`,
              reference_type: 'forklift',
              reference_id: forklift.forklift_id,
              priority: isOverdue ? 'urgent' : (daysUntilDue || 7) <= 3 ? 'high' : 'normal',
            });
            if (result) {
              count++;
            }
          }
        }
      }
    } catch (e) {
      console.warn('Fallback notification creation failed:', e);
    }
    return count;
  },

  // Create notifications when a service job is created
  createServiceJobNotifications: async (forklift: any, jobId: string, location?: string): Promise<number> => {
    let count = 0;
    try {
      // Get admins and supervisors
      const { data: admins } = await supabase
        .from('users')
        .select('user_id, name')
        .in('role', ['admin', 'supervisor', 'Admin', 'Supervisor'])
        .eq('is_active', true);

      if (!admins || admins.length === 0) {
        console.log('[Notifications] No admin/supervisor users found');
        return 0;
      }

      const isOverdue = forklift.is_overdue;
      const locationStr = location ? ` at ${location}` : '';
      
      for (const admin of admins) {
        try {
          const { error } = await supabase
            .from('notifications')
            .insert({
              user_id: admin.user_id,
              type: 'job_created',
              title: isOverdue 
                ? `⚠️ OVERDUE Service Job Created: ${forklift.serial_number}`
                : `🔧 Service Job Created: ${forklift.serial_number}`,
              message: `${forklift.make || ''} ${forklift.model || ''} ${forklift.serial_number}${locationStr} - ${isOverdue ? 'OVERDUE for service!' : `Service due in ${forklift.days_until_due || 7} days.`} Hourmeter: ${forklift.hourmeter} hrs.`,
              reference_type: 'job',
              reference_id: jobId,
              priority: isOverdue ? 'urgent' : 'high',
            });

          if (!error) {
            count++;
          }
        } catch (e) {
          console.warn(`[Notifications] Error creating notification for ${admin.name}:`, e);
        }
      }
    } catch (e) {
      console.warn('Service job notifications failed:', e);
    }
    return count;
  },
};
