import { supabase, SupabaseDb } from './supabaseService';
import {
  Employee,
  EmployeeLicense,
  EmployeePermit,
  EmployeeLeave,
  LeaveType,
  EmployeeLeaveBalance,
  HRAlert,
  EmploymentStatus,
  LeaveStatus,
  LicenseStatus,
  HRAlertType,
  HRAlertSeverity,
  HRDashboardSummary,
  AttendanceToday,
  User,
  UserRole,
  NotificationType,
} from '../types';

export const HRService = {
  // =============================================
  // EMPLOYEE OPERATIONS (Now queries users table directly)
  // employees table has been merged into users
  // =============================================

  getEmployees: async (): Promise<Employee[]> => {
    const { data, error } = await supabase
      .from('users')
      .select(`
        *,
        licenses:employee_licenses(*),
        permits:employee_permits(*),
        leaves:employee_leaves!employee_leaves_user_id_fkey(*, leave_type:leave_types(*))
      `)
      .order('full_name');

    if (error) throw new Error(error.message);
    return data as Employee[];
  },

  // Get employee by user_id (now directly from users table)
  getEmployeeByUserId: async (userId: string): Promise<Employee | null> => {
    const { data, error } = await supabase
      .from('users')
      .select(`
        *,
        licenses:employee_licenses(*),
        permits:employee_permits(*),
        leaves:employee_leaves!employee_leaves_user_id_fkey(
          *,
          leave_type:leave_types(*)
        )
      `)
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching employee by user ID:', error);
      return null;
    }
    return data as Employee;
  },

  // Alias for backwards compatibility - now routes to getEmployeeByUserId
  getEmployeeById: async (userId: string): Promise<Employee | null> => {
    return HRService.getEmployeeByUserId(userId);
  },

  // Get current user's employee profile
  getMyProfile: async (): Promise<Employee | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Get the user_id from users table using auth_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('user_id')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      console.error('Error getting user:', userError);
      return null;
    }

    return HRService.getEmployeeByUserId(userData.user_id);
  },

  // Update user's HR profile (replaces createEmployee - user already exists)
  updateEmployeeProfile: async (
    userId: string,
    employeeData: Partial<Employee>,
    updatedById?: string,
    updatedByName?: string
  ): Promise<Employee> => {
    if (!userId) {
      throw new Error('user_id is required to update employee profile');
    }

    const { data, error } = await supabase
      .from('users')
      .update({
        employee_code: employeeData.employee_code,
        full_name: employeeData.full_name,
        phone: employeeData.phone,
        ic_number: employeeData.ic_number,
        address: employeeData.address,
        department: employeeData.department,
        position: employeeData.position,
        joined_date: employeeData.joined_date,
        employment_type: employeeData.employment_type,
        employment_status: employeeData.employment_status || EmploymentStatus.ACTIVE,
        emergency_contact_name: employeeData.emergency_contact_name,
        emergency_contact_phone: employeeData.emergency_contact_phone,
        emergency_contact_relationship: employeeData.emergency_contact_relationship,
        profile_photo_url: employeeData.profile_photo_url,
        notes: employeeData.notes,
        updated_by_id: updatedById,
        updated_by_name: updatedByName,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Employee;
  },

  // Backward compatibility alias
  createEmployee: async (
    employeeData: Partial<Employee>,
    createdById?: string,
    createdByName?: string
  ): Promise<Employee> => {
    if (!employeeData.user_id) {
      throw new Error('user_id is required');
    }
    return HRService.updateEmployeeProfile(
      employeeData.user_id,
      employeeData,
      createdById,
      createdByName
    );
  },

  updateEmployee: async (
    userId: string,
    updates: Partial<Employee>,
    updatedById?: string,
    updatedByName?: string
  ): Promise<Employee> => {
    // Remove user_id from updates (it's the primary key and shouldn't be changed)
    const { user_id, ...safeUpdates } = updates;

    const { data, error } = await supabase
      .from('users')
      .update({
        ...safeUpdates,
        updated_by_id: updatedById,
        updated_by_name: updatedByName,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Employee;
  },

  // Deactivate employee (soft delete - keeps user record)
  deleteEmployee: async (userId: string): Promise<void> => {
    const { error } = await supabase
      .from('users')
      .update({
        is_active: false,
        employment_status: EmploymentStatus.TERMINATED,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) throw new Error(error.message);
  },

  // Get technicians (users with technician role)
  getTechnicianEmployees: async (): Promise<Employee[]> => {
    const { data, error } = await supabase
      .from('users')
      .select(`
        *,
        licenses:employee_licenses(*),
        permits:employee_permits(*)
      `)
      .eq('role', UserRole.TECHNICIAN)
      .eq('employment_status', EmploymentStatus.ACTIVE)
      .order('full_name');

    if (error) {
      console.warn('Error fetching technician employees:', error);
      return [];
    }
    return data as Employee[];
  },

  // =============================================
  // LICENSE OPERATIONS - Now using user_id
  // =============================================

  getLicenses: async (userId?: string): Promise<EmployeeLicense[]> => {
    let query = supabase
      .from('employee_licenses')
      .select(`
        *,
        user:users(full_name, phone, department, employee_code)
      `)
      .order('expiry_date');

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data as EmployeeLicense[];
  },

  getExpiringLicenses: async (daysAhead: number = 60): Promise<EmployeeLicense[]> => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const { data, error } = await supabase
      .from('employee_licenses')
      .select(`
        *,
        user:users!employee_licenses_user_id_fkey(user_id, full_name, name, phone, department, employee_code)
      `)
      .eq('status', 'active')
      .lte('expiry_date', futureDate.toISOString().split('T')[0])
      .order('expiry_date');

    if (error) throw new Error(error.message);

    // Calculate days until expiry
    return (data || []).map((license: any) => ({
      ...license,
      days_until_expiry: Math.ceil(
        (new Date(license.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      ),
    })) as EmployeeLicense[];
  },

  createLicense: async (
    licenseData: Partial<EmployeeLicense>,
    createdById?: string,
    createdByName?: string
  ): Promise<EmployeeLicense> => {
    if (!licenseData.user_id) {
      throw new Error('user_id is required to create a license');
    }

    const { data, error } = await supabase
      .from('employee_licenses')
      .insert({
        user_id: licenseData.user_id,
        license_type: licenseData.license_type,
        license_number: licenseData.license_number,
        issuing_authority: licenseData.issuing_authority,
        issue_date: licenseData.issue_date,
        expiry_date: licenseData.expiry_date,
        license_front_image_url: licenseData.license_front_image_url,
        license_back_image_url: licenseData.license_back_image_url,
        status: licenseData.status || LicenseStatus.ACTIVE,
        alert_days_before: licenseData.alert_days_before || 30,
        notes: licenseData.notes,
        created_by_id: createdById,
        created_by_name: createdByName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as EmployeeLicense;
  },

  updateLicense: async (
    licenseId: string,
    updates: Partial<EmployeeLicense>
  ): Promise<EmployeeLicense> => {
    const { data, error } = await supabase
      .from('employee_licenses')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('license_id', licenseId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as EmployeeLicense;
  },

  deleteLicense: async (licenseId: string): Promise<void> => {
    const { error } = await supabase
      .from('employee_licenses')
      .delete()
      .eq('license_id', licenseId);

    if (error) throw new Error(error.message);
  },

  // =============================================
  // PERMIT OPERATIONS - Now using user_id
  // =============================================

  getPermits: async (userId?: string): Promise<EmployeePermit[]> => {
    let query = supabase
      .from('employee_permits')
      .select(`
        *,
        user:users(full_name, phone, department, employee_code)
      `)
      .order('expiry_date');

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data as EmployeePermit[];
  },

  getExpiringPermits: async (daysAhead: number = 60): Promise<EmployeePermit[]> => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const { data, error } = await supabase
      .from('employee_permits')
      .select(`
        *,
        user:users!employee_permits_user_id_fkey(user_id, full_name, name, phone, department, employee_code)
      `)
      .eq('status', 'active')
      .lte('expiry_date', futureDate.toISOString().split('T')[0])
      .order('expiry_date');

    if (error) throw new Error(error.message);

    return (data || []).map((permit: any) => ({
      ...permit,
      days_until_expiry: Math.ceil(
        (new Date(permit.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      ),
    })) as EmployeePermit[];
  },

  createPermit: async (
    permitData: Partial<EmployeePermit>,
    createdById?: string,
    createdByName?: string
  ): Promise<EmployeePermit> => {
    if (!permitData.user_id) {
      throw new Error('user_id is required to create a permit');
    }

    const { data, error } = await supabase
      .from('employee_permits')
      .insert({
        user_id: permitData.user_id,
        permit_type: permitData.permit_type,
        permit_number: permitData.permit_number,
        permit_name: permitData.permit_name,
        issuing_authority: permitData.issuing_authority,
        issue_date: permitData.issue_date,
        expiry_date: permitData.expiry_date,
        restricted_areas: permitData.restricted_areas,
        permit_document_url: permitData.permit_document_url,
        status: permitData.status || LicenseStatus.ACTIVE,
        alert_days_before: permitData.alert_days_before || 30,
        notes: permitData.notes,
        created_by_id: createdById,
        created_by_name: createdByName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as EmployeePermit;
  },

  updatePermit: async (
    permitId: string,
    updates: Partial<EmployeePermit>
  ): Promise<EmployeePermit> => {
    const { data, error } = await supabase
      .from('employee_permits')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('permit_id', permitId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as EmployeePermit;
  },

  deletePermit: async (permitId: string): Promise<void> => {
    const { error } = await supabase
      .from('employee_permits')
      .delete()
      .eq('permit_id', permitId);

    if (error) throw new Error(error.message);
  },


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
  // LEAVE OPERATIONS - Now using user_id
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
        requested_by_user_id: leaveData.user_id, // The requester is the employee
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
      const dateRange = leaveRequest.start_date === leaveRequest.end_date 
        ? startDate 
        : `${startDate} - ${endDate}`;
      
      // Create notification for each supervisor/admin
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
      // Don't fail the leave request if notifications fail
      console.warn('Failed to send leave request notifications:', notifError);
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
    
    // Notify the employee that their leave was approved
    try {
      const leaveTypeName = (leaveRequest.leave_type as any)?.name || 'Leave';
      const startDate = new Date(leaveRequest.start_date).toLocaleDateString();
      const endDate = new Date(leaveRequest.end_date).toLocaleDateString();
      const dateRange = leaveRequest.start_date === leaveRequest.end_date 
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
      console.warn('Failed to send leave approval notification:', notifError);
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
    
    // Notify the employee that their leave was rejected
    try {
      const leaveTypeName = (leaveRequest.leave_type as any)?.name || 'Leave';
      const startDate = new Date(leaveRequest.start_date).toLocaleDateString();
      const endDate = new Date(leaveRequest.end_date).toLocaleDateString();
      const dateRange = leaveRequest.start_date === leaveRequest.end_date 
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
      console.warn('Failed to send leave rejection notification:', notifError);
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
  // LEAVE BALANCE OPERATIONS - Now using user_id
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

    // Calculate available days
    return (data || []).map((balance: any) => ({
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
  // HR DASHBOARD & REPORTS
  // =============================================

  getDashboardSummary: async (): Promise<HRDashboardSummary> => {
    try {
      // Get employee counts from users table
      const { data: users } = await supabase
        .from('users')
        .select('employment_status');

      const totalEmployees = users?.length || 0;
      const activeEmployees =
        users?.filter((u) => u.employment_status === EmploymentStatus.ACTIVE).length || 0;

      // Get today's leaves
      const today = new Date().toISOString().split('T')[0];
      const { data: todayLeaves } = await supabase
        .from('employee_leaves')
        .select('leave_id')
        .eq('status', LeaveStatus.APPROVED)
        .lte('start_date', today)
        .gte('end_date', today);

      // Get expiring licenses (within 30 days)
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      const { data: expiringLicenses } = await supabase
        .from('employee_licenses')
        .select('license_id')
        .eq('status', 'active')
        .lte('expiry_date', thirtyDaysFromNow.toISOString().split('T')[0]);

      // Get expiring permits (within 30 days)
      const { data: expiringPermits } = await supabase
        .from('employee_permits')
        .select('permit_id')
        .eq('status', 'active')
        .lte('expiry_date', thirtyDaysFromNow.toISOString().split('T')[0]);

      // Get pending leave requests
      const { data: pendingLeaves } = await supabase
        .from('employee_leaves')
        .select('leave_id')
        .eq('status', LeaveStatus.PENDING);

      return {
        totalEmployees,
        activeEmployees,
        onLeaveToday: todayLeaves?.length || 0,
        expiringLicenses: expiringLicenses?.length || 0,
        expiringPermits: expiringPermits?.length || 0,
        pendingLeaveRequests: pendingLeaves?.length || 0,
      };
    } catch (e) {
      console.error('Error getting HR dashboard summary:', e);
      return {
        totalEmployees: 0,
        activeEmployees: 0,
        onLeaveToday: 0,
        expiringLicenses: 0,
        expiringPermits: 0,
        pendingLeaveRequests: 0,
      };
    }
  },

  getAttendanceToday: async (): Promise<AttendanceToday> => {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Get employees on leave today
      const { data: leavesData } = await supabase
        .from('employee_leaves')
        .select(`
          *,
          user:users!employee_leaves_user_id_fkey(*),
          leave_type:leave_types(*)
        `)
        .eq('status', LeaveStatus.APPROVED)
        .lte('start_date', today)
        .gte('end_date', today);

      const onLeave = (leavesData || []) as any[];
      const onLeaveUserIds = onLeave.map((l) => l.user_id);

      // Get all active users (employees)
      const { data: allUsers } = await supabase
        .from('users')
        .select('*')
        .eq('employment_status', EmploymentStatus.ACTIVE);

      // Filter available employees (not on leave)
      const available = (allUsers || []).filter(
        (u) => !onLeaveUserIds.includes(u.user_id)
      ) as User[];

      return {
        available,
        onLeave,
      };
    } catch (e) {
      console.error('Error getting attendance:', e);
      return {
        available: [],
        onLeave: [],
      };
    }
  },

  // Get leave calendar data for a month
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
  // HR ALERTS - Now using user_id
  // =============================================

  getAlerts: async (userId?: string): Promise<HRAlert[]> => {
    let query = supabase
      .from('hr_alerts')
      .select(`
        *,
        user:users(name, department)
      `)
      .order('scheduled_for', { ascending: false })
      .limit(50);

    if (userId) {
      query = query.contains('recipient_ids', [userId]);
    }

    const { data, error } = await query;
    if (error) {
      console.warn('Error fetching HR alerts:', error);
      return [];
    }
    return data as HRAlert[];
  },

  createExpiryAlert: async (
    type: 'license' | 'permit',
    record: EmployeeLicense | EmployeePermit,
    recipientIds: string[]
  ): Promise<HRAlert | null> => {
    const daysUntilExpiry = Math.ceil(
      (new Date(record.expiry_date).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24)
    );

    let severity: HRAlertSeverity = HRAlertSeverity.INFO;
    if (daysUntilExpiry <= 7) {
      severity = HRAlertSeverity.CRITICAL;
    } else if (daysUntilExpiry <= 14) {
      severity = HRAlertSeverity.WARNING;
    }

    const title =
      type === 'license'
        ? `Driving License Expiring`
        : `Permit Expiring`;
    const message =
      type === 'license'
        ? `${(record as EmployeeLicense).license_type} license (${record.user?.name || 'Employee'}) expires in ${daysUntilExpiry} days on ${new Date(record.expiry_date).toLocaleDateString()}`
        : `${(record as EmployeePermit).permit_type} permit (${record.user?.name || 'Employee'}) expires in ${daysUntilExpiry} days on ${new Date(record.expiry_date).toLocaleDateString()}`;

    const { data, error } = await supabase
      .from('hr_alerts')
      .insert({
        alert_type:
          type === 'license'
            ? HRAlertType.LICENSE_EXPIRY
            : HRAlertType.PERMIT_EXPIRY,
        user_id: record.user_id, // Using user_id instead of employee_id
        license_id: type === 'license' ? (record as EmployeeLicense).license_id : null,
        permit_id: type === 'permit' ? (record as EmployeePermit).permit_id : null,
        title,
        message,
        severity,
        recipient_ids: recipientIds,
        scheduled_for: new Date().toISOString(),
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.warn('Error creating HR alert:', error);
      return null;
    }
    return data as HRAlert;
  },

  markAlertAsRead: async (alertId: string, userId: string): Promise<void> => {
    await supabase
      .from('hr_alerts')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
        read_by_id: userId,
      })
      .eq('alert_id', alertId);
  },

  // =============================================
  // FILE UPLOAD HELPERS - Now using user_id
  // =============================================

  uploadLicenseImage: async (
    userId: string,
    file: File,
    side: 'front' | 'back'
  ): Promise<string> => {
    const fileName = `licenses/${userId}/${side}_${Date.now()}.${file.name.split('.').pop()}`;

    const { data, error } = await supabase.storage
      .from('hr-documents')
      .upload(fileName, file);

    if (error) throw new Error(error.message);

    const {
      data: { publicUrl },
    } = supabase.storage.from('hr-documents').getPublicUrl(fileName);

    return publicUrl;
  },

  uploadPermitDocument: async (
    userId: string,
    file: File
  ): Promise<string> => {
    const fileName = `permits/${userId}/${Date.now()}.${file.name.split('.').pop()}`;

    const { data, error } = await supabase.storage
      .from('hr-documents')
      .upload(fileName, file);

    if (error) throw new Error(error.message);

    const {
      data: { publicUrl },
    } = supabase.storage.from('hr-documents').getPublicUrl(fileName);

    return publicUrl;
  },

  uploadProfilePhoto: async (
    userId: string,
    file: File
  ): Promise<string> => {
    const fileName = `profiles/${userId}/${Date.now()}.${file.name.split('.').pop()}`;

    const { data, error } = await supabase.storage
      .from('hr-documents')
      .upload(fileName, file);

    if (error) throw new Error(error.message);

    const {
      data: { publicUrl },
    } = supabase.storage.from('hr-documents').getPublicUrl(fileName);

    return publicUrl;
  },

  uploadLeaveDocument: async (
    userId: string,
    file: File
  ): Promise<string> => {
    const fileName = `leaves/${userId}/${Date.now()}.${file.name.split('.').pop()}`;

    const { data, error } = await supabase.storage
      .from('hr-documents')
      .upload(fileName, file);

    if (error) throw new Error(error.message);

    const {
      data: { publicUrl },
    } = supabase.storage.from('hr-documents').getPublicUrl(fileName);

    return publicUrl;
  },
};
