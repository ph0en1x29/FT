/**
 * Job Read Service
 *
 * All read paths for jobs: paginated lookups, lightweight projections, KPI fetch,
 * and detail fetches. Split from jobService.ts (was 821 LOC) so the file stays
 * within the line cap and read concerns are isolated from write concerns.
 *
 * Read paths use circuit breakers (`getJobsCB`, `getJobsForKPICB`) to trip after
 * 3 consecutive network failures and auto-reset after 60 s — protects the UI from
 * cascading retries during outages.
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
import { UserRole } from '../types';
import { CircuitBreakerTrippedError, createCircuitBreaker } from '../utils/circuit-breaker';
import { isNetworkError, JOB_SELECT, logDebug, logError, supabase, wait } from './supabaseClient';

const getJobsCB = createCircuitBreaker({ maxFailures: 3, resetAfterMs: 60_000, label: 'getJobs' });
const getJobsForKPICB = createCircuitBreaker({ maxFailures: 3, resetAfterMs: 60_000, label: 'getJobsForKPI' });

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
    total: count || 0,
  };
};

export interface JobsPageResult {
  jobs: Job[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export const getJobsPage = async (user: User, options?: {
  status?: JobStatus;
  page?: number;
  pageSize?: number;
}): Promise<JobsPageResult> => {
  const page = Math.max(1, options?.page || 1);
  const pageSize = Math.min(Math.max(options?.pageSize || 100, 1), 200);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const buildQuery = () => {
    let query = supabase
      .from('jobs')
      .select(JOB_SELECT.BOARD, { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (user.role === UserRole.TECHNICIAN) {
      query = query.eq('assigned_technician_id', user.user_id);
    }

    return query;
  };

  const { data, count, error } = await buildQuery();
  if (error) throw new Error(error.message);

  let allJobs = (data || []) as unknown as Job[];

  // Preserve helper jobs for technician boards without making the admin board unbounded.
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
      allJobs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  }

  allJobs.forEach(job => {
    job.parts_used = job.parts_used || [];
    job.extra_charges = job.extra_charges || [];
    job.labor_cost = job.labor_cost || 0;
  });

  const total = count || 0;
  return {
    jobs: allJobs,
    total,
    page,
    pageSize,
    hasMore: to + 1 < total,
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
    throw new Error((error as Error)?.message || 'Failed to fetch jobs', { cause: error });
  }

  let allJobs = data as Job[];

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

  allJobs.forEach(job => {
    job.parts_used = job.parts_used || [];
    job.extra_charges = job.extra_charges || [];
    job.labor_cost = job.labor_cost || 0;
  });

  logDebug('[getJobs] Found jobs:', allJobs.length || 0);
  return allJobs;
};

/**
 * Jobs for KPI calculations — KPI projection includes revenue fields
 * (labor_cost, parts_used, extra_charges) but is lighter than DETAIL.
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
    throw new Error((error as Error)?.message || 'Failed to fetch jobs', { cause: error });
  }

  const allJobs = data as Job[];

  allJobs.forEach(job => {
    job.parts_used = job.parts_used || [];
    job.extra_charges = job.extra_charges || [];
    job.labor_cost = job.labor_cost || 0;
  });

  logDebug('[getJobsForKPI] Found jobs:', allJobs.length || 0);
  return allJobs;
};

/**
 * Optimized job-by-id fetch with parallel queries.
 * Reduces query time vs single massive JOIN — uses 5-way Promise.all for related tables.
 */
export const getJobByIdFast = async (jobId: string): Promise<Job | null> => {
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

  const partsPromise = supabase
    .from('job_parts')
    .select('job_part_id, part_id, part_name, quantity, sell_price_at_time, quantity_used, quantity_returned, auto_populated, return_status, return_reason, return_requested_by, return_requested_at, return_confirmed_by, return_confirmed_at, return_notes')
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

  const [jobResult, partsResult, mediaResult, chargesResult, helperResult] = await Promise.all([
    jobPromise,
    partsPromise,
    mediaPromise,
    chargesPromise,
    helperPromise,
  ]);

  if (jobResult.error) {
    console.error('Error fetching job:', jobResult.error);
    return null;
  }

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
 * Full job fetch — same parallel-query pattern as `getJobByIdFast` but pulls
 * the full column set for each related table (used by JobDetail). Reduces
 * query time vs a single massive JOIN.
 */
export const getJobById = async (jobId: string): Promise<Job | null> => {
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

  const partsPromise = supabase
    .from('job_parts')
    .select('job_part_id, job_id, part_id, part_name, quantity, sell_price_at_time, from_van_stock, van_stock_item_id, quantity_used, quantity_returned, auto_populated, return_status, return_reason, return_requested_by, return_requested_at, return_confirmed_by, return_confirmed_at, return_notes')
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

  const [jobResult, partsResult, mediaResult, chargesResult, helperResult] = await Promise.all([
    jobPromise,
    partsPromise,
    mediaPromise,
    chargesPromise,
    helperPromise,
  ]);

  if (jobResult.error) {
    console.error('Error fetching job:', jobResult.error);
    return null;
  }

  const job = jobResult.data as Job;
  job.parts_used = partsResult.data || [];
  job.media = mediaResult.data || [];
  job.extra_charges = chargesResult.data || [];

  if (helperResult.data) {
    job.helper_assignment = helperResult.data as JobAssignment;
  }

  return job;
};
