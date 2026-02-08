// ============================================
// HOURMETER AMENDMENT WORKFLOW
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
