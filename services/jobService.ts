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
deleteMedia,
signJob
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
      .select(`
        ${JOB_SELECT.BOARD},
        parts_used:job_parts(job_part_id, part_name, quantity),
        media:job_media(media_id, category, created_at)
      `)
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
    data = await executeQuery();
  } catch (error) {
    if (isNetworkError(error)) {
      try {
        await wait(600);
        data = await executeQuery();
      } catch (retryError) {
        logError('[getJobs] Error fetching jobs after retry:', retryError);
        throw new Error((retryError as Error)?.message || 'Failed to fetch jobs');
      }
    } else {
      logError('[getJobs] Error fetching jobs:', error);
      throw new Error((error as Error)?.message || 'Failed to fetch jobs');
    }
  }
  
  let allJobs = data as Job[];
  
  // Include helper assignments for technicians
  if (user.role === UserRole.TECHNICIAN) {
    const { data: helperAssignments, error: helperError } = await supabase
      .from('job_assignments')
      .select('job_id')
      .eq('technician_id', user.user_id)
      .eq('assignment_type', 'assistant')
      .eq('is_active', true);
    
    if (!helperError && helperAssignments && helperAssignments.length > 0) {
      const helperJobIds = helperAssignments.map(a => a.job_id);
      const existingJobIds = new Set(allJobs.map(j => j.job_id));
      const newHelperJobIds = helperJobIds.filter(id => !existingJobIds.has(id));
      
      if (newHelperJobIds.length > 0) {
        let helperQuery = supabase
          .from('jobs')
          .select(`
            job_id, title, status, priority, job_type,
            customer_id, customer:customers(customer_id, name, address, phone),
            forklift_id, forklift:forklifts!forklift_id(serial_number, make, model, type),
            assigned_technician_id, assigned_technician_name, helper_technician_id,
            arrival_time, started_at, repair_start_time, repair_end_time, completed_at,
            technician_accepted_at, technician_rejected_at, created_at, scheduled_date,
            parts_used:job_parts(job_part_id, part_name, quantity),
            media:job_media(media_id, category, created_at)
          `)
          .in('job_id', newHelperJobIds)
          .is('deleted_at', null);

        if (options?.status) {
          helperQuery = helperQuery.eq('status', options.status);
        }

        const { data: helperJobs, error: hjError } = await helperQuery;
        
        if (!hjError && helperJobs) {
          const markedHelperJobs = helperJobs.map(j => ({
            ...j,
            _isHelperAssignment: true
          })) as unknown as Job[];
          allJobs = [...allJobs, ...markedHelperJobs];
        }
      }
    }
    
    allJobs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }
  
  logDebug('[getJobs] Found jobs:', allJobs.length || 0);
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
      forklift:forklifts!forklift_id(forklift_id, serial_number, make, model, type, status, hourmeter, location)
    `)
    .eq('job_id', jobId)
    .is('deleted_at', null)
    .single();

  // Step 2: Fetch related data in parallel (these are simple indexed queries)
  const partsPromise = supabase
    .from('job_parts')
    .select('job_part_id, part_id, part_name, quantity, unit_cost')
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
    .select('*')
    .eq('job_id', jobId);

  const mediaPromise = supabase
    .from('job_media')
    .select('*')
    .eq('job_id', jobId);

  const chargesPromise = supabase
    .from('extra_charges')
    .select('*')
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
      notes: jobData.notes || [],
      labor_cost: jobData.labor_cost || 150,
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
      media:job_media(*),
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
      media:job_media(*),
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
      media:job_media(*),
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
      media:job_media(*),
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
