// =============================================
import { ForkliftConditionChecklist } from './forklift.types';
// JOB CORE TYPES - Enums, Job interface, and core types
// =============================================

import type { AssignmentType, MediaCategory, SignatureEntry } from './common.types';
import type { Customer } from './customer.types';
import type { Forklift } from './forklift.types';
import type { JobPartUsed } from './inventory.types';
import type { User } from './user.types';

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
  SERVICE = 'Service',           // Legacy - kept for backward compatibility
  FULL_SERVICE = 'Full Service', // PM with oil change - resets hourmeter cycle
  MINOR_SERVICE = 'Minor Service', // PM without oil change - no reset
  REPAIR = 'Repair',
  CHECKING = 'Checking',
  SLOT_IN = 'Slot-In',    // Emergency/same-day response (15-min SLA)
  COURIER = 'Courier',     // Delivery/Collection with POD
}

// Job types that reset the hourmeter service cycle
export const SERVICE_RESET_JOB_TYPES: JobType[] = [
  JobType.SERVICE,      // Legacy
  JobType.FULL_SERVICE, // New
];

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
  job_number?: string; // Auto-generated job number for display
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

  // Callback/Return Visit Tracking (for KPI calculation)
  is_callback?: boolean; // True if this job is a return visit/callback
  callback_parent_job_id?: string; // Reference to original job if callback

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

