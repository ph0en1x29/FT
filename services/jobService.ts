/**
 * Job Service
 * 
 * Core job CRUD operations and re-exports from specialized services.
 * 
 * This file maintains backward compatibility by re-exporting all functions
 * from the split service files.
 */

import { supabase, logDebug, logError, wait, isNetworkError, JOB_SELECT } from './supabaseClient';
import { 
  createNotification, 
  notifyJobAssignment, 
  notifyPendingFinalization,
  getAdminsAndSupervisors 
} from './notificationService';
import type {
  Job,
  JobStatus,
  JobAssignment,
  JobPartUsed,
  JobMedia,
  ExtraCharge,
  User,
} from '../types';
import { JobStatus as JobStatusEnum, JobPriority as JobPriorityEnum, JobType as JobTypeEnum, ForkliftStatus, UserRole, NotificationType } from '../types';

// =====================
// LOCAL TYPE DEFINITIONS
// =====================

/** Row type for forklift hourmeter query */
interface ForkliftHourmeterRow {
  hourmeter: number | null;
}

/** Row type for deleted jobs query with relations (Supabase returns arrays for relations) */
interface DeletedJobRow {
  job_id: string;
  title: string;
  description?: string;
  status: string;
  job_type: string;
  priority: string;
  deleted_at: string;
  deleted_by?: string;
  deleted_by_name?: string;
  deletion_reason?: string;
  hourmeter_before_delete?: number;
  forklift_id?: string;
  customer_id?: string;
  assigned_technician_name?: string;
  created_at: string;
  customer?: { name: string }[] | null;
  forklift?: { serial_number: string; make: string; model: string }[] | null;
}

// =====================
// RE-EXPORTS FOR BACKWARD COMPATIBILITY
// =====================

// Assignment Service
export {
  acceptJobAssignment,
  rejectJobAssignment,
  checkExpiredJobResponses,
  getJobsPendingResponse,
  reassignJob,
  getJobAssignments,
  getActiveHelper,
  assignHelper,
  removeHelper,
  startHelperWork,
  endHelperWork,
  getHelperJobs,
  isUserHelperOnJob,
  getUserAssignmentType,
} from './jobAssignmentService';

// Request Service
export {
  createJobRequest,
  updateJobRequest,
  getJobRequests,
  getPendingRequests,
  approveSparePartRequest,
  rejectRequest,
  acknowledgeSkillfulTechRequest,
  approveAssistanceRequest,
  getRequestCounts,
} from './jobRequestService';

// Media Service
export {
  addMedia,
  signJob,
} from './jobMediaService';

// Checklist Service
export {
  updateJobConditionChecklist,
  updateJobCarriedOut,
  updateConditionChecklist,
  setNoPartsUsed,
  getJobServiceRecord,
  updateJobRepairTimes,
  startJobWithCondition,
} from './jobChecklistService';

// Invoice Service
export {
  addPartToJob,
  updatePartPrice,
  removePartFromJob,
  updateLaborCost,
  addExtraCharge,
  removeExtraCharge,
  finalizeInvoice,
  sendInvoice,
  generateInvoiceText,
} from './jobInvoiceService';

// Locking Service
export {
  acquireJobLock,
  releaseJobLock,
  checkJobLock,
  cleanupExpiredLocks,
} from './jobLockingService';

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
  const { customer, forklift, parts_used, media, extra_charges, ...safeUpdates } = updates;

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

export const assignJob = async (jobId: string, technicianId: string, technicianName: string, assignedById?: string, assignedByName?: string): Promise<Job> => {
  const now = new Date();
  const responseDeadline = new Date(now.getTime() + 15 * 60 * 1000);
  
  const { data, error } = await supabase
    .from('jobs')
    .update({
      assigned_technician_id: technicianId,
      assigned_technician_name: technicianName,
      status: JobStatusEnum.ASSIGNED,
      assigned_at: now.toISOString(),
      assigned_by_id: assignedById || null,
      assigned_by_name: assignedByName || null,
      technician_response_deadline: responseDeadline.toISOString(),
      technician_accepted_at: null,
      technician_rejected_at: null,
      technician_rejection_reason: null,
      no_response_alerted_at: null,
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
  
  const job = data as Job;
  await notifyJobAssignment(technicianId, job);
  
  return job;
};

export const updateJobStatus = async (jobId: string, status: JobStatus, completedById?: string, completedByName?: string): Promise<Job> => {
  const { data: currentJob, error: fetchError } = await supabase
    .from('jobs')
    .select('status, arrival_time, started_at, completion_time, repair_end_time, completed_at, assigned_technician_id, forklift_id, hourmeter_reading, technician_signature, customer_signature')
    .eq('job_id', jobId)
    .single();
  
  if (fetchError) throw new Error(fetchError.message);
  
  const previousStatus = currentJob?.status;
  
  // Validation for status transitions
  if (status === JobStatusEnum.IN_PROGRESS && previousStatus !== JobStatusEnum.IN_PROGRESS) {
    if (!currentJob?.assigned_technician_id) {
      throw new Error('Cannot start job: No technician assigned');
    }
    if (!currentJob?.forklift_id) {
      throw new Error('Cannot start job: No forklift assigned');
    }
  }
  
  if (status === JobStatusEnum.AWAITING_FINALIZATION) {
    if (!currentJob?.hourmeter_reading) {
      throw new Error('Cannot complete job: Hourmeter reading is required');
    }
    const hasTechSignature = !!currentJob?.technician_signature;
    const hasCustomerSignature = !!currentJob?.customer_signature;
    if (!hasTechSignature || !hasCustomerSignature) {
      throw new Error('Cannot complete job: Both technician and customer signatures are required');
    }
  }
  
  const updates: Partial<Job> = { status };
  const now = new Date().toISOString();

  // Set timestamps based on status
  if (status === JobStatusEnum.IN_PROGRESS) {
    if (!currentJob?.arrival_time) updates.arrival_time = now;
    if (!currentJob?.started_at) updates.started_at = now;
  }
  
  if (status === JobStatusEnum.AWAITING_FINALIZATION) {
    if (!currentJob?.completion_time) updates.completion_time = now;
    if (!currentJob?.repair_end_time) updates.repair_end_time = now;
    if (!currentJob?.completed_at) {
      updates.completed_at = now;
      updates.completed_by_id = completedById || null;
      updates.completed_by_name = completedByName || null;
    }
  }
  
  // Reset timestamps on status rollback
  if (status === JobStatusEnum.ASSIGNED && previousStatus === JobStatusEnum.IN_PROGRESS) {
    updates.arrival_time = null;
    updates.started_at = null;
  }
  
  if (status === JobStatusEnum.IN_PROGRESS && 
      (previousStatus === JobStatusEnum.AWAITING_FINALIZATION || previousStatus === JobStatusEnum.COMPLETED)) {
    updates.completion_time = null;
    updates.repair_end_time = null;
    updates.completed_at = null;
    updates.completed_by_id = null;
    updates.completed_by_name = null;
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

  const job = data as Job;

  // Sync started_at to job_service_records when moving to IN_PROGRESS
  if (status === JobStatusEnum.IN_PROGRESS && previousStatus !== JobStatusEnum.IN_PROGRESS) {
    const now = new Date().toISOString();
    await supabase
      .from('job_service_records')
      .update({
        started_at: now,
        repair_start_time: job.repair_start_time || now,
        updated_at: now,
      })
      .eq('job_id', jobId)
      .is('started_at', null); // Only update if not already set
  }

  // Update forklift status
  if (currentJob?.forklift_id) {
    if (status === JobStatusEnum.IN_PROGRESS && previousStatus !== JobStatusEnum.IN_PROGRESS) {
      await supabase
        .from('forklifts')
        .update({ status: ForkliftStatus.IN_SERVICE, updated_at: new Date().toISOString() })
        .eq('forklift_id', currentJob.forklift_id);
    }

    if (status === JobStatusEnum.COMPLETED || status === JobStatusEnum.AWAITING_FINALIZATION) {
      const { data: forklift } = await supabase
        .from('forklifts')
        .select('hourmeter, next_service_due, next_service_hourmeter')
        .eq('forklift_id', currentJob.forklift_id)
        .single();

      if (forklift) {
        const now = new Date();
        const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const isServiceDueByDate = forklift.next_service_due && new Date(forklift.next_service_due) <= sevenDaysFromNow;
        const hoursUntilService = forklift.next_service_hourmeter ? forklift.next_service_hourmeter - (forklift.hourmeter || 0) : null;
        const isServiceDueByHours = hoursUntilService !== null && hoursUntilService <= 50;

        const newStatus = (isServiceDueByDate || isServiceDueByHours)
          ? ForkliftStatus.SERVICE_DUE
          : ForkliftStatus.AVAILABLE;

        await supabase
          .from('forklifts')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('forklift_id', currentJob.forklift_id);
      }
    }
  }

  // Notify on awaiting finalization
  if (status === JobStatusEnum.AWAITING_FINALIZATION) {
    await notifyPendingFinalization(job);
  }

  return job;
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

export const deleteJob = async (
  jobId: string, 
  deletedById?: string, 
  deletedByName?: string,
  deletionReason?: string
): Promise<void> => {
  const now = new Date().toISOString();
  
  const { data: job } = await supabase
    .from('jobs')
    .select('forklift_id, hourmeter_reading')
    .eq('job_id', jobId)
    .single();

  // Rollback forklift hourmeter if needed
  if (job?.forklift_id && job?.hourmeter_reading) {
    const { data: forklift } = await supabase
      .from('forklifts')
      .select('hourmeter')
      .eq('forklift_id', job.forklift_id)
      .single();

    if (forklift?.hourmeter === job.hourmeter_reading) {
      const { data: prevJob } = await supabase
        .from('jobs')
        .select('hourmeter_reading')
        .eq('forklift_id', job.forklift_id)
        .neq('job_id', jobId)
        .is('deleted_at', null)
        .not('hourmeter_reading', 'is', null)
        .in('status', ['Completed', 'Awaiting Finalization'])
        .order('completed_at', { ascending: false, nullsFirst: false })
        .limit(1)
        .single();

      if (prevJob?.hourmeter_reading) {
        await supabase
          .from('forklifts')
          .update({ hourmeter: prevJob.hourmeter_reading, updated_at: now })
          .eq('forklift_id', job.forklift_id);
      }
    }
  }

  const { error } = await supabase
    .from('jobs')
    .update({
      deleted_at: now,
      deleted_by: deletedById || null,
      deleted_by_name: deletedByName || null,
      deletion_reason: deletionReason || null,
      hourmeter_before_delete: job?.hourmeter_reading || null,
    })
    .eq('job_id', jobId);

  if (error) throw new Error(error.message);
};

export const getRecentlyDeletedJobs = async (): Promise<any[]> => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data, error } = await supabase
    .from('jobs')
    .select(`
      job_id, title, description, status, job_type, priority,
      deleted_at, deleted_by, deleted_by_name, deletion_reason, hourmeter_before_delete,
      forklift_id, customer_id, assigned_technician_name, created_at,
      customer:customers(name),
      forklift:forklifts!forklift_id(serial_number, make, model)
    `)
    .not('deleted_at', 'is', null)
    .gte('deleted_at', thirtyDaysAgo.toISOString())
    .order('deleted_at', { ascending: false });

  if (error) {
    console.error('Error fetching recently deleted jobs:', error);
    return [];
  }

  return (data || []).map((job) => {
    const row = job as DeletedJobRow;
    const customer = Array.isArray(row.customer) ? row.customer[0] : row.customer;
    const forklift = Array.isArray(row.forklift) ? row.forklift[0] : row.forklift;
    return {
      ...row,
      customer_name: customer?.name || 'Unknown',
      forklift_serial: forklift?.serial_number,
      forklift_make: forklift?.make,
      forklift_model: forklift?.model,
    };
  });
};

export const hardDeleteJob = async (jobId: string): Promise<void> => {
  // Delete all related records first
  await supabase.from('job_inventory_usage').delete().eq('job_id', jobId);
  await supabase.from('job_invoice_extra_charges').delete().eq('job_id', jobId);
  await supabase.from('job_invoices').delete().eq('job_id', jobId);
  await supabase.from('job_service_records').delete().eq('job_id', jobId);
  await supabase.from('job_status_history').delete().eq('job_id', jobId);
  await supabase.from('job_audit_log').delete().eq('job_id', jobId);
  await supabase.from('job_parts').delete().eq('job_id', jobId);
  await supabase.from('job_media').delete().eq('job_id', jobId);
  await supabase.from('extra_charges').delete().eq('job_id', jobId);
  
  const { error } = await supabase.from('jobs').delete().eq('job_id', jobId);
  if (error) throw new Error(error.message);
};

// =====================
// MULTI-DAY JOB SUPPORT
// =====================

/**
 * Mark job to continue tomorrow (multi-day job support)
 */
export const markJobContinueTomorrow = async (
  jobId: string,
  hourmeter: number | undefined,
  _userId: string,
  _userName: string
): Promise<Job> => {
  logDebug('[JobService] markJobContinueTomorrow called for job:', jobId);
  
  const updateData: Record<string, unknown> = {
    status: 'continue_tomorrow',
    updated_at: new Date().toISOString()
  };
  
  if (hourmeter !== undefined) {
    updateData.hourmeter_reading = hourmeter;
  }
  
  const { data, error } = await supabase
    .from('jobs')
    .update(updateData)
    .eq('job_id', jobId)
    .select()
    .single();
  
  if (error) throw new Error(error.message);
  return data as Job;
};

/**
 * Resume a multi-day job
 */
export const resumeMultiDayJob = async (
  jobId: string,
  _userId: string,
  _userName: string
): Promise<Job> => {
  logDebug('[JobService] resumeMultiDayJob called for job:', jobId);
  
  const { data, error } = await supabase
    .from('jobs')
    .update({
      status: 'in_progress',
      updated_at: new Date().toISOString()
    })
    .eq('job_id', jobId)
    .select()
    .single();
  
  if (error) throw new Error(error.message);
  return data as Job;
};

// =====================
// STUB IMPLEMENTATIONS (TODO: Implement properly)
// =====================

// =====================
// AUTOCOUNT INTEGRATION (TODO: Implement properly)
// =====================

interface AutoCountExport {
  export_id: string;
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  error_message?: string;
}

/**
 * Create an AutoCount export for a job
 * @stub Not yet implemented
 */
export const createAutoCountExport = async (
  jobId: string,
  _userId: string,
  _userName: string
): Promise<void> => {
  logDebug('[JobService] createAutoCountExport called for job:', jobId);
  // TODO: Implement AutoCount integration
  throw new Error('AutoCount export not yet implemented');
};

/**
 * Get all AutoCount exports
 * @stub Returns empty array
 */
export const getAutoCountExports = async (): Promise<AutoCountExport[]> => {
  logDebug('[JobService] getAutoCountExports called');
  // TODO: Implement - query autocount_exports table
  return [];
};

/**
 * Get jobs pending AutoCount export
 * @stub Returns empty array
 */
export const getJobsPendingExport = async (): Promise<Job[]> => {
  logDebug('[JobService] getJobsPendingExport called');
  // TODO: Implement - query jobs where invoice is finalized but not exported
  return [];
};

/**
 * Retry a failed AutoCount export
 * @stub Not yet implemented
 */
export const retryAutoCountExport = async (exportId: string): Promise<void> => {
  logDebug('[JobService] retryAutoCountExport called for:', exportId);
  // TODO: Implement retry logic
  throw new Error('AutoCount retry not yet implemented');
};

/**
 * Cancel an AutoCount export
 * @stub Not yet implemented
 */
export const cancelAutoCountExport = async (exportId: string): Promise<void> => {
  logDebug('[JobService] cancelAutoCountExport called for:', exportId);
  // TODO: Implement cancel logic
  throw new Error('AutoCount cancel not yet implemented');
};

/**
 * Confirm parts used on a job
 * @stub Returns job unchanged for now
 */
export const confirmParts = async (
  jobId: string,
  _userId: string,
  _userName: string
): Promise<Job> => {
  logDebug('[JobService] confirmParts called for job:', jobId);
  // For now, just return the job unchanged
  const job = await getJobById(jobId);
  if (!job) throw new Error('Job not found');
  return job;
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
