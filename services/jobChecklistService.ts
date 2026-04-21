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
    .is('deleted_at', null)
    .select(`
      *,
      customer:customers(*),
      forklift:forklifts!forklift_id(*),
      parts_used:job_parts(*),
      media:job_media!job_media_job_id_fkey(*),
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
    .is('deleted_at', null)
    .select(`
      *,
      customer:customers(*),
      forklift:forklifts!forklift_id(*),
      parts_used:job_parts(*),
      media:job_media!job_media_job_id_fkey(*),
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
    .is('deleted_at', null)
    .select(`
      *,
      customer:customers(*),
      forklift:forklifts!forklift_id(*),
      parts_used:job_parts(*),
      media:job_media!job_media_job_id_fkey(*),
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getJobServiceRecord = async (jobId: string): Promise<any> => {
  const { data, error } = await supabase
    .from('job_service_records')
    .select('service_record_id, job_id, started_at, completed_at, repair_start_time, repair_end_time, checklist_data, service_notes, job_carried_out, recommendation, hourmeter_reading, no_parts_used, parts_summary, photos, technician_signature, technician_signature_at, customer_signature, customer_signature_at, technician_id, created_at, updated_at, updated_by, locked_at, locked_by, lock_reason')
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
    .is('deleted_at', null)
    .select(`
      *,
      customer:customers(*),
      forklift:forklifts!forklift_id(*),
      parts_used:job_parts(*),
      media:job_media!job_media_job_id_fkey(*),
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
  startedByName?: string,
  // Broken-meter remark. Set only when hourmeterReading === 1 (the sentinel used
  // when the meter is broken / unreadable). Appended to jobs.notes as a structured
  // entry `[Broken Hourmeter — DATE — TECH]: <reason>`, same format as Continue Tomorrow.
  brokenMeterNote?: string
): Promise<Job> => {
  const now = new Date().toISOString();

  const { data: jobData, error: fetchError } = await supabase
    .from('jobs')
    .select('forklift_id, notes, forklift:forklifts!forklift_id(hourmeter)')
    .is('deleted_at', null)
    .eq('job_id', jobId)
    .single();

  if (fetchError) throw new Error(fetchError.message);

  const currentHourmeter = (jobData?.forklift as ForkliftHourmeterRow | null)?.hourmeter || 0;
  // Broken-meter sentinel (1) is allowed even below the forklift's last reading.
  if (hourmeterReading !== 1 && hourmeterReading < currentHourmeter) {
    throw new Error(`Hourmeter reading (${hourmeterReading}) cannot be less than forklift's current reading (${currentHourmeter}). Enter 1 if the meter is broken.`);
  }

  // Append broken-meter remark to jobs.notes when tech flagged reading as 1.
  const existingNotes: string[] = Array.isArray(jobData?.notes) ? jobData.notes : [];
  let updatedNotes = existingNotes;
  if (hourmeterReading === 1 && brokenMeterNote && brokenMeterNote.trim().length > 0) {
    const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const noteEntry = `[Broken Hourmeter — ${dateStr} — ${startedByName || 'Technician'}]: ${brokenMeterNote.trim()}`;
    updatedNotes = [...existingNotes, noteEntry];
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
      notes: updatedNotes,
    })
    .eq('job_id', jobId)
    .is('deleted_at', null)
    .select(`
      *,
      customer:customers(*),
      forklift:forklifts!forklift_id(*),
      parts_used:job_parts(*),
      media:job_media!job_media_job_id_fkey(*),
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
