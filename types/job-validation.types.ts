// =============================================
// JOB VALIDATION, CHECKLIST & CHANGE TYPES
// =============================================

import type { ForkliftConditionChecklist } from './forklift.types';
import type { JobPriority, JobStatus, JobType } from './job-core.types';

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

// Checklist Enforcement
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
