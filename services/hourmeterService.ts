/**
 * Hourmeter Service
 * 
 * Handles:
 * - Hourmeter readings, history, amendments, and validation (existing)
 * - Service prediction system (new - 2026-02-04)
 */

import type {
  HourmeterAmendment,
  HourmeterAmendmentStatus,
  HourmeterFlagReason,
} from '../types';
import { supabase } from './supabaseClient';

// =============================================
// HOURMETER HISTORY (existing)
// =============================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  } catch (_e) {
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
  } catch (_e) {
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
  } catch (_e) {
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


// Re-export from servicePredictionService
export {
  recordHourmeterReading,
  getHourmeterReadings,
  calculateServicePrediction,
  getServicePrediction,
  getForkliftServicePredictions,
  getServicePredictionDashboard,
  completeForkliftService,
  updateServiceInterval,
  requiresHourmeterTracking,
  formatDaysRemaining,
  getUrgencyColor,
  getForkliftsDueForService,
  runDailyServiceCheck,
} from './servicePredictionService';
