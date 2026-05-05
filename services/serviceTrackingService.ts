/**
 * Service Tracking Service
 * 
 * Handles hourmeter service tracking, fleet overview, and service upgrade logic.
 * Created: 2026-02-05 for customer feedback implementation
 */

import {
DailyUsageResult,
FleetServiceOverview,
Job,
ServiceUpgradeLog,
ServiceUpgradePrompt
} from '../types';
import { JOB_SELECT,supabase } from './supabaseClient';

// =============================================
// FLEET SERVICE OVERVIEW
// =============================================

/**
 * Get fleet service overview with all tracking data
 */
export const getFleetServiceOverview = async (): Promise<FleetServiceOverview[]> => {
  const { data, error } = await supabase
    .from('fleet_service_overview')
    .select('forklift_id, serial_number, make, model, type, status, current_hourmeter, last_serviced_hourmeter, next_target_service_hour, service_interval_hours, last_hourmeter_update, ownership, current_customer_id, is_service_overdue, hours_overdue, is_stale_data, days_since_update')
    .order('is_service_overdue', { ascending: false })
    .order('is_stale_data', { ascending: false })
    .order('serial_number');

  if (error) throw new Error(`Failed to fetch fleet overview: ${error.message}`);
  return data || [];
};

/**
 * External / customer-owned forklifts that Acwer is responsible for
 * servicing. Reads from v_forklift_service_predictions which exposes the
 * hourmeter prediction + service_responsibility classification.
 *
 * Used by the Serviced Externals tab. (Added 2026-05-06.)
 */
export interface ExternalServicedForklift {
  forklift_id: string;
  serial_number: string;
  make: string;
  model: string;
  type: string;
  fuel_type: string | null;
  status: string;
  current_hourmeter: number | null;
  last_service_date: string | null;
  next_service_due: string | null;
  predicted_date: string | null;
  days_remaining: number | null;
  service_urgency: 'overdue' | 'due_soon' | 'upcoming' | 'ok';
  customer_id: string | null;
  current_customer_id: string | null;
  ownership: 'company' | 'customer';
  ownership_type: 'fleet' | 'external';
  service_management_status: 'active' | 'dormant' | 'contract_ended' | null;
  acquisition_source: 'new_byo' | 'sold_from_fleet' | 'transferred' | null;
  customer_forklift_no: string | null;
  service_responsibility: 'fleet' | 'amc' | 'chargeable_external' | 'unmanaged';
}

export const getExternalServicedFleet = async (): Promise<ExternalServicedForklift[]> => {
  const { data, error } = await supabase
    .from('v_forklift_service_predictions')
    .select('forklift_id, serial_number, make, model, type, fuel_type, status, current_hourmeter, last_service_date, next_service_due, predicted_date, days_remaining, service_urgency, customer_id, current_customer_id, ownership, ownership_type, service_management_status, acquisition_source, customer_forklift_no, service_responsibility')
    .eq('ownership', 'customer')
    .neq('service_management_status', 'dormant')
    .order('days_remaining', { ascending: true, nullsFirst: false });
  if (error) throw new Error(`Failed to fetch external serviced fleet: ${error.message}`);
  return (data as ExternalServicedForklift[]) || [];
};

/**
 * Get daily usage for a specific forklift
 */
export const getForkliftDailyUsage = async (
  forkliftId: string, 
  days: number = 365
): Promise<DailyUsageResult> => {
  const { data, error } = await supabase
    .rpc('get_forklift_daily_usage', {
      p_forklift_id: forkliftId,
      p_days: days
    });

  if (error) throw new Error(`Failed to calculate daily usage: ${error.message}`);
  
  if (data && data.length > 0) {
    return data[0];
  }
  
  return {
    avg_daily_hours: null,
    usage_trend: 'insufficient_data',
    reading_count: 0
  };
};

// =============================================
// SERVICE UPGRADE LOGIC
// =============================================

/**
 * Check if a forklift is overdue for Full Service
 * Used when starting a Minor Service job
 */
export const checkServiceUpgradeNeeded = async (
  forkliftId: string,
  jobId: string,
  currentJobType: string
): Promise<ServiceUpgradePrompt | null> => {
  // Only check for Minor Service jobs
  if (currentJobType !== 'Minor Service') {
    return null;
  }

  const { data: forklift, error } = await supabase
    .from('forklifts')
    .select('forklift_id, hourmeter, next_target_service_hour')
    .eq('forklift_id', forkliftId)
    .single();

  if (error || !forklift) return null;

  const currentHourmeter = forklift.hourmeter || 0;
  const targetHourmeter = forklift.next_target_service_hour;

  // If no target set or not overdue, no prompt needed
  if (!targetHourmeter || currentHourmeter < targetHourmeter) {
    return null;
  }

  return {
    show: true,
    forklift_id: forkliftId,
    current_hourmeter: currentHourmeter,
    target_hourmeter: targetHourmeter,
    hours_overdue: currentHourmeter - targetHourmeter,
    job_id: jobId,
    original_job_type: currentJobType
  };
};

/**
 * Log service upgrade decision
 */
export const logServiceUpgradeDecision = async (
  data: Omit<ServiceUpgradeLog, 'log_id' | 'created_at'>
): Promise<ServiceUpgradeLog> => {
  const { data: log, error } = await supabase
    .from('service_upgrade_logs')
    .insert(data)
    .select()
    .single();

  if (error) throw new Error(`Failed to log upgrade decision: ${error.message}`);
  return log;
};

/**
 * Upgrade job from Minor Service to Full Service. Returns the updated Job row
 * so callers can apply via setJob({...updated}) and feed the realtime-echo
 * dedupe (2026-04-08) instead of calling loadJob().
 */
export const upgradeToFullService = async (
  jobId: string,
  technicianId: string,
  technicianName: string
): Promise<Job> => {
  // Get current job details
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('forklift_id, job_type, forklift:forklifts(hourmeter, next_target_service_hour)')
    .is('deleted_at', null)
    .eq('job_id', jobId)
    .single();

  if (jobError || !job) throw new Error('Job not found');
  if (!job.forklift_id) throw new Error('Job has no forklift assigned');

  // Handle the nested forklift object - Supabase returns it as an array or object
  const forkliftData = Array.isArray(job.forklift) ? job.forklift[0] : job.forklift;
  const currentHourmeter = forkliftData?.hourmeter || 0;
  const targetHourmeter = forkliftData?.next_target_service_hour || 0;

  // Update job type to Full Service and return the full row.
  const { data: updated, error: updateError } = await supabase
    .from('jobs')
    .update({
      job_type: 'Full Service',
      notes: `Upgraded from Minor Service by ${technicianName}. Unit was ${currentHourmeter - targetHourmeter} hours overdue for Full Service.`,
      updated_at: new Date().toISOString()
    })
    .is('deleted_at', null)
    .eq('job_id', jobId)
    .select(JOB_SELECT.DETAIL)
    .single();

  if (updateError) throw new Error(`Failed to upgrade job: ${updateError.message}`);

  // Log the upgrade decision
  await logServiceUpgradeDecision({
    job_id: jobId,
    forklift_id: job.forklift_id,
    technician_id: technicianId,
    technician_name: technicianName,
    decision: 'upgraded',
    current_hourmeter: currentHourmeter,
    target_hourmeter: targetHourmeter,
    hours_overdue: currentHourmeter - targetHourmeter,
    original_job_type: job.job_type
  });

  return updated as unknown as Job;
};

/**
 * Decline service upgrade (keep as Minor Service)
 */
export const declineServiceUpgrade = async (
  jobId: string,
  forkliftId: string,
  technicianId: string,
  technicianName: string,
  currentHourmeter: number,
  targetHourmeter: number,
  originalJobType: string
): Promise<void> => {
  // Log the decline decision
  await logServiceUpgradeDecision({
    job_id: jobId,
    forklift_id: forkliftId,
    technician_id: technicianId,
    technician_name: technicianName,
    decision: 'declined',
    current_hourmeter: currentHourmeter,
    target_hourmeter: targetHourmeter,
    hours_overdue: currentHourmeter - targetHourmeter,
    original_job_type: originalJobType
  });
};

// =============================================
// FULL SERVICE COMPLETION
// =============================================

// =============================================
// STALE DATA DETECTION
// =============================================

/**
 * Get forklifts with stale hourmeter data (no update in 60+ days)
 */
export const getStaleForklifts = async (): Promise<FleetServiceOverview[]> => {
  const { data, error } = await supabase
    .from('fleet_service_overview')
    .select('forklift_id, serial_number, make, model, type, status, current_hourmeter, last_serviced_hourmeter, next_target_service_hour, service_interval_hours, last_hourmeter_update, ownership, current_customer_id, is_service_overdue, hours_overdue, is_stale_data, days_since_update')
    .eq('is_stale_data', true)
    .order('days_since_update', { ascending: false });

  if (error) throw new Error(`Failed to fetch stale forklifts: ${error.message}`);
  return data || [];
};

/**
 * Get service intervals by forklift type
 */
export const getServiceIntervals = async () => {
  const { data, error } = await supabase
    .from('service_intervals')
    .select('interval_id, forklift_type, service_type, hourmeter_interval, calendar_interval_days, priority, checklist_items, estimated_duration_hours, is_active')
    .eq('is_active', true)
    .order('forklift_type')
    .order('service_type');

  if (error) throw new Error(`Failed to fetch service intervals: ${error.message}`);
  return data || [];
};

/**
 * Check for stale data and return summary (for dashboard display)
 */
export const getStaleDataSummary = async (): Promise<{
  hasStaleData: boolean;
  count: number;
  forklifts: Array<{ serial_number: string; days_since_update: number }>;
}> => {
  const staleForklifts = await getStaleForklifts();
  
  return {
    hasStaleData: staleForklifts.length > 0,
    count: staleForklifts.length,
    forklifts: staleForklifts.map(f => ({
      serial_number: f.serial_number,
      days_since_update: f.days_since_update || 0
    }))
  };
};
