/**
 * Job Service
 *
 * Job write paths (createJob, updateJob, addNote, confirmParts, etc.) plus
 * backward-compatible re-exports from every split service. Read paths live in
 * `jobReadService.ts`; assignment / request / media / checklist / invoice /
 * locking / status / crud / autocount / star paths live in their own files.
 */

import type { Job } from '../types';
import { JobPriority as JobPriorityEnum, JobStatus as JobStatusEnum, JobType as JobTypeEnum } from '../types';
import { notifyJobAssignment } from './notificationService';
import { logDebug, logError, supabase } from './supabaseClient';

/** Row type for forklift hourmeter query */
interface ForkliftHourmeterRow {
  hourmeter: number | null;
}

// =====================
// RE-EXPORTS FOR BACKWARD COMPATIBILITY
// =====================

// Assignment Service
export {
acceptJobAssignment,assignHelper,assignJob,checkExpiredJobResponses,endHelperWork,getActiveHelper,getHelperJobs,getJobAssignments,getJobsPendingResponse,getUserAssignmentType,isUserHelperOnJob,reassignJob,rejectJobAssignment,removeHelper,
startHelperWork
} from './jobAssignmentService';

// Request Service
export {
acknowledgeSkillfulTechRequest,
approveAssistanceRequest,approveSparePartRequest,createJobRequest,getJobRequests,
getPendingRequests,getRequestCounts,rejectRequest,updateJobRequest
} from './jobRequestService';

// Media Service
export {
addMedia,
bulkSignJobs,
bulkSwipeSignJobs,
deleteMedia,
signJob,
swipeSignJob
} from './jobMediaService';

// Checklist Service
export {
getJobServiceRecord,setNoPartsUsed,startJobWithCondition,updateConditionChecklist,updateJobCarriedOut,updateJobConditionChecklist,updateJobRepairTimes
} from './jobChecklistService';

// Invoice Service
export {
addExtraCharge,addPartToJob,finalizeInvoice,generateInvoiceText,removeExtraCharge,removePartFromJob,sendInvoice,updateLaborCost,updatePartPrice
} from './jobInvoiceService';

// Locking Service
export {
acquireJobLock,checkJobLock,
cleanupExpiredLocks,releaseJobLock
} from './jobLockingService';

// Status Service
export {
  markJobContinueTomorrow,
  resumeMultiDayJob,
  updateJobStatus
} from './jobStatusService';

// CRUD Service (delete/restore)
export {
  deleteJob,
  getRecentlyDeletedJobs,
  hardDeleteJob
} from './jobCrudService';

// AutoCount Service
export {
  cancelAutoCountExport,
  createAutoCountExport,
  getAutoCountExports,
  getJobsPendingExport,
  retryAutoCountExport
} from './jobAutoCountService';

// Star Service
export { starJob, unstarJob } from './jobStarService';

// Read Service (paginated lookups, KPI, detail fetches)
export {
  getJobById,
  getJobByIdFast,
  getJobs,
  getJobsForKPI,
  getJobsLightweight,
  getJobsPage,
  type JobsPageResult,
} from './jobReadService';

// =====================
// JOB WRITES
// =====================


export const createJob = async (jobData: Partial<Job>, createdById?: string, createdByName?: string): Promise<Job> => {
  const { data, error } = await supabase
    .from('jobs')
    .insert({
      customer_id: jobData.customer_id,
      title: jobData.title,
      description: jobData.description,
      priority: jobData.priority || JobPriorityEnum.MEDIUM,
      job_type: jobData.job_type || JobTypeEnum.SERVICE,
      status: jobData.status || JobStatusEnum.NEW,
      assigned_technician_id: jobData.assigned_technician_id || null,
      assigned_technician_name: jobData.assigned_technician_name || null,
      forklift_id: jobData.forklift_id || null,
      hourmeter_reading: jobData.hourmeter_reading || null,
      contact_id: jobData.contact_id || null,
      site_id: jobData.site_id || null,
      notes: jobData.notes || [],
      labor_cost: jobData.labor_cost || 150,
      scheduled_date: jobData.scheduled_date || null,
      created_by_id: createdById || null,
      created_by_name: createdByName || null,
      assigned_at: jobData.assigned_technician_id ? new Date().toISOString() : null,
      assigned_by_id: jobData.assigned_technician_id ? createdById : null,
      assigned_by_name: jobData.assigned_technician_id ? createdByName : null,
    })
    .select(`*, customer:customers(*), forklift:forklifts!forklift_id(*)`)
    .single();

  if (error) throw new Error(error.message);
  
  const job = data as Job;
  job.parts_used = job.parts_used ?? [];
  job.media = job.media ?? [];
  job.extra_charges = job.extra_charges ?? [];
  
  if (jobData.assigned_technician_id) {
    await notifyJobAssignment(jobData.assigned_technician_id, job);
  }
  
  return job;
};

export const updateJob = async (jobId: string, updates: Partial<Job>): Promise<Job> => {
  // Destructure to remove relations that shouldn't be sent to database
  const { customer: _customer, forklift: _forklift, parts_used: _parts_used, media: _media, extra_charges: _extra_charges, ...safeUpdates } = updates;

  const { data, error } = await supabase
    .from('jobs')
    .update(safeUpdates)
    .eq('job_id', jobId)
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

// =====================
// JOB OPERATIONS
// =====================

export const updateJobHourmeter = async (jobId: string, hourmeterReading: number): Promise<Job> => {
  const { data: jobData, error: jobError } = await supabase
    .from('jobs')
    .select('forklift_id, forklift:forklifts!forklift_id(hourmeter)')
    .eq('job_id', jobId)
    .single();
  
  if (jobError) throw new Error(jobError.message);
  
  const forkliftData = Array.isArray(jobData?.forklift) ? jobData.forklift[0] : jobData?.forklift;
  const currentHourmeter = (forkliftData as ForkliftHourmeterRow | null)?.hourmeter || 0;
  if (hourmeterReading < currentHourmeter) {
    throw new Error(`Hourmeter reading (${hourmeterReading}) cannot be less than forklift's current reading (${currentHourmeter})`);
  }
  
  const { data, error } = await supabase
    .from('jobs')
    .update({ hourmeter_reading: hourmeterReading })
    .eq('job_id', jobId)
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

export const addNote = async (jobId: string, note: string): Promise<Job> => {
  const { data: currentJob } = await supabase
    .from('jobs')
    .select('notes')
    .eq('job_id', jobId)
    .single();

  const currentNotes = currentJob?.notes || [];
  const timestamp = new Date().toLocaleTimeString();
  const updatedNotes = [...currentNotes, `${timestamp}: ${note}`];

  const { data, error } = await supabase
    .from('jobs')
    .update({ notes: updatedNotes })
    .eq('job_id', jobId)
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

// =====================
// JOB DELETE
// =====================
// STUB IMPLEMENTATIONS
// =====================

/**
 * Confirm parts used on a job (Admin 2 / Store verification)
 */
export const confirmParts = async (
  jobId: string,
  userId: string,
  userName: string,
  userRole?: string
): Promise<Job> => {
  logDebug('[JobService] confirmParts called for job:', jobId, 'role:', userRole);
  
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    parts_confirmed_at: now,
    parts_confirmed_by_id: userId,
    parts_confirmed_by_name: userName
  };

  // Unified admin: auto-confirm job as well (skip the two-step process)
  if (userRole === 'admin') {
    updates.job_confirmed_at = now;
    updates.job_confirmed_by_id = userId;
    updates.job_confirmed_by_name = userName;
  }

  const { data, error } = await supabase
    .from('jobs')
    .update(updates)
    .eq('job_id', jobId)
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

/**
 * Reconcile parts used on a job (Admin 2 / Store verification)
 * Updates each part's quantity_used/quantity_returned, restocks returned parts,
 * and marks parts as confirmed on the job.
 */
export interface PartReconciliation {
  job_part_id: string;
  part_id: string;
  quantity_used: number;
  quantity_returned: number;
}

export const reconcileParts = async (
  jobId: string,
  reconciliation: PartReconciliation[],
  userId: string,
  userName: string,
  userRole?: string,
  notes?: string
): Promise<Job> => {
  logDebug('[JobService] reconcileParts called for job:', jobId, 'parts:', reconciliation.length);

  // Step 1: Update each job_part with quantity_used and quantity_returned
  for (const item of reconciliation) {
    const { error: partError } = await supabase
      .from('job_parts')
      .update({
        quantity_used: item.quantity_used,
        quantity_returned: item.quantity_returned,
      })
      .eq('job_part_id', item.job_part_id);

    if (partError) throw new Error(`Failed to update part ${item.job_part_id}: ${partError.message}`);
  }

  // Step 2: Restock returned parts (increment stock_quantity on the parts table)
  const returnedParts = reconciliation.filter(r => r.quantity_returned > 0);
  for (const item of returnedParts) {
    // Fetch current stock, then increment (Supabase doesn't support atomic increment without RPC)
    const { data: partData, error: fetchErr } = await supabase
      .from('parts')
      .select('stock_quantity')
      .eq('part_id', item.part_id)
      .single();

    if (fetchErr) throw new Error(`Failed to fetch part ${item.part_id}: ${fetchErr.message}`);

    const newStock = (partData?.stock_quantity ?? 0) + item.quantity_returned;
    const { error: stockErr } = await supabase
      .from('parts')
      .update({ stock_quantity: newStock })
      .eq('part_id', item.part_id);

    if (stockErr) throw new Error(`Failed to restock part ${item.part_id}: ${stockErr.message}`);
  }

  // Step 3: Mark parts as confirmed on the job
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    parts_confirmed_at: now,
    parts_confirmed_by_id: userId,
    parts_confirmed_by_name: userName,
  };

  if (notes) {
    updates.parts_confirmation_notes = notes;
  }

  // Unified admin: auto-confirm job as well
  if (userRole === 'admin') {
    updates.job_confirmed_at = now;
    updates.job_confirmed_by_id = userId;
    updates.job_confirmed_by_name = userName;
  }

  const { data, error } = await supabase
    .from('jobs')
    .update(updates)
    .eq('job_id', jobId)
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

/**
 * Complete deferred acknowledgement for a job
 * @stub Basic implementation
 */
export const completeDeferredAcknowledgement = async (
  jobId: string,
  reason: string,
  _evidenceIds: string[],
  _hourmeter?: number,
  _userId?: string,
  _userName?: string
): Promise<{ success: boolean; job?: Job }> => {
  logDebug('[JobService] completeDeferredAcknowledgement called for job:', jobId, 'reason:', reason);
  
  try {
    // Update job status to reflect deferred acknowledgement
    const { data, error } = await supabase
      .from('jobs')
      .update({ 
        notes: `Deferred acknowledgement: ${reason}`,
        updated_at: new Date().toISOString()
      })
      .eq('job_id', jobId)
      .select()
      .single();
    
    if (error) throw error;
    return { success: true, job: data as Job };
  } catch (err) {
    logError('[JobService] Error in completeDeferredAcknowledgement:', err);
    return { success: false };
  }
};
