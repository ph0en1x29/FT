/**
 * Hourmeter Service
 * 
 * Handles:
 * - Hourmeter readings, history, amendments, and validation (existing)
 * - Service prediction system (new - 2026-02-04)
 */

import { supabase, logDebug, logError } from './supabaseClient';
import type { 
  HourmeterAmendment, 
  HourmeterAmendmentStatus, 
  HourmeterFlagReason,
  HourmeterReading, 
  ServicePrediction, 
  ForkliftWithPrediction,
  ServicePredictionDashboard,
  ForkliftType 
} from '../types';

// =============================================
// HOURMETER HISTORY (existing)
// =============================================

export const getForkliftHourmeterHistory = async (forkliftId: string): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from('hourmeter_history')
      .select(`*, job:jobs(job_id, title, job_type)`)
      .eq('forklift_id', forkliftId)
      .order('recorded_at', { ascending: false });

    if (error) {
      return [];
    }
    return data || [];
  } catch (e) {
    return [];
  }
};

// =============================================
// HOURMETER AMENDMENTS (existing)
// =============================================

export const getHourmeterAmendments = async (statusFilter?: HourmeterAmendmentStatus): Promise<HourmeterAmendment[]> => {
  try {
    let query = supabase
      .from('hourmeter_amendments')
      .select(`
        *,
        job:jobs(job_id, title, job_type, scheduled_date),
        forklift:forklifts(forklift_id, serial_number, model, make)
      `)
      .order('requested_at', { ascending: false });

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      return [];
    }
    return (data || []) as HourmeterAmendment[];
  } catch (e) {
    return [];
  }
};

export const createHourmeterAmendment = async (
  jobId: string,
  forkliftId: string,
  originalReading: number,
  amendedReading: number,
  reason: string,
  flagReasons: HourmeterFlagReason[],
  requestedById: string,
  requestedByName: string
): Promise<HourmeterAmendment> => {
  const { data, error } = await supabase
    .from('hourmeter_amendments')
    .insert({
      job_id: jobId,
      forklift_id: forkliftId,
      original_reading: originalReading,
      amended_reading: amendedReading,
      reason,
      flag_reasons: flagReasons,
      requested_by_id: requestedById,
      requested_by_name: requestedByName,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as HourmeterAmendment;
};

export const approveHourmeterAmendment = async (
  amendmentId: string,
  reviewedById: string,
  reviewedByName: string,
  reviewNotes?: string
): Promise<HourmeterAmendment> => {
  const { data: amendment, error: fetchError } = await supabase
    .from('hourmeter_amendments')
    .select('job_id, forklift_id, amended_reading')
    .eq('amendment_id', amendmentId)
    .single();

  if (fetchError) throw new Error(fetchError.message);

  await supabase
    .from('jobs')
    .update({
      hourmeter_reading: amendment.amended_reading,
      hourmeter_flagged: false,
      hourmeter_flag_reasons: [],
      updated_at: new Date().toISOString(),
    })
    .eq('job_id', amendment.job_id);

  const { data: forklift } = await supabase
    .from('forklifts')
    .select('hourmeter')
    .eq('forklift_id', amendment.forklift_id)
    .single();

  if (forklift && amendment.amended_reading > (forklift.hourmeter || 0)) {
    await supabase
      .from('forklifts')
      .update({
        hourmeter: amendment.amended_reading,
        updated_at: new Date().toISOString(),
      })
      .eq('forklift_id', amendment.forklift_id);
  }

  const { data, error } = await supabase
    .from('hourmeter_amendments')
    .update({
      status: 'approved',
      reviewed_by_id: reviewedById,
      reviewed_by_name: reviewedByName,
      reviewed_at: new Date().toISOString(),
      review_notes: reviewNotes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('amendment_id', amendmentId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as HourmeterAmendment;
};

export const rejectHourmeterAmendment = async (
  amendmentId: string,
  reviewedById: string,
  reviewedByName: string,
  reviewNotes: string
): Promise<HourmeterAmendment> => {
  const { data, error } = await supabase
    .from('hourmeter_amendments')
    .update({
      status: 'rejected',
      reviewed_by_id: reviewedById,
      reviewed_by_name: reviewedByName,
      reviewed_at: new Date().toISOString(),
      review_notes: reviewNotes,
      updated_at: new Date().toISOString(),
    })
    .eq('amendment_id', amendmentId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as HourmeterAmendment;
};

export const getJobHourmeterAmendment = async (jobId: string): Promise<HourmeterAmendment | null> => {
  try {
    const { data, error } = await supabase
      .from('hourmeter_amendments')
      .select('*')
      .eq('job_id', jobId)
      .order('requested_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      return null;
    }
    return data as HourmeterAmendment;
  } catch (e) {
    return null;
  }
};

// =============================================
// HOURMETER FLAGGING & VALIDATION (existing)
// =============================================

export const flagJobHourmeter = async (jobId: string, flagReasons: HourmeterFlagReason[]): Promise<void> => {
  await supabase
    .from('jobs')
    .update({
      hourmeter_flagged: true,
      hourmeter_flag_reasons: flagReasons,
      updated_at: new Date().toISOString(),
    })
    .eq('job_id', jobId);
};

export const validateHourmeterReading = async (
  forkliftId: string,
  newReading: number
): Promise<{ isValid: boolean; flags: HourmeterFlagReason[] }> => {
  const flags: HourmeterFlagReason[] = [];

  const { data: forklift } = await supabase
    .from('forklifts')
    .select('hourmeter, avg_daily_usage')
    .eq('forklift_id', forkliftId)
    .single();

  if (!forklift) {
    return { isValid: true, flags: [] };
  }

  const currentHourmeter = forklift.hourmeter || 0;
  const avgDailyUsage = forklift.avg_daily_usage || 8;

  if (newReading < currentHourmeter) {
    flags.push('lower_than_previous');
  }

  const difference = newReading - currentHourmeter;
  const excessiveThreshold = avgDailyUsage * 30;
  if (difference > excessiveThreshold) {
    flags.push('excessive_jump');
  }

  return { isValid: flags.length === 0, flags };
};

// =============================================
// SERVICE PREDICTION SYSTEM (new - 2026-02-04)
// =============================================

/**
 * Record a new hourmeter reading
 */
export async function recordHourmeterReading(params: {
  forklift_id: string;
  hourmeter_value: number;
  recorded_by_id?: string;
  recorded_by_name?: string;
  job_id?: string;
  is_service_reading?: boolean;
  notes?: string;
}): Promise<{ data: HourmeterReading | null; error: Error | null }> {
  try {
    logDebug('[HourmeterService] Recording reading:', params);
    
    // Insert the reading
    const { data, error } = await supabase
      .from('hourmeter_readings')
      .insert({
        forklift_id: params.forklift_id,
        hourmeter_value: params.hourmeter_value,
        recorded_by_id: params.recorded_by_id,
        recorded_by_name: params.recorded_by_name,
        job_id: params.job_id,
        is_service_reading: params.is_service_reading || false,
        notes: params.notes,
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Also update the forklift's current hourmeter
    await supabase
      .from('forklifts')
      .update({ 
        hourmeter: params.hourmeter_value,
        updated_at: new Date().toISOString()
      })
      .eq('forklift_id', params.forklift_id);
    
    logDebug('[HourmeterService] Reading recorded:', data);
    return { data, error: null };
  } catch (err) {
    logError('[HourmeterService] Error recording reading:', err);
    return { data: null, error: err as Error };
  }
}

/**
 * Get hourmeter readings for a forklift
 */
export async function getHourmeterReadings(
  forklift_id: string,
  limit = 50
): Promise<{ data: HourmeterReading[] | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('hourmeter_readings')
      .select('*')
      .eq('forklift_id', forklift_id)
      .order('reading_date', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    logError('[HourmeterService] Error fetching readings:', err);
    return { data: null, error: err as Error };
  }
}

/**
 * Calculate service prediction for a single forklift (client-side fallback)
 * Note: Prefer using the database function for accuracy
 */
export function calculateServicePrediction(
  currentHourmeter: number,
  lastServiceHourmeter: number,
  lastServiceDate: string | undefined,
  serviceInterval: number,
  readings: HourmeterReading[] = []
): ServicePrediction | null {
  const nextServiceHourmeter = lastServiceHourmeter + serviceInterval;
  const hoursUntilService = nextServiceHourmeter - currentHourmeter;
  
  let avgDailyHours: number;
  let confidence: 'low' | 'medium' | 'high';
  
  // Calculate average from readings if available
  if (readings.length >= 2) {
    const sortedReadings = [...readings].sort(
      (a, b) => new Date(a.reading_date).getTime() - new Date(b.reading_date).getTime()
    );
    const firstReading = sortedReadings[0];
    const lastReading = sortedReadings[sortedReadings.length - 1];
    
    const hoursDiff = lastReading.hourmeter_value - firstReading.hourmeter_value;
    const daysDiff = (new Date(lastReading.reading_date).getTime() - 
                     new Date(firstReading.reading_date).getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysDiff > 0) {
      avgDailyHours = hoursDiff / daysDiff;
      confidence = readings.length >= 5 ? 'high' : 'medium';
    } else {
      avgDailyHours = 8; // Default
      confidence = 'low';
    }
  } else if (lastServiceDate) {
    // Calculate from last service
    const daysSinceService = Math.max(1, 
      (Date.now() - new Date(lastServiceDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    const hoursUsed = currentHourmeter - lastServiceHourmeter;
    avgDailyHours = hoursUsed / daysSinceService;
    confidence = 'medium';
  } else {
    // Default assumption
    avgDailyHours = 8;
    confidence = 'low';
  }
  
  // Ensure reasonable bounds
  avgDailyHours = Math.max(0.1, Math.min(24, avgDailyHours));
  
  const daysRemaining = Math.max(0, Math.ceil(hoursUntilService / avgDailyHours));
  const predictedDate = new Date();
  predictedDate.setDate(predictedDate.getDate() + daysRemaining);
  
  return {
    forklift_id: '',
    predicted_date: predictedDate.toISOString().split('T')[0],
    days_remaining: daysRemaining,
    hours_until_service: hoursUntilService,
    avg_daily_hours: Math.round(avgDailyHours * 10) / 10,
    next_service_hourmeter: nextServiceHourmeter,
    confidence,
  };
}

/**
 * Get service prediction using database function
 */
export async function getServicePrediction(
  forklift_id: string
): Promise<{ data: ServicePrediction | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .rpc('calculate_predicted_service_date', { p_forklift_id: forklift_id })
      .single();
    
    if (error) throw error;
    
    if (!data) return { data: null, error: null };
    
    const predictionData = typeof data === 'object' && data !== null ? data : {};
    return { 
      data: { 
        forklift_id,
        ...predictionData 
      } as ServicePrediction, 
      error: null 
    };
  } catch (err) {
    logError('[HourmeterService] Error getting prediction:', err);
    return { data: null, error: err as Error };
  }
}

/**
 * Get all forklifts with service predictions (for dashboard)
 */
export async function getForkliftServicePredictions(): Promise<{
  data: ForkliftWithPrediction[] | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase
      .from('v_forklift_service_predictions')
      .select('*')
      .order('days_remaining', { ascending: true, nullsFirst: false });
    
    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    logError('[HourmeterService] Error fetching predictions:', err);
    return { data: null, error: err as Error };
  }
}

/**
 * Get service prediction dashboard data
 */
export async function getServicePredictionDashboard(): Promise<{
  data: ServicePredictionDashboard | null;
  error: Error | null;
}> {
  try {
    const { data: forklifts, error } = await getForkliftServicePredictions();
    
    if (error) throw error;
    if (!forklifts) return { data: null, error: null };
    
    const dashboard: ServicePredictionDashboard = {
      overdue: forklifts.filter(f => f.service_urgency === 'overdue'),
      due_this_week: forklifts.filter(f => f.service_urgency === 'due_soon'),
      upcoming_two_weeks: forklifts.filter(f => f.service_urgency === 'upcoming'),
      total_engine_forklifts: forklifts.length,
    };
    
    return { data: dashboard, error: null };
  } catch (err) {
    logError('[HourmeterService] Error fetching dashboard:', err);
    return { data: null, error: err as Error };
  }
}

/**
 * Complete service and reset hourmeter tracking
 */
export async function completeForkliftService(params: {
  forklift_id: string;
  hourmeter_reading: number;
  user_id?: string;
  user_name?: string;
  job_id?: string;
}): Promise<{ success: boolean; error: Error | null }> {
  try {
    logDebug('[HourmeterService] Completing service:', params);
    
    const { error } = await supabase.rpc('complete_forklift_service', {
      p_forklift_id: params.forklift_id,
      p_hourmeter_reading: params.hourmeter_reading,
      p_user_id: params.user_id,
      p_user_name: params.user_name,
      p_job_id: params.job_id,
    });
    
    if (error) throw error;
    
    logDebug('[HourmeterService] Service completed successfully');
    return { success: true, error: null };
  } catch (err) {
    logError('[HourmeterService] Error completing service:', err);
    return { success: false, error: err as Error };
  }
}

/**
 * Update forklift service interval
 */
export async function updateServiceInterval(
  forklift_id: string,
  interval_hours: number
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { error } = await supabase
      .from('forklifts')
      .update({ 
        service_interval_hours: interval_hours,
        updated_at: new Date().toISOString()
      })
      .eq('forklift_id', forklift_id);
    
    if (error) throw error;
    return { success: true, error: null };
  } catch (err) {
    logError('[HourmeterService] Error updating interval:', err);
    return { success: false, error: err as Error };
  }
}

// =============================================
// HELPERS
// =============================================

/**
 * Check if forklift type requires hourmeter tracking
 */
export function requiresHourmeterTracking(type: ForkliftType | string): boolean {
  const engineTypes = ['Diesel', 'LPG', 'Petrol'];
  return engineTypes.includes(type);
}

/**
 * Format days remaining for display
 */
export function formatDaysRemaining(days: number): string {
  if (days <= 0) return 'Overdue';
  if (days === 1) return '1 day';
  if (days < 7) return `${days} days`;
  if (days < 14) return `${Math.floor(days / 7)} week`;
  return `${Math.floor(days / 7)} weeks`;
}

/**
 * Get urgency color class for UI
 */
export function getUrgencyColor(urgency: string): string {
  switch (urgency) {
    case 'overdue':
      return 'text-red-600 bg-red-100';
    case 'due_soon':
      return 'text-orange-600 bg-orange-100';
    case 'upcoming':
      return 'text-yellow-600 bg-yellow-100';
    default:
      return 'text-green-600 bg-green-100';
  }
}

// =============================================
// SERVICE AUTOMATION FUNCTIONS
// =============================================

/**
 * Get forklifts due for service within specified days
 */
export async function getForkliftsDueForService(withinDays: number = 7): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('v_forklift_service_predictions')
      .select('*')
      .or(`service_urgency.eq.overdue,service_urgency.eq.due_soon,days_remaining.lte.${withinDays}`)
      .order('days_remaining', { ascending: true });
    
    if (error) throw error;
    
    // Add computed fields for widget compatibility
    return (data || []).map(f => ({
      ...f,
      is_overdue: f.service_urgency === 'overdue' || (f.days_remaining !== null && f.days_remaining <= 0),
      has_open_job: false, // TODO: Check if forklift has open service job
    }));
  } catch (err) {
    logError('[HourmeterService] Error getting forklifts due for service:', err);
    return [];
  }
}

/**
 * Run daily service check - creates jobs and notifications for due forklifts
 */
export async function runDailyServiceCheck(): Promise<{ jobs_created: number; notifications_created: number }> {
  try {
    logDebug('[HourmeterService] Running daily service check...');
    
    // Get forklifts that are overdue or due within 7 days
    const dueForklifts = await getForkliftsDueForService(7);
    
    let jobsCreated = 0;
    let notificationsCreated = 0;
    
    for (const forklift of dueForklifts) {
      // Skip if already has an open service job
      const { data: existingJobs } = await supabase
        .from('jobs')
        .select('job_id')
        .eq('forklift_id', forklift.forklift_id)
        .in('job_type', ['Service', 'Full Service'])
        .not('status', 'in', '("Completed","Cancelled")')
        .limit(1);
      
      if (existingJobs && existingJobs.length > 0) {
        continue; // Skip - already has open service job
      }
      
      // Create service job for overdue forklifts
      if (forklift.is_overdue) {
        const { error: jobError } = await supabase
          .from('jobs')
          .insert({
            title: `PM Service - ${forklift.serial_number}`,
            description: `Scheduled preventive maintenance. Current hourmeter: ${forklift.current_hourmeter} hrs. Service was due at ${forklift.next_service_hourmeter} hrs.`,
            job_type: 'Full Service',
            priority: 'High',
            status: 'Pending',
            forklift_id: forklift.forklift_id,
            customer_id: forklift.current_customer_id || forklift.customer_id,
          });
        
        if (!jobError) {
          jobsCreated++;
        }
      }
      
      // Create notification for admins
      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          type: 'service_due',
          title: forklift.is_overdue 
            ? `Service OVERDUE: ${forklift.serial_number}` 
            : `Service Due Soon: ${forklift.serial_number}`,
          message: forklift.is_overdue
            ? `Forklift ${forklift.serial_number} is overdue for service. Current: ${forklift.current_hourmeter} hrs, Target: ${forklift.next_service_hourmeter} hrs.`
            : `Forklift ${forklift.serial_number} service due in ${forklift.days_remaining} days. Predicted date: ${forklift.predicted_date}.`,
          priority: forklift.is_overdue ? 'high' : 'medium',
          target_roles: ['admin', 'supervisor'],
          metadata: {
            forklift_id: forklift.forklift_id,
            serial_number: forklift.serial_number,
            days_remaining: forklift.days_remaining,
            current_hourmeter: forklift.current_hourmeter,
            next_service_hourmeter: forklift.next_service_hourmeter,
          },
        });
      
      if (!notifError) {
        notificationsCreated++;
      }
    }
    
    logDebug(`[HourmeterService] Daily check complete: ${jobsCreated} jobs, ${notificationsCreated} notifications`);
    return { jobs_created: jobsCreated, notifications_created: notificationsCreated };
  } catch (err) {
    logError('[HourmeterService] Error running daily service check:', err);
    throw err;
  }
}
