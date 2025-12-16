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
  created_at?: string;
}

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

export interface JobMedia {
  media_id: string;
  job_id: string;
  type: 'photo' | 'video';
  url: string;
  description?: string;
  created_at: string;
  uploaded_by_id?: string;
  uploaded_by_name?: string;
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
}

export interface Notification {
  notification_id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  reference_type?: 'job' | 'forklift' | 'rental' | 'inventory';
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
  },
  [UserRole.SUPERVISOR]: {
    // Supervisor has access to everything technician and accountant can see
    canViewDashboard: true,
    canViewAllJobs: true,
    canCreateJobs: true,
    canAssignJobs: true,
    canReassignJobs: true,
    canEditJobs: true,
    canDeleteJobs: false,
    canFinalizeInvoices: true, // Can finalize like accountant
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
  },
  [UserRole.TECHNICIAN]: {
    canViewDashboard: false,
    canViewAllJobs: false,
    canCreateJobs: false,
    canAssignJobs: false,
    canReassignJobs: false,
    canEditJobs: true, // Own jobs only
    canDeleteJobs: false,
    canFinalizeInvoices: false,
    canViewKPI: false,
    canManageUsers: false,
    canManageInventory: true, // Can view inventory
    canEditInventory: false,
    canViewCustomers: true,
    canEditCustomers: false,
    canDeleteCustomers: false,
    canViewForklifts: true,
    canEditForklifts: false,
    canManageRentals: false,
    canEditRentalRates: false,
    canViewServiceRecords: true, // Can view service records
    canScheduleMaintenance: false,
  },
  [UserRole.ACCOUNTANT]: {
    canViewDashboard: true,
    canViewAllJobs: true,
    canCreateJobs: false,
    canAssignJobs: false,
    canReassignJobs: false,
    canEditJobs: true, // For invoice finalization
    canDeleteJobs: false,
    canFinalizeInvoices: true,
    canViewKPI: false,
    canManageUsers: false,
    canManageInventory: true, // Can view inventory
    canEditInventory: false,
    canViewCustomers: true, // Can view customers
    canEditCustomers: false,
    canDeleteCustomers: false,
    canViewForklifts: true, // Can view forklifts
    canEditForklifts: false,
    canManageRentals: false,
    canEditRentalRates: false,
    canViewServiceRecords: true, // Can view service records
    canScheduleMaintenance: false,
  },
};
