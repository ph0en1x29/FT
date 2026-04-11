/* eslint-disable max-lines */
/**
 * Job Service
 * 
 * Core job CRUD operations and re-exports from specialized services.
 * 
 * This file maintains backward compatibility by re-exporting all functions
 * from the split service files.
 */

import type {
ExtraCharge,
Job,
JobAssignment,
JobMedia,
JobPartUsed,
JobStatus,
User,
} from '../types';
import { JobPriority as JobPriorityEnum,JobStatus as JobStatusEnum,JobType as JobTypeEnum,UserRole } from '../types';
import { notifyJobAssignment } from './notificationService';
import { isNetworkError,JOB_SELECT,logDebug,logError,supabase,wait } from './supabaseClient';
import { CircuitBreakerTrippedError,createCircuitBreaker } from '../utils/circuit-breaker';

// Shared circuit breakers — one per hot query path.
// Trips after 3 consecutive network failures; auto-resets after 60 s.
const getJobsCB = createCircuitBreaker({ maxFailures: 3, resetAfterMs: 60_000, label: 'getJobs' });
const getJobsForKPICB = createCircuitBreaker({ maxFailures: 3, resetAfterMs: 60_000, label: 'getJobsForKPI' });

// =====================
// LOCAL TYPE DEFINITIONS
// =====================

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

// =====================
// JOB CRUD
// =====================

export const getJobsLightweight = async (user: User, options?: { 
  status?: JobStatus;
  limit?: number;
  page?: number;
}): Promise<{ jobs: Partial<Job>[]; total: number }> => {
  const limit = options?.limit || 50;
  const page = options?.page || 1;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('jobs')
    .select(JOB_SELECT.LIST, { count: 'exact' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (options?.status) {
    query = query.eq('status', options.status);
  }

  if (user.role === UserRole.TECHNICIAN) {
    query = query.eq('assigned_technician_id', user.user_id);
  }

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  return { 
    jobs: (data || []) as Partial<Job>[], 
    total: count || 0 
  };
};

export const getJobs = async (user: User, options?: { status?: JobStatus }): Promise<Job[]> => {
  logDebug('[getJobs] Fetching jobs for user:', user.user_id, user.role, user.name, options?.status ? `status=${options.status}` : '');

  const buildQuery = () => {
    let query = supabase
      .from('jobs')
      .select(JOB_SELECT.BOARD)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (user.role === UserRole.TECHNICIAN) {
      logDebug('[getJobs] Filtering for technician:', user.user_id);
      query = query.eq('assigned_technician_id', user.user_id);
    }

    return query;
  };

  const executeQuery = async () => {
    const { data, error } = await buildQuery();
    if (error) throw error;
    return data as unknown as Job[];
  };

  let data: Job[];
  try {
    data = await getJobsCB.execute(async () => {
      try {
        return await executeQuery();
      } catch (error) {
        if (isNetworkError(error)) {
          await wait(600);
          return await executeQuery();
        }
        throw error;
      }
    });
  } catch (error) {
    if (error instanceof CircuitBreakerTrippedError) {
      logError('[getJobs] Circuit breaker tripped — too many consecutive failures:', error.message);
      throw error;
    }
    logError('[getJobs] Error fetching jobs:', error);
    throw new Error((error as Error)?.message || 'Failed to fetch jobs');
  }

  let allJobs = data as Job[];

  // Include helper assignments for technicians — single query with inner join
  if (user.role === UserRole.TECHNICIAN) {
    const existingJobIds = new Set(allJobs.map(j => j.job_id));

    const helperSelect = `${JOB_SELECT.BOARD}, job_assignments!inner(technician_id, assignment_type, is_active)`;
    const { data: helperJobs, error: helperError } = await supabase
      .from('jobs')
      .select(helperSelect)
      .eq('job_assignments.technician_id', user.user_id)
      .eq('job_assignments.assignment_type', 'assistant')
      .eq('job_assignments.is_active', true)
      .is('deleted_at', null);

    if (!helperError && helperJobs) {
      const rawJobs = helperJobs as unknown as Array<Record<string, unknown>>;
      const newHelperJobs = rawJobs
        .filter(j => !existingJobIds.has(j.job_id as string))
        .map(j => {
          const { job_assignments: _assignments, ...jobData } = j;
          return { ...jobData, _isHelperAssignment: true };
        }) as unknown as Job[];
      allJobs = [...allJobs, ...newHelperJobs];
    }

    allJobs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  // Add defensive defaults for fields that may be missing
  allJobs.forEach(job => {
    job.parts_used = job.parts_used || [];
    job.extra_charges = job.extra_charges || [];
    job.labor_cost = job.labor_cost || 0;
  });

  logDebug('[getJobs] Found jobs:', allJobs.length || 0);
  return allJobs;
};

/**
 * Get jobs for KPI calculations - includes revenue fields (labor_cost, parts_used, extra_charges)
 * Lighter than DETAIL but includes what KPI needs
 */
export const getJobsForKPI = async (user: User): Promise<Job[]> => {
  logDebug('[getJobsForKPI] Fetching jobs for KPI calculations, user:', user.user_id, user.role);

  const buildQuery = () => {
    let query = supabase
      .from('jobs')
      .select(JOB_SELECT.KPI)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (user.role === UserRole.TECHNICIAN) {
      query = query.eq('assigned_technician_id', user.user_id);
    }

    return query;
  };

  const executeQuery = async () => {
    const { data, error } = await buildQuery();
    if (error) throw error;
    return data as unknown as Job[];
  };

  let data: Job[];
  try {
    data = await getJobsForKPICB.execute(async () => {
      try {
        return await executeQuery();
      } catch (error) {
        if (isNetworkError(error)) {
          await wait(600);
          return await executeQuery();
        }
        throw error;
      }
    });
  } catch (error) {
    if (error instanceof CircuitBreakerTrippedError) {
      logError('[getJobsForKPI] Circuit breaker tripped — too many consecutive failures:', error.message);
      throw error;
    }
    logError('[getJobsForKPI] Error fetching jobs:', error);
    throw new Error((error as Error)?.message || 'Failed to fetch jobs');
  }

  const allJobs = data as Job[];
  
  // Add defensive defaults for fields that may be missing
  allJobs.forEach(job => {
    job.parts_used = job.parts_used || [];
    job.extra_charges = job.extra_charges || [];
    job.labor_cost = job.labor_cost || 0;
  });

  logDebug('[getJobsForKPI] Found jobs:', allJobs.length || 0);
  return allJobs;
};

/**
 * Optimized job fetch - uses parallel queries instead of one massive JOIN
 * This reduces query time from ~2s to ~200-400ms
 */
export const getJobByIdFast = async (jobId: string): Promise<Job | null> => {
  // Step 1: Fetch job with core relations (customer + forklift) - fast single query
  const jobPromise = supabase
    .from('jobs')
    .select(`
      *,
      customer:customers(customer_id, name, address, phone, email, contact_person),
      forklift:forklifts!forklift_id(forklift_id, serial_number, forklift_no, customer_forklift_no, make, model, type, status, hourmeter, location)
    `)
    .eq('job_id', jobId)
    .is('deleted_at', null)
    .single();

  // Step 2: Fetch related data in parallel (these are simple indexed queries)
  const partsPromise = supabase
    .from('job_parts')
    .select('job_part_id, part_id, part_name, quantity, sell_price_at_time, quantity_used, quantity_returned')
    .eq('job_id', jobId);

  const mediaPromise = supabase
    .from('job_media')
    .select('media_id, type, category, url, description, created_at')
    .eq('job_id', jobId);

  const chargesPromise = supabase
    .from('extra_charges')
    .select('charge_id, description, amount, created_at')
    .eq('job_id', jobId);

  const helperPromise = supabase
    .from('job_assignments')
    .select(`*, technician:users!job_assignments_technician_id_fkey(user_id, name, email, phone, role)`)
    .eq('job_id', jobId)
    .eq('assignment_type', 'assistant')
    .eq('is_active', true)
    .maybeSingle();

  // Execute all queries in parallel
  const [jobResult, partsResult, mediaResult, chargesResult, helperResult] = await Promise.all([
    jobPromise,
    partsPromise,
    mediaPromise,
    chargesPromise,
    helperPromise
  ]);

  if (jobResult.error) {
    console.error('Error fetching job:', jobResult.error);
    return null;
  }

  // Combine results
  const job = jobResult.data as Job;
  job.parts_used = (partsResult.data || []) as unknown as JobPartUsed[];
  job.media = (mediaResult.data || []) as unknown as JobMedia[];
  job.extra_charges = (chargesResult.data || []) as unknown as ExtraCharge[];

  if (helperResult.data) {
    job.helper_assignment = helperResult.data as JobAssignment;
  }

  return job;
};

/**
 * Full job fetch with all relations - optimized with parallel queries
 * Reduces query time from ~2.4s to ~300-500ms by avoiding massive JOINs
 */
export const getJobById = async (jobId: string): Promise<Job | null> => {
  // Step 1: Fetch job with core relations (customer + forklift)
  const jobPromise = supabase
    .from('jobs')
    .select(`
      *,
      customer:customers(*),
      forklift:forklifts!forklift_id(*)
    `)
    .eq('job_id', jobId)
    .is('deleted_at', null)
    .single();

  // Step 2: Fetch related data in parallel
  const partsPromise = supabase
    .from('job_parts')
    .select('job_part_id, job_id, part_id, part_name, quantity, sell_price_at_time, from_van_stock, van_stock_item_id, quantity_used, quantity_returned')
    .eq('job_id', jobId);

  const mediaPromise = supabase
    .from('job_media')
    .select('media_id, job_id, type, url, description, created_at, uploaded_by_id, uploaded_by_name, category, is_helper_photo, gps_latitude, gps_longitude, gps_accuracy, gps_captured_at, device_timestamp, server_timestamp, timestamp_mismatch, timestamp_mismatch_minutes, source, is_camera_fallback, fallback_description, fallback_approved, fallback_approved_by_id, fallback_approved_by_name, fallback_approved_at, is_start_photo, is_end_photo, timer_triggered_at, job_day_number, flagged_for_review, flagged_reason, reviewed_by_id, reviewed_by_name, reviewed_at, review_notes')
    .eq('job_id', jobId);

  const chargesPromise = supabase
    .from('extra_charges')
    .select('charge_id, job_id, name, description, amount, created_at')
    .eq('job_id', jobId);

  const helperPromise = supabase
    .from('job_assignments')
    .select(`*, technician:users!job_assignments_technician_id_fkey(user_id, name, email, phone, role)`)
    .eq('job_id', jobId)
    .eq('assignment_type', 'assistant')
    .eq('is_active', true)
    .maybeSingle();

  // Execute all queries in parallel
  const [jobResult, partsResult, mediaResult, chargesResult, helperResult] = await Promise.all([
    jobPromise,
    partsPromise,
    mediaPromise,
    chargesPromise,
    helperPromise
  ]);

  if (jobResult.error) {
    console.error('Error fetching job:', jobResult.error);
    return null;
  }

  // Combine results
  const job = jobResult.data as Job;
  job.parts_used = partsResult.data || [];
  job.media = mediaResult.data || [];
  job.extra_charges = chargesResult.data || [];
  
  if (helperResult.data) {
    job.helper_assignment = helperResult.data as JobAssignment;
  }

  return job;
};

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
