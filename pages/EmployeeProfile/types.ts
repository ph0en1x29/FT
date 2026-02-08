// EmployeeProfile folder types
// TypeScript types used across EmployeeProfile components

import React from 'react';
import { Employee,EmployeeLeave,EmployeeLicense,EmployeePermit,LeaveType,User } from '../../types';

/**
 * Props for the main EmployeeProfile component
 */
export interface EmployeeProfileProps {
  currentUser: User;
}

/**
 * Props for the InfoTab component
 */
export interface InfoTabProps {
  employee: Employee;
  editing: boolean;
  editData: Partial<Employee>;
  setEditData: (data: Partial<Employee>) => void;
}

/**
 * Props for the LicensesTab component
 */
export interface LicensesTabProps {
  employee: Employee;
  canManage: boolean;
  onAdd: () => void;
  onRefresh: () => void;
  currentUser: User;
}

/**
 * Props for the PermitsTab component
 */
export interface PermitsTabProps {
  employee: Employee;
  canManage: boolean;
  onAdd: () => void;
  onRefresh: () => void;
  currentUser: User;
}

/**
 * Props for the LeavesTab component
 */
export interface LeavesTabProps {
  employee: Employee;
  leaveTypes: LeaveType[];
  canManage: boolean;
  canApprove: boolean;
  canRequestOwn: boolean;
  onAdd: () => void;
  onShowCalendar: () => void;
  onRefresh: () => void;
  currentUser: User;
}

/**
 * Props for the AddLicenseModal component
 */
export interface AddLicenseModalProps {
  userId: string;
  onClose: () => void;
  onSave: (data: Partial<EmployeeLicense>) => Promise<void>;
}

/**
 * Props for the AddPermitModal component
 */
export interface AddPermitModalProps {
  userId: string;
  onClose: () => void;
  onSave: (data: Partial<EmployeePermit>) => Promise<void>;
}

/**
 * Props for the AddLeaveModal component
 */
export interface AddLeaveModalProps {
  userId: string;
  leaveTypes: LeaveType[];
  onClose: () => void;
  onSave: (data: Partial<EmployeeLeave>) => Promise<void>;
}

/**
 * Props for the LeaveCalendarModal component
 */
export interface LeaveCalendarModalProps {
  userId: string;
  employeeName: string;
  onClose: () => void;
}

/**
 * Props for the InfoItem helper component
 */
export interface InfoItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

/**
 * Active tab type for the profile page
 */
export type ActiveTab = 'info' | 'jobs' | 'licenses' | 'permits' | 'leaves';
