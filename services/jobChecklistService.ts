/**
 * Job Checklist Service
 * 
 * Handles condition checklists, service records, and repair times.
 */

import type { ForkliftConditionChecklist,Job } from '../types';
import { JobStatus as JobStatusEnum } from '../types';
import { supabase } from './supabaseClient';

// Type for forklift hourmeter query result
interface ForkliftHourmeterRow {
  hourmeter?: number;
}

// =====================
// JOB CONDITION & CHECKLIST
// =====================

export const updateJobConditionChecklist = async (jobId: string, checklist: ForkliftConditionChecklist): Promise<Job> => {
  const { data, error } = await supabase
    .from('jobs')
    .update({ condition_checklist: checklist })
    .eq('job_id', jobId)
    .select(`
      *,
      customer:customers(*),
      forklift:forklifts!forklift_id(*),
      parts_used:job_parts(*),
      media:job_media(*),
      extra_charges:extra_charges(*)
    `)
    .single();

  if (error) throw new Error(error.message);
  return data as Job;
};

export const updateJobCarriedOut = async (jobId: string, jobCarriedOut: string, recommendation?: string): Promise<Job> => {
  const { data, error } = await supabase
    .from('jobs')
    .update({ job_carried_out: jobCarriedOut, recommendation: recommendation })
    .eq('job_id', jobId)
    .select(`
      *,
      customer:customers(*),
      forklift:forklifts!forklift_id(*),
      parts_used:job_parts(*),
      media:job_media(*),
      extra_charges:extra_charges(*)
    `)
    .single();

  if (error) throw new Error(error.message);
  
  await supabase
    .from('job_service_records')
    .update({
      job_carried_out: jobCarriedOut,
      recommendation: recommendation,
      updated_at: new Date().toISOString(),
    })
    .eq('job_id', jobId);
  
  return data as Job;
};

export const updateConditionChecklist = async (jobId: string, checklist: ForkliftConditionChecklist, userId?: string): Promise<Job> => {
  const { data, error } = await supabase
    .from('jobs')
    .update({ condition_checklist: checklist })
    .eq('job_id', jobId)
    .select(`
      *,
      customer:customers(*),
      forklift:forklifts!forklift_id(*),
      parts_used:job_parts(*),
      media:job_media(*),
      extra_charges:extra_charges(*)
    `)
    .single();

  if (error) throw new Error(error.message);
  
  await supabase
    .from('job_service_records')
    .update({
      checklist_data: checklist,
      updated_at: new Date().toISOString(),
      updated_by: userId || null,
    })
    .eq('job_id', jobId);
  
  return data as Job;
};

export const setNoPartsUsed = async (jobId: string, noPartsUsed: boolean): Promise<void> => {
  const { error } = await supabase
    .from('job_service_records')
    .update({ no_parts_used: noPartsUsed, updated_at: new Date().toISOString() })
    .eq('job_id', jobId);

  if (error) throw new Error(error.message);
};

export const getJobServiceRecord = async (jobId: string): Promise<any> => {
  const { data, error } = await supabase
    .from('job_service_records')
    .select('*')
    .eq('job_id', jobId)
    .limit(1);

  if (error) {
    return null;
  }
  return data?.[0] ?? null;
};

export const updateJobRepairTimes = async (jobId: string, startTime?: string, endTime?: string): Promise<Job> => {
  const updates: Partial<Job> = {};
  if (startTime) updates.repair_start_time = startTime;
  if (endTime) updates.repair_end_time = endTime;

  const { data, error } = await supabase
    .from('jobs')
    .update(updates)
    .eq('job_id', jobId)
    .select(`
      *,
      customer:customers(*),
      forklift:forklifts!forklift_id(*),
      parts_used:job_parts(*),
      media:job_media(*),
      extra_charges:extra_charges(*)
    `)
    .single();

  if (error) throw new Error(error.message);
  return data as Job;
};

export const startJobWithCondition = async (
  jobId: string, 
  hourmeterReading: number, 
  checklist: ForkliftConditionChecklist,
  startedById?: string,
  startedByName?: string
): Promise<Job> => {
  const now = new Date().toISOString();
  
  const { data: jobData, error: fetchError } = await supabase
    .from('jobs')
    .select('forklift_id, forklift:forklifts!forklift_id(hourmeter)')
    .eq('job_id', jobId)
    .single();
  
  if (fetchError) throw new Error(fetchError.message);
  
  const currentHourmeter = (jobData?.forklift as ForkliftHourmeterRow | null)?.hourmeter || 0;
  if (hourmeterReading < currentHourmeter) {
    throw new Error(`Hourmeter reading (${hourmeterReading}) cannot be less than forklift's current reading (${currentHourmeter})`);
  }
  
  const { data, error } = await supabase
    .from('jobs')
    .update({
      status: JobStatusEnum.IN_PROGRESS,
      arrival_time: now,
      repair_start_time: now,
      hourmeter_reading: hourmeterReading,
      condition_checklist: checklist,
      started_at: now,
      started_by_id: startedById || null,
      started_by_name: startedByName || null,
    })
    .eq('job_id', jobId)
    .select(`
      *,
      customer:customers(*),
      forklift:forklifts!forklift_id(*),
      parts_used:job_parts(*),
      media:job_media(*),
      extra_charges:extra_charges(*)
    `)
    .single();

  if (error) throw new Error(error.message);
  
  await supabase
    .from('job_service_records')
    .update({
      started_at: now,
      repair_start_time: now,
      hourmeter_reading: hourmeterReading,
      checklist_data: checklist,
      technician_id: startedById || null,
      updated_at: now,
      updated_by: startedById || null,
    })
    .eq('job_id', jobId);
  
  return data as Job;
};
