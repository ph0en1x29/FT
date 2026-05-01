// =============================================
// ACWER SERVICE OPERATIONS FLOW — TYPES (Phase 0)
//
// Mirrors the schema added in supabase/migrations/20260501_acwer_flow_phase0_foundation.sql.
// These types are pure data shapes — no service-layer logic here.
// =============================================

/**
 * Three-path billing classification per the ACWER service operations flow.
 *
 * - AMC: customer-owned forklift covered by an active service contract
 * - CHARGEABLE: customer-owned forklift, no active contract (Path B, ad-hoc)
 * - FLEET: Acwer-owned forklift, default non-chargeable internal cost (Path C)
 * - UNSET: legacy / pre-Phase-0 jobs OR jobs that cannot be classified yet
 */
export enum BillingPath {
  AMC = 'amc',
  CHARGEABLE = 'chargeable',
  FLEET = 'fleet',
  UNSET = 'unset',
}

/**
 * Result of classifying a job into one of the three paths.
 * Stored on the job row as `billing_path` + `billing_path_reason`.
 */
export interface BillingPathClassification {
  path: BillingPath;
  reason: string;
  contract_id?: string;
}

/**
 * Customer service contract (AMC / warranty / maintenance).
 * Drives Path A classification: a forklift covered by an active contract
 * for the customer becomes Path A.
 */
export interface ServiceContract {
  contract_id: string;
  customer_id: string;
  contract_number?: string | null;
  contract_type: 'amc' | 'warranty' | 'maintenance';
  start_date: string;
  end_date: string;
  /** NULL or [] = all customer's forklifts */
  covered_forklift_ids?: string[] | null;
  includes_parts: boolean;
  includes_labor: boolean;
  /** Per-contract wear-and-tear override list */
  wear_tear_part_ids?: string[] | null;
  notes?: string | null;
  is_active: boolean;
  created_at: string;
  created_by_id?: string | null;
  created_by_name?: string | null;
  updated_at: string;
  updated_by_id?: string | null;
  updated_by_name?: string | null;
}

/**
 * Consumable usage quota (e.g. "1 set tires/year per fleet forklift").
 * Phase 6 enforcement flips Path C jobs to chargeable on overage.
 */
export interface PartsUsageQuota {
  quota_id: string;
  scope_type: 'global' | 'per_forklift' | 'per_customer';
  /** forklift_id or customer_id; NULL when scope_type='global' */
  scope_id?: string | null;
  part_id?: string | null;
  part_category?: string | null;
  period_unit: 'year' | 'quarter' | 'month';
  max_quantity: number;
  is_active: boolean;
  notes?: string | null;
  created_at: string;
}

/**
 * Recurrence rule for fleet (Acwer-owned) forklift maintenance.
 * Phase 5 cron generates ScheduledService records ahead of next_due_date.
 */
export interface RecurringSchedule {
  schedule_id: string;
  forklift_id: string;
  service_interval_id?: string | null;
  contract_id?: string | null;
  frequency: 'monthly' | 'quarterly' | 'yearly' | 'hourmeter';
  /** Required when frequency='hourmeter' */
  hourmeter_interval?: number | null;
  next_due_date?: string | null;
  next_due_hourmeter?: number | null;
  /** Create job N days before due_date */
  lead_time_days: number;
  is_active: boolean;
  last_generated_at?: string | null;
  notes?: string | null;
  created_at: string;
}

/**
 * Single-row global ACWER settings. id=1 is the only allowed row.
 */
export interface AcwerSettings {
  id: 1;
  default_labor_rate_myr: number;
  default_transport_flat_myr: number;
  default_transport_per_km_myr: number;
  default_transport_flat_threshold_km: number;
  amc_warranty_default_months: number;
  fleet_default_frequency: 'monthly' | 'quarterly' | 'yearly' | 'hourmeter';
  fleet_default_hourmeter_interval: number;
  /** Phase 7 feature flag — when TRUE, parts deduct only on Admin 2 finalize */
  feature_deduct_on_finalize: boolean;
  updated_at: string;
  updated_by_id?: string | null;
  updated_by_name?: string | null;
}
