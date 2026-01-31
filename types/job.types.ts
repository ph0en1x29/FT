// =============================================
// JOB / JOB REQUEST / JOB PARTS TYPES
// =============================================

import type { Customer } from './customer.types';
import type { Forklift, ForkliftConditionChecklist } from './forklift.types';
import type { JobPartUsed } from './inventory.types';
import type { User } from './user.types';
import type { Part } from './inventory.types';
import type { MediaCategory, AssignmentType, SignatureEntry } from './common.types';

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

export interface ExtraCharge {
  charge_id: string;
  job_id: string;
  name: string;
  description: string;
  amount: number;
  created_at: string;
}

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
  
  // Technician Accept/Reject (15-minute response window)
  technician_response_deadline?: string; // assigned_at + 15 minutes
  technician_accepted_at?: string;
  technician_rejected_at?: string;
  technician_rejection_reason?: string;
  no_response_alerted_at?: string; // When admin was alerted about no response
  
  // Forklift reference
  forklift_id?: string;
  forklift?: Forklift;
  hourmeter_reading?: number;
  first_hourmeter_recorded_by_id?: string;  // Technician who first recorded the hourmeter
  first_hourmeter_recorded_by_name?: string;
  first_hourmeter_recorded_at?: string;     // When the hourmeter was first recorded

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
