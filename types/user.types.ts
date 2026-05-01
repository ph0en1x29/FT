// =============================================
// USER / ROLE / PERMISSION TYPES
// =============================================

import type { EmploymentStatus,EmploymentType } from './common.types';
import type { EmployeeLeave,EmployeeLicense,EmployeePermit } from './hr-core.types';

export enum UserRole {
  ADMIN = 'admin',
  ADMIN_SERVICE = 'admin_service',  // Admin 1 - Service operations, job completion, hourmeter approval
  ADMIN_STORE = 'admin_store',      // Admin 2 - Parts/inventory, requisitions, Van Stock replenishment
  SUPERVISOR = 'supervisor',
  TECHNICIAN = 'technician',
  ACCOUNTANT = 'accountant',
}

export interface User {
  user_id: string;
  name: string;
  role: UserRole;
  email: string;
  password_hash?: string;
  is_active: boolean;
  avatar?: string;
  auth_id?: string;
  created_at?: string;
  
  // HR Information (merged from employees table)
  employee_code?: string;
  full_name?: string;
  phone?: string;
  ic_number?: string;
  address?: string;
  
  // Employment Details
  department?: string;
  position?: string;
  joined_date?: string;
  employment_type?: EmploymentType;
  employment_status?: EmploymentStatus;
  
  // Emergency Contact
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  
  // Profile Photo
  profile_photo_url?: string;
  
  // Metadata
  updated_at?: string;
  created_by_id?: string;
  created_by_name?: string;
  updated_by_id?: string;
  updated_by_name?: string;
  notes?: string;
  
  // Related data (populated on fetch)
  licenses?: EmployeeLicense[];
  permits?: EmployeePermit[];
  leaves?: EmployeeLeave[];
}

// Backward compatibility - Employee is now the same as User
export type Employee = User;

// Supervisor Role Permissions
export interface RolePermissions {
  canViewDashboard: boolean;
  canViewAllJobs: boolean;
  canCreateJobs: boolean;
  canAssignJobs: boolean;
  canReassignJobs: boolean;
  canEditJobs: boolean;
  canDeleteJobs: boolean;
  canFinalizeInvoices: boolean;
  canViewKPI: boolean;
  canManageUsers: boolean;
  canManageInventory: boolean;
  canEditInventory: boolean;
  canViewCustomers: boolean;
  canEditCustomers: boolean;
  canDeleteCustomers: boolean;
  canViewForklifts: boolean;
  canEditForklifts: boolean;
  canManageRentals: boolean;
  canEditRentalRates: boolean;
  canViewServiceRecords: boolean;
  canScheduleMaintenance: boolean;
  // HR Permissions
  canViewHR: boolean;
  canManageEmployees: boolean;
  canApproveLeave: boolean;
  canViewOwnProfile: boolean;
  // Pricing/Cost Visibility (questionnaire: hide from Technicians)
  canViewPricing: boolean;       // Can see cost_price, sell_price on parts
  canViewJobCosts: boolean;      // Can see labor costs, job totals
  // Customer Name Visibility — hide from Technicians per client request
  canViewCustomerName: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  [UserRole.ADMIN]: {
    canViewDashboard: true,
    canViewAllJobs: true,
    canCreateJobs: true,
    canAssignJobs: true,
    canReassignJobs: true,
    canEditJobs: true,
    canDeleteJobs: true,
    canFinalizeInvoices: true,
    canViewKPI: true,
    canManageUsers: true,
    canManageInventory: true,
    canEditInventory: true,
    canViewCustomers: true,
    canEditCustomers: true,
    canDeleteCustomers: true,
    canViewForklifts: true,
    canEditForklifts: true,
    canManageRentals: true,
    canEditRentalRates: true,
    canViewServiceRecords: true,
    canScheduleMaintenance: true,
    // HR Permissions
    canViewHR: true,
    canManageEmployees: true,
    canApproveLeave: true,
    canViewOwnProfile: true,
    // Pricing Visibility
    canViewPricing: true,
    canViewJobCosts: true,
    canViewCustomerName: true,
  },
  // Admin 1 (Service) - Job operations, assignments, customers, forklifts. NO inventory access.
  [UserRole.ADMIN_SERVICE]: {
    canViewDashboard: true,
    canViewAllJobs: true,
    canCreateJobs: true,
    canAssignJobs: true,
    canReassignJobs: true,
    canEditJobs: true,
    canDeleteJobs: true,
    canFinalizeInvoices: true,
    canViewKPI: true,
    canManageUsers: true,
    canManageInventory: false,
    canEditInventory: false,
    canViewCustomers: true,
    canEditCustomers: true,
    canDeleteCustomers: true,
    canViewForklifts: true,
    canEditForklifts: true,
    canManageRentals: true,
    canEditRentalRates: true,
    canViewServiceRecords: true,
    canScheduleMaintenance: true,
    canViewHR: true,
    canManageEmployees: true,
    canApproveLeave: true,
    canViewOwnProfile: true,
    canViewPricing: true,
    canViewJobCosts: true,
    canViewCustomerName: true,
  },
  // Admin 2 (Store) - Parts/inventory, approve & provide parts. NO job creation, NO customers/forklifts.
  [UserRole.ADMIN_STORE]: {
    canViewDashboard: true,
    canViewAllJobs: true,    // read-only view to check what parts are needed
    canCreateJobs: false,
    canAssignJobs: false,
    canReassignJobs: false,
    canEditJobs: false,
    canDeleteJobs: false,
    canFinalizeInvoices: true,
    canViewKPI: false,
    canManageUsers: false,
    canManageInventory: true,
    canEditInventory: true,
    canViewCustomers: false,
    canEditCustomers: false,
    canDeleteCustomers: false,
    canViewForklifts: false,
    canEditForklifts: false,
    canManageRentals: false,
    canEditRentalRates: false,
    canViewServiceRecords: false,
    canScheduleMaintenance: false,
    canViewHR: false,
    canManageEmployees: false,
    canApproveLeave: false,
    canViewOwnProfile: true,
    canViewPricing: true,
    canViewJobCosts: true,
    canViewCustomerName: true,
  },
  [UserRole.SUPERVISOR]: {
    canViewDashboard: true,
    canViewAllJobs: true,
    canCreateJobs: true,
    canAssignJobs: true,
    canReassignJobs: true,
    canEditJobs: true,
    canDeleteJobs: false,
    canFinalizeInvoices: true,
    canViewKPI: true,
    canManageUsers: false,
    canManageInventory: true,
    canEditInventory: true,
    canViewCustomers: true,
    canEditCustomers: true,
    canDeleteCustomers: false,
    canViewForklifts: true,
    canEditForklifts: true,
    canManageRentals: true,
    canEditRentalRates: false,
    canViewServiceRecords: true,
    canScheduleMaintenance: true,
    // HR Permissions - Supervisor can view HR and approve leaves
    canViewHR: true,
    canManageEmployees: true,
    canApproveLeave: true,
    canViewOwnProfile: true,
    // Pricing Visibility - Supervisor can see costs
    canViewPricing: true,
    canViewJobCosts: true,
    canViewCustomerName: true,
  },
  [UserRole.TECHNICIAN]: {
    canViewDashboard: true,  // Technicians have their own simplified dashboard
    canViewAllJobs: false,
    canCreateJobs: false,
    canAssignJobs: false,
    canReassignJobs: false,
    canEditJobs: true,
    canDeleteJobs: false,
    canFinalizeInvoices: false,
    canViewKPI: false,
    canManageUsers: false,
    canManageInventory: false,
    canEditInventory: false,
    canViewCustomers: false,
    canEditCustomers: false,
    canDeleteCustomers: false,
    // Fleet is hidden from technicians — rental + pricing details exposed in
    // ForkliftsTabs/FleetTab are restricted info (per 2026-04-21 client request).
    // Mirrors the existing canViewCustomers + canManageInventory gates so
    // technicians' side nav, mobile drawer, routes, and command palette all
    // agree. /my-van-stock stays open via its own UserRole-list route guard.
    canViewForklifts: false,
    canEditForklifts: false,
    canManageRentals: false,
    canEditRentalRates: false,
    canViewServiceRecords: true,
    canScheduleMaintenance: false,
    // HR Permissions - Technician can only view own profile
    canViewHR: false,
    canManageEmployees: false,
    canApproveLeave: false,
    canViewOwnProfile: true,
    // Pricing Visibility - HIDDEN from Technicians per questionnaire
    canViewPricing: false,
    canViewJobCosts: false,
    // Customer name is now visible to technicians per 2026-05-01 client
    // request — they need to know which site they're going to.
    canViewCustomerName: true,
  },
  [UserRole.ACCOUNTANT]: {
    canViewDashboard: true,
    canViewAllJobs: true,
    canCreateJobs: false,
    canAssignJobs: false,
    canReassignJobs: false,
    canEditJobs: true,
    canDeleteJobs: false,
    canFinalizeInvoices: true,
    canViewKPI: false,
    canManageUsers: false,
    canManageInventory: true,
    canEditInventory: false,
    canViewCustomers: true,
    canEditCustomers: false,
    canDeleteCustomers: false,
    canViewForklifts: true,
    canEditForklifts: false,
    canManageRentals: false,
    canEditRentalRates: false,
    canViewServiceRecords: true,
    canScheduleMaintenance: false,
    // HR Permissions - Accountant cannot view HR
    canViewHR: false,
    canManageEmployees: false,
    canApproveLeave: false,
    canViewOwnProfile: true,
    // Pricing Visibility - Accountant can see costs for invoicing
    canViewPricing: true,
    canViewJobCosts: true,
    canViewCustomerName: true,
  },
};
