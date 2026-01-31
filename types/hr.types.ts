// =============================================
// HR SYSTEM TYPES
// =============================================

import type { User } from './user.types';

// EmploymentStatus and EmploymentType are exported from common.types via index.ts
// Don't re-export here to avoid conflicts

export enum LicenseStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  SUSPENDED = 'suspended',
  REVOKED = 'revoked',
}

export enum LeaveStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

export enum HRAlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

export enum HRAlertType {
  LICENSE_EXPIRY = 'license_expiry',
  PERMIT_EXPIRY = 'permit_expiry',
  LEAVE_REQUEST = 'leave_request',
}

export interface EmployeeLicense {
  license_id: string;
  user_id: string; // References users.user_id directly
  
  // License Information
  license_type: string;
  license_number: string;
  issuing_authority?: string;
  issue_date?: string;
  expiry_date: string;
  
  // License Image
  license_front_image_url?: string;
  license_back_image_url?: string;
  
  // Status
  status: LicenseStatus;
  
  // Alert Settings
  alert_days_before: number;
  last_alert_sent_at?: string;
  
  // Metadata
  created_at: string;
  updated_at: string;
  created_by_id?: string;
  created_by_name?: string;
  verified_at?: string;
  verified_by_id?: string;
  verified_by_name?: string;
  notes?: string;
  
  // Computed (from view)
  days_until_expiry?: number;
  user?: User;
}

export interface EmployeePermit {
  permit_id: string;
  user_id: string; // Changed from employee_id - references employees.user_id
  
  // Permit Information
  permit_type: string;
  permit_number: string;
  permit_name?: string;
  issuing_authority?: string;
  issue_date?: string;
  expiry_date: string;
  
  // Permit scope
  restricted_areas?: string[];
  
  // Permit Document
  permit_document_url?: string;
  
  // Status
  status: LicenseStatus;
  
  // Alert Settings
  alert_days_before: number;
  last_alert_sent_at?: string;
  
  // Metadata
  created_at: string;
  updated_at: string;
  created_by_id?: string;
  created_by_name?: string;
  verified_at?: string;
  verified_by_id?: string;
  verified_by_name?: string;
  notes?: string;
  
  // Computed (from view)
  days_until_expiry?: number;
  user?: User;
}

export interface LeaveType {
  leave_type_id: string;
  name: string;
  description?: string;
  is_paid: boolean;
  requires_approval: boolean;
  requires_document: boolean;
  max_days_per_year?: number;
  color: string;
  is_active: boolean;
  created_at: string;
}

export interface EmployeeLeave {
  leave_id: string;
  user_id: string; // Changed from employee_id - references employees.user_id
  leave_type_id: string;
  
  // Leave Period
  start_date: string;
  end_date: string;
  total_days: number;
  is_half_day: boolean;
  half_day_type?: 'morning' | 'afternoon';
  
  // Request Details
  reason?: string;
  supporting_document_url?: string;
  
  // Approval Workflow - now using user_id references
  status: LeaveStatus;
  requested_at: string;
  requested_by_user_id?: string; // The user who requested (typically same as user_id)
  approved_at?: string;
  approved_by_id?: string; // Legacy - keep for backwards compatibility
  approved_by_name?: string;
  approved_by_user_id?: string; // New: proper FK to users
  rejected_at?: string;
  rejected_by_id?: string; // Legacy
  rejected_by_name?: string;
  rejected_by_user_id?: string; // New: proper FK to users
  rejection_reason?: string;
  
  // Metadata
  created_at: string;
  updated_at: string;
  notes?: string;
  
  // Related data
  user?: User;
  leave_type?: LeaveType;
}

export interface EmployeeLeaveBalance {
  balance_id: string;
  user_id: string; // Changed from employee_id - references employees.user_id
  leave_type_id: string;
  year: number;
  entitled_days: number;
  used_days: number;
  pending_days: number;
  carried_forward: number;
  created_at: string;
  updated_at: string;
  
  // Computed
  available_days?: number; // entitled + carried_forward - used - pending
  leave_type?: LeaveType;
}

export interface HRAlert {
  alert_id: string;
  alert_type: HRAlertType;
  
  // Related Records - using user_id instead of employee_id
  user_id?: string; // Changed from employee_id - references employees.user_id
  license_id?: string;
  permit_id?: string;
  leave_id?: string;
  
  // Alert Details
  title: string;
  message: string;
  severity: HRAlertSeverity;
  
  // Recipients
  recipient_ids: string[];
  
  // Status
  is_read: boolean;
  read_at?: string;
  read_by_id?: string;
  
  // Scheduling
  scheduled_for: string;
  sent_at?: string;
  
  // Metadata
  created_at: string;
  expires_at?: string;
  
  // Related data
  user?: User;
}

// HR Dashboard Summary Types
export interface HRDashboardSummary {
  totalEmployees: number;
  activeEmployees: number;
  onLeaveToday: number;
  expiringLicenses: number;
  expiringPermits: number;
  pendingLeaveRequests: number;
}

export interface AttendanceToday {
  available: User[];
  onLeave: (EmployeeLeave & { user: User; leave_type: LeaveType })[];
}
