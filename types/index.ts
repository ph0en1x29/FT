export enum UserRole {
  ADMIN = 'admin',
  ADMIN_SERVICE = 'admin_service',  // Admin 1 - Service operations, job completion, hourmeter approval
  ADMIN_STORE = 'admin_store',      // Admin 2 - Parts/inventory, requisitions, Van Stock replenishment
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
  CANCELLED = 'Cancelled',
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
  SLOT_IN = 'Slot-In',    // Emergency/same-day response (15-min SLA)
  COURIER = 'Courier',     // Delivery/Collection with POD
}

// Forklift/Asset types
export enum ForkliftType {
  ELECTRIC = 'Electric',
  DIESEL = 'Diesel',
  LPG = 'LPG',
  PETROL = 'Petrol',
}

export enum ForkliftStatus {
  // Primary statuses
  AVAILABLE = 'Available',           // Ready for use/rent
  RENTED_OUT = 'Rented Out',         // Currently rented to customer
  IN_SERVICE = 'In Service',         // Currently being serviced (job in progress)
  SERVICE_DUE = 'Service Due',       // PM service coming up
  AWAITING_PARTS = 'Awaiting Parts', // Waiting for parts to complete repair
  OUT_OF_SERVICE = 'Out of Service', // Not operational
  RESERVED = 'Reserved',             // Reserved for upcoming rental/job

  // Legacy statuses (for backwards compatibility)
  ACTIVE = 'Active',                 // @deprecated - use AVAILABLE
  MAINTENANCE = 'Under Maintenance', // @deprecated - use IN_SERVICE
  INACTIVE = 'Inactive',             // @deprecated - use OUT_OF_SERVICE
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

// Forklift Ownership Type
export enum ForkliftOwnership {
  COMPANY = 'company',   // ACWER-owned forklift
  CUSTOMER = 'customer', // Customer-owned forklift (Van Stock usage requires approval)
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
  // Ownership - determines Van Stock approval requirements
  ownership: ForkliftOwnership; // 'company' = ACWER-owned, 'customer' = customer-owned
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
  // Van Stock tracking
  from_van_stock?: boolean; // True if part came from Van Stock
  van_stock_item_id?: string; // Reference to VanStockItem if from Van Stock
}

// =============================================
// VAN STOCK SYSTEM
// =============================================

// Van Stock Assignment - Links technician to their Van Stock inventory
export interface VanStock {
  van_stock_id: string;
  technician_id: string;
  technician_name?: string;
  technician?: User;

  // Van identification
  van_code?: string; // Unique van identifier (license plate, van number, etc.)
  notes?: string; // Optional notes about this van

  // Configuration
  max_items: number; // Default 50 SKUs
  is_active: boolean;

  // Metadata
  created_at: string;
  created_by_id?: string;
  created_by_name?: string;
  updated_at: string;
  last_audit_at?: string;
  next_audit_due?: string;

  // Populated on fetch
  items?: VanStockItem[];
  total_value?: number;
}

// Individual item in a technician's Van Stock
export interface VanStockItem {
  item_id: string;
  van_stock_id: string;
  part_id: string;
  part?: Part;

  // Quantities
  quantity: number;
  min_quantity: number; // Trigger replenishment when below this
  max_quantity: number; // Maximum to carry

  // Tracking
  last_replenished_at?: string;
  last_used_at?: string;

  // For specialty variation
  is_core_item: boolean; // True = standard item, False = specialty variation

  // Metadata
  created_at: string;
  updated_at: string;
}

// Van Stock usage record (when technician uses parts from Van Stock)
export interface VanStockUsage {
  usage_id: string;
  van_stock_item_id: string;
  job_id: string;
  job_part_id?: string;

  quantity_used: number;
  used_at: string;
  used_by_id: string;
  used_by_name: string;

  // For customer-owned forklifts - approval tracking
  requires_approval: boolean;
  approved_by_id?: string;
  approved_by_name?: string;
  approved_at?: string;
  approval_status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
}

// Replenishment request status
export type ReplenishmentStatus = 'pending' | 'approved' | 'in_progress' | 'completed' | 'cancelled';

// Van Stock Replenishment Request
export interface VanStockReplenishment {
  replenishment_id: string;
  van_stock_id: string;
  technician_id: string;
  technician_name?: string;

  // Request details
  status: ReplenishmentStatus;
  request_type: 'manual' | 'auto_slot_in' | 'low_stock'; // auto_slot_in = triggered by Slot-In job
  triggered_by_job_id?: string; // If auto-triggered by Slot-In

  // Items to replenish
  items: VanStockReplenishmentItem[];

  // Workflow
  requested_at: string;
  requested_by_id?: string;
  requested_by_name?: string;

  // Admin 2 (Store) approval
  approved_by_id?: string;
  approved_by_name?: string;
  approved_at?: string;

  // Fulfillment
  fulfilled_at?: string;
  fulfilled_by_id?: string;
  fulfilled_by_name?: string;

  // Technician confirmation
  confirmed_by_technician: boolean;
  confirmed_at?: string;
  confirmation_photo_url?: string;

  // Notes
  notes?: string;

  // Metadata
  created_at: string;
  updated_at: string;
}

// Individual item in a replenishment request
export interface VanStockReplenishmentItem {
  item_id: string;
  replenishment_id: string;
  van_stock_item_id: string;
  part_id: string;
  part_name: string;
  part_code: string;

  quantity_requested: number;
  quantity_issued: number;

  // Serial numbers for warranty tracking
  serial_numbers?: string[];

  // Rejection tracking
  is_rejected: boolean;
  rejection_reason?: string;
}

// Van Stock Audit
export type AuditStatus = 'scheduled' | 'in_progress' | 'completed' | 'discrepancy_found';

export interface VanStockAudit {
  audit_id: string;
  van_stock_id: string;
  technician_id: string;
  technician_name?: string;

  // Schedule
  scheduled_date: string;
  status: AuditStatus;

  // Audit details
  started_at?: string;
  completed_at?: string;
  audited_by_id?: string; // Admin 2 (Store)
  audited_by_name?: string;

  // Results
  items_audited: VanStockAuditItem[];
  total_expected_value: number;
  total_actual_value: number;
  discrepancy_value: number;

  // Resolution
  discrepancy_notes?: string;
  resolution_notes?: string;
  resolved_at?: string;
  resolved_by_id?: string;
  resolved_by_name?: string;

  // Metadata
  created_at: string;
  updated_at: string;
}

// Individual item in an audit
export interface VanStockAuditItem {
  audit_item_id: string;
  audit_id: string;
  van_stock_item_id: string;
  part_id: string;
  part_name: string;

  expected_quantity: number;
  actual_quantity: number;
  discrepancy: number; // actual - expected

  notes?: string;
}

// =============================================
// END VAN STOCK SYSTEM
// =============================================

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

  // GPS Location (required for job photos)
  gps_latitude?: number;
  gps_longitude?: number;
  gps_accuracy?: number; // Accuracy in meters
  gps_captured_at?: string;

  // Timestamp validation
  device_timestamp?: string; // Timestamp from device EXIF
  server_timestamp?: string; // When server received it
  timestamp_mismatch?: boolean; // Flagged if device != server by threshold
  timestamp_mismatch_minutes?: number; // Difference in minutes

  // Photo source tracking
  source: 'camera' | 'gallery' | 'unknown';
  is_camera_fallback?: boolean; // True if camera broken, text description used
  fallback_description?: string; // Text description if camera fallback
  fallback_approved?: boolean;
  fallback_approved_by_id?: string;
  fallback_approved_by_name?: string;
  fallback_approved_at?: string;

  // Start/End photo markers (for timer automation)
  is_start_photo?: boolean; // True = triggers labour timer start
  is_end_photo?: boolean; // True = triggers labour timer stop
  timer_triggered_at?: string; // When timer was triggered by this photo

  // Multi-day job tracking
  job_day_number?: number; // Day 1, Day 2, etc. for multi-day jobs

  // Admin review
  flagged_for_review?: boolean;
  flagged_reason?: string;
  reviewed_by_id?: string;
  reviewed_by_name?: string;
  reviewed_at?: string;
  review_notes?: string;
}

// Photo validation requirements
export interface PhotoRequirements {
  require_gps: boolean;
  require_timestamp: boolean;
  require_camera_only: boolean;
  timestamp_tolerance_minutes: number; // Flag if mismatch > this
  require_forklift_visible: boolean;
  require_hourmeter_visible: boolean;
  require_serial_visible: boolean;
}

// Duration alert configuration
export interface DurationAlertConfig {
  job_type: JobType;
  warning_threshold_hours: number;
  alert_threshold_hours: number;
  notify_supervisor: boolean;
  notify_admin: boolean;
}

// Default duration alert thresholds (from questionnaire)
export const DEFAULT_DURATION_ALERTS: DurationAlertConfig[] = [
  { job_type: JobType.SERVICE, warning_threshold_hours: 2.5, alert_threshold_hours: 3, notify_supervisor: true, notify_admin: true },
  { job_type: JobType.REPAIR, warning_threshold_hours: 4, alert_threshold_hours: 5, notify_supervisor: true, notify_admin: true },
  { job_type: JobType.SLOT_IN, warning_threshold_hours: 4, alert_threshold_hours: 5, notify_supervisor: true, notify_admin: true },
  { job_type: JobType.CHECKING, warning_threshold_hours: 1.5, alert_threshold_hours: 2, notify_supervisor: true, notify_admin: false },
  { job_type: JobType.COURIER, warning_threshold_hours: 1, alert_threshold_hours: 1.5, notify_supervisor: false, notify_admin: false },
];

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
  job_type?: JobType; // Service, Repair, Checking, Slot-In, Courier
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

  // Slot-In SLA Tracking
  sla_target_minutes?: number; // Default 15 for Slot-In jobs
  sla_met?: boolean;
  acknowledged_at?: string;
  acknowledged_by_id?: string;
  acknowledged_by_name?: string;

  // Slot-In → Repair Conversion
  converted_from_job_id?: string;
  converted_to_job_id?: string;
  conversion_reason?: string;
  converted_at?: string;
  converted_by_id?: string;
  converted_by_name?: string;

  // Courier/Collection POD (Proof of Delivery)
  courier_type?: 'delivery' | 'collection' | 'both';
  courier_items?: CourierItem[];
  pod_photo_ids?: string[];
  pod_timestamp?: string;
  pod_notes?: string;

  // Dual Admin Confirmation Workflow
  // Admin 2 (Store) - Parts confirmation (within 24 hours)
  parts_confirmed_by_id?: string;
  parts_confirmed_by_name?: string;
  parts_confirmed_at?: string;
  parts_confirmation_notes?: string;
  parts_confirmation_skipped?: boolean; // True if job has no parts used

  // Admin 1 (Service) - Job completion confirmation
  job_confirmed_by_id?: string;
  job_confirmed_by_name?: string;
  job_confirmed_at?: string;
  job_confirmation_notes?: string;

  // Escalation tracking (if not confirmed within 24 hours)
  parts_escalated_at?: string;
  parts_escalated_to_id?: string;
  parts_escalated_to_name?: string;

  // Hourmeter Validation & Amendment
  hourmeter_previous?: number;            // Last recorded reading for comparison
  hourmeter_flag_reasons?: string[];      // Why reading was flagged
  hourmeter_flagged?: boolean;            // True if reading needs review
  hourmeter_amendment_id?: string;        // Reference to amendment if amended
  hourmeter_validated_at?: string;
  hourmeter_validated_by_id?: string;
  hourmeter_validated_by_name?: string;

  // Checklist Enforcement
  checklist_completed?: boolean;          // True if all required items checked
  checklist_missing_items?: string[];     // List of unchecked required items
  checklist_used_check_all?: boolean;     // True if bulk "Check All" was used
  checklist_check_all_confirmed?: boolean; // True if confirmed after Check All
  checklist_validated_at?: string;
  checklist_validated_by_id?: string;
  checklist_validated_by_name?: string;
}

// Courier item for POD tracking
export interface CourierItem {
  item_type: 'spare_part' | 'document' | 'pallet_truck' | 'other';
  description: string;
  quantity?: number;
  part_id?: string; // Reference to part if spare_part
  notes?: string;
}

// Job Type Change Request (requires Admin approval)
export type JobTypeChangeStatus = 'pending' | 'approved' | 'rejected';

export interface JobTypeChangeRequest {
  request_id: string;
  job_id: string;
  original_type: JobType;
  requested_type: JobType;
  justification: string; // Required justification for the change

  // Request tracking
  requested_by_id: string;
  requested_by_name: string;
  requested_at: string;

  // Approval/Rejection
  status: JobTypeChangeStatus;
  reviewed_by_id?: string;
  reviewed_by_name?: string;
  reviewed_at?: string;
  review_notes?: string;

  // Auto-populated
  created_at: string;
  updated_at: string;
}

// Job Type Change History (for audit trail)
export interface JobTypeChangeLog {
  log_id: string;
  job_id: string;
  old_type: JobType;
  new_type: JobType;
  change_reason: string;
  changed_by_id: string;
  changed_by_name: string;
  changed_at: string;
  approved_by_id?: string;
  approved_by_name?: string;
}

// ============================================
// Hourmeter Amendment Workflow
// ============================================

export type HourmeterAmendmentStatus = 'pending' | 'approved' | 'rejected';

export type HourmeterFlagReason =
  | 'lower_than_previous'    // Reading is lower than last recorded
  | 'excessive_jump'         // Jump exceeds threshold
  | 'pattern_mismatch'       // Doesn't match expected usage pattern
  | 'manual_flag'            // Manually flagged by technician/admin
  | 'timestamp_mismatch';    // Timestamp validation issue

export interface HourmeterAmendment {
  amendment_id: string;
  job_id: string;
  forklift_id: string;

  // Original and amended values
  original_reading: number;
  amended_reading: number;

  // Request tracking
  reason: string; // Justification for amendment
  flag_reasons?: HourmeterFlagReason[];
  requested_by_id: string;
  requested_by_name: string;
  requested_at: string;

  // Approval (only Admin 1 - Service can approve)
  status: HourmeterAmendmentStatus;
  reviewed_by_id?: string;
  reviewed_by_name?: string;
  reviewed_at?: string;
  review_notes?: string;

  // Metadata
  created_at: string;
  updated_at: string;
}

// Hourmeter validation configuration
export interface HourmeterValidationConfig {
  config_id: string;

  // Thresholds (configurable per questionnaire)
  warning_threshold_hours?: number;      // Hours jump that triggers warning
  alert_threshold_hours?: number;        // Hours jump that triggers hard block
  lower_reading_action: 'flag' | 'block' | 'allow'; // What to do if lower than previous

  // Daily usage patterns (for anomaly detection)
  expected_daily_usage_hours?: number;   // Expected average daily hours
  usage_variance_tolerance?: number;     // Percentage variance allowed

  // Amendment rules
  require_approval_for_all: boolean;     // If true, all amendments need approval
  auto_approve_minor_corrections: boolean; // Auto-approve small differences
  minor_correction_threshold: number;    // What counts as "minor" (e.g., 1 hour)

  // Active status
  is_active: boolean;
  updated_at: string;
  updated_by_id?: string;
  updated_by_name?: string;
}

// Default hourmeter validation config
export const DEFAULT_HOURMETER_CONFIG: Partial<HourmeterValidationConfig> = {
  warning_threshold_hours: 100,         // Warn if jump > 100 hours
  alert_threshold_hours: 500,           // Alert if jump > 500 hours
  lower_reading_action: 'flag',         // Flag but don't block
  expected_daily_usage_hours: 8,        // Assume 8 hours/day average
  usage_variance_tolerance: 50,         // 50% variance tolerance
  require_approval_for_all: false,
  auto_approve_minor_corrections: true,
  minor_correction_threshold: 2,        // Auto-approve ≤2 hour differences
  is_active: true,
};

// Hourmeter history entry (for tracking changes on forklift)
export interface HourmeterHistoryEntry {
  entry_id: string;
  forklift_id: string;
  job_id?: string;

  // Reading details
  reading: number;
  previous_reading?: number;
  hours_since_last?: number;

  // Validation flags
  flag_reasons?: HourmeterFlagReason[];
  was_amended: boolean;
  amendment_id?: string;

  // Recording info
  recorded_by_id: string;
  recorded_by_name: string;
  recorded_at: string;

  // Source
  source: 'job_start' | 'job_end' | 'amendment' | 'audit' | 'manual';
}

// ============================================
// Checklist Enforcement
// ============================================

export interface ChecklistValidation {
  job_id: string;

  // Checklist status
  total_items: number;
  checked_items: number;
  required_items: number;        // Number of mandatory items
  checked_required_items: number;

  // Validation result
  is_complete: boolean;
  missing_required_items?: string[];  // List of unchecked required items

  // "Check All" tracking
  used_check_all: boolean;       // Did technician use bulk check?
  check_all_confirmed: boolean;  // Did they confirm after using Check All?

  // Validation timestamp
  validated_at?: string;
  validated_by_id?: string;
  validated_by_name?: string;
}

// Which checklist items are mandatory (block completion if unchecked)
export const MANDATORY_CHECKLIST_ITEMS: (keyof ForkliftConditionChecklist)[] = [
  // Safety critical items
  'safety_overhead_guard',
  'safety_seat_belt',
  'lighting_horn',
  'lighting_beacon_light',
  // Braking system
  'braking_brake_pedal',
  'braking_parking_brake',
  // Steering
  'steering_wheel_valve',
  'steering_cylinder',
];

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
  // Job type change notifications
  JOB_TYPE_CHANGE_REQUESTED = 'job_type_change_requested',
  JOB_TYPE_CHANGE_APPROVED = 'job_type_change_approved',
  JOB_TYPE_CHANGE_REJECTED = 'job_type_change_rejected',
  // Slot-In SLA notifications
  SLOT_IN_SLA_WARNING = 'slot_in_sla_warning', // Approaching 15-min deadline
  SLOT_IN_SLA_BREACH = 'slot_in_sla_breach',   // SLA missed
  // Duration alert notifications
  JOB_DURATION_WARNING = 'job_duration_warning', // Approaching threshold
  JOB_DURATION_EXCEEDED = 'job_duration_exceeded', // Exceeded threshold
  // Photo validation notifications
  PHOTO_FLAGGED = 'photo_flagged', // Photo flagged for review
  PHOTO_GPS_MISSING = 'photo_gps_missing', // GPS not captured
  PHOTO_TIMESTAMP_MISMATCH = 'photo_timestamp_mismatch', // Timestamp doesn't match
  CAMERA_FALLBACK_REQUESTED = 'camera_fallback_requested', // Tech requesting text fallback
  CAMERA_FALLBACK_APPROVED = 'camera_fallback_approved',
  CAMERA_FALLBACK_REJECTED = 'camera_fallback_rejected',
  // Hourmeter amendment notifications
  HOURMETER_FLAGGED = 'hourmeter_flagged',                 // Reading flagged for review
  HOURMETER_AMENDMENT_REQUESTED = 'hourmeter_amendment_requested', // Tech requests amendment
  HOURMETER_AMENDMENT_APPROVED = 'hourmeter_amendment_approved',   // Admin 1 approved
  HOURMETER_AMENDMENT_REJECTED = 'hourmeter_amendment_rejected',   // Admin 1 rejected
  // Checklist notifications
  CHECKLIST_INCOMPLETE = 'checklist_incomplete',           // Required items missing
  CHECKLIST_CHECK_ALL_USED = 'checklist_check_all_used',   // Bulk check used - needs review
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
  slot_in_jobs: number;
  courier_jobs: number;
  
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
  // Pricing/Cost Visibility (questionnaire: hide from Technicians)
  canViewPricing: boolean;       // Can see cost_price, sell_price on parts
  canViewJobCosts: boolean;      // Can see labor costs, job totals
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

// =============================================
// FLEET DASHBOARD METRICS (per questionnaire)
// =============================================

export interface FleetDashboardMetrics {
  // Must Have metrics
  total_fleet_count: number;
  units_by_status: {
    available: number;
    rented_out: number;
    in_service: number;
    service_due: number;
    awaiting_parts: number;
    out_of_service: number;
    reserved: number;
  };
  service_due_this_week: number;
  jobs_completed_this_month: number;

  // Nice to Have metrics
  average_job_duration_hours?: number;
  most_active_forklifts?: {
    forklift_id: string;
    serial_number: string;
    job_count: number;
  }[];
}

// =============================================
// AUTOCOUNT INTEGRATION (Invoice Export Only)
// =============================================

export type AutoCountExportStatus = 'pending' | 'exported' | 'failed' | 'cancelled';

// AutoCount invoice export record
export interface AutoCountExport {
  export_id: string;
  job_id: string;

  // Export details
  export_type: 'invoice' | 'credit_note';
  autocount_invoice_number?: string; // Invoice number in AutoCount after export
  status: AutoCountExportStatus;

  // Invoice data snapshot (at time of export)
  customer_code?: string;          // AutoCount customer code
  customer_name: string;
  invoice_date: string;
  due_date?: string;
  total_amount: number;
  tax_amount?: number;
  currency: string;                // Default: MYR

  // Line items
  line_items: AutoCountLineItem[];

  // Export tracking
  exported_at?: string;
  exported_by_id?: string;
  exported_by_name?: string;
  export_error?: string;

  // Retry tracking
  retry_count: number;
  last_retry_at?: string;

  // Metadata
  created_at: string;
  updated_at: string;
}

// AutoCount line item for export
export interface AutoCountLineItem {
  item_code?: string;              // AutoCount item code (if mapped)
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  tax_code?: string;               // AutoCount tax code

  // Source tracking
  source_type: 'labor' | 'part' | 'extra_charge';
  source_id?: string;              // job_part_id or extra_charge reference
}

// AutoCount customer mapping (for syncing customer codes)
export interface AutoCountCustomerMapping {
  mapping_id: string;
  customer_id: string;             // FieldPro customer ID
  autocount_customer_code: string; // AutoCount customer code
  autocount_customer_name?: string;
  is_active: boolean;
  last_synced_at?: string;
  created_at: string;
  updated_at: string;
}

// AutoCount item mapping (for syncing part codes)
export interface AutoCountItemMapping {
  mapping_id: string;
  part_id: string;                 // FieldPro part ID
  autocount_item_code: string;     // AutoCount item code
  autocount_item_name?: string;
  is_active: boolean;
  last_synced_at?: string;
  created_at: string;
  updated_at: string;
}

// AutoCount export settings
export interface AutoCountSettings {
  is_enabled: boolean;
  api_endpoint?: string;
  company_code?: string;
  default_tax_code?: string;
  default_currency: string;
  auto_export_on_finalize: boolean; // Auto-export when job is finalized
  labor_item_code?: string;         // Default item code for labor charges
  extra_charge_item_code?: string;  // Default item code for extra charges
  updated_at: string;
  updated_by_id?: string;
  updated_by_name?: string;
}

// Default AutoCount settings
export const DEFAULT_AUTOCOUNT_SETTINGS: Partial<AutoCountSettings> = {
  is_enabled: false,
  default_currency: 'MYR',
  auto_export_on_finalize: false,
};

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
  },
  // Admin 1 (Service) - Same permissions as Admin, workflow routing for service operations
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
    canViewHR: true,
    canManageEmployees: true,
    canApproveLeave: true,
    canViewOwnProfile: true,
    canViewPricing: true,
    canViewJobCosts: true,
  },
  // Admin 2 (Store) - Same permissions as Admin, workflow routing for parts/inventory
  [UserRole.ADMIN_STORE]: {
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
    canViewHR: true,
    canManageEmployees: true,
    canApproveLeave: true,
    canViewOwnProfile: true,
    canViewPricing: true,
    canViewJobCosts: true,
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
    // Pricing Visibility - HIDDEN from Technicians per questionnaire
    canViewPricing: false,
    canViewJobCosts: false,
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
  },
};
