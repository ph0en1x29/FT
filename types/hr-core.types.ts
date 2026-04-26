// =============================================
// HR CORE TYPES - dependency-free shared HR shapes
// =============================================

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

export interface HRUserSummary {
  user_id?: string;
  name?: string;
  full_name?: string;
  email?: string;
}

export interface EmployeeLicense {
  license_id: string;
  user_id: string;
  license_type: string;
  license_number: string;
  issuing_authority?: string;
  issue_date?: string;
  expiry_date: string;
  license_front_image_url?: string;
  license_back_image_url?: string;
  status: LicenseStatus;
  alert_days_before: number;
  last_alert_sent_at?: string;
  created_at: string;
  updated_at: string;
  created_by_id?: string;
  created_by_name?: string;
  verified_at?: string;
  verified_by_id?: string;
  verified_by_name?: string;
  notes?: string;
  days_until_expiry?: number;
  user?: HRUserSummary;
}

export interface EmployeePermit {
  permit_id: string;
  user_id: string;
  permit_type: string;
  permit_number: string;
  permit_name?: string;
  issuing_authority?: string;
  issue_date?: string;
  expiry_date: string;
  restricted_areas?: string[];
  permit_document_url?: string;
  status: LicenseStatus;
  alert_days_before: number;
  last_alert_sent_at?: string;
  created_at: string;
  updated_at: string;
  created_by_id?: string;
  created_by_name?: string;
  verified_at?: string;
  verified_by_id?: string;
  verified_by_name?: string;
  notes?: string;
  days_until_expiry?: number;
  user?: HRUserSummary;
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
  user_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  total_days: number;
  is_half_day: boolean;
  half_day_type?: 'morning' | 'afternoon';
  reason?: string;
  supporting_document_url?: string;
  status: LeaveStatus;
  requested_at: string;
  requested_by_user_id?: string;
  approved_at?: string;
  approved_by_id?: string;
  approved_by_name?: string;
  approved_by_user_id?: string;
  rejected_at?: string;
  rejected_by_id?: string;
  rejected_by_name?: string;
  rejected_by_user_id?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
  notes?: string;
  user?: HRUserSummary;
  leave_type?: LeaveType;
}

export interface EmployeeLeaveBalance {
  balance_id: string;
  user_id: string;
  leave_type_id: string;
  year: number;
  entitled_days: number;
  used_days: number;
  pending_days: number;
  carried_forward: number;
  created_at: string;
  updated_at: string;
  available_days?: number;
  leave_type?: LeaveType;
}
