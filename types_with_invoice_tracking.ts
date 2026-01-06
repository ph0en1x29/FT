export enum UserRole {
  ADMIN = 'admin',
  SUPERVISOR = 'supervisor',
  TECHNICIAN = 'technician',
  ACCOUNTANT = 'accountant',
}

export enum JobStatus {
  NEW = 'New',
  ASSIGNED = 'Assigned',
  IN_PROGRESS = 'In Progress',
  AWAITING_FINALIZATION = 'Awaiting Finalization',
  COMPLETED = 'Completed',
  // Multi-day & Deferred Acknowledgement statuses (ACWER #7, #8)
  COMPLETED_AWAITING_ACK = 'Completed Awaiting Acknowledgement',
  INCOMPLETE_CONTINUING = 'Incomplete - Continuing',
  INCOMPLETE_REASSIGNED = 'Incomplete - Reassigned',
  DISPUTED = 'Disputed',
}

export enum JobPriority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  EMERGENCY = 'Emergency',
}

// Job Type Classification
export enum JobType {
  SERVICE = 'Service',
  REPAIR = 'Repair',
  CHECKING = 'Checking',
  ACCIDENT = 'Accident',
}

// Forklift/Asset types
export enum ForkliftType {
  ELECTRIC = 'Electric',
  DIESEL = 'Diesel',
  LPG = 'LPG',
  PETROL = 'Petrol',
}

export enum ForkliftStatus {
  ACTIVE = 'Active',
  MAINTENANCE = 'Under Maintenance',
  INACTIVE = 'Inactive',
}

// Forklift Condition Checklist Items
export interface ForkliftConditionChecklist {
  // Drive System
  drive_front_axle?: boolean;
  drive_rear_axle?: boolean;
  drive_motor_engine?: boolean;
  drive_controller_transmission?: boolean;
  
  // Hydraulic System
  hydraulic_pump?: boolean;
  hydraulic_control_valve?: boolean;
  hydraulic_hose?: boolean;
  hydraulic_oil_level?: boolean;
  
  // Safety Devices
  safety_overhead_guard?: boolean;
  safety_cabin_body?: boolean;
  safety_backrest?: boolean;
  safety_seat_belt?: boolean;
  
  // Steering System
  steering_wheel_valve?: boolean;
  steering_cylinder?: boolean;
  steering_motor?: boolean;
  steering_knuckle?: boolean;
  
  // Load Handling System
  load_fork?: boolean;
  load_mast_roller?: boolean;
  load_chain_wheel?: boolean;
  load_cylinder?: boolean;
  
  // Lighting
  lighting_beacon_light?: boolean;
  lighting_horn?: boolean;
  lighting_buzzer?: boolean;
  lighting_rear_view_mirror?: boolean;
  
  // Braking System
  braking_brake_pedal?: boolean;
  braking_parking_brake?: boolean;
  braking_fluid_pipe?: boolean;
  braking_master_pump?: boolean;
  
  // Diesel/LPG/Petrol
  fuel_engine_oil_level?: boolean;
  fuel_line_leaks?: boolean;
  fuel_radiator?: boolean;
  fuel_exhaust_piping?: boolean;
  
  // Tyres
  tyres_front?: boolean;
  tyres_rear?: boolean;
  tyres_rim?: boolean;
  tyres_screw_nut?: boolean;
  
  // Electrical System
  electrical_ignition?: boolean;
  electrical_battery?: boolean;
  electrical_wiring?: boolean;
  electrical_instruments?: boolean;
  
  // Transmission
  transmission_fluid_level?: boolean;
  transmission_inching_valve?: boolean;
  transmission_air_cleaner?: boolean;
  transmission_lpg_regulator?: boolean;
  
  // Wheels
  wheels_drive?: boolean;
  wheels_load?: boolean;
  wheels_support?: boolean;
  wheels_hub_nut?: boolean;
}

export interface Forklift {
  forklift_id: string;
  serial_number: string;
  make: string;
  model: string;
  type: ForkliftType;
  hourmeter: number;
  year?: number;
  capacity_kg?: number;
  location?: string;
  status: ForkliftStatus;
  last_service_date?: string;
  next_service_due?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Customer relationship for rental tracking
  customer_id?: string;
  forklift_no?: string; // Internal forklift number (e.g., FLT 5)
  // Current rental assignment (denormalized for quick lookup)
  current_customer_id?: string;
  current_customer?: Customer; // Populated when fetched with joins
}

// Rental Status
export enum RentalStatus {
  ACTIVE = 'active',
  ENDED = 'ended',
  SCHEDULED = 'scheduled',
}

// Forklift Rental/Assignment
export interface ForkliftRental {
  rental_id: string;
  forklift_id: string;
  customer_id: string;
  start_date: string;
  end_date?: string;
  status: RentalStatus;
  rental_location?: string;
  notes?: string;
  monthly_rental_rate?: number;
  currency?: string;
  created_at: string;
  created_by_id?: string;
  created_by_name?: string;
  updated_at: string;
  ended_at?: string;
  ended_by_id?: string;
  ended_by_name?: string;
  // Populated relations
  forklift?: Forklift;
  customer?: Customer;
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

export interface Customer {
  customer_id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes?: string;
  contact_person?: string; // Attention person
  account_number?: string; // A/C No
}

export interface Part {
  part_id: string;
  part_name: string;
  part_code: string;
  category: string;
  cost_price: number;
  sell_price: number;
  warranty_months: number;
  stock_quantity: number;
  // New fields for inventory tracking
  last_updated_by?: string;
  last_updated_by_name?: string;
  updated_at?: string;
  min_stock_level?: number;
  supplier?: string;
  location?: string;
}

export interface JobPartUsed {
  job_part_id: string;
  job_id: string;
  part_id: string;
  part_name: string;
  quantity: number;
  sell_price_at_time: number;
}

export type MediaCategory = 'before' | 'after' | 'spare_part' | 'condition' | 'evidence' | 'other';

// Job Assignment Types (for Helper Technician feature)
export type AssignmentType = 'lead' | 'assistant';

export interface JobAssignment {
  assignment_id: string;
  job_id: string;
  technician_id: string;
  technician?: User; // Populated on fetch
  assignment_type: AssignmentType;
  assigned_at: string;
  assigned_by?: string;
  assigned_by_name?: string;
  started_at?: string;
  ended_at?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Job Request Types (for In-Job Request System)
export type JobRequestType = 'assistance' | 'spare_part' | 'skillful_technician';
export type JobRequestStatus = 'pending' | 'approved' | 'rejected';

export interface JobRequest {
  request_id: string;
  job_id: string;
  request_type: JobRequestType;
  requested_by: string;
  requested_by_user?: User; // Populated on fetch
  description: string;
  photo_url?: string;
  status: JobRequestStatus;
  admin_response_notes?: string;
  admin_response_part_id?: string;
  admin_response_part?: Part; // Populated on fetch
  admin_response_quantity?: number;
  responded_by?: string;
  responded_by_user?: User; // Populated on fetch
  responded_at?: string;
  created_at: string;
  updated_at: string;
}

// Public Holidays for business day calculations (#7)
export interface PublicHoliday {
  holiday_id: string;
  holiday_date: string; // DATE as ISO string
  name: string;
  year: number;
  created_at?: string;
}

// App Settings for configurable values
export interface AppSetting {
  setting_id: string;
  key: string;
  value: string;
  description?: string;
  updated_at?: string;
  updated_by?: string;
}

// Customer Acknowledgement for deferred completion (#8)
export interface CustomerAcknowledgement {
  ack_id: string;
  job_id: string;
  customer_id: string;
  status: 'pending' | 'acknowledged' | 'disputed' | 'auto_completed';
  access_token?: string;
  token_expires_at?: string;
  responded_at?: string;
  response_method?: 'portal' | 'email' | 'phone' | 'auto';
  response_notes?: string;
  customer_signature?: string;
  signed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface JobMedia {
  media_id: string;
  job_id: string;
  type: 'photo' | 'video';
  url: string;
  description?: string;
  created_at: string;
  uploaded_by_id?: string;
  uploaded_by_name?: string;
  category?: MediaCategory;
  is_helper_photo?: boolean;
  uploaded_by_assignment_id?: string;
}

export interface SignatureEntry {
  signed_by_name: string;
  signed_at: string;
  signature_url: string;
  department?: string;
  ic_no?: string;
}

export interface ExtraCharge {
  charge_id: string;
  job_id: string;
  name: string;
  description: string;
  amount: number;
  created_at: string;
}

export interface Job {
  job_id: string;
  customer_id: string;
  customer: Customer;
  title: string;
  description: string;
  priority: JobPriority;
  job_type?: JobType; // Service, Repair, Checking, Accident
  status: JobStatus;
  assigned_technician_id: string;
  assigned_technician_name?: string;
  created_at: string;
  scheduled_date?: string;
  arrival_time?: string;
  completion_time?: string;
  notes: string[];
  
  // Audit Trail - Job Creation
  created_by_id?: string;
  created_by_name?: string;
  
  // Audit Trail - Job Started
  started_at?: string;
  started_by_id?: string;
  started_by_name?: string;
  
  // Audit Trail - Job Completed
  completed_at?: string;
  completed_by_id?: string;
  completed_by_name?: string;
  
  // Audit Trail - Job Deletion (soft delete)
  deleted_at?: string;
  deleted_by?: string;
  deleted_by_name?: string;
  deletion_reason?: string;
  hourmeter_before_delete?: number; // Store hourmeter before deletion for reference
  
  // Audit Trail - Job Assigned
  assigned_at?: string;
  assigned_by_id?: string;
  assigned_by_name?: string;
  
  // Forklift reference
  forklift_id?: string;
  forklift?: Forklift;
  hourmeter_reading?: number;
  
  // Condition checklist (checked when starting job)
  condition_checklist?: ForkliftConditionChecklist;
  job_carried_out?: string; // Description of work done
  recommendation?: string; // Technician recommendations
  
  // Repairing hours
  repair_start_time?: string;
  repair_end_time?: string;
  
  // Signatures
  technician_signature?: SignatureEntry;
  customer_signature?: SignatureEntry;

  // Helper Technician
  helper_assignment?: JobAssignment; // Active helper if any
  assignments?: JobAssignment[]; // All assignments (for history)

  parts_used: JobPartUsed[];
  media: JobMedia[];
  
  // Pricing
  labor_cost?: number;
  extra_charges?: ExtraCharge[];
  
  // Invoice tracking
  invoiced_by_id?: string;
  invoiced_by_name?: string;
  invoiced_at?: string;
  invoice_sent_at?: string;
  invoice_sent_via?: string[];
  
  // Quotation tracking
  quotation_number?: string;
  quotation_date?: string;
  quotation_validity?: string;
  delivery_term?: string;
  payment_term?: string;
  
  // Service report number
  service_report_number?: string;
  
  // Multi-Day Escalation (#7)
  cutoff_time?: string; // When tech marked job to continue next day
  is_overtime?: boolean; // Saturday OT jobs don't escalate
  escalation_triggered_at?: string; // When escalation notification was sent
  
  // Deferred Acknowledgement (#8)
  verification_type?: 'signed_onsite' | 'deferred' | 'auto_completed' | 'disputed';
  deferred_reason?: string;
  evidence_photo_ids?: string[];
  customer_notified_at?: string;
  customer_response_deadline?: string;
  auto_completed_at?: string;
  dispute_notes?: string;
  disputed_at?: string;
  dispute_resolved_at?: string;
  dispute_resolution?: string;
}

// Quotation specific types
export interface QuotationItem {
  item_number: number;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  brand?: string;
  model?: string;
  capacity?: string;
  voltage?: string;
  accessory?: string;
  warranty?: string;
}

// Deleted Job (for "Recently Deleted" view)
export interface DeletedJob {
  job_id: string;
  title: string;
  description: string;
  status: JobStatus;
  job_type?: JobType;
  priority: JobPriority;
  deleted_at: string;
  deleted_by?: string;
  deleted_by_name?: string;
  deletion_reason?: string;
  hourmeter_before_delete?: number;
  forklift_id?: string;
  customer_id?: string;
  assigned_technician_name?: string;
  created_at: string;
  customer_name?: string;
  forklift_serial?: string;
  forklift_make?: string;
  forklift_model?: string;
}

// Forklift service history entry (includes cancelled jobs)
export interface ForkliftServiceEntry extends Job {
  is_cancelled: boolean; // True if the job was deleted/cancelled
}

export interface Quotation {
  quotation_id: string;
  quotation_number: string;
  customer_id: string;
  customer: Customer;
  date: string;
  attention: string;
  reference: string; // RE: line
  items: QuotationItem[];
  sub_total: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  validity: string;
  delivery_site?: string;
  delivery_term: string;
  payment_term: string;
  remark?: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  created_by_id: string;
  created_by_name: string;
  created_at: string;
  // Reference to job if converted
  job_id?: string;
  forklift_id?: string;
  forklift?: Forklift;
}

// Technician KPI types
export interface TechnicianKPI {
  technician_id: string;
  technician_name: string;
  period_start: string;
  period_end: string;
  
  // Job metrics
  total_jobs_assigned: number;
  total_jobs_completed: number;
  completion_rate: number;
  
  // Time metrics (in hours)
  avg_response_time: number; // Time from assignment to arrival
  avg_completion_time: number; // Time from arrival to completion
  total_hours_worked: number;
  
  // Quality metrics
  jobs_with_callbacks: number; // Jobs that needed follow-up
  customer_satisfaction_avg?: number;
  
  // Revenue metrics
  total_revenue_generated: number;
  avg_job_value: number;
  
  // Parts metrics
  total_parts_used: number;
  
  // Priority breakdown
  emergency_jobs: number;
  high_priority_jobs: number;
  medium_priority_jobs: number;
  low_priority_jobs: number;
}

// Predictive Maintenance types
export interface ServiceInterval {
  interval_id: string;
  forklift_type: ForkliftType;
  service_type: string; // e.g., "PM Service", "Oil Change", "Full Inspection"
  hourmeter_interval: number; // Every X hours
  calendar_interval_days?: number; // Or every X days
  priority: JobPriority;
  checklist_items?: string[];
  estimated_duration_hours?: number;
  is_active: boolean;
}

export interface ScheduledService {
  scheduled_id: string;
  forklift_id: string;
  forklift?: Forklift;
  service_interval_id?: string;
  service_interval?: ServiceInterval;
  service_type: string;
  due_date: string;
  due_hourmeter?: number;
  estimated_hours?: number;
  status: 'pending' | 'scheduled' | 'completed' | 'overdue' | 'cancelled';
  priority: string;
  assigned_technician_id?: string;
  assigned_technician_name?: string;
  job_id?: string; // Linked job if created
  auto_create_job?: boolean;
  notes?: string;
  created_at: string;
  created_by_id?: string;
  created_by_name?: string;
  updated_at?: string;
  completed_at?: string;
}

// Notification System
export enum NotificationType {
  JOB_ASSIGNED = 'job_assigned',
  JOB_PENDING = 'job_pending',
  SERVICE_DUE = 'service_due',
  RENTAL_ENDING = 'rental_ending',
  LOW_STOCK = 'low_stock',
  JOB_COMPLETED = 'job_completed',
  JOB_UPDATED = 'job_updated',
  LEAVE_REQUEST = 'leave_request',
  LEAVE_APPROVED = 'leave_approved',
  LEAVE_REJECTED = 'leave_rejected',
  // New notification types for customer feedback
  HELPER_REQUEST = 'helper_request',
  SPARE_PART_REQUEST = 'spare_part_request',
  SKILLFUL_TECH_REQUEST = 'skillful_tech_request',
  REQUEST_APPROVED = 'request_approved',
  REQUEST_REJECTED = 'request_rejected',
  JOB_REASSIGNED = 'job_reassigned',
}

export interface Notification {
  notification_id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  reference_type?: 'job' | 'forklift' | 'rental' | 'inventory' | 'leave';
  reference_id?: string;
  is_read: boolean;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  created_at: string;
  read_at?: string;
  expires_at?: string;
}

// Enhanced TechnicianKPI with industry standards
export interface EnhancedTechnicianKPI extends TechnicianKPI {
  // Industry Standard KPIs
  first_time_fix_rate: number; // FTFR - Jobs resolved without return visits (%)
  mean_time_to_repair: number; // MTTR - Average repair time in hours
  technician_utilization: number; // Billable hours / Total hours (%)
  jobs_per_day: number; // Average jobs completed per working day
  repeat_visit_count: number; // Number of callbacks/return visits
  
  // Job Type Breakdown
  service_jobs: number;
  repair_jobs: number;
  checking_jobs: number;
  accident_jobs: number;
  
  // Efficiency Scores (calculated)
  efficiency_score: number; // Overall efficiency rating 0-100
  productivity_score: number; // Jobs completed vs capacity
  quality_score: number; // Based on FTFR and customer satisfaction
}

// Rental Financial Tracking
export interface RentalFinancials {
  rental_id: string;
  monthly_rental_rate: number;
  currency: string;
  total_rental_revenue: number; // Calculated from rate * months
  total_service_costs: number; // Sum of all service job costs
  net_profit: number; // Revenue - Costs
  rental_months: number;
}

// Customer Financial Summary
export interface CustomerFinancialSummary {
  customer_id: string;
  customer_name: string;
  total_rental_revenue: number;
  total_service_revenue: number;
  total_parts_revenue: number;
  total_labor_revenue: number;
  total_extra_charges: number;
  grand_total: number;
  active_rentals: number;
  total_forklifts_rented: number;
}

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
}

// =============================================
// HR SYSTEM TYPES
// =============================================

export enum EmploymentStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  TERMINATED = 'terminated',
  ON_LEAVE = 'on_leave',
}

export enum EmploymentType {
  FULL_TIME = 'full-time',
  PART_TIME = 'part-time',
  CONTRACT = 'contract',
}

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

// =============================================
// END HR SYSTEM TYPES
// =============================================

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
  },
  [UserRole.TECHNICIAN]: {
    canViewDashboard: false,
    canViewAllJobs: false,
    canCreateJobs: false,
    canAssignJobs: false,
    canReassignJobs: false,
    canEditJobs: true,
    canDeleteJobs: false,
    canFinalizeInvoices: false,
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
    // HR Permissions - Technician can only view own profile
    canViewHR: false,
    canManageEmployees: false,
    canApproveLeave: false,
    canViewOwnProfile: true,
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
  },
};
