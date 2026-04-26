// =============================================
// HR SYSTEM TYPES
// =============================================

import type { User } from './user.types';
import type {
  EmployeeLeave,
  HRAlertSeverity,
  HRAlertType,
  LeaveType,
} from './hr-core.types';

// EmploymentStatus and EmploymentType are exported from common.types via index.ts.
// Core HR entities live in hr-core.types.ts so user.types.ts can reference them
// without creating a type-only circular dependency.
export {
  HRAlertSeverity,
  HRAlertType,
  LeaveStatus,
  LicenseStatus,
} from './hr-core.types';

export type {
  EmployeeLeave,
  EmployeeLeaveBalance,
  EmployeeLicense,
  EmployeePermit,
  LeaveType,
} from './hr-core.types';

export interface HRAlert {
  alert_id: string;
  alert_type: HRAlertType;

  // Related Records - using user_id instead of employee_id
  user_id?: string;
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
