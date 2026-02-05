/**
 * Service Tracking Service
 * 
 * Handles hourmeter service tracking, fleet overview, and service upgrade logic.
 * Created: 2026-02-05 for customer feedback implementation
 */

import { supabase } from './supabaseClient';
import { 
  FleetServiceOverview, 
  DailyUsageResult, 
  ServiceUpgradeLog,
  ServiceUpgradePrompt,
  Forklift
} from '../types';

// =============================================
// FLEET SERVICE OVERVIEW
// =============================================

/**
 * Get fleet service overview with all tracking data
 */
export const getFleetServiceOverview = async (): Promise<FleetServiceOverview[]> => {
  const { data, error } = await supabase
    .from('fleet_service_overview')
    .select('*')
    .order('is_service_overdue', { ascending: false })
    .order('is_stale_data', { ascending: false })
    .order('serial_number');

  if (error) throw new Error(`Failed to fetch fleet overview: ${error.message}`);
  return data || [];
};

/**
 * Get daily usage for a specific forklift
 */
export const getForkliftDailyUsage = async (
  forkliftId: string, 
  days: number = 14
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

/**
 * Get daily usage period setting
 */
export const getDailyUsagePeriod = async (): Promise<number> => {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'daily_usage_period_days')
    .single();

  if (error || !data) return 14; // Default to 14 days
  return parseInt(data.value, 10) || 14;
};

/**
 * Update daily usage period setting
 */
export const updateDailyUsagePeriod = async (days: number): Promise<void> => {
  const { error } = await supabase
    .from('app_settings')
    .upsert({
      key: 'daily_usage_period_days',
      value: days.toString(),
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' });

  if (error) throw new Error(`Failed to update setting: ${error.message}`);
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
 * Upgrade job from Minor Service to Full Service
 */
export const upgradeToFullService = async (
  jobId: string,
  technicianId: string,
  technicianName: string
): Promise<void> => {
  // Get current job details
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('forklift_id, job_type, forklift:forklifts(hourmeter, next_target_service_hour)')
    .eq('job_id', jobId)
    .single();

  if (jobError || !job) throw new Error('Job not found');
  if (!job.forklift_id) throw new Error('Job has no forklift assigned');

  // Handle the nested forklift object - Supabase returns it as an array or object
  const forkliftData = Array.isArray(job.forklift) ? job.forklift[0] : job.forklift;
  const currentHourmeter = forkliftData?.hourmeter || 0;
  const targetHourmeter = forkliftData?.next_target_service_hour || 0;

  // Update job type to Full Service
  const { error: updateError } = await supabase
    .from('jobs')
    .update({
      job_type: 'Full Service',
      notes: `Upgraded from Minor Service by ${technicianName}. Unit was ${currentHourmeter - targetHourmeter} hours overdue for Full Service.`,
      updated_at: new Date().toISOString()
    })
    .eq('job_id', jobId);

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

/**
 * Complete a Full Service job and reset the hourmeter baseline
 */
export const completeFullService = async (
  jobId: string,
  hourmeterReading: number
): Promise<void> => {
  // Validate input
  if (!jobId) throw new Error('Job ID is required');
  if (hourmeterReading < 0) throw new Error('Hourmeter reading cannot be negative');
  if (!Number.isInteger(hourmeterReading)) {
    hourmeterReading = Math.round(hourmeterReading);
  }

  const { error } = await supabase
    .rpc('complete_full_service', {
      p_job_id: jobId,
      p_hourmeter_reading: hourmeterReading
    });

  if (error) throw new Error(`Failed to complete Full Service: ${error.message}`);
};

// =============================================
// STALE DATA DETECTION
// =============================================

/**
 * Get forklifts with stale hourmeter data (no update in 60+ days)
 */
export const getStaleForklifts = async (): Promise<FleetServiceOverview[]> => {
  const { data, error } = await supabase
    .from('fleet_service_overview')
    .select('*')
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
    .select('*')
    .eq('is_active', true)
    .order('forklift_type')
    .order('service_type');

  if (error) throw new Error(`Failed to fetch service intervals: ${error.message}`);
  return data || [];
};
