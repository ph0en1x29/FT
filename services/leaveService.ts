import {
EmployeeLeave,
EmployeeLeaveBalance,
LeaveStatus,
LeaveType,
NotificationType,
UserRole,
} from '../types';
import { supabase,SupabaseDb } from './supabaseService';

export const LeaveService = {
  // =============================================
  // LEAVE TYPE OPERATIONS
  // =============================================

  getLeaveTypes: async (): Promise<LeaveType[]> => {
    const { data, error } = await supabase
      .from('leave_types')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw new Error(error.message);
    return data as LeaveType[];
  },

  // =============================================
  // LEAVE OPERATIONS
  // =============================================

  getLeaves: async (filters?: {
    userId?: string;
    status?: LeaveStatus;
    startDate?: string;
    endDate?: string;
  }): Promise<EmployeeLeave[]> => {
    let query = supabase
      .from('employee_leaves')
      .select(`
        *,
        user:users!employee_leaves_user_id_fkey(user_id, full_name, name, department, employee_code, phone),
        leave_type:leave_types(*)
      `)
      .order('start_date', { ascending: false });

    if (filters?.userId) {
      query = query.eq('user_id', filters.userId);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.startDate) {
      query = query.gte('start_date', filters.startDate);
    }
    if (filters?.endDate) {
      query = query.lte('end_date', filters.endDate);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data as EmployeeLeave[];
  },

  getPendingLeaves: async (): Promise<EmployeeLeave[]> => {
    const { data, error } = await supabase
      .from('employee_leaves')
      .select(`
        *,
        user:users!employee_leaves_user_id_fkey(user_id, full_name, name, department, employee_code, phone),
        leave_type:leave_types(*)
      `)
      .eq('status', LeaveStatus.PENDING)
      .order('requested_at');

    if (error) throw new Error(error.message);
    return data as EmployeeLeave[];
  },

  getTodaysLeaves: async (): Promise<EmployeeLeave[]> => {
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('employee_leaves')
      .select(`
        *,
        user:users!employee_leaves_user_id_fkey(user_id, full_name, name, department, employee_code, phone, profile_photo_url),
        leave_type:leave_types(*)
      `)
      .eq('status', LeaveStatus.APPROVED)
      .lte('start_date', today)
      .gte('end_date', today);

    if (error) throw new Error(error.message);
    return data as EmployeeLeave[];
  },

  createLeave: async (leaveData: Partial<EmployeeLeave>): Promise<EmployeeLeave> => {
    if (!leaveData.user_id) {
      throw new Error('user_id is required to create a leave request');
    }

    const { data, error } = await supabase
      .from('employee_leaves')
      .insert({
        user_id: leaveData.user_id,
        leave_type_id: leaveData.leave_type_id,
        start_date: leaveData.start_date,
        end_date: leaveData.end_date,
        is_half_day: leaveData.is_half_day || false,
        half_day_type: leaveData.half_day_type,
        reason: leaveData.reason,
        supporting_document_url: leaveData.supporting_document_url,
        status: LeaveStatus.PENDING,
        requested_at: new Date().toISOString(),
        requested_by_user_id: leaveData.user_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select(`
        *,
        user:users!employee_leaves_user_id_fkey(full_name, department),
        leave_type:leave_types(*)
      `)
      .single();

    if (error) throw new Error(error.message);

    const leaveRequest = data as EmployeeLeave;

    // Send notifications to supervisors and admins
    try {
      const allUsers = await SupabaseDb.getUsers();
      const approvers = allUsers.filter(
        (u) => (u.role === UserRole.SUPERVISOR || u.role === UserRole.ADMIN) && u.is_active
      );

      const employeeName = leaveRequest.user?.name || 'An employee';
      const leaveTypeName = leaveRequest.leave_type?.name || 'Leave';
      const startDate = new Date(leaveRequest.start_date).toLocaleDateString();
      const endDate = new Date(leaveRequest.end_date).toLocaleDateString();
      const dateRange =
        leaveRequest.start_date === leaveRequest.end_date
          ? startDate
          : `${startDate} - ${endDate}`;

      for (const approver of approvers) {
        await SupabaseDb.createNotification({
          user_id: approver.user_id,
          type: NotificationType.LEAVE_REQUEST,
          title: 'New Leave Request',
          message: `${employeeName} has requested ${leaveTypeName} for ${dateRange}. Please review and approve.`,
          reference_type: 'leave',
          reference_id: leaveRequest.leave_id,
          priority: 'normal',
        });
      }
    } catch (notifError) {
    }

    return leaveRequest;
  },

  approveLeave: async (
    leaveId: string,
    approvedByUserId: string,
    approvedByName: string
  ): Promise<EmployeeLeave> => {
    const { data, error } = await supabase
      .from('employee_leaves')
      .update({
        status: LeaveStatus.APPROVED,
        approved_at: new Date().toISOString(),
        approved_by_id: approvedByUserId,
        approved_by_name: approvedByName,
        approved_by_user_id: approvedByUserId,
        updated_at: new Date().toISOString(),
      })
      .eq('leave_id', leaveId)
      .select(`
        *,
        user:users!employee_leaves_user_id_fkey(full_name, department),
        leave_type:leave_types(*)
      `)
      .single();

    if (error) throw new Error(error.message);

    const leaveRequest = data as EmployeeLeave;

    try {
      const leaveTypeName = leaveRequest.leave_type?.name || 'Leave';
      const startDate = new Date(leaveRequest.start_date).toLocaleDateString();
      const endDate = new Date(leaveRequest.end_date).toLocaleDateString();
      const dateRange =
        leaveRequest.start_date === leaveRequest.end_date
          ? startDate
          : `${startDate} - ${endDate}`;

      await SupabaseDb.createNotification({
        user_id: leaveRequest.user_id,
        type: NotificationType.LEAVE_APPROVED,
        title: 'Leave Approved',
        message: `Your ${leaveTypeName} request for ${dateRange} has been approved by ${approvedByName}.`,
        reference_type: 'leave',
        reference_id: leaveRequest.leave_id,
        priority: 'normal',
      });
    } catch (notifError) {
    }

    return leaveRequest;
  },

  rejectLeave: async (
    leaveId: string,
    rejectedByUserId: string,
    rejectedByName: string,
    reason: string
  ): Promise<EmployeeLeave> => {
    const { data, error } = await supabase
      .from('employee_leaves')
      .update({
        status: LeaveStatus.REJECTED,
        rejected_at: new Date().toISOString(),
        rejected_by_id: rejectedByUserId,
        rejected_by_name: rejectedByName,
        rejected_by_user_id: rejectedByUserId,
        rejection_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('leave_id', leaveId)
      .select(`
        *,
        user:users!employee_leaves_user_id_fkey(full_name, department),
        leave_type:leave_types(*)
      `)
      .single();

    if (error) throw new Error(error.message);

    const leaveRequest = data as EmployeeLeave;

    try {
      const leaveTypeName = leaveRequest.leave_type?.name || 'Leave';
      const startDate = new Date(leaveRequest.start_date).toLocaleDateString();
      const endDate = new Date(leaveRequest.end_date).toLocaleDateString();
      const dateRange =
        leaveRequest.start_date === leaveRequest.end_date
          ? startDate
          : `${startDate} - ${endDate}`;

      await SupabaseDb.createNotification({
        user_id: leaveRequest.user_id,
        type: NotificationType.LEAVE_REJECTED,
        title: 'Leave Rejected',
        message: `Your ${leaveTypeName} request for ${dateRange} has been rejected by ${rejectedByName}. Reason: ${reason}`,
        reference_type: 'leave',
        reference_id: leaveRequest.leave_id,
        priority: 'high',
      });
    } catch (notifError) {
    }

    return leaveRequest;
  },

  cancelLeave: async (leaveId: string): Promise<EmployeeLeave> => {
    const { data, error } = await supabase
      .from('employee_leaves')
      .update({
        status: LeaveStatus.CANCELLED,
        updated_at: new Date().toISOString(),
      })
      .eq('leave_id', leaveId)
      .select(`
        *,
        user:users!employee_leaves_user_id_fkey(full_name, department),
        leave_type:leave_types(*)
      `)
      .single();

    if (error) throw new Error(error.message);
    return data as EmployeeLeave;
  },

  // =============================================
  // LEAVE BALANCE OPERATIONS
  // =============================================

  getLeaveBalances: async (
    userId: string,
    year?: number
  ): Promise<EmployeeLeaveBalance[]> => {
    const targetYear = year || new Date().getFullYear();

    const { data, error } = await supabase
      .from('employee_leave_balances')
      .select(`
        *,
        leave_type:leave_types(*)
      `)
      .eq('user_id', userId)
      .eq('year', targetYear);

    if (error) throw new Error(error.message);

    return (data || []).map((balance: EmployeeLeaveBalance) => ({
      ...balance,
      available_days:
        balance.entitled_days +
        balance.carried_forward -
        balance.used_days -
        balance.pending_days,
    })) as EmployeeLeaveBalance[];
  },

  updateLeaveBalance: async (
    userId: string,
    leaveTypeId: string,
    year: number,
    updates: Partial<EmployeeLeaveBalance>
  ): Promise<EmployeeLeaveBalance> => {
    const { data, error } = await supabase
      .from('employee_leave_balances')
      .upsert({
        user_id: userId,
        leave_type_id: leaveTypeId,
        year,
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .select(`
        *,
        leave_type:leave_types(*)
      `)
      .single();

    if (error) throw new Error(error.message);
    return data as EmployeeLeaveBalance;
  },

  // =============================================
  // LEAVE CALENDAR
  // =============================================

  getLeaveCalendar: async (
    year: number,
    month: number
  ): Promise<EmployeeLeave[]> => {
    const startOfMonth = new Date(year, month - 1, 1)
      .toISOString()
      .split('T')[0];
    const endOfMonth = new Date(year, month, 0).toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('employee_leaves')
      .select(`
        *,
        user:users!employee_leaves_user_id_fkey(full_name, department, employee_code),
        leave_type:leave_types(*)
      `)
      .eq('status', LeaveStatus.APPROVED)
      .or(`start_date.lte.${endOfMonth},end_date.gte.${startOfMonth}`);

    if (error) throw new Error(error.message);
    return data as EmployeeLeave[];
  },

  // =============================================
  // FILE UPLOAD
  // =============================================

  uploadLeaveDocument: async (userId: string, file: File): Promise<string> => {
    const fileName = `leaves/${userId}/${Date.now()}.${file.name.split('.').pop()}`;

    const { error } = await supabase.storage
      .from('hr-documents')
      .upload(fileName, file);

    if (error) throw new Error(error.message);

    // Return file path - use getLeaveDocumentUrl for signed access
    return fileName;
  },

  /**
   * Get a signed URL for a leave document (valid for 1 hour)
   */
  getLeaveDocumentUrl: async (filePath: string): Promise<string | null> => {
    if (!filePath) return null;

    const { data, error } = await supabase.storage
      .from('hr-documents')
      .createSignedUrl(filePath, 3600);

    if (error) {
      console.error('Failed to create signed URL:', error.message);
      return null;
    }

    return data.signedUrl;
  },
};
