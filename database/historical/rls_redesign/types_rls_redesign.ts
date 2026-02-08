// ============================================
// FieldPro RLS Redesign - TypeScript Interfaces
// ============================================
// Updated interfaces for new security model
// NOTE: Uses EXISTING status values from the app

// =====================
// EXISTING STATUS VALUES (unchanged)
// =====================
// These match your existing types/index.ts
// 'New', 'Assigned', 'In Progress', 'Awaiting Finalization', 'Completed'

// =====================
// NEW ENUMS
// =====================

export enum PaymentStatus {
  PENDING = 'pending',
  PARTIAL = 'partial',
  PAID = 'paid',
  OVERDUE = 'overdue',
  REFUNDED = 'refunded',
}

export enum AuditEventType {
  JOB_CREATED = 'job_created',
  JOB_ASSIGNED = 'job_assigned',
  JOB_REASSIGNED = 'job_reassigned',
  STATUS_CHANGED = 'status_changed',
  STATUS_ROLLBACK = 'status_rollback',
  SERVICE_STARTED = 'service_started',
  SERVICE_COMPLETED = 'service_completed',
  SIGNATURE_ADDED = 'signature_added',
  PARTS_ADDED = 'parts_added',
  PARTS_REMOVED = 'parts_removed',
  INVOICE_CREATED = 'invoice_created',
  INVOICE_FINALIZED = 'invoice_finalized',
  INVOICE_SENT = 'invoice_sent',
  PAYMENT_RECORDED = 'payment_recorded',
  ADMIN_OVERRIDE = 'admin_override',
  RECORD_LOCKED = 'record_locked',
  RECORD_UNLOCKED = 'record_unlocked',
  INVENTORY_DEDUCTED = 'inventory_deducted',
  JOB_CANCELLED = 'job_cancelled',
}

// =====================
// NEW TABLE INTERFACES
// =====================

export interface JobServiceRecord {
  service_record_id: string;
  job_id: string;
  technician_id?: string;
  
  // Timing
  started_at?: string;
  completed_at?: string;
  repair_start_time?: string;
  repair_end_time?: string;
  
  // Service Data
  checklist_data?: Record<string, boolean>;
  service_notes?: string;
  job_carried_out?: string;
  recommendation?: string;
  hourmeter_reading?: number;
  
  // Parts flag
  no_parts_used: boolean;
  
  // Signatures
  technician_signature?: {
    signed_by_name: string;
    signed_at: string;
    signature_url: string;
  };
  technician_signature_at?: string;
  customer_signature?: {
    signed_by_name: string;
    signed_at: string;
    signature_url: string;
    department?: string;
    ic_no?: string;
  };
  customer_signature_at?: string;
  
  // Locking
  locked_at?: string;
  locked_by?: string;
  lock_reason?: string;
  
  // Metadata
  created_at: string;
  updated_at: string;
}

export interface JobInvoice {
  invoice_id: string;
  job_id: string;
  invoice_number?: string;
  service_report_number?: string;
  
  // Pricing
  labor_total: number;
  labor_hours?: number;
  parts_total: number;
  extra_charges_total: number;
  discount_amount: number;
  discount_percentage: number;
  tax_rate: number;
  tax_amount: number;
  subtotal: number;
  total: number;
  
  // Payment
  amount_paid: number;
  payment_status: PaymentStatus;
  last_payment_at?: string;
  last_payment_method?: string;
  last_payment_reference?: string;
  
  // Workflow
  prepared_by?: string;
  prepared_by_name?: string;
  finalized_at?: string;
  finalized_by?: string;
  finalized_by_name?: string;
  locked_at?: string;
  
  // Delivery
  sent_at?: string;
  sent_via?: string[];
  
  // Metadata
  created_at: string;
  updated_at: string;
}

export interface JobInvoiceExtraCharge {
  charge_id: string;
  job_id: string;
  invoice_id?: string;
  
  description: string;
  amount: number;
  quantity: number;
  unit_price: number;
  
  is_approved: boolean;
  approved_by?: string;
  approved_by_name?: string;
  approved_at?: string;
  
  created_at: string;
  created_by?: string;
  created_by_name?: string;
}

export interface JobAuditLog {
  audit_id: string;
  job_id: string;
  
  event_type: AuditEventType;
  event_description: string;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  old_value?: Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  new_value?: Record<string, any>;
  
  performed_by?: string;
  performed_by_name?: string;
  performed_by_role?: string;
  performed_at: string;
  
  ip_address?: string;
  user_agent?: string;
}

export interface JobInventoryUsage {
  usage_id: string;
  job_id: string;
  service_record_id?: string;
  
  inventory_item_id: string;
  part_name: string;
  part_code?: string;
  
  quantity_used: number;
  unit_price: number;
  total_price: number;
  
  stock_deducted: boolean;
  deducted_at?: string;
  deducted_by?: string;
  
  recorded_by?: string;
  recorded_by_name?: string;
  recorded_at: string;
}

export interface JobStatusHistory {
  history_id: string;
  job_id: string;
  
  old_status?: string;
  new_status: string;
  
  changed_by?: string;
  changed_by_name?: string;
  changed_at: string;
  
  reason?: string;
}

// =====================
// RPC RESPONSE TYPES
// =====================

export interface StartJobResponse {
  success: boolean;
  message?: string;
  error?: string;
  job_id?: string;
  new_status?: string;
}

export interface CompleteJobResponse {
  success: boolean;
  message?: string;
  error?: string;
  job_id?: string;
  new_status?: string;
  missing_fields?: string[];
}

export interface FinalizeInvoiceResponse {
  success: boolean;
  message?: string;
  error?: string;
  job_id?: string;
  invoice_id?: string;
  invoice_number?: string;
  new_status?: string;
}

export interface AdminOverrideResponse {
  success: boolean;
  message?: string;
  error?: string;
  job_id?: string;
  action?: string;
  reason?: string;
}

export interface CancelJobResponse {
  success: boolean;
  message?: string;
  error?: string;
  job_id?: string;
  reason?: string;
}

export interface RecordPaymentResponse {
  success: boolean;
  message?: string;
  error?: string;
  job_id?: string;
  amount?: number;
  total_paid?: number;
  payment_status?: PaymentStatus;
}

// =====================
// ROLE PERMISSIONS (updated)
// =====================

export interface RolePermissions {
  // Job permissions
  canViewAllJobs: boolean;
  canViewOwnJobs: boolean;
  canCreateJobs: boolean;
  canAssignJobs: boolean;
  canReassignJobs: boolean;
  canStartJobs: boolean;
  canCompleteJobs: boolean;
  canCancelJobs: boolean;
  
  // Invoice permissions
  canFinalizeInvoices: boolean;
  canRecordPayments: boolean;
  canEditInvoices: boolean;
  
  // Service record permissions
  canEditServiceRecords: boolean;
  canViewServiceRecords: boolean;
  
  // Admin permissions
  canOverrideLocks: boolean;
  canManageUsers: boolean;
  canRollbackStatus: boolean;
  
  // Inventory permissions
  canManageInventory: boolean;
  canViewInventory: boolean;
  
  // Asset permissions
  canManageForklifts: boolean;
  canManageRentals: boolean;
  
  // Customer permissions
  canManageCustomers: boolean;
  canViewCustomers: boolean;
  
  // Reporting
  canViewKPI: boolean;
  canViewAuditLog: boolean;
}

export const ROLE_PERMISSIONS_V2: Record<string, RolePermissions> = {
  admin: {
    canViewAllJobs: true,
    canViewOwnJobs: true,
    canCreateJobs: true,
    canAssignJobs: true,
    canReassignJobs: true,
    canStartJobs: true,
    canCompleteJobs: true,
    canCancelJobs: true,
    canFinalizeInvoices: true,
    canRecordPayments: true,
    canEditInvoices: true,
    canEditServiceRecords: true,
    canViewServiceRecords: true,
    canOverrideLocks: true,
    canManageUsers: true,
    canRollbackStatus: true,
    canManageInventory: true,
    canViewInventory: true,
    canManageForklifts: true,
    canManageRentals: true,
    canManageCustomers: true,
    canViewCustomers: true,
    canViewKPI: true,
    canViewAuditLog: true,
  },
  supervisor: {
    canViewAllJobs: true,
    canViewOwnJobs: true,
    canCreateJobs: true,
    canAssignJobs: true,
    canReassignJobs: true,
    canStartJobs: true,
    canCompleteJobs: true,
    canCancelJobs: true,
    canFinalizeInvoices: true,
    canRecordPayments: true,
    canEditInvoices: false,
    canEditServiceRecords: false,
    canViewServiceRecords: true,
    canOverrideLocks: false,
    canManageUsers: false,
    canRollbackStatus: true,
    canManageInventory: true,
    canViewInventory: true,
    canManageForklifts: true,
    canManageRentals: true,
    canManageCustomers: true,
    canViewCustomers: true,
    canViewKPI: true,
    canViewAuditLog: true,
  },
  accountant: {
    canViewAllJobs: true,
    canViewOwnJobs: true,
    canCreateJobs: false,
    canAssignJobs: false,
    canReassignJobs: false,
    canStartJobs: false,
    canCompleteJobs: false,
    canCancelJobs: false,
    canFinalizeInvoices: true,
    canRecordPayments: true,
    canEditInvoices: true,
    canEditServiceRecords: false,
    canViewServiceRecords: true,
    canOverrideLocks: false,
    canManageUsers: false,
    canRollbackStatus: false,
    canManageInventory: false,
    canViewInventory: true,
    canManageForklifts: false,
    canManageRentals: false,
    canManageCustomers: false,
    canViewCustomers: true,
    canViewKPI: false,
    canViewAuditLog: true,
  },
  technician: {
    canViewAllJobs: false,
    canViewOwnJobs: true,
    canCreateJobs: false,
    canAssignJobs: false,
    canReassignJobs: false,
    canStartJobs: true,
    canCompleteJobs: true,
    canCancelJobs: false,
    canFinalizeInvoices: false,
    canRecordPayments: false,
    canEditInvoices: false,
    canEditServiceRecords: true,
    canViewServiceRecords: true,
    canOverrideLocks: false,
    canManageUsers: false,
    canRollbackStatus: false,
    canManageInventory: false,
    canViewInventory: true,
    canManageForklifts: false,
    canManageRentals: false,
    canManageCustomers: false,
    canViewCustomers: true,
    canViewKPI: false,
    canViewAuditLog: false,
  },
};

// =====================
// HELPER FUNCTIONS
// =====================

/**
 * Check if a job is locked (service record locked)
 */
export function isJobLocked(job: { status: string; invoiced_at?: string }): boolean {
  return job.status === 'Completed' || !!job.invoiced_at;
}

/**
 * Check if user can edit service record
 */
export function canEditServiceRecord(
  job: { status: string; assigned_technician_id?: string },
  userRole: string,
  userId?: string
): boolean {
  // Admin can always edit
  if (userRole === 'admin') return true;
  
  // Job must not be completed
  if (job.status === 'Completed') return false;
  
  // Technician can only edit their own assigned jobs
  if (userRole === 'technician') {
    return job.assigned_technician_id === userId && 
           ['Assigned', 'In Progress'].includes(job.status);
  }
  
  return false;
}

/**
 * Check if user can move job to a specific status
 */
export function canMoveToStatus(
  currentStatus: string,
  targetStatus: string,
  userRole: string
): boolean {
  const statusOrder = ['New', 'Assigned', 'In Progress', 'Awaiting Finalization', 'Completed'];
  const currentIdx = statusOrder.indexOf(currentStatus);
  const targetIdx = statusOrder.indexOf(targetStatus);
  
  if (currentIdx === -1 || targetIdx === -1) return false;
  
  // Forward movement
  if (targetIdx > currentIdx) {
    // Must be sequential (except admin can skip)
    if (targetIdx - currentIdx > 1 && userRole !== 'admin') return false;
    
    // Role-specific rules
    if (userRole === 'technician') {
      return (currentStatus === 'Assigned' && targetStatus === 'In Progress') ||
             (currentStatus === 'In Progress' && targetStatus === 'Awaiting Finalization');
    }
    if (userRole === 'accountant') {
      return currentStatus === 'Awaiting Finalization' && targetStatus === 'Completed';
    }
    return ['admin', 'supervisor'].includes(userRole);
  }
  
  // Backward movement - admin/supervisor only
  return ['admin', 'supervisor'].includes(userRole);
}

/**
 * Get required fields for job completion
 */
export function getCompletionRequirements(): string[] {
  return [
    'started_at',
    'checklist_data',
    'service_notes_or_job_carried_out',
    'parts_used_or_no_parts_flag',
    'technician_signature',
    'customer_signature',
  ];
}
