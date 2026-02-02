import { supabase } from './supabaseService';
import {
  Employee,
  User,
  HRDashboardSummary,
  AttendanceToday,
  EmploymentStatus,
  LeaveStatus,
  UserRole,
  EmployeeLeave,
  LeaveType,
} from '../types';

// Type for employee leave with joined relations
type EmployeeLeaveWithRelations = EmployeeLeave & { user: User; leave_type: LeaveType };

// Re-export all HR-related services for backwards compatibility
export { LeaveService } from './leaveService';
export { LicenseService } from './licenseService';
export { PermitService } from './permitService';
export { HRAlertService } from './hrAlertService';

// Import for proxy functions
import { LicenseService } from './licenseService';
import { PermitService } from './permitService';
import { LeaveService } from './leaveService';

export const HRService = {
  // Proxy functions for backwards compatibility
  getExpiringLicenses: LicenseService.getExpiringLicenses,
  getExpiringPermits: PermitService.getExpiringPermits,
  getPendingLeaves: LeaveService.getPendingLeaves,
  // =============================================
  // EMPLOYEE OPERATIONS (Now queries users table directly)
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
      return null;
    }
    return data as Employee;
  },

  // Alias for backwards compatibility
  getEmployeeById: async (userId: string): Promise<Employee | null> => {
    return HRService.getEmployeeByUserId(userId);
  },

  getMyProfile: async (): Promise<Employee | null> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('user_id')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) {
      return null;
    }

    return HRService.getEmployeeByUserId(userData.user_id);
  },

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
      return [];
    }
    return data as Employee[];
  },

  // =============================================
  // HR DASHBOARD & REPORTS
  // =============================================

  getDashboardSummary: async (): Promise<HRDashboardSummary> => {
    try {
      const { data: users } = await supabase.from('users').select('employment_status');

      const totalEmployees = users?.length || 0;
      const activeEmployees =
        users?.filter((u) => u.employment_status === EmploymentStatus.ACTIVE).length || 0;

      const today = new Date().toISOString().split('T')[0];
      const { data: todayLeaves } = await supabase
        .from('employee_leaves')
        .select('leave_id')
        .eq('status', LeaveStatus.APPROVED)
        .lte('start_date', today)
        .gte('end_date', today);

      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      const { data: expiringLicenses } = await supabase
        .from('employee_licenses')
        .select('license_id')
        .eq('status', 'active')
        .lte('expiry_date', thirtyDaysFromNow.toISOString().split('T')[0]);

      const { data: expiringPermits } = await supabase
        .from('employee_permits')
        .select('permit_id')
        .eq('status', 'active')
        .lte('expiry_date', thirtyDaysFromNow.toISOString().split('T')[0]);

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

      const onLeave = (leavesData || []) as EmployeeLeaveWithRelations[];
      const onLeaveUserIds = onLeave.map((l) => l.user_id);

      const { data: allUsers } = await supabase
        .from('users')
        .select('*')
        .eq('employment_status', EmploymentStatus.ACTIVE);

      const available = (allUsers || []).filter(
        (u: User) => !onLeaveUserIds.includes(u.user_id)
      ) as User[];

      return { available, onLeave };
    } catch (e) {
      return { available: [], onLeave: [] };
    }
  },

  // =============================================
  // FILE UPLOAD - Profile photo only (others in respective services)
  // =============================================

  uploadProfilePhoto: async (userId: string, file: File): Promise<string> => {
    const fileName = `profiles/${userId}/${Date.now()}.${file.name.split('.').pop()}`;

    const { error } = await supabase.storage
      .from('hr-documents')
      .upload(fileName, file);

    if (error) throw new Error(error.message);

    const {
      data: { publicUrl },
    } = supabase.storage.from('hr-documents').getPublicUrl(fileName);

    return publicUrl;
  },
};
