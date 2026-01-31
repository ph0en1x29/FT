// =============================================
// NOTIFICATION TYPES
// =============================================

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
