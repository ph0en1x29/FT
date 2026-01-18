import { createClient } from '@supabase/supabase-js';
import {
  AutoCountExport,
  AutoCountExportStatus,
  AutoCountLineItem,
  Customer,
  Forklift,
  ForkliftRental,
  ForkliftStatus,
  HourmeterAmendment,
  HourmeterAmendmentStatus,
  HourmeterFlagReason,
  Job,
  JobAssignment,
  JobMedia,
  JobPriority,
  JobStatus,
  JobType,
  NotificationType,
  Part,
  RentalStatus,
  ReplenishmentStatus,
  ScheduledService,
  SignatureEntry,
  User,
  UserRole,
  VanStock,
  VanStockItem,
  VanStockReplenishment,
  VanStockUsage,
  VanStockAudit,
} from '../types';
import type { Notification } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);

const isDev = import.meta.env.DEV;
const logDebug = (...args: unknown[]) => {
  if (isDev) {
    console.log(...args);
  }
};
const logError = (...args: unknown[]) => {
  if (isDev) {
    console.error(...args);
  }
};
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const isNetworkError = (error: unknown) => {
  const message = (error as Error | undefined)?.message || String(error || '');
  return error instanceof TypeError || /Failed to fetch|NetworkError|ERR_CONNECTION_CLOSED|fetch failed/i.test(message);
};

export const SupabaseDb = {
  login: async (email: string, password: string): Promise<User> => {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) throw new Error(authError.message);
    if (!authData.user) throw new Error('Login failed');

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', authData.user.id)
      .single();

    if (userError || !userData) throw new Error('User profile not found');
    if (!userData.is_active) throw new Error('Account is deactivated');

    return userData as User;
  },

  getUsers: async (): Promise<User[]> => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('name');

    if (error) throw new Error(error.message);
    return data as User[];
  },

  getTechnicians: async (): Promise<User[]> => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', UserRole.TECHNICIAN)
      .eq('is_active', true)
      .order('name');

    if (error) throw new Error(error.message);
    return data as User[];
  },

  createUser: async (userData: Partial<User> & { password?: string }): Promise<User> => {
    // Secure two-step user creation process
    // Step 1: Prepare - registers intent tied to admin's auth.uid()
    const { data: pendingId, error: prepareError } = await supabase.rpc('prepare_user_creation', {
      p_email: userData.email,
    });

    if (prepareError) throw new Error(prepareError.message);
    if (!pendingId) throw new Error('Failed to prepare user creation');

    // Step 2: Create auth user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: userData.email!,
      password: userData.password || 'temp123',
    });

    if (authError) throw new Error(authError.message);
    if (!authData.user) throw new Error('Failed to create auth user');

    // Step 3: Complete - verifies pending request and creates user record
    const { data: userId, error: completeError } = await supabase.rpc('complete_user_creation', {
      p_pending_id: pendingId,
      p_auth_id: authData.user.id,
      p_name: userData.name,
      p_email: userData.email,
      p_role: userData.role || UserRole.TECHNICIAN,
      p_is_active: userData.is_active ?? true,
    });

    if (completeError) throw new Error(completeError.message);

    // Step 4: Fetch and return the created user
    const { data, error } = await supabase
      .from('users')
      .select()
      .eq('user_id', userId)
      .single();

    if (error) throw new Error(error.message);
    return data as User;
  },

  updateUser: async (userId: string, updates: Partial<User> & { password?: string }): Promise<User> => {
    // Extract password from updates (passwords are in Supabase Auth, not users table)
    const { password, ...userUpdates } = updates as any;
    
    // Update user profile in users table (without password)
    const { data, error } = await supabase
      .from('users')
      .update(userUpdates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    
    // If password was provided, update it via Supabase Auth
    // Note: This only works if the current user is updating their OWN password
    // For admin password reset, you'd need a server-side function with service role
    if (password) {
      // Get the auth_id for this user
      const { data: userData } = await supabase
        .from('users')
        .select('auth_id')
        .eq('user_id', userId)
        .single();
      
      if (userData?.auth_id) {
        // Try to update password (will only work for current user's own password)
        const { error: authError } = await supabase.auth.updateUser({
          password: password
        });
        
        if (authError) {
          console.warn('Password update failed - admin password reset requires server-side implementation:', authError.message);
          // Don't throw - the user profile was still updated successfully
        }
      }
    }
    
    return data as User;
  },

  // =====================
  // FORKLIFT/ASSET OPERATIONS
  // =====================

  getForklifts: async (): Promise<Forklift[]> => {
    const { data, error } = await supabase
      .from('forklifts')
      .select('*')
      .order('serial_number');

    if (error) throw new Error(error.message);
    return data as Forklift[];
  },

  getForkliftById: async (forkliftId: string): Promise<Forklift | null> => {
    const { data, error } = await supabase
      .from('forklifts')
      .select('*')
      .eq('forklift_id', forkliftId)
      .single();

    if (error) {
      console.error('Error fetching forklift:', error);
      return null;
    }
    return data as Forklift;
  },

  // Get active rental for a forklift (includes customer and location)
  getActiveRentalForForklift: async (forkliftId: string): Promise<{
    rental_id: string;
    customer_id: string;
    customer_name: string;
    customer_address: string;
    rental_location: string;
    start_date: string;
    end_date?: string;
  } | null> => {
    try {
      const { data, error } = await supabase
        .from('forklift_rentals')
        .select(`
          rental_id,
          customer_id,
          rental_location,
          start_date,
          end_date,
          customers (
            name,
            address
          )
        `)
        .eq('forklift_id', forkliftId)
        .eq('status', 'active')
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      const customer = data.customers as any;
      return {
        rental_id: data.rental_id,
        customer_id: data.customer_id,
        customer_name: customer?.name || 'Unknown',
        customer_address: customer?.address || '',
        rental_location: data.rental_location || '',
        start_date: data.start_date,
        end_date: data.end_date,
      };
    } catch (e) {
      console.warn('Failed to get active rental:', e);
      return null;
    }
  },

  createForklift: async (forkliftData: Partial<Forklift>): Promise<Forklift> => {
    const { data, error } = await supabase
      .from('forklifts')
      .insert({
        serial_number: forkliftData.serial_number,
        make: forkliftData.make,
        model: forkliftData.model,
        type: forkliftData.type,
        hourmeter: forkliftData.hourmeter || 0,
        year: forkliftData.year,
        capacity_kg: forkliftData.capacity_kg,
        location: forkliftData.location,
        status: forkliftData.status || ForkliftStatus.ACTIVE,
        notes: forkliftData.notes,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Forklift;
  },

  updateForklift: async (
    forkliftId: string,
    updates: Partial<Forklift>,
    userContext?: { userId: string; userName: string }
  ): Promise<Forklift> => {
    // If hourmeter is being updated, get current value for audit trail
    let previousHourmeter: number | null = null;
    if (updates.hourmeter !== undefined && userContext) {
      const { data: current } = await supabase
        .from('forklifts')
        .select('hourmeter')
        .eq('forklift_id', forkliftId)
        .single();
      previousHourmeter = current?.hourmeter ?? null;
    }

    // Perform the update
    const { data, error } = await supabase
      .from('forklifts')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('forklift_id', forkliftId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    // Create audit trail for hourmeter changes
    if (updates.hourmeter !== undefined && userContext && previousHourmeter !== updates.hourmeter) {
      try {
        await supabase
          .from('hourmeter_history')
          .insert({
            forklift_id: forkliftId,
            reading: updates.hourmeter,
            previous_reading: previousHourmeter,
            hours_since_last: previousHourmeter ? updates.hourmeter - previousHourmeter : null,
            recorded_by_id: userContext.userId,
            recorded_by_name: userContext.userName,
            source: 'manual',
          });
      } catch (historyError) {
        console.warn('Failed to create hourmeter history:', historyError);
        // Don't fail the update if history insert fails
      }
    }

    return data as Forklift;
  },

  deleteForklift: async (forkliftId: string): Promise<void> => {
    // Check if forklift has any active (non-deleted) jobs
    const { data: jobs } = await supabase
      .from('jobs')
      .select('job_id')
      .eq('forklift_id', forkliftId)
      .is('deleted_at', null); // Exclude soft-deleted jobs
    
    if (jobs && jobs.length > 0) {
      throw new Error('Cannot delete forklift with existing service records. Set status to Inactive instead.');
    }

    const { error } = await supabase
      .from('forklifts')
      .delete()
      .eq('forklift_id', forkliftId);

    if (error) throw new Error(error.message);
  },

  // Update forklift hourmeter (when job is completed)
  updateForkliftHourmeter: async (forkliftId: string, newHourmeter: number): Promise<Forklift> => {
    const { data, error } = await supabase
      .from('forklifts')
      .update({
        hourmeter: newHourmeter,
        last_service_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('forklift_id', forkliftId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Forklift;
  },

  // =====================
  // PARTS OPERATIONS
  // =====================

  getParts: async (): Promise<Part[]> => {
    const { data, error } = await supabase
      .from('parts')
      .select('*')
      .order('category')
      .order('part_name');

    if (error) throw new Error(error.message);
    return data as Part[];
  },

  // =====================
  // CUSTOMER OPERATIONS
  // =====================

  getCustomers: async (): Promise<Customer[]> => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('name');

    if (error) throw new Error(error.message);
    return data as Customer[];
  },

  createCustomer: async (customerData: Partial<Customer>): Promise<Customer> => {
    const { data, error } = await supabase
      .from('customers')
      .insert(customerData)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Customer;
  },

  // =====================
  // JOB OPERATIONS
  // =====================

  getJobs: async (user: User, options?: { status?: JobStatus }): Promise<Job[]> => {
    logDebug('[getJobs] Fetching jobs for user:', user.user_id, user.role, user.name, options?.status ? `status=${options.status}` : '');

    const buildQuery = () => {
      let query = supabase
        .from('jobs')
        .select(`
          *,
          customer:customers(*),
          forklift:forklifts!forklift_id(*),
          parts_used:job_parts(*),
          media:job_media(*),
          extra_charges:extra_charges(*)
        `)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      // Apply status filter at database level if provided
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
      return data as Job[];
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
    
    // For technicians, also fetch jobs where they're assigned as helper
    let allJobs = data as Job[];
    
    if (user.role === UserRole.TECHNICIAN) {
      // Get job IDs where user is a helper
      const { data: helperAssignments, error: helperError } = await supabase
        .from('job_assignments')
        .select('job_id')
        .eq('technician_id', user.user_id)
        .eq('assignment_type', 'assistant')
        .eq('is_active', true);
      
      if (!helperError && helperAssignments && helperAssignments.length > 0) {
        const helperJobIds = helperAssignments.map(a => a.job_id);
        
        // Fetch those jobs (exclude ones already in the list)
        const existingJobIds = new Set(allJobs.map(j => j.job_id));
        const newHelperJobIds = helperJobIds.filter(id => !existingJobIds.has(id));
        
        if (newHelperJobIds.length > 0) {
          let helperQuery = supabase
            .from('jobs')
            .select(`
              *,
              customer:customers(*),
              forklift:forklifts!forklift_id(*),
              parts_used:job_parts(*),
              media:job_media(*),
              extra_charges:extra_charges(*)
            `)
            .in('job_id', newHelperJobIds)
            .is('deleted_at', null);

          // Apply status filter to helper jobs too
          if (options?.status) {
            helperQuery = helperQuery.eq('status', options.status);
          }

          const { data: helperJobs, error: hjError } = await helperQuery;
          
          if (!hjError && helperJobs) {
            // Mark these jobs as helper assignments for UI display
            const markedHelperJobs = helperJobs.map(j => ({
              ...j,
              _isHelperAssignment: true // UI hint
            }));
            allJobs = [...allJobs, ...markedHelperJobs];
          }
        }
      }
      
      // Sort combined list by created_at desc
      allJobs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    
    logDebug('[getJobs] Found jobs:', allJobs.length || 0);
    return allJobs;
  },

  getJobById: async (jobId: string): Promise<Job | null> => {
    const { data, error } = await supabase
      .from('jobs')
      .select(`
        *,
        customer:customers(*),
        forklift:forklifts!forklift_id(*),
        parts_used:job_parts(*),
        media:job_media(*),
        extra_charges:extra_charges(*)
      `)
      .eq('job_id', jobId)
      .is('deleted_at', null) // Exclude soft-deleted jobs
      .single();

    if (error) {
      console.error('Error fetching job:', error);
      return null;
    }

    // Fetch active helper assignment
    const { data: helperData, error: helperError } = await supabase
      .from('job_assignments')
      .select(`
        *,
        technician:users!job_assignments_technician_id_fkey(user_id, name, email, phone, role)
      `)
      .eq('job_id', jobId)
      .eq('assignment_type', 'assistant')
      .eq('is_active', true)
      .maybeSingle();

    if (helperError) {
      console.warn('Failed to fetch helper assignment:', helperError.message);
    }

    const job = data as Job;
    if (helperData) {
      job.helper_assignment = helperData as JobAssignment;
    }

    return job;
  },

  createJob: async (jobData: Partial<Job>, createdById?: string, createdByName?: string): Promise<Job> => {
    const { data, error } = await supabase
      .from('jobs')
      .insert({
        customer_id: jobData.customer_id,
        title: jobData.title,
        description: jobData.description,
        priority: jobData.priority || JobPriority.MEDIUM,
        job_type: jobData.job_type || JobType.SERVICE,
        status: jobData.status || JobStatus.NEW,
        assigned_technician_id: jobData.assigned_technician_id || null,
        assigned_technician_name: jobData.assigned_technician_name || null,
        forklift_id: jobData.forklift_id || null,
        hourmeter_reading: jobData.hourmeter_reading || null,
        notes: jobData.notes || [],
        labor_cost: jobData.labor_cost || 150,
        // Audit: Job Creation
        created_by_id: createdById || null,
        created_by_name: createdByName || null,
        // If technician is assigned during creation, set assigned_at
        assigned_at: jobData.assigned_technician_id ? new Date().toISOString() : null,
        assigned_by_id: jobData.assigned_technician_id ? createdById : null,
        assigned_by_name: jobData.assigned_technician_id ? createdByName : null,
      })
      .select(`
        *,
        customer:customers(*),
        forklift:forklifts!forklift_id(*)
      `)
      .single();

    if (error) throw new Error(error.message);
    
    const job = data as Job;
    (job as any).parts_used = (job as any).parts_used ?? [];
    (job as any).media = (job as any).media ?? [];
    (job as any).extra_charges = (job as any).extra_charges ?? [];
    
    // Notify technician if one was assigned during job creation
    if (jobData.assigned_technician_id) {
      await SupabaseDb.notifyJobAssignment(jobData.assigned_technician_id, job);
    }
    
    return job;
  },

  assignJob: async (jobId: string, technicianId: string, technicianName: string, assignedById?: string, assignedByName?: string): Promise<Job> => {
    const { data, error } = await supabase
      .from('jobs')
      .update({
        assigned_technician_id: technicianId,
        assigned_technician_name: technicianName,
        status: JobStatus.ASSIGNED,
        // Audit: Job Assignment
        assigned_at: new Date().toISOString(),
        assigned_by_id: assignedById || null,
        assigned_by_name: assignedByName || null,
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
    
    // Notify the technician of the new assignment
    await SupabaseDb.notifyJobAssignment(technicianId, job);
    
    return job;
  },

  updateJobStatus: async (jobId: string, status: JobStatus, completedById?: string, completedByName?: string): Promise<Job> => {
    // First fetch current job to check existing timestamps and required fields
    const { data: currentJob, error: fetchError } = await supabase
      .from('jobs')
      .select('status, arrival_time, started_at, completion_time, repair_end_time, completed_at, assigned_technician_id, forklift_id, hourmeter_reading, technician_signature, customer_signature')
      .eq('job_id', jobId)
      .single();
    
    if (fetchError) throw new Error(fetchError.message);
    
    const previousStatus = currentJob?.status;
    
    // === REQUIRED FIELD VALIDATION ===
    
    // Transition to IN_PROGRESS requires: assigned technician and forklift
    if (status === JobStatus.IN_PROGRESS && previousStatus !== JobStatus.IN_PROGRESS) {
      if (!currentJob?.assigned_technician_id) {
        throw new Error('Cannot start job: No technician assigned');
      }
      if (!currentJob?.forklift_id) {
        throw new Error('Cannot start job: No forklift assigned');
      }
    }
    
    // Transition to AWAITING_FINALIZATION requires: hourmeter and both signatures
    if (status === JobStatus.AWAITING_FINALIZATION) {
      if (!currentJob?.hourmeter_reading) {
        throw new Error('Cannot complete job: Hourmeter reading is required');
      }
      // Check for both signature columns (stored as base64 strings or URLs)
      const hasTechSignature = !!currentJob?.technician_signature;
      const hasCustomerSignature = !!currentJob?.customer_signature;
      if (!hasTechSignature || !hasCustomerSignature) {
        throw new Error('Cannot complete job: Both technician and customer signatures are required');
      }
    }
    
    // === END VALIDATION ===
    
    const updates: any = { status };
    const now = new Date().toISOString();

    // Forward transition: Assigned → In Progress
    // Only set timestamps if not already set (prevents overwriting on re-submission)
    if (status === JobStatus.IN_PROGRESS) {
      if (!currentJob?.arrival_time) {
        updates.arrival_time = now;
      }
      if (!currentJob?.started_at) {
        updates.started_at = now;
      }
    }
    
    // Forward transition: In Progress → Awaiting Finalization
    // Only set timestamps if not already set
    if (status === JobStatus.AWAITING_FINALIZATION) {
      if (!currentJob?.completion_time) {
        updates.completion_time = now;
      }
      if (!currentJob?.repair_end_time) {
        updates.repair_end_time = now;
      }
      if (!currentJob?.completed_at) {
        updates.completed_at = now;
        updates.completed_by_id = completedById || null;
        updates.completed_by_name = completedByName || null;
      }
    }
    
    // Rollback: In Progress → Assigned (reassignment scenario)
    // Clear arrival timestamps
    if (status === JobStatus.ASSIGNED && previousStatus === JobStatus.IN_PROGRESS) {
      updates.arrival_time = null;
      updates.started_at = null;
    }
    
    // Rollback: Awaiting Finalization/Completed → In Progress
    // Clear completion timestamps
    if (status === JobStatus.IN_PROGRESS && 
        (previousStatus === JobStatus.AWAITING_FINALIZATION || previousStatus === JobStatus.COMPLETED)) {
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

    // === AUTO-UPDATE FORKLIFT STATUS ===
    if (currentJob?.forklift_id) {
      // When job starts → Update forklift to "In Service"
      if (status === JobStatus.IN_PROGRESS && previousStatus !== JobStatus.IN_PROGRESS) {
        await supabase
          .from('forklifts')
          .update({
            status: ForkliftStatus.IN_SERVICE,
            updated_at: new Date().toISOString(),
          })
          .eq('forklift_id', currentJob.forklift_id);
      }

      // When job completes → Update forklift status based on service due
      if (status === JobStatus.COMPLETED || status === JobStatus.AWAITING_FINALIZATION) {
        // Get forklift to check service due
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
            .update({
              status: newStatus,
              updated_at: new Date().toISOString(),
            })
            .eq('forklift_id', currentJob.forklift_id);
        }
      }
    }
    // === END AUTO-UPDATE FORKLIFT STATUS ===

    // Notify accountants when job is pending finalization
    if (status === JobStatus.AWAITING_FINALIZATION) {
      await SupabaseDb.notifyPendingFinalization(job);
    }

    return job;
  },

  // Generic job update function for partial updates
  updateJob: async (jobId: string, updates: Partial<Job>): Promise<Job> => {
    // Remove nested objects that should not be updated directly
    const { customer, forklift, parts_used, media, extra_charges, ...safeUpdates } = updates as any;

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
  },

  // Update job's hourmeter reading with validation
  updateJobHourmeter: async (jobId: string, hourmeterReading: number): Promise<Job> => {
    // First get the job's forklift to validate hourmeter
    const { data: jobData, error: jobError } = await supabase
      .from('jobs')
      .select('forklift_id, forklift:forklifts!forklift_id(hourmeter)')
      .eq('job_id', jobId)
      .single();
    
    if (jobError) throw new Error(jobError.message);
    
    // Validate hourmeter reading is >= forklift's current reading
    const currentHourmeter = (jobData?.forklift as any)?.hourmeter || 0;
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
  },

  addNote: async (jobId: string, note: string): Promise<Job> => {
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
  },

  addPartToJob: async (
    jobId: string,
    partId: string,
    quantity: number,
    customPrice?: number,
    actorRole?: UserRole
  ): Promise<Job> => {
    const { data: part, error: partError } = await supabase
      .from('parts')
      .select('*')
      .eq('part_id', partId)
      .single();

    if (partError) throw new Error(partError.message);
    if (part.stock_quantity < quantity) throw new Error('Insufficient stock');

    const { error: insertError } = await supabase
      .from('job_parts')
      .insert({
        job_id: jobId,
        part_id: partId,
        part_name: part.part_name,
        quantity,
        sell_price_at_time: customPrice !== undefined ? customPrice : part.sell_price,
      });

    if (insertError) throw new Error(insertError.message);

    // Stock updates may be restricted by RLS (e.g. accountant/supervisor roles).
    // If the job_part insert succeeded, keep the UX unblocked and only update stock
    // when the acting role is allowed to modify inventory.
    if (actorRole === UserRole.ADMIN || actorRole === UserRole.TECHNICIAN) {
      const { error: stockError } = await supabase
        .from('parts')
        .update({ stock_quantity: part.stock_quantity - quantity })
        .eq('part_id', partId);
      if (stockError) {
        console.warn('Part added, but stock update failed (RLS?):', stockError.message);
      }
    }

    return SupabaseDb.getJobById(jobId) as Promise<Job>;
  },

  addMedia: async (
    jobId: string, 
    media: Omit<JobMedia, 'media_id' | 'job_id'>,
    uploadedById?: string,
    uploadedByName?: string,
    isHelperPhoto?: boolean
  ): Promise<Job> => {
    const { error } = await supabase
      .from('job_media')
      .insert({
        job_id: jobId,
        ...media,
        uploaded_by_id: uploadedById || null,
        uploaded_by_name: uploadedByName || null,
        is_helper_photo: isHelperPhoto || false,
      });

    if (error) throw new Error(error.message);
    return SupabaseDb.getJobById(jobId) as Promise<Job>;
  },

  signJob: async (
    jobId: string,
    type: 'technician' | 'customer',
    signerName: string,
    signatureDataUrl: string
  ): Promise<Job> => {
    const now = new Date().toISOString();
    const signatureEntry: SignatureEntry = {
      signed_by_name: signerName,
      signed_at: now,
      signature_url: signatureDataUrl,
    };

    const field = type === 'technician' ? 'technician_signature' : 'customer_signature';
    const timestampField = type === 'technician' ? 'technician_signature_at' : 'customer_signature_at';

    // Update jobs table (for UI display / backward compatibility)
    const { data, error } = await supabase
      .from('jobs')
      .update({ [field]: signatureEntry })
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

    // IMPORTANT: Also update job_service_records table (for validation trigger)
    const { error: serviceRecordError } = await supabase
      .from('job_service_records')
      .update({ 
        [field]: signatureEntry,
        [timestampField]: now,
        updated_at: now
      })
      .eq('job_id', jobId);

    // If service record doesn't exist, create one with the signature
    if (serviceRecordError) {
      // Try to upsert - create if not exists
      await supabase
        .from('job_service_records')
        .upsert({
          job_id: jobId,
          [field]: signatureEntry,
          [timestampField]: now,
          updated_at: now
        }, { onConflict: 'job_id' });
    }

    return data as Job;
  },

  updatePartPrice: async (jobId: string, jobPartId: string, newPrice: number): Promise<Job> => {
    const { error } = await supabase
      .from('job_parts')
      .update({ sell_price_at_time: newPrice })
      .eq('job_part_id', jobPartId)
      .eq('job_id', jobId);

    if (error) throw new Error(error.message);
    
    return SupabaseDb.getJobById(jobId) as Promise<Job>;
  },

  removePartFromJob: async (jobId: string, jobPartId: string, actorRole?: UserRole): Promise<Job> => {
    const { data: jobPart } = await supabase
      .from('job_parts')
      .select('part_id, quantity')
      .eq('job_part_id', jobPartId)
      .single();

    if (jobPart && (actorRole === UserRole.ADMIN || actorRole === UserRole.TECHNICIAN)) {
      const { data: part } = await supabase
        .from('parts')
        .select('stock_quantity')
        .eq('part_id', jobPart.part_id)
        .single();

      if (part) {
        const { error: stockError } = await supabase
          .from('parts')
          .update({ stock_quantity: part.stock_quantity + jobPart.quantity })
          .eq('part_id', jobPart.part_id);
        if (stockError) {
          console.warn('Removed part, but stock restore failed (RLS?):', stockError.message);
        }
      }
    }

    const { error } = await supabase
      .from('job_parts')
      .delete()
      .eq('job_part_id', jobPartId)
      .eq('job_id', jobId);

    if (error) throw new Error(error.message);
    
    return SupabaseDb.getJobById(jobId) as Promise<Job>;
  },

  updateLaborCost: async (jobId: string, laborCost: number): Promise<Job> => {
    const { data, error } = await supabase
      .from('jobs')
      .update({ labor_cost: laborCost })
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
  },

  addExtraCharge: async (
    jobId: string, 
    charge: { name: string; description: string; amount: number }
  ): Promise<Job> => {
    const { error } = await supabase
      .from('extra_charges')
      .insert({
        job_id: jobId,
        name: charge.name,
        description: charge.description,
        amount: charge.amount,
      });

    if (error) throw new Error(error.message);
    
    return SupabaseDb.getJobById(jobId) as Promise<Job>;
  },

  removeExtraCharge: async (jobId: string, chargeId: string): Promise<Job> => {
    const { error } = await supabase
      .from('extra_charges')
      .delete()
      .eq('charge_id', chargeId)
      .eq('job_id', jobId);

    if (error) throw new Error(error.message);
    
    return SupabaseDb.getJobById(jobId) as Promise<Job>;
  },

  finalizeInvoice: async (jobId: string, accountantId: string, accountantName: string): Promise<Job> => {
    // Get job to check for forklift and update hourmeter
    const job = await SupabaseDb.getJobById(jobId);
    
    // If job has a forklift and hourmeter reading, update the forklift's hourmeter
    if (job && job.forklift_id && job.hourmeter_reading) {
      await SupabaseDb.updateForkliftHourmeter(job.forklift_id, job.hourmeter_reading);
    }

    const { data, error } = await supabase
      .from('jobs')
      .update({
        status: JobStatus.COMPLETED,
        invoiced_by_id: accountantId,
        invoiced_by_name: accountantName,
        invoiced_at: new Date().toISOString(),
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
    return data as Job;
  },

  sendInvoice: async (jobId: string, method: 'email' | 'whatsapp' | 'both'): Promise<Job> => {
    const methods: string[] = [];
    if (method === 'both') {
      methods.push('email', 'whatsapp');
    } else {
      methods.push(method);
    }

    const { data, error } = await supabase
      .from('jobs')
      .update({
        invoice_sent_at: new Date().toISOString(),
        invoice_sent_via: methods,
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
    return data as Job;
  },

  generateInvoiceText: (job: Job): string => {
    const totalParts = job.parts_used.reduce((acc, p) => acc + (p.sell_price_at_time * p.quantity), 0);
    const laborCost = job.labor_cost || 150;
    const extraCharges = (job.extra_charges || []).reduce((acc, c) => acc + c.amount, 0);
    const total = totalParts + laborCost + extraCharges;

    let text = `*INVOICE - ${job.title}*\n\n`;
    text += `Customer: ${job.customer.name}\n`;
    text += `Address: ${job.customer.address}\n`;
    text += `Date: ${new Date(job.created_at).toLocaleDateString()}\n`;
    
    if (job.forklift) {
      text += `\n*Equipment Serviced:*\n`;
      text += `${job.forklift.make} ${job.forklift.model}\n`;
      text += `S/N: ${job.forklift.serial_number}\n`;
      if (job.hourmeter_reading) {
        text += `Hourmeter: ${job.hourmeter_reading} hrs\n`;
      }
    }
    
    text += `\n*Services Provided:*\n`;
    text += `${job.description}\n\n`;
    
    if (job.parts_used.length > 0) {
      text += `*Parts Used:*\n`;
      job.parts_used.forEach(p => {
        text += `• ${p.quantity}x ${p.part_name} - ${(p.sell_price_at_time * p.quantity).toFixed(2)}\n`;
      });
      text += `\n`;
    }
    
    text += `*Cost Breakdown:*\n`;
    text += `Labor: ${laborCost.toFixed(2)}\n`;
    text += `Parts: ${totalParts.toFixed(2)}\n`;
    
    if (extraCharges > 0) {
      text += `Extra Charges: ${extraCharges.toFixed(2)}\n`;
      if (job.extra_charges) {
        job.extra_charges.forEach(c => {
          text += `  • ${c.name}: ${c.amount.toFixed(2)}\n`;
        });
      }
    }
    
    text += `\n*TOTAL: ${total.toFixed(2)}*\n\n`;
    text += `Thank you for your business!`;
    
    return text;
  },

  // Soft delete job with reason and hourmeter handling
  // This marks the job as cancelled/deleted, preserves audit trail, 
  // and handles forklift hourmeter reversion if needed
  deleteJob: async (
    jobId: string, 
    deletedById?: string, 
    deletedByName?: string,
    deletionReason?: string
  ): Promise<void> => {
    const now = new Date().toISOString();
    
    // First, get the job to check for hourmeter handling
    const { data: job } = await supabase
      .from('jobs')
      .select('forklift_id, hourmeter_reading')
      .eq('job_id', jobId)
      .single();

    // If job had a hourmeter reading and forklift, check if we need to revert
    if (job?.forklift_id && job?.hourmeter_reading) {
      // Get current forklift hourmeter
      const { data: forklift } = await supabase
        .from('forklifts')
        .select('hourmeter')
        .eq('forklift_id', job.forklift_id)
        .single();

      // If the forklift's current hourmeter matches this job's reading
      if (forklift?.hourmeter === job.hourmeter_reading) {
        // Find the previous valid hourmeter reading
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

        // Revert to previous hourmeter if found
        if (prevJob?.hourmeter_reading) {
          await supabase
            .from('forklifts')
            .update({ 
              hourmeter: prevJob.hourmeter_reading,
              updated_at: now
            })
            .eq('forklift_id', job.forklift_id);
        }
      }
    }

    // Soft delete the job with reason and audit info
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
  },

  // Get recently deleted jobs (admin/supervisor only - last 30 days)
  getRecentlyDeletedJobs: async (): Promise<any[]> => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data, error } = await supabase
      .from('jobs')
      .select(`
        job_id,
        title,
        description,
        status,
        job_type,
        priority,
        deleted_at,
        deleted_by,
        deleted_by_name,
        deletion_reason,
        hourmeter_before_delete,
        forklift_id,
        customer_id,
        assigned_technician_name,
        created_at,
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

    // Transform data for easier consumption
    return (data || []).map((job: any) => ({
      ...job,
      customer_name: job.customer?.name || 'Unknown',
      forklift_serial: job.forklift?.serial_number,
      forklift_make: job.forklift?.make,
      forklift_model: job.forklift?.model,
    }));
  },

  // Hard delete job (admin only - use with caution)
  // This permanently removes the job and related data
  hardDeleteJob: async (jobId: string): Promise<void> => {
    // Delete related records first (in order to avoid FK constraints)
    await supabase.from('job_inventory_usage').delete().eq('job_id', jobId);
    await supabase.from('job_invoice_extra_charges').delete().eq('job_id', jobId);
    await supabase.from('job_invoices').delete().eq('job_id', jobId);
    await supabase.from('job_service_records').delete().eq('job_id', jobId);
    await supabase.from('job_status_history').delete().eq('job_id', jobId);
    await supabase.from('job_audit_log').delete().eq('job_id', jobId);
    await supabase.from('job_parts').delete().eq('job_id', jobId);
    await supabase.from('job_media').delete().eq('job_id', jobId);
    await supabase.from('extra_charges').delete().eq('job_id', jobId);
    
    const { error } = await supabase
      .from('jobs')
      .delete()
      .eq('job_id', jobId);

    if (error) throw new Error(error.message);
  },

  deleteCustomer: async (customerId: string): Promise<void> => {
    // Check for active (non-deleted) jobs only
    const { data: jobs } = await supabase
      .from('jobs')
      .select('job_id')
      .eq('customer_id', customerId)
      .is('deleted_at', null); // Exclude soft-deleted jobs
    
    if (jobs && jobs.length > 0) {
      throw new Error('Cannot delete customer with existing jobs. Delete the jobs first.');
    }

    const { error } = await supabase
      .from('customers')
      .delete()
      .eq('customer_id', customerId);

    if (error) throw new Error(error.message);
  },

  // =====================
  // INVENTORY/PARTS CRUD OPERATIONS
  // =====================

  createPart: async (partData: Partial<Part>): Promise<Part> => {
    const { data, error } = await supabase
      .from('parts')
      .insert({
        part_name: partData.part_name,
        part_code: partData.part_code,
        category: partData.category,
        cost_price: partData.cost_price || 0,
        sell_price: partData.sell_price || 0,
        warranty_months: partData.warranty_months || 0,
        stock_quantity: partData.stock_quantity || 0,
        min_stock_level: partData.min_stock_level || 10,
        supplier: partData.supplier,
        location: partData.location,
        last_updated_by: partData.last_updated_by,
        last_updated_by_name: partData.last_updated_by_name,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Part;
  },

  updatePart: async (partId: string, updates: Partial<Part>): Promise<Part> => {
    const { data, error } = await supabase
      .from('parts')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('part_id', partId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Part;
  },

  deletePart: async (partId: string): Promise<void> => {
    // Check if part is used in any jobs
    const { data: jobParts } = await supabase
      .from('job_parts')
      .select('job_part_id')
      .eq('part_id', partId);
    
    if (jobParts && jobParts.length > 0) {
      throw new Error('Cannot delete part that has been used in jobs. Set stock to 0 instead.');
    }

    const { error } = await supabase
      .from('parts')
      .delete()
      .eq('part_id', partId);

    if (error) throw new Error(error.message);
  },

  // =====================
  // JOB CONDITION & CHECKLIST OPERATIONS
  // =====================

  updateJobConditionChecklist: async (jobId: string, checklist: any): Promise<Job> => {
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
  },

  updateJobCarriedOut: async (jobId: string, jobCarriedOut: string, recommendation?: string): Promise<Job> => {
    // Update jobs table
    const { data, error } = await supabase
      .from('jobs')
      .update({ 
        job_carried_out: jobCarriedOut,
        recommendation: recommendation,
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
    
    // Also sync to job_service_records (required by completion validation)
    await supabase
      .from('job_service_records')
      .update({
        job_carried_out: jobCarriedOut,
        recommendation: recommendation,
        updated_at: new Date().toISOString(),
      })
      .eq('job_id', jobId);
    
    return data as Job;
  },

  // Update condition checklist (for editing after job started)
  updateConditionChecklist: async (jobId: string, checklist: any, userId?: string): Promise<Job> => {
    // Update jobs table
    const { data, error } = await supabase
      .from('jobs')
      .update({ 
        condition_checklist: checklist,
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
    
    // Also sync to job_service_records
    await supabase
      .from('job_service_records')
      .update({
        checklist_data: checklist,
        updated_at: new Date().toISOString(),
        updated_by: userId || null,
      })
      .eq('job_id', jobId);
    
    return data as Job;
  },

  // Set no parts used flag
  setNoPartsUsed: async (jobId: string, noPartsUsed: boolean): Promise<void> => {
    const { error } = await supabase
      .from('job_service_records')
      .update({
        no_parts_used: noPartsUsed,
        updated_at: new Date().toISOString(),
      })
      .eq('job_id', jobId);

    if (error) throw new Error(error.message);
  },

  // Get job service record (for loading no_parts_used flag etc)
  getJobServiceRecord: async (jobId: string): Promise<any> => {
    const { data, error } = await supabase
      .from('job_service_records')
      .select('*')
      .eq('job_id', jobId)
      .limit(1);

    if (error) {
      console.warn('Error fetching service record:', error.message);
      return null;
    }
    return data?.[0] ?? null;
  },

  updateJobRepairTimes: async (jobId: string, startTime?: string, endTime?: string): Promise<Job> => {
    const updates: any = {};
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
  },

  // Start job with condition check
  startJobWithCondition: async (
    jobId: string, 
    hourmeterReading: number, 
    checklist: any,
    startedById?: string,
    startedByName?: string
  ): Promise<Job> => {
    const now = new Date().toISOString();
    
    // First get the job's forklift to validate hourmeter
    const { data: jobData, error: fetchError } = await supabase
      .from('jobs')
      .select('forklift_id, forklift:forklifts!forklift_id(hourmeter)')
      .eq('job_id', jobId)
      .single();
    
    if (fetchError) throw new Error(fetchError.message);
    
    // Validate hourmeter reading is >= forklift's current reading
    const currentHourmeter = (jobData?.forklift as any)?.hourmeter || 0;
    if (hourmeterReading < currentHourmeter) {
      throw new Error(`Hourmeter reading (${hourmeterReading}) cannot be less than forklift's current reading (${currentHourmeter})`);
    }
    
    // Update jobs table
    const { data, error } = await supabase
      .from('jobs')
      .update({
        status: JobStatus.IN_PROGRESS,
        arrival_time: now,
        repair_start_time: now,
        hourmeter_reading: hourmeterReading,
        condition_checklist: checklist,
        // Audit: Job Started
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
    
    // Also update job_service_records with started_at (required by completion validation)
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
  },

  updateCustomer: async (customerId: string, updates: Partial<Customer>): Promise<Customer> => {
    const { data, error } = await supabase
      .from('customers')
      .update(updates)
      .eq('customer_id', customerId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as Customer;
  },

  // =====================
  // FORKLIFT RENTAL OPERATIONS
  // =====================

  // Get all rentals (with optional filters)
  getRentals: async (filters?: { forklift_id?: string; customer_id?: string; status?: RentalStatus }): Promise<ForkliftRental[]> => {
    try {
      let query = supabase
        .from('forklift_rentals')
        .select(`
          *,
          forklift:forklifts!forklift_rentals_forklift_id_fkey(*),
          customer:customers(*)
        `)
        .order('created_at', { ascending: false });

      if (filters?.forklift_id) {
        query = query.eq('forklift_id', filters.forklift_id);
      }
      if (filters?.customer_id) {
        query = query.eq('customer_id', filters.customer_id);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('Rentals query failed:', error.message);
        return [];
      }
      return data as ForkliftRental[];
    } catch (e) {
      console.warn('Rentals not available:', e);
      return [];
    }
  },

  // Get rentals for a specific forklift
  getForkliftRentals: async (forkliftId: string): Promise<ForkliftRental[]> => {
    try {
      const { data, error } = await supabase
        .from('forklift_rentals')
        .select(`
          *,
          customer:customers(*)
        `)
        .eq('forklift_id', forkliftId)
        .order('start_date', { ascending: false });

      if (error) {
        console.warn('Forklift rentals query failed:', error.message);
        return [];
      }
      return data as ForkliftRental[];
    } catch (e) {
      console.warn('Forklift rentals not available:', e);
      return [];
    }
  },

  // Get rentals for a specific customer
  getCustomerRentals: async (customerId: string): Promise<ForkliftRental[]> => {
    try {
      const { data, error } = await supabase
        .from('forklift_rentals')
        .select(`
          *,
          forklift:forklifts!forklift_rentals_forklift_id_fkey(*)
        `)
        .eq('customer_id', customerId)
        .order('start_date', { ascending: false });

      if (error) {
        console.warn('Customer rentals query failed:', error.message);
        return [];
      }
      return data as ForkliftRental[];
    } catch (e) {
      console.warn('Customer rentals not available:', e);
      return [];
    }
  },

  // Get active rentals for a customer
  getCustomerActiveRentals: async (customerId: string): Promise<ForkliftRental[]> => {
    try {
      const { data, error } = await supabase
        .from('forklift_rentals')
        .select(`
          *,
          forklift:forklifts!forklift_rentals_forklift_id_fkey(*)
        `)
        .eq('customer_id', customerId)
        .eq('status', 'active')
        .order('start_date', { ascending: false });

      if (error) {
        console.warn('Active rentals query failed:', error.message);
        return [];
      }
      return data as ForkliftRental[];
    } catch (e) {
      console.warn('Active rentals not available:', e);
      return [];
    }
  },

  // Assign forklift to customer (create rental)
  assignForkliftToCustomer: async (
    forkliftId: string, 
    customerId: string, 
    startDate: string, 
    endDate?: string,
    notes?: string,
    createdById?: string,
    createdByName?: string,
    monthlyRentalRate?: number
  ): Promise<ForkliftRental> => {
    // Check if forklift is already assigned
    const { data: existingRental } = await supabase
      .from('forklift_rentals')
      .select('rental_id')
      .eq('forklift_id', forkliftId)
      .eq('status', 'active')
      .single();

    if (existingRental) {
      throw new Error('Forklift is already assigned to a customer. End the current rental first.');
    }

    // Get customer address for location update
    const { data: customer } = await supabase
      .from('customers')
      .select('address')
      .eq('customer_id', customerId)
      .single();

    // Create the rental
    const { data, error } = await supabase
      .from('forklift_rentals')
      .insert({
        forklift_id: forkliftId,
        customer_id: customerId,
        start_date: startDate,
        end_date: endDate || null,
        status: 'active',
        notes: notes || null,
        rental_location: customer?.address || null,
        created_by_id: createdById || null,
        created_by_name: createdByName || null,
        monthly_rental_rate: monthlyRentalRate || 0,
        currency: 'RM',
      })
      .select(`
        *,
        forklift:forklifts!forklift_rentals_forklift_id_fkey(*),
        customer:customers(*)
      `)
      .single();

    if (error) throw new Error(error.message);

    // Update forklift with current customer and location
    await supabase
      .from('forklifts')
      .update({
        current_customer_id: customerId,
        location: customer?.address || null,
        updated_at: new Date().toISOString(),
      })
      .eq('forklift_id', forkliftId);

    return data as ForkliftRental;
  },

  // End a rental
  endRental: async (
    rentalId: string, 
    endDate?: string,
    endedById?: string,
    endedByName?: string
  ): Promise<ForkliftRental> => {
    // First get the rental to know which forklift to update
    const { data: rental } = await supabase
      .from('forklift_rentals')
      .select('forklift_id')
      .eq('rental_id', rentalId)
      .single();

    // Update the rental status
    const { data, error } = await supabase
      .from('forklift_rentals')
      .update({
        status: 'ended',
        end_date: endDate || new Date().toISOString().split('T')[0],
        ended_at: new Date().toISOString(),
        ended_by_id: endedById || null,
        ended_by_name: endedByName || null,
        updated_at: new Date().toISOString(),
      })
      .eq('rental_id', rentalId)
      .select(`
        *,
        forklift:forklifts!forklift_rentals_forklift_id_fkey(*),
        customer:customers(*)
      `)
      .single();

    if (error) throw new Error(error.message);

    // Clear the forklift's current customer
    if (rental?.forklift_id) {
      await supabase
        .from('forklifts')
        .update({
          current_customer_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('forklift_id', rental.forklift_id);
    }

    return data as ForkliftRental;
  },

  // Update rental dates and rate
  updateRental: async (rentalId: string, updates: { start_date?: string; end_date?: string; notes?: string; monthly_rental_rate?: number }): Promise<ForkliftRental> => {
    const { data, error } = await supabase
      .from('forklift_rentals')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('rental_id', rentalId)
      .select(`
        *,
        forklift:forklifts!forklift_rentals_forklift_id_fkey(*),
        customer:customers(*)
      `)
      .single();

    if (error) throw new Error(error.message);
    return data as ForkliftRental;
  },

  // =====================
  // BULK RENTAL OPERATIONS
  // =====================

  // Bulk assign multiple forklifts to a customer
  bulkAssignForkliftsToCustomer: async (
    forkliftIds: string[],
    customerId: string,
    startDate: string,
    endDate?: string,
    notes?: string,
    createdById?: string,
    createdByName?: string,
    monthlyRentalRate?: number
  ): Promise<{ success: ForkliftRental[]; failed: { forkliftId: string; error: string }[] }> => {
    const results: { success: ForkliftRental[]; failed: { forkliftId: string; error: string }[] } = {
      success: [],
      failed: []
    };

    // Get customer address for location update
    const { data: customer } = await supabase
      .from('customers')
      .select('address')
      .eq('customer_id', customerId)
      .single();

    for (const forkliftId of forkliftIds) {
      try {
        // Check if forklift is already assigned
        const { data: existingRental } = await supabase
          .from('forklift_rentals')
          .select('rental_id')
          .eq('forklift_id', forkliftId)
          .eq('status', 'active')
          .maybeSingle();

        if (existingRental) {
          results.failed.push({
            forkliftId,
            error: 'Already rented to another customer'
          });
          continue;
        }

        // Create the rental
        const { data, error } = await supabase
          .from('forklift_rentals')
          .insert({
            forklift_id: forkliftId,
            customer_id: customerId,
            start_date: startDate,
            end_date: endDate || null,
            status: 'active',
            notes: notes || null,
            rental_location: customer?.address || null,
            created_by_id: createdById || null,
            created_by_name: createdByName || null,
            monthly_rental_rate: monthlyRentalRate || 0,
            currency: 'RM',
          })
          .select(`
            *,
            forklift:forklifts!forklift_rentals_forklift_id_fkey(*),
            customer:customers(*)
          `)
          .single();

        if (error) {
          results.failed.push({
            forkliftId,
            error: error.message
          });
          continue;
        }

        // Update forklift with current customer and location
        await supabase
          .from('forklifts')
          .update({
            current_customer_id: customerId,
            location: customer?.address || null,
            updated_at: new Date().toISOString(),
          })
          .eq('forklift_id', forkliftId);

        results.success.push(data as ForkliftRental);
      } catch (e) {
        results.failed.push({
          forkliftId,
          error: (e as Error).message
        });
      }
    }

    return results;
  },

  // Bulk end multiple rentals
  bulkEndRentals: async (
    forkliftIds: string[],
    endDate?: string,
    endedById?: string,
    endedByName?: string
  ): Promise<{ success: ForkliftRental[]; failed: { forkliftId: string; error: string }[] }> => {
    const results: { success: ForkliftRental[]; failed: { forkliftId: string; error: string }[] } = {
      success: [],
      failed: []
    };

    for (const forkliftId of forkliftIds) {
      try {
        // Find the active rental for this forklift
        const { data: activeRental, error: findError } = await supabase
          .from('forklift_rentals')
          .select('rental_id')
          .eq('forklift_id', forkliftId)
          .eq('status', 'active')
          .maybeSingle();

        if (findError || !activeRental) {
          results.failed.push({
            forkliftId,
            error: 'No active rental found'
          });
          continue;
        }

        // Update the rental status
        const { data, error } = await supabase
          .from('forklift_rentals')
          .update({
            status: 'ended',
            end_date: endDate || new Date().toISOString().split('T')[0],
            ended_at: new Date().toISOString(),
            ended_by_id: endedById || null,
            ended_by_name: endedByName || null,
            updated_at: new Date().toISOString(),
          })
          .eq('rental_id', activeRental.rental_id)
          .select(`
            *,
            forklift:forklifts!forklift_rentals_forklift_id_fkey(*),
            customer:customers(*)
          `)
          .single();

        if (error) {
          results.failed.push({
            forkliftId,
            error: error.message
          });
          continue;
        }

        // Clear the forklift's current customer
        await supabase
          .from('forklifts')
          .update({
            current_customer_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq('forklift_id', forkliftId);

        results.success.push(data as ForkliftRental);
      } catch (e) {
        results.failed.push({
          forkliftId,
          error: (e as Error).message
        });
      }
    }

    return results;
  },

  // Get forklift with current customer info
  getForkliftWithCustomer: async (forkliftId: string): Promise<Forklift | null> => {
    try {
      // First try with customer join
      const { data, error } = await supabase
        .from('forklifts')
        .select(`
          *,
          current_customer:customers!forklifts_current_customer_id_fkey(*)
        `)
        .eq('forklift_id', forkliftId)
        .single();

      if (error) {
        // Fallback: get forklift without customer join
        console.warn('Forklift with customer query failed, falling back:', error.message);
        const { data: basicData, error: basicError } = await supabase
          .from('forklifts')
          .select('*')
          .eq('forklift_id', forkliftId)
          .single();
        
        if (basicError) return null;
        return basicData as Forklift;
      }
      return data as Forklift;
    } catch (e) {
      console.error('Error fetching forklift:', e);
      return null;
    }
  },

  // Get forklifts with their current customers (via active rentals)
  getForkliftsWithCustomers: async (): Promise<Forklift[]> => {
    try {
      // Get all forklifts
      const { data: forklifts, error: forkliftError } = await supabase
        .from('forklifts')
        .select('*')
        .order('serial_number');

      if (forkliftError) throw new Error(forkliftError.message);

      // Get all active rentals with customer info
      const { data: activeRentals, error: rentalError } = await supabase
        .from('forklift_rentals')
        .select(`
          forklift_id,
          customer_id,
          monthly_rental_rate,
          customer:customers(*)
        `)
        .eq('status', 'active');

      if (rentalError) {
        console.warn('Active rentals query failed:', rentalError.message);
        return forklifts as Forklift[];
      }

      // Map active rentals to forklifts
      const rentalMap = new Map();
      (activeRentals || []).forEach(rental => {
        rentalMap.set(rental.forklift_id, {
          current_customer_id: rental.customer_id,
          current_customer: rental.customer,
          monthly_rental_rate: rental.monthly_rental_rate,
        });
      });

      // Merge rental info into forklifts
      const forkliftsWithCustomers = (forklifts || []).map(forklift => {
        const rentalInfo = rentalMap.get(forklift.forklift_id);
        if (rentalInfo) {
          return { ...forklift, ...rentalInfo };
        }
        return forklift;
      });

      return forkliftsWithCustomers as Forklift[];
    } catch (e) {
      console.error('Error fetching forklifts:', e);
      // Ultimate fallback
      const { data, error } = await supabase
        .from('forklifts')
        .select('*')
        .order('serial_number');
      
      if (error) throw new Error(error.message);
      return data as Forklift[];
    }
  },

  // Get service history for a forklift (active jobs only)
  getForkliftServiceHistory: async (forkliftId: string): Promise<Job[]> => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          customer:customers(*),
          parts_used:job_parts(*),
          media:job_media(*),
          extra_charges:extra_charges(*)
        `)
        .eq('forklift_id', forkliftId)
        .is('deleted_at', null) // Exclude soft-deleted jobs
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Forklift service history query failed:', error.message);
        return [];
      }
      return data as Job[];
    } catch (e) {
      console.warn('Forklift service history not available:', e);
      return [];
    }
  },

  // Get service history for a forklift INCLUDING cancelled/deleted jobs
  // Returns both active and cancelled jobs, with is_cancelled flag
  getForkliftServiceHistoryWithCancelled: async (forkliftId: string): Promise<any[]> => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          customer:customers(*),
          parts_used:job_parts(*),
          media:job_media(*),
          extra_charges:extra_charges(*)
        `)
        .eq('forklift_id', forkliftId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Forklift service history with cancelled query failed:', error.message);
        return [];
      }

      // Add is_cancelled flag to each job
      return (data || []).map((job: any) => ({
        ...job,
        is_cancelled: job.deleted_at !== null,
      }));
    } catch (e) {
      console.warn('Forklift service history with cancelled not available:', e);
      return [];
    }
  },

  // Get service history for a customer INCLUDING cancelled/deleted jobs
  // Returns both active and cancelled jobs, with is_cancelled flag
  getCustomerJobsWithCancelled: async (customerId: string): Promise<any[]> => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          *,
          customer:customers(*),
          forklift:forklifts!forklift_id(*),
          parts_used:job_parts(*),
          media:job_media(*),
          extra_charges:extra_charges(*)
        `)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Customer jobs with cancelled query failed:', error.message);
        return [];
      }

      // Add is_cancelled flag to each job
      return (data || []).map((job: any) => ({
        ...job,
        is_cancelled: job.deleted_at !== null,
      }));
    } catch (e) {
      console.warn('Customer jobs with cancelled not available:', e);
      return [];
    }
  },

  // =====================
  // NOTIFICATION OPERATIONS
  // =====================

  getNotifications: async (userId: string, unreadOnly: boolean = false): Promise<Notification[]> => {
    try {
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (unreadOnly) {
        query = query.eq('is_read', false);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('Notifications query failed:', error.message);
        return [];
      }
      return data as Notification[];
    } catch (e) {
      console.warn('Notifications not available:', e);
      return [];
    }
  },

  getUnreadNotificationCount: async (userId: string): Promise<number> => {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) return 0;
      return count || 0;
    } catch (e) {
      return 0;
    }
  },

  /**
   * Creates a notification for a user.
   * Returns true on success, false on failure.
   * Note: Does not return the created notification object due to RLS constraints
   * (user A creating notification for user B cannot SELECT user B's notifications).
   */
  createNotification: async (notification: Partial<Notification>): Promise<boolean> => {
    try {
      // NOTE: Removed .select().single() to avoid RLS SELECT denial
      // When user A creates notification for user B, INSERT is allowed but
      // SELECT would fail because user A can't read user B's notifications
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: notification.user_id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          reference_type: notification.reference_type,
          reference_id: notification.reference_id,
          priority: notification.priority || 'normal',
        });

      if (error) {
        console.warn('Failed to create notification:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.warn('Notification creation failed:', e);
      return false;
    }
  },

  markNotificationRead: async (notificationId: string): Promise<void> => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('notification_id', notificationId);
    } catch (e) {
      console.warn('Failed to mark notification read:', e);
    }
  },

  markAllNotificationsRead: async (userId: string): Promise<void> => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('is_read', false);
    } catch (e) {
      console.warn('Failed to mark all notifications read:', e);
    }
  },

  // Notify technician of new job assignment
  notifyJobAssignment: async (technicianId: string, job: Job): Promise<void> => {
    await SupabaseDb.createNotification({
      user_id: technicianId,
      type: NotificationType.JOB_ASSIGNED,
      title: 'New Job Assigned',
      message: `You have been assigned to: ${job.title} - ${job.customer?.name || 'Unknown Customer'}`,
      reference_type: 'job',
      reference_id: job.job_id,
      priority: job.priority === 'Emergency' ? 'urgent' : job.priority === 'High' ? 'high' : 'normal',
    });
  },

  // Get all accountants for notifications
  getAccountants: async (): Promise<User[]> => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', UserRole.ACCOUNTANT)
      .eq('is_active', true);

    if (error) {
      console.warn('Failed to get accountants:', error.message);
      return [];
    }
    return data as User[];
  },

  // Notify all accountants of pending finalization
  notifyPendingFinalization: async (job: Job): Promise<void> => {
    try {
      // Get all active accountants
      const accountants = await SupabaseDb.getAccountants();
      
      // Also notify admins
      const { data: admins } = await supabase
        .from('users')
        .select('*')
        .eq('role', UserRole.ADMIN)
        .eq('is_active', true);

      const usersToNotify = [...accountants, ...(admins || [])];

      // Create notification for each accountant/admin
      for (const user of usersToNotify) {
        await SupabaseDb.createNotification({
          user_id: user.user_id,
          type: NotificationType.JOB_PENDING,
          title: 'Job Pending Finalization',
          message: `Job "${job.title}" for ${job.customer?.name || 'Unknown Customer'} is ready for invoice finalization.`,
          reference_type: 'job',
          reference_id: job.job_id,
          priority: job.priority === 'Emergency' ? 'urgent' : job.priority === 'High' ? 'high' : 'normal',
        });
      }
    } catch (e) {
      console.warn('Failed to notify pending finalization:', e);
    }
  },

  // Get all admins and supervisors for notifications
  getAdminsAndSupervisors: async (): Promise<User[]> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .in('role', [UserRole.ADMIN, UserRole.SUPERVISOR])
        .eq('is_active', true);

      if (error) {
        console.warn('Failed to get admins/supervisors:', error.message);
        return [];
      }
      return data as User[];
    } catch (e) {
      console.warn('Admins/supervisors fetch failed:', e);
      return [];
    }
  },

  // Notify all admins/supervisors of a new job request (helper, spare part, etc.)
  notifyAdminsOfRequest: async (
    requestType: 'assistance' | 'spare_part' | 'skillful_technician',
    technicianName: string,
    jobId: string,
    description: string
  ): Promise<void> => {
    try {
      const admins = await SupabaseDb.getAdminsAndSupervisors();
      
      const typeLabels: Record<string, { title: string; type: NotificationType }> = {
        'assistance': { title: 'Helper Request', type: NotificationType.HELPER_REQUEST },
        'spare_part': { title: 'Spare Part Request', type: NotificationType.SPARE_PART_REQUEST },
        'skillful_technician': { title: 'Skillful Technician Request', type: NotificationType.SKILLFUL_TECH_REQUEST },
      };

      const { title, type } = typeLabels[requestType] || { title: 'New Request', type: NotificationType.JOB_PENDING };

      for (const admin of admins) {
        await SupabaseDb.createNotification({
          user_id: admin.user_id,
          type: type,
          title: title,
          message: `${technicianName} requests ${requestType.replace('_', ' ')}: ${description.substring(0, 100)}${description.length > 100 ? '...' : ''}`,
          reference_type: 'job',
          reference_id: jobId,
          priority: requestType === 'assistance' ? 'high' : 'normal',
        });
      }
    } catch (e) {
      console.warn('Failed to notify admins of request:', e);
    }
  },

  // Notify technician when their request is approved
  notifyRequestApproved: async (
    technicianId: string,
    requestType: string,
    jobId: string,
    adminNotes?: string
  ): Promise<void> => {
    try {
      await SupabaseDb.createNotification({
        user_id: technicianId,
        type: NotificationType.REQUEST_APPROVED,
        title: 'Request Approved ✓',
        message: `Your ${requestType.replace('_', ' ')} request has been approved.${adminNotes ? ` Note: ${adminNotes}` : ''}`,
        reference_type: 'job',
        reference_id: jobId,
        priority: 'high',
      });
    } catch (e) {
      console.warn('Failed to notify request approved:', e);
    }
  },

  // Notify technician when their request is rejected
  notifyRequestRejected: async (
    technicianId: string,
    requestType: string,
    jobId: string,
    reason: string
  ): Promise<void> => {
    try {
      await SupabaseDb.createNotification({
        user_id: technicianId,
        type: NotificationType.REQUEST_REJECTED,
        title: 'Request Rejected',
        message: `Your ${requestType.replace('_', ' ')} request was rejected. Reason: ${reason}`,
        reference_type: 'job',
        reference_id: jobId,
        priority: 'high',
      });
    } catch (e) {
      console.warn('Failed to notify request rejected:', e);
    }
  },

  // Notify technician when job is reassigned to them
  notifyJobReassigned: async (
    newTechnicianId: string,
    jobTitle: string,
    jobId: string,
    previousTechnicianName?: string
  ): Promise<void> => {
    try {
      await SupabaseDb.createNotification({
        user_id: newTechnicianId,
        type: NotificationType.JOB_REASSIGNED,
        title: 'Job Reassigned to You',
        message: `Job "${jobTitle}" has been reassigned to you${previousTechnicianName ? ` from ${previousTechnicianName}` : ''}.`,
        reference_type: 'job',
        reference_id: jobId,
        priority: 'high',
      });
    } catch (e) {
      console.warn('Failed to notify job reassigned:', e);
    }
  },

  // =====================
  // SCHEDULED SERVICE OPERATIONS
  // =====================

  getScheduledServices: async (filters?: { forklift_id?: string; status?: string }): Promise<ScheduledService[]> => {
    try {
      let query = supabase
        .from('scheduled_services')
        .select(`
          *,
          forklift:forklifts!forklift_id(*)
        `)
        .order('due_date', { ascending: true });

      if (filters?.forklift_id) {
        query = query.eq('forklift_id', filters.forklift_id);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('Scheduled services query failed:', error.message);
        return [];
      }
      return data as ScheduledService[];
    } catch (e) {
      console.warn('Scheduled services not available:', e);
      return [];
    }
  },

  getUpcomingServices: async (daysAhead: number = 30): Promise<ScheduledService[]> => {
    try {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + daysAhead);

      const { data, error } = await supabase
        .from('scheduled_services')
        .select(`
          *,
          forklift:forklifts!forklift_id(*)
        `)
        .in('status', ['pending', 'scheduled'])
        .lte('due_date', futureDate.toISOString().split('T')[0])
        .order('due_date', { ascending: true });

      if (error) {
        console.warn('Upcoming services query failed:', error.message);
        return [];
      }
      return data as ScheduledService[];
    } catch (e) {
      console.warn('Upcoming services not available:', e);
      return [];
    }
  },

  createScheduledService: async (
    service: Partial<ScheduledService>,
    createdById?: string,
    createdByName?: string
  ): Promise<ScheduledService | null> => {
    try {
      const { data, error } = await supabase
        .from('scheduled_services')
        .insert({
          forklift_id: service.forklift_id,
          service_type: service.service_type,
          due_date: service.due_date,
          due_hourmeter: service.due_hourmeter,
          estimated_hours: service.estimated_hours,
          priority: service.priority || 'Medium',
          notes: service.notes,
          auto_create_job: service.auto_create_job ?? true,
          created_by_id: createdById,
          created_by_name: createdByName,
        })
        .select(`
          *,
          forklift:forklifts!forklift_id(*)
        `)
        .single();

      if (error) {
        console.warn('Failed to create scheduled service:', error.message);
        return null;
      }
      return data as ScheduledService;
    } catch (e) {
      console.warn('Scheduled service creation failed:', e);
      return null;
    }
  },

  updateScheduledService: async (
    scheduledId: string,
    updates: Partial<ScheduledService>
  ): Promise<ScheduledService | null> => {
    try {
      const { data, error } = await supabase
        .from('scheduled_services')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('scheduled_id', scheduledId)
        .select(`
          *,
          forklift:forklifts!forklift_id(*)
        `)
        .single();

      if (error) {
        console.warn('Failed to update scheduled service:', error.message);
        return null;
      }
      return data as ScheduledService;
    } catch (e) {
      console.warn('Scheduled service update failed:', e);
      return null;
    }
  },

  // Auto-create job from scheduled service
  createJobFromScheduledService: async (
    scheduledService: ScheduledService,
    technicianId: string,
    technicianName: string,
    createdById: string,
    createdByName: string
  ): Promise<Job | null> => {
    try {
      // Get forklift and customer details
      const forklift = scheduledService.forklift;
      if (!forklift || !forklift.current_customer_id) {
        console.warn('No customer associated with forklift');
        return null;
      }

      // Create the job
      const job = await SupabaseDb.createJob({
        customer_id: forklift.current_customer_id,
        title: `${scheduledService.service_type} - ${forklift.make} ${forklift.model}`,
        description: `Scheduled preventive maintenance: ${scheduledService.service_type}. ${scheduledService.notes || ''}`,
        priority: scheduledService.priority as JobPriority,
        job_type: JobType.SERVICE,
        status: JobStatus.ASSIGNED,
        assigned_technician_id: technicianId,
        assigned_technician_name: technicianName,
        forklift_id: forklift.forklift_id,
        scheduled_date: scheduledService.due_date,
      }, createdById, createdByName);

      if (job) {
        // Update scheduled service with job reference
        await SupabaseDb.updateScheduledService(scheduledService.scheduled_id, {
          status: 'scheduled',
          job_id: job.job_id,
          assigned_technician_id: technicianId,
          assigned_technician_name: technicianName,
        });

        // Notify technician
        await SupabaseDb.notifyJobAssignment(technicianId, job);
      }

      return job;
    } catch (e) {
      console.warn('Failed to create job from scheduled service:', e);
      return null;
    }
  },

  // =====================
  // RENTAL AMOUNT OPERATIONS
  // =====================

  updateRentalRate: async (rentalId: string, monthlyRate: number, currency: string = 'RM'): Promise<ForkliftRental | null> => {
    try {
      const { data, error } = await supabase
        .from('forklift_rentals')
        .update({
          monthly_rental_rate: monthlyRate,
          currency: currency,
          updated_at: new Date().toISOString(),
        })
        .eq('rental_id', rentalId)
        .select(`
          *,
          forklift:forklifts!forklift_rentals_forklift_id_fkey(*),
          customer:customers(*)
        `)
        .single();

      if (error) {
        console.warn('Failed to update rental rate:', error.message);
        return null;
      }
      return data as ForkliftRental;
    } catch (e) {
      console.warn('Rental rate update failed:', e);
      return null;
    }
  },

  // Get customer financial summary
  getCustomerFinancialSummary: async (customerId: string): Promise<any> => {
    try {
      // Get all rentals for customer
      const rentals = await SupabaseDb.getCustomerRentals(customerId);
      
      // Get all jobs for customer
      const { data: jobs } = await supabase
        .from('jobs')
        .select(`
          *,
          parts_used:job_parts(*),
          extra_charges:extra_charges(*)
        `)
        .eq('customer_id', customerId);

      // Calculate rental revenue
      let totalRentalRevenue = 0;
      rentals.forEach(rental => {
        const rate = (rental as any).monthly_rental_rate || 0;
        if (rate > 0) {
          const startDate = new Date(rental.start_date);
          const endDate = rental.end_date ? new Date(rental.end_date) : new Date();
          const months = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (30 * 24 * 60 * 60 * 1000)));
          totalRentalRevenue += rate * months;
        }
      });

      // Calculate service revenue
      let totalServiceRevenue = 0;
      let totalPartsRevenue = 0;
      let totalLaborRevenue = 0;
      let totalExtraCharges = 0;

      (jobs || []).forEach((job: any) => {
        const partsTotal = (job.parts_used || []).reduce((sum: number, p: any) => 
          sum + (p.sell_price_at_time * p.quantity), 0);
        const laborCost = job.labor_cost || 0;
        const extraCharges = (job.extra_charges || []).reduce((sum: number, c: any) => 
          sum + c.amount, 0);

        totalPartsRevenue += partsTotal;
        totalLaborRevenue += laborCost;
        totalExtraCharges += extraCharges;
        totalServiceRevenue += partsTotal + laborCost + extraCharges;
      });

      return {
        customer_id: customerId,
        total_rental_revenue: totalRentalRevenue,
        total_service_revenue: totalServiceRevenue,
        total_parts_revenue: totalPartsRevenue,
        total_labor_revenue: totalLaborRevenue,
        total_extra_charges: totalExtraCharges,
        grand_total: totalRentalRevenue + totalServiceRevenue,
        active_rentals: rentals.filter(r => r.status === 'active').length,
        total_jobs: (jobs || []).length,
      };
    } catch (e) {
      console.warn('Failed to get customer financial summary:', e);
      return null;
    }
  },

  // =====================
  // JOB REASSIGNMENT
  // =====================

  reassignJob: async (
    jobId: string,
    newTechnicianId: string,
    newTechnicianName: string,
    reassignedById: string,
    reassignedByName: string
  ): Promise<Job | null> => {
    try {
      // Get current job to notify old technician
      const currentJob = await SupabaseDb.getJobById(jobId);
      const oldTechnicianId = currentJob?.assigned_technician_id;

      const { data, error } = await supabase
        .from('jobs')
        .update({
          assigned_technician_id: newTechnicianId,
          assigned_technician_name: newTechnicianName,
          assigned_at: new Date().toISOString(),
          assigned_by_id: reassignedById,
          assigned_by_name: reassignedByName,
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

      if (error) {
        console.warn('Failed to reassign job:', error.message);
        return null;
      }

      const updatedJob = data as Job;

      // Notify new technician
      await SupabaseDb.notifyJobAssignment(newTechnicianId, updatedJob);

      // Notify old technician of reassignment (if different)
      if (oldTechnicianId && oldTechnicianId !== newTechnicianId) {
        await SupabaseDb.createNotification({
          user_id: oldTechnicianId,
          type: NotificationType.JOB_UPDATED,
          title: 'Job Reassigned',
          message: `Job "${updatedJob.title}" has been reassigned to another technician.`,
          reference_type: 'job',
          reference_id: jobId,
          priority: 'normal',
        });
      }

      return updatedJob;
    } catch (e) {
      console.warn('Job reassignment failed:', e);
      return null;
    }
  },

  // =====================
  // SERVICE DUE AUTOMATION
  // =====================

  // Get forklifts due for service within specified days
  getForkliftsDueForService: async (daysAhead: number = 7): Promise<any[]> => {
    try {
      const { data, error } = await supabase.rpc('get_forklifts_due_for_service', {
        p_days_ahead: daysAhead
      });

      if (error) {
        console.warn('Failed to get forklifts due for service:', error.message);
        // Fallback: Manual query if RPC not available
        return await SupabaseDb.getForkliftsDueForServiceFallback(daysAhead);
      }
      return data || [];
    } catch (e) {
      console.warn('Service due check failed:', e);
      return await SupabaseDb.getForkliftsDueForServiceFallback(daysAhead);
    }
  },

  // Fallback method if RPC is not available
  getForkliftsDueForServiceFallback: async (daysAhead: number = 7): Promise<any[]> => {
    try {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + daysAhead);
      const today = new Date().toISOString().split('T')[0];

      // Get forklifts due by date (without customer embed to avoid relationship ambiguity)
      const { data: forklifts, error } = await supabase
        .from('forklifts')
        .select('*')
        .eq('status', 'Active')
        .or(`next_service_due.lte.${futureDate.toISOString()}`);

      if (error) {
        console.warn('Fallback query failed:', error.message);
        return [];
      }

      // Check for open service jobs
      const forkliftIds = (forklifts || []).map(f => f.forklift_id);
      const { data: openJobs } = await supabase
        .from('jobs')
        .select('forklift_id')
        .in('forklift_id', forkliftIds)
        .in('status', ['New', 'Assigned', 'In Progress', 'Pending Parts'])
        .eq('job_type', 'Service');

      const forkliftsWithOpenJobs = new Set((openJobs || []).map(j => j.forklift_id));

      return (forklifts || []).map(f => {
        const daysUntilDue = f.next_service_due 
          ? Math.floor((new Date(f.next_service_due).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
          : null;
        const hoursUntilDue = f.next_service_hourmeter 
          ? f.next_service_hourmeter - f.hourmeter
          : null;
        const isOverdue = (daysUntilDue !== null && daysUntilDue < 0) || 
          (hoursUntilDue !== null && hoursUntilDue <= 0);

        return {
          ...f,
          days_until_due: daysUntilDue,
          hours_until_due: hoursUntilDue,
          is_overdue: isOverdue,
          has_open_job: forkliftsWithOpenJobs.has(f.forklift_id)
        };
      }).filter(f => !f.has_open_job); // Only return forklifts without open jobs
    } catch (e) {
      console.warn('Fallback query failed:', e);
      return [];
    }
  },

  // Auto-create service jobs for forklifts due
  autoCreateServiceJobs: async (
    daysAhead: number = 7,
    createdByName: string = 'System'
  ): Promise<{ created: number; skipped: number; results: any[] }> => {
    try {
      // Try RPC first
      const { data, error } = await supabase.rpc('auto_create_service_jobs', {
        p_days_ahead: daysAhead,
        p_created_by_name: createdByName
      });

      if (error) {
        console.warn('RPC auto_create_service_jobs failed:', error.message);
        // Fallback to manual creation
        return await SupabaseDb.autoCreateServiceJobsFallback(daysAhead, createdByName);
      }

      return {
        created: (data || []).filter((r: any) => r.action === 'CREATED').length,
        skipped: (data || []).filter((r: any) => r.action !== 'CREATED').length,
        results: data || []
      };
    } catch (e) {
      console.warn('Auto-create service jobs failed:', e);
      return await SupabaseDb.autoCreateServiceJobsFallback(daysAhead, createdByName);
    }
  },

  // Fallback for auto-creating service jobs
  autoCreateServiceJobsFallback: async (
    daysAhead: number = 7,
    createdByName: string = 'System'
  ): Promise<{ created: number; skipped: number; results: any[] }> => {
    const results: any[] = [];
    let created = 0;
    let skipped = 0;

    try {
      const dueForklifts = await SupabaseDb.getForkliftsDueForServiceFallback(daysAhead);
      console.log(`[Jobs] Found ${dueForklifts.length} forklifts due for service`);

      for (const forklift of dueForklifts) {
        if (forklift.has_open_job) {
          skipped++;
          results.push({
            forklift_serial: forklift.serial_number,
            action: 'SKIPPED',
            message: 'Open job already exists'
          });
          continue;
        }

        try {
          // ALWAYS check active rental FIRST for customer and location
          const { data: rental } = await supabase
            .from('forklift_rentals')
            .select('customer_id, rental_location, customers(name, address)')
            .eq('forklift_id', forklift.forklift_id)
            .eq('status', 'active')
            .maybeSingle();

          // Use rental customer if available, otherwise fall back to forklift's current_customer_id
          const customerId = rental?.customer_id || forklift.current_customer_id;
          const rentalLocation = rental?.rental_location;
          const customerName = (rental?.customers as any)?.name;

          console.log(`[Jobs] Creating job for ${forklift.serial_number}, customer: ${customerName || customerId || 'none'}, location: ${rentalLocation || 'not specified'}`);

          // Build description with location if available
          let description = `Preventive maintenance service.\n`;
          description += `Current hourmeter: ${forklift.hourmeter} hrs.\n`;
          description += `Next service at: ${forklift.next_service_hourmeter || 'N/A'} hrs.`;
          
          if (rentalLocation) {
            description += `\n\n📍 Location: ${rentalLocation}`;
          }
          if (customerName) {
            description += `\n👤 Customer: ${customerName}`;
          }

          // Create the job
          const { data: job, error: jobError } = await supabase
            .from('jobs')
            .insert({
              customer_id: customerId,
              forklift_id: forklift.forklift_id,
              title: `Scheduled Service - ${forklift.serial_number}`,
              description: description,
              job_type: 'Service',
              status: 'New',
              priority: forklift.is_overdue ? 'High' : ((forklift.days_until_due || 7) <= 3 ? 'Medium' : 'Low'),
              scheduled_date: forklift.next_service_due || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              created_by_name: createdByName
            })
            .select()
            .single();

          if (jobError) {
            skipped++;
            results.push({
              forklift_serial: forklift.serial_number,
              action: 'ERROR',
              message: jobError.message
            });
          } else {
            created++;
            results.push({
              forklift_serial: forklift.serial_number,
              job_id: job.job_id,
              action: 'CREATED',
              message: forklift.is_overdue ? 'OVERDUE!' : `Due in ${forklift.days_until_due} days`
            });
            
            // Also create notification for this new job
            await SupabaseDb.createServiceJobNotifications(forklift, job.job_id, rentalLocation);
          }
        } catch (e: any) {
          skipped++;
          results.push({
            forklift_serial: forklift.serial_number,
            action: 'ERROR',
            message: e.message
          });
        }
      }
    } catch (e) {
      console.warn('Fallback auto-create failed:', e);
    }

    return { created, skipped, results };
  },

  // Create service due notifications
  createServiceDueNotifications: async (daysAhead: number = 7): Promise<number> => {
    try {
      const { data, error } = await supabase.rpc('create_service_due_notifications', {
        p_days_ahead: daysAhead
      });

      if (error) {
        console.warn('RPC create_service_due_notifications failed:', error.message);
        // Fallback to manual notification creation
        return await SupabaseDb.createServiceDueNotificationsFallback(daysAhead);
      }

      return data || 0;
    } catch (e) {
      console.warn('Create notifications failed:', e);
      return await SupabaseDb.createServiceDueNotificationsFallback(daysAhead);
    }
  },

  // Fallback for creating notifications
  createServiceDueNotificationsFallback: async (daysAhead: number = 7): Promise<number> => {
    let count = 0;
    try {
      const dueForklifts = await SupabaseDb.getForkliftsDueForServiceFallback(daysAhead);
      console.log(`[Notifications] Found ${dueForklifts.length} forklifts due`);
      
      // Get admins and supervisors
      const { data: admins, error: adminsError } = await supabase
        .from('users')
        .select('user_id, name, role')
        .in('role', ['admin', 'supervisor', 'Admin', 'Supervisor'])
        .eq('is_active', true);

      console.log(`[Notifications] Found ${admins?.length || 0} admin/supervisor users`, admins);
      if (adminsError) {
        console.warn('[Notifications] Error fetching admins:', adminsError.message);
      }

      if (!admins || admins.length === 0) {
        console.warn('[Notifications] No admin/supervisor users found - cannot create notifications');
        return 0;
      }

      for (const forklift of dueForklifts) {
        for (const admin of admins) {
          // Check if notification already exists today
          const { data: existing } = await supabase
            .from('notifications')
            .select('notification_id')
            .eq('user_id', admin.user_id)
            .eq('reference_type', 'forklift')
            .eq('reference_id', forklift.forklift_id)
            .gte('created_at', new Date().toISOString().split('T')[0])
            .maybeSingle();

          if (!existing) {
            const result = await SupabaseDb.createNotification({
              user_id: admin.user_id,
              type: 'service_due' as any,
              title: forklift.is_overdue 
                ? `⚠️ Service OVERDUE: ${forklift.serial_number}`
                : `🔧 Service Due: ${forklift.serial_number}`,
              message: `${forklift.make} ${forklift.model} ${forklift.is_overdue ? 'is OVERDUE for service!' : `needs service in ${forklift.days_until_due} days.`} Current: ${forklift.hourmeter} hrs.`,
              reference_type: 'forklift',
              reference_id: forklift.forklift_id,
              priority: forklift.is_overdue ? 'urgent' : (forklift.days_until_due || 7) <= 3 ? 'high' : 'normal',
            });
            if (result) {
              count++;
              console.log(`[Notifications] Created notification for ${forklift.serial_number} -> ${admin.name}`);
            } else {
              console.warn(`[Notifications] Failed to create notification for ${forklift.serial_number}`);
            }
          } else {
            console.log(`[Notifications] Skipping - notification already exists for ${forklift.serial_number}`);
          }
        }
      }
    } catch (e) {
      console.warn('Fallback notification creation failed:', e);
    }
    return count;
  },

  // Run daily service check (call this from a scheduled task or manually)
  runDailyServiceCheck: async (): Promise<{
    notifications_created: number;
    jobs_created: number;
    overdue_updated: number;
  }> => {
    try {
      // Try RPC first
      const { data, error } = await supabase.rpc('daily_service_check');

      if (error) {
        console.warn('RPC daily_service_check failed:', error.message);
        // Fallback to manual checks
        const notifications = await SupabaseDb.createServiceDueNotifications(7);
        const jobsResult = await SupabaseDb.autoCreateServiceJobs(7, 'System');
        
        return {
          notifications_created: notifications,
          jobs_created: jobsResult.created,
          overdue_updated: 0
        };
      }

      // Parse RPC result
      const result = {
        notifications_created: 0,
        jobs_created: 0,
        overdue_updated: 0
      };
      
      (data || []).forEach((row: any) => {
        if (row.check_type === 'notifications') result.notifications_created = row.count;
        if (row.check_type === 'jobs_created') result.jobs_created = row.count;
        if (row.check_type === 'overdue_updated') result.overdue_updated = row.count;
      });

      return result;
    } catch (e) {
      console.warn('Daily service check failed:', e);
      return { notifications_created: 0, jobs_created: 0, overdue_updated: 0 };
    }
  },

  // Simulate making a forklift overdue (for testing)
  simulateOverdueForklift: async (forkliftId?: string): Promise<Forklift | null> => {
    try {
      let targetForkliftId = forkliftId;

      // If no forklift ID provided, get the first active one
      if (!targetForkliftId) {
        const { data: forklift } = await supabase
          .from('forklifts')
          .select('forklift_id')
          .eq('status', 'Active')
          .limit(1)
          .single();
        
        if (!forklift) return null;
        targetForkliftId = forklift.forklift_id;
      }

      // Set next_service_due to yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      // First get the current hourmeter to calculate a proper overdue value
      const { data: current } = await supabase
        .from('forklifts')
        .select('hourmeter, service_interval_hours')
        .eq('forklift_id', targetForkliftId)
        .single();
      
      // Set next_service_hourmeter to current - 100 (so it's 100 hours overdue)
      const overdueHourmeter = (current?.hourmeter || 1000) - 100;

      const { data, error } = await supabase
        .from('forklifts')
        .update({
          next_service_due: yesterday.toISOString(),
          next_service_hourmeter: overdueHourmeter,
        })
        .eq('forklift_id', targetForkliftId)
        .select()
        .single();

      if (error) {
        console.warn('Failed to simulate overdue:', error.message);
        return null;
      }

      return data as Forklift;
    } catch (e) {
      console.warn('Simulate overdue failed:', e);
      return null;
    }
  },

  // Reset service schedule for all forklifts (fixes corrupted data)
  resetAllServiceSchedules: async (): Promise<{ updated: number; errors: string[] }> => {
    const errors: string[] = [];
    let updated = 0;

    try {
      // Get all active forklifts
      const { data: forklifts, error } = await supabase
        .from('forklifts')
        .select('forklift_id, serial_number, hourmeter, service_interval_hours, avg_daily_usage')
        .eq('status', 'Active');

      if (error) {
        return { updated: 0, errors: [error.message] };
      }

      // Update each forklift with proper next_service values
      for (const f of forklifts || []) {
        const interval = f.service_interval_hours || 500;
        const avgUsage = f.avg_daily_usage || 8;
        const nextHourmeter = (f.hourmeter || 0) + interval;
        const daysUntil = Math.ceil(interval / avgUsage);
        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + daysUntil);

        const { error: updateError } = await supabase
          .from('forklifts')
          .update({
            next_service_hourmeter: nextHourmeter,
            next_service_due: nextDate.toISOString(),
          })
          .eq('forklift_id', f.forklift_id);

        if (updateError) {
          errors.push(`${f.serial_number}: ${updateError.message}`);
        } else {
          updated++;
        }
      }

      return { updated, errors };
    } catch (e) {
      return { updated, errors: [`Unexpected error: ${e}`] };
    }
  },

  // Create notifications when a service job is created
  createServiceJobNotifications: async (forklift: any, jobId: string, location?: string): Promise<number> => {
    let count = 0;
    try {
      // Get admins and supervisors
      const { data: admins } = await supabase
        .from('users')
        .select('user_id, name')
        .in('role', ['admin', 'supervisor', 'Admin', 'Supervisor'])
        .eq('is_active', true);

      if (!admins || admins.length === 0) {
        console.log('[Notifications] No admin/supervisor users found');
        return 0;
      }

      const isOverdue = forklift.is_overdue;
      const locationStr = location ? ` at ${location}` : '';
      
      for (const admin of admins) {
        try {
          const { error } = await supabase
            .from('notifications')
            .insert({
              user_id: admin.user_id,
              type: 'job_created',
              title: isOverdue 
                ? `⚠️ OVERDUE Service Job Created: ${forklift.serial_number}`
                : `🔧 Service Job Created: ${forklift.serial_number}`,
              message: `${forklift.make || ''} ${forklift.model || ''} ${forklift.serial_number}${locationStr} - ${isOverdue ? 'OVERDUE for service!' : `Service due in ${forklift.days_until_due || 7} days.`} Hourmeter: ${forklift.hourmeter} hrs.`,
              reference_type: 'job',
              reference_id: jobId,
              priority: isOverdue ? 'urgent' : 'high',
            });

          if (!error) {
            count++;
            console.log(`[Notifications] Created job notification for ${forklift.serial_number} -> ${admin.name}`);
          } else {
            console.warn(`[Notifications] Failed to create notification:`, error.message);
          }
        } catch (e) {
          console.warn(`[Notifications] Error creating notification for ${admin.name}:`, e);
        }
      }
    } catch (e) {
      console.warn('Service job notifications failed:', e);
    }
    return count;
  },

  // =====================
  // SERVICE INTERVALS CONFIG
  // =====================

  // Get all service intervals
  getServiceIntervals: async (): Promise<any[]> => {
    try {
      const { data, error } = await supabase
        .from('service_intervals')
        .select('*')
        .order('forklift_type', { ascending: true })
        .order('hourmeter_interval', { ascending: true });

      if (error) {
        console.error('Failed to fetch service intervals:', error.message);
        return [];
      }
      return data || [];
    } catch (e) {
      console.error('Service intervals fetch error:', e);
      return [];
    }
  },

  // Get service intervals by forklift type
  getServiceIntervalsByType: async (forkliftType: string): Promise<any[]> => {
    try {
      const { data, error } = await supabase
        .from('service_intervals')
        .select('*')
        .eq('forklift_type', forkliftType)
        .eq('is_active', true)
        .order('hourmeter_interval', { ascending: true });

      if (error) {
        console.error('Failed to fetch service intervals by type:', error.message);
        return [];
      }
      return data || [];
    } catch (e) {
      console.error('Service intervals by type fetch error:', e);
      return [];
    }
  },

  // Create a new service interval
  createServiceInterval: async (interval: {
    forklift_type: string;
    service_type: string;
    hourmeter_interval: number;
    calendar_interval_days?: number;
    priority?: string;
    checklist_items?: string[];
    estimated_duration_hours?: number;
    name?: string;
  }): Promise<any | null> => {
    try {
      const { data, error } = await supabase
        .from('service_intervals')
        .insert({
          forklift_type: interval.forklift_type,
          service_type: interval.service_type,
          hourmeter_interval: interval.hourmeter_interval,
          calendar_interval_days: interval.calendar_interval_days || null,
          priority: interval.priority || 'Medium',
          checklist_items: interval.checklist_items || [],
          estimated_duration_hours: interval.estimated_duration_hours || null,
          name: interval.name || interval.service_type,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to create service interval:', error.message);
        return null;
      }
      return data;
    } catch (e) {
      console.error('Service interval create error:', e);
      return null;
    }
  },

  // Update a service interval
  updateServiceInterval: async (
    intervalId: string,
    updates: {
      forklift_type?: string;
      service_type?: string;
      hourmeter_interval?: number;
      calendar_interval_days?: number | null;
      priority?: string;
      checklist_items?: string[];
      estimated_duration_hours?: number | null;
      name?: string;
      is_active?: boolean;
    }
  ): Promise<any | null> => {
    try {
      const { data, error } = await supabase
        .from('service_intervals')
        .update(updates)
        .eq('interval_id', intervalId)
        .select()
        .single();

      if (error) {
        console.error('Failed to update service interval:', error.message);
        return null;
      }
      return data;
    } catch (e) {
      console.error('Service interval update error:', e);
      return null;
    }
  },

  // Delete (deactivate) a service interval
  deleteServiceInterval: async (intervalId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('service_intervals')
        .update({ is_active: false })
        .eq('interval_id', intervalId);

      if (error) {
        console.error('Failed to delete service interval:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.error('Service interval delete error:', e);
      return false;
    }
  },

  // Hard delete a service interval (use with caution)
  hardDeleteServiceInterval: async (intervalId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('service_intervals')
        .delete()
        .eq('interval_id', intervalId);

      if (error) {
        console.error('Failed to hard delete service interval:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.error('Service interval hard delete error:', e);
      return false;
    }
  },

  // =====================
  // JOB ASSIGNMENTS (Helper Technician)
  // =====================

  // Get all assignments for a job
  getJobAssignments: async (jobId: string): Promise<JobAssignment[]> => {
    try {
      const { data, error } = await supabase
        .from('job_assignments')
        .select(`
          *,
          technician:users!job_assignments_technician_id_fkey(user_id, name, email, phone, role)
        `)
        .eq('job_id', jobId)
        .order('assigned_at', { ascending: false });

      if (error) {
        console.error('Failed to get job assignments:', error.message);
        return [];
      }
      return data || [];
    } catch (e) {
      console.error('Job assignments fetch error:', e);
      return [];
    }
  },

  // Get active helper assignment for a job
  getActiveHelper: async (jobId: string): Promise<JobAssignment | null> => {
    try {
      const { data, error } = await supabase
        .from('job_assignments')
        .select(`
          *,
          technician:users!job_assignments_technician_id_fkey(user_id, name, email, phone, role)
        `)
        .eq('job_id', jobId)
        .eq('assignment_type', 'assistant')
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('Failed to get active helper:', error.message);
        return null;
      }
      return data || null;
    } catch (e) {
      console.error('Active helper fetch error:', e);
      return null;
    }
  },

  // Assign helper to a job
  assignHelper: async (
    jobId: string,
    technicianId: string,
    assignedById: string,
    notes?: string
  ): Promise<JobAssignment | null> => {
    try {
      // First, deactivate any existing active helper
      await supabase
        .from('job_assignments')
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq('job_id', jobId)
        .eq('assignment_type', 'assistant')
        .eq('is_active', true);

      // Create new helper assignment
      const { data, error } = await supabase
        .from('job_assignments')
        .insert({
          job_id: jobId,
          technician_id: technicianId,
          assignment_type: 'assistant',
          assigned_by: assignedById,
          notes: notes || null,
          is_active: true,
        })
        .select(`
          *,
          technician:users!job_assignments_technician_id_fkey(user_id, name, email, phone, role)
        `)
        .single();

      if (error) {
        console.error('Failed to assign helper:', error.message);
        return null;
      }
      return data;
    } catch (e) {
      console.error('Helper assignment error:', e);
      return null;
    }
  },

  // Remove helper from a job
  removeHelper: async (jobId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('job_assignments')
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq('job_id', jobId)
        .eq('assignment_type', 'assistant')
        .eq('is_active', true);

      if (error) {
        console.error('Failed to remove helper:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.error('Helper removal error:', e);
      return false;
    }
  },

  // Start helper's work (log start time)
  startHelperWork: async (assignmentId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('job_assignments')
        .update({ started_at: new Date().toISOString() })
        .eq('assignment_id', assignmentId);

      if (error) {
        console.error('Failed to start helper work:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.error('Helper start work error:', e);
      return false;
    }
  },

  // End helper's work (log end time)
  endHelperWork: async (assignmentId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('job_assignments')
        .update({ ended_at: new Date().toISOString() })
        .eq('assignment_id', assignmentId);

      if (error) {
        console.error('Failed to end helper work:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.error('Helper end work error:', e);
      return false;
    }
  },

  // Get all jobs where user is assigned as helper
  getHelperJobs: async (technicianId: string): Promise<string[]> => {
    try {
      const { data, error } = await supabase
        .from('job_assignments')
        .select('job_id')
        .eq('technician_id', technicianId)
        .eq('assignment_type', 'assistant')
        .eq('is_active', true);

      if (error) {
        console.error('Failed to get helper jobs:', error.message);
        return [];
      }
      return data?.map(d => d.job_id) || [];
    } catch (e) {
      console.error('Helper jobs fetch error:', e);
      return [];
    }
  },

  // Check if user is helper on a specific job
  isUserHelperOnJob: async (jobId: string, userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('job_assignments')
        .select('assignment_id')
        .eq('job_id', jobId)
        .eq('technician_id', userId)
        .eq('assignment_type', 'assistant')
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Failed to check helper status:', error.message);
        return false;
      }
      return !!data;
    } catch (e) {
      console.error('Helper status check error:', e);
      return false;
    }
  },

  // Get user's assignment type on a job (lead, assistant, or null)
  getUserAssignmentType: async (jobId: string, userId: string): Promise<'lead' | 'assistant' | null> => {
    try {
      // Check if user is the assigned technician (lead)
      const { data: job } = await supabase
        .from('jobs')
        .select('assigned_technician_id')
        .eq('job_id', jobId)
        .single();

      if (job?.assigned_technician_id === userId) {
        return 'lead';
      }

      // Check if user is an active helper
      const { data: assignment } = await supabase
        .from('job_assignments')
        .select('assignment_type')
        .eq('job_id', jobId)
        .eq('technician_id', userId)
        .eq('is_active', true)
        .single();

      if (assignment?.assignment_type === 'assistant') {
        return 'assistant';
      }

      return null;
    } catch (e) {
      console.error('Assignment type check error:', e);
      return null;
    }
  },

  // =====================
  // JOB REQUESTS (In-Job Request System)
  // =====================

  // Create a new job request
  createJobRequest: async (
    jobId: string,
    requestType: 'assistance' | 'spare_part' | 'skillful_technician',
    requestedBy: string,
    description: string,
    photoUrl?: string
  ): Promise<{ request_id: string } | null> => {
    try {
      const { data, error } = await supabase
        .from('job_requests')
        .insert({
          job_id: jobId,
          request_type: requestType,
          requested_by: requestedBy,
          description: description,
          photo_url: photoUrl || null,
          status: 'pending',
        })
        .select('request_id')
        .single();

      if (error) {
        console.error('Failed to create job request:', error.message);
        return null;
      }

      // Notify admins/supervisors of the new request
      const { data: technician } = await supabase
        .from('users')
        .select('name, full_name')
        .eq('user_id', requestedBy)
        .single();
      
      const techName = technician?.full_name || technician?.name || 'Technician';
      await SupabaseDb.notifyAdminsOfRequest(requestType, techName, jobId, description);

      return data;
    } catch (e) {
      console.error('Job request create error:', e);
      return null;
    }
  },

  // Get all requests for a job
  getJobRequests: async (jobId: string): Promise<any[]> => {
    try {
      const { data, error } = await supabase
        .from('job_requests')
        .select(`
          *,
          requested_by_user:users!job_requests_requested_by_fkey(user_id, name, full_name),
          responded_by_user:users!job_requests_responded_by_fkey(user_id, name, full_name),
          admin_response_part:parts!job_requests_admin_response_part_id_fkey(part_id, part_name, sell_price)
        `)
        .eq('job_id', jobId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to get job requests:', error.message);
        return [];
      }
      return data || [];
    } catch (e) {
      console.error('Job requests fetch error:', e);
      return [];
    }
  },

  // Get pending requests for admin dashboard
  getPendingRequests: async (): Promise<any[]> => {
    try {
      const { data, error } = await supabase
        .from('job_requests')
        .select(`
          *,
          job:jobs(job_id, description, status, forklift:forklifts!forklift_id(serial_number, make, model)),
          requested_by_user:users!job_requests_requested_by_fkey(user_id, name, full_name)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Failed to get pending requests:', error.message);
        return [];
      }
      return data || [];
    } catch (e) {
      console.error('Pending requests fetch error:', e);
      return [];
    }
  },

  // Approve a spare part request
  approveSparePartRequest: async (
    requestId: string,
    adminUserId: string,
    partId: string,
    quantity: number,
    notes?: string
  ): Promise<boolean> => {
    try {
      // Get the request to find job_id
      const { data: request, error: reqError } = await supabase
        .from('job_requests')
        .select('job_id, requested_by')
        .eq('request_id', requestId)
        .single();

      if (reqError || !request) {
        console.error('Request not found:', reqError?.message);
        return false;
      }

      // Get part details (use part_name, not name)
      const { data: part, error: partError } = await supabase
        .from('parts')
        .select('part_name, sell_price, stock_quantity')
        .eq('part_id', partId)
        .single();

      if (partError || !part) {
        console.error('Part not found:', partError?.message);
        return false;
      }

      // Check stock
      if (part.stock_quantity < quantity) {
        console.error('Insufficient stock');
        return false;
      }

      // Update request status
      const { error: updateError } = await supabase
        .from('job_requests')
        .update({
          status: 'approved',
          admin_response_part_id: partId,
          admin_response_quantity: quantity,
          admin_response_notes: notes || null,
          responded_by: adminUserId,
          responded_at: new Date().toISOString(),
        })
        .eq('request_id', requestId);

      if (updateError) {
        console.error('Failed to update request:', updateError.message);
        return false;
      }

      // Add part to job_parts table (not jobs.parts_used)
      const { error: insertError } = await supabase
        .from('job_parts')
        .insert({
          job_id: request.job_id,
          part_id: partId,
          part_name: part.part_name,
          quantity: quantity,
          sell_price_at_time: part.sell_price,
          // Note: added_via_request_id would need schema change, tracked via request record instead
        });

      if (insertError) {
        console.error('Failed to add part to job:', insertError.message);
        return false;
      }

      // Update stock quantity
      const { error: stockError } = await supabase
        .from('parts')
        .update({ stock_quantity: part.stock_quantity - quantity })
        .eq('part_id', partId);

      if (stockError) {
        console.error('Failed to update stock:', stockError.message);
        // Part was added but stock not updated - log but don't fail
      }

      // Notify technician that their spare part request was approved
      await SupabaseDb.notifyRequestApproved(
        request.requested_by,
        'spare_part',
        request.job_id,
        notes || `${quantity}x ${part.part_name} added to your job`
      );

      return true;
    } catch (e) {
      console.error('Approve spare part request error:', e);
      return false;
    }
  },

  // Reject a request
  rejectRequest: async (
    requestId: string,
    adminUserId: string,
    reason: string
  ): Promise<boolean> => {
    try {
      // First get the request details for notification
      const { data: request, error: reqError } = await supabase
        .from('job_requests')
        .select('job_id, requested_by, request_type')
        .eq('request_id', requestId)
        .single();

      if (reqError || !request) {
        console.error('Request not found for rejection:', reqError?.message);
        return false;
      }

      const { error } = await supabase
        .from('job_requests')
        .update({
          status: 'rejected',
          admin_response_notes: reason,
          responded_by: adminUserId,
          responded_at: new Date().toISOString(),
        })
        .eq('request_id', requestId);

      if (error) {
        console.error('Failed to reject request:', error.message);
        return false;
      }

      // Notify technician that their request was rejected
      await SupabaseDb.notifyRequestRejected(
        request.requested_by,
        request.request_type,
        request.job_id,
        reason
      );

      return true;
    } catch (e) {
      console.error('Reject request error:', e);
      return false;
    }
  },

  // Acknowledge skillful technician request (marks as approved, reassignment done separately)
  acknowledgeSkillfulTechRequest: async (
    requestId: string,
    adminUserId: string,
    notes?: string
  ): Promise<boolean> => {
    try {
      // First get the request details for notification
      const { data: request, error: reqError } = await supabase
        .from('job_requests')
        .select('job_id, requested_by, request_type')
        .eq('request_id', requestId)
        .single();

      if (reqError || !request) {
        console.error('Request not found:', reqError?.message);
        return false;
      }

      const { error } = await supabase
        .from('job_requests')
        .update({
          status: 'approved',
          admin_response_notes: notes || 'Acknowledged - Job will be reassigned to skilled technician',
          responded_by: adminUserId,
          responded_at: new Date().toISOString(),
        })
        .eq('request_id', requestId);

      if (error) {
        console.error('Failed to acknowledge skillful tech request:', error.message);
        return false;
      }

      // Notify technician that their skillful tech request was acknowledged
      await SupabaseDb.notifyRequestApproved(
        request.requested_by,
        'skillful_technician',
        request.job_id,
        notes || 'Your request has been acknowledged. Job will be reassigned.'
      );

      return true;
    } catch (e) {
      console.error('Acknowledge skillful tech request error:', e);
      return false;
    }
  },

  // Approve assistance request (assigns helper)
  approveAssistanceRequest: async (
    requestId: string,
    adminUserId: string,
    helperTechnicianId: string,
    notes?: string
  ): Promise<boolean> => {
    try {
      // Get the request to find job_id and requester
      const { data: request, error: reqError } = await supabase
        .from('job_requests')
        .select('job_id, requested_by')
        .eq('request_id', requestId)
        .single();

      if (reqError || !request) {
        console.error('Request not found:', reqError?.message);
        return false;
      }

      // Get job details for notifications
      const { data: job } = await supabase
        .from('jobs')
        .select('title, description')
        .eq('job_id', request.job_id)
        .single();

      // Get helper technician name
      const { data: helper } = await supabase
        .from('users')
        .select('name, full_name')
        .eq('user_id', helperTechnicianId)
        .single();

      const helperName = helper?.full_name || helper?.name || 'Helper';
      const jobTitle = job?.title || 'Job';

      // Update request status
      const { error: updateError } = await supabase
        .from('job_requests')
        .update({
          status: 'approved',
          admin_response_notes: notes || null,
          responded_by: adminUserId,
          responded_at: new Date().toISOString(),
        })
        .eq('request_id', requestId);

      if (updateError) {
        console.error('Failed to update request:', updateError.message);
        return false;
      }

      // Assign helper using existing function
      const result = await SupabaseDb.assignHelper(
        request.job_id,
        helperTechnicianId,
        adminUserId,
        notes || 'Assigned via assistance request'
      );

      if (result) {
        // Notify the original technician that their request was approved
        await SupabaseDb.notifyRequestApproved(
          request.requested_by,
          'assistance',
          request.job_id,
          `${helperName} has been assigned to help you.`
        );

        // Notify the helper technician that they've been assigned
        await SupabaseDb.createNotification({
          user_id: helperTechnicianId,
          type: NotificationType.JOB_ASSIGNED,
          title: 'Helper Assignment',
          message: `You have been assigned to help with: ${jobTitle}`,
          reference_type: 'job',
          reference_id: request.job_id,
          priority: 'high',
        });
      }

      return result !== null;
    } catch (e) {
      console.error('Approve assistance request error:', e);
      return false;
    }
  },

  // Get request counts by status for badge display
  getRequestCounts: async (): Promise<{ pending: number; total: number }> => {
    try {
      const { count: pending, error: pendingError } = await supabase
        .from('job_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      const { count: total, error: totalError } = await supabase
        .from('job_requests')
        .select('*', { count: 'exact', head: true });

      if (pendingError || totalError) {
        return { pending: 0, total: 0 };
      }

      return { pending: pending || 0, total: total || 0 };
    } catch (e) {
      console.error('Request counts error:', e);
      return { pending: 0, total: 0 };
    }
  },

  // ==========================================================================
  // MULTI-DAY ESCALATION (#7)
  // ==========================================================================

  // Get all public holidays
  getPublicHolidays: async (year?: number): Promise<any[]> => {
    try {
      let query = supabase.from('public_holidays').select('*');
      if (year) {
        query = query.eq('year', year);
      }
      const { data, error } = await query.order('holiday_date', { ascending: true });
      if (error) {
        console.error('Failed to get holidays:', error.message);
        return [];
      }
      return data || [];
    } catch (e) {
      console.error('Get holidays error:', e);
      return [];
    }
  },

  // Get app setting by key
  getAppSetting: async (key: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', key)
        .single();
      if (error) {
        console.error('Failed to get setting:', error.message);
        return null;
      }
      return data?.value || null;
    } catch (e) {
      console.error('Get setting error:', e);
      return null;
    }
  },

  // Update app setting
  updateAppSetting: async (key: string, value: string, updatedBy?: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('app_settings')
        .update({ 
          value, 
          updated_at: new Date().toISOString(),
          updated_by: updatedBy || null 
        })
        .eq('key', key);
      if (error) {
        console.error('Failed to update setting:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.error('Update setting error:', e);
      return false;
    }
  },

  // Mark job to continue tomorrow (multi-day)
  markJobContinueTomorrow: async (
    jobId: string,
    reason: string,
    userId: string,
    userName: string
  ): Promise<boolean> => {
    try {
      const now = new Date().toISOString();
      
      // Fetch current notes (JSONB)
      const { data: job, error: fetchError } = await supabase
        .from('jobs')
        .select('notes')
        .eq('job_id', jobId)
        .single();
      
      if (fetchError) {
        console.error('Failed to fetch job notes:', fetchError.message);
        return false;
      }
      
      // Append new note to JSONB array
      const currentNotes = Array.isArray(job?.notes) ? job.notes : [];
      const updatedNotes = [...currentNotes, {
        text: `Job marked to continue: ${reason}`,
        created_at: now,
        created_by: userName
      }];
      
      // Update job status, cutoff time, and notes
      const { error } = await supabase
        .from('jobs')
        .update({
          status: 'Incomplete - Continuing',
          cutoff_time: now,
          notes: updatedNotes
        })
        .eq('job_id', jobId);

      if (error) {
        console.error('Failed to mark job continue:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.error('Mark job continue error:', e);
      return false;
    }
  },

  // Resume a multi-day job
  resumeMultiDayJob: async (jobId: string, userId: string, userName: string): Promise<boolean> => {
    try {
      const now = new Date().toISOString();
      
      // Fetch current notes (JSONB)
      const { data: job, error: fetchError } = await supabase
        .from('jobs')
        .select('notes')
        .eq('job_id', jobId)
        .single();
      
      if (fetchError) {
        console.error('Failed to fetch job notes:', fetchError.message);
        return false;
      }
      
      // Append new note to JSONB array
      const currentNotes = Array.isArray(job?.notes) ? job.notes : [];
      const updatedNotes = [...currentNotes, {
        text: 'Job resumed',
        created_at: now,
        created_by: userName
      }];
      
      const { error } = await supabase
        .from('jobs')
        .update({
          status: 'In Progress',
          notes: updatedNotes
        })
        .eq('job_id', jobId);

      if (error) {
        console.error('Failed to resume job:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.error('Resume job error:', e);
      return false;
    }
  },

  // Get jobs that need escalation check
  getJobsNeedingEscalation: async (): Promise<any[]> => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          job_id, title, status, created_at, scheduled_date, cutoff_time,
          is_overtime, escalation_triggered_at,
          assigned_technician_id, assigned_technician_name,
          customer:customers(name)
        `)
        .is('escalation_triggered_at', null)
        .is('deleted_at', null)
        .eq('is_overtime', false)
        .in('status', ['Assigned', 'In Progress', 'Incomplete - Continuing']);

      if (error) {
        console.error('Failed to get escalation jobs:', error.message);
        return [];
      }
      return data || [];
    } catch (e) {
      console.error('Get escalation jobs error:', e);
      return [];
    }
  },

  // Trigger escalation for a job (mark as escalated, admin will be notified)
  triggerEscalation: async (jobId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('jobs')
        .update({
          escalation_triggered_at: new Date().toISOString()
        })
        .eq('job_id', jobId);

      if (error) {
        console.error('Failed to trigger escalation:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.error('Trigger escalation error:', e);
      return false;
    }
  },

  // Mark job as overtime (disables escalation)
  markJobAsOvertime: async (jobId: string, isOvertime: boolean): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ is_overtime: isOvertime })
        .eq('job_id', jobId);

      if (error) {
        console.error('Failed to update overtime status:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.error('Update overtime error:', e);
      return false;
    }
  },

  // Get escalated jobs for admin dashboard (enhanced with ack tracking)
  getEscalatedJobs: async (): Promise<any[]> => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          job_id, title, status, created_at, scheduled_date, cutoff_time,
          escalation_triggered_at, escalation_acknowledged_at, 
          escalation_acknowledged_by, escalation_notes,
          assigned_technician_id, assigned_technician_name,
          customer:customers(name, phone, email),
          forklift:forklifts!forklift_id(serial_number, model),
          technician:users!jobs_assigned_technician_id_fkey(phone)
        `)
        .not('escalation_triggered_at', 'is', null)
        .is('deleted_at', null)
        .not('status', 'in', '("Completed","Completed Awaiting Acknowledgement")')
        .order('escalation_acknowledged_at', { ascending: true, nullsFirst: true })
        .order('escalation_triggered_at', { ascending: false });

      if (error) {
        console.error('Failed to get escalated jobs:', error.message);
        return [];
      }
      return data || [];
    } catch (e) {
      console.error('Get escalated jobs error:', e);
      return [];
    }
  },

  // Acknowledge an escalated job (Admin takes ownership)
  acknowledgeEscalation: async (jobId: string, userId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('jobs')
        .update({
          escalation_acknowledged_at: new Date().toISOString(),
          escalation_acknowledged_by: userId
        })
        .eq('job_id', jobId);

      if (error) {
        console.error('Failed to acknowledge escalation:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.error('Acknowledge escalation error:', e);
      return false;
    }
  },

  // Add/update escalation notes
  updateEscalationNotes: async (jobId: string, notes: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ escalation_notes: notes })
        .eq('job_id', jobId);

      if (error) {
        console.error('Failed to update escalation notes:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.error('Update escalation notes error:', e);
      return false;
    }
  },

  // Check and trigger escalations (called from Dashboard)
  // Returns: { checked: number, escalated: number, jobs: array }
  checkAndTriggerEscalations: async (): Promise<{ checked: number; escalated: number; jobs: any[] }> => {
    try {
      // 1. Get holidays for current year
      const currentYear = new Date().getFullYear();
      const { data: holidayData } = await supabase
        .from('public_holidays')
        .select('holiday_date')
        .gte('year', currentYear - 1)
        .lte('year', currentYear + 1);
      
      const holidays = (holidayData || []).map(h => h.holiday_date);

      // 2. Get jobs needing escalation check
      const { data: jobs, error } = await supabase
        .from('jobs')
        .select(`
          job_id, title, status, created_at, scheduled_date, cutoff_time,
          is_overtime, escalation_triggered_at,
          assigned_technician_id, assigned_technician_name,
          customer:customers(name)
        `)
        .is('escalation_triggered_at', null)
        .is('deleted_at', null)
        .eq('is_overtime', false)
        .in('status', ['Assigned', 'In Progress', 'Incomplete - Continuing']);

      if (error || !jobs) {
        console.error('Failed to get jobs for escalation:', error?.message);
        return { checked: 0, escalated: 0, jobs: [] };
      }

      // 3. Check each job against escalation rules
      const now = new Date();
      const escalatedJobs: any[] = [];

      for (const job of jobs) {
        // Use cutoff_time if continuing, otherwise scheduled_date or created_at
        const referenceDate = job.cutoff_time 
          ? new Date(job.cutoff_time)
          : job.scheduled_date 
            ? new Date(job.scheduled_date)
            : new Date(job.created_at);

        // Calculate next business day 8 AM
        const escalationTime = getNextBusinessDay8AM(referenceDate, holidays);

        if (now >= escalationTime) {
          // Trigger escalation
          const { error: updateError } = await supabase
            .from('jobs')
            .update({ escalation_triggered_at: now.toISOString() })
            .eq('job_id', job.job_id);

          if (!updateError) {
            escalatedJobs.push(job);
          }
        }
      }

      return { 
        checked: jobs.length, 
        escalated: escalatedJobs.length, 
        jobs: escalatedJobs 
      };
    } catch (e) {
      console.error('Check escalations error:', e);
      return { checked: 0, escalated: 0, jobs: [] };
    }
  },

  // ==========================================================================
  // DEFERRED ACKNOWLEDGEMENT (#8)
  // ==========================================================================

  // Defer job completion (customer not available to sign)
  deferJobCompletion: async (
    jobId: string,
    reason: string,
    evidencePhotoIds: string[],
    userId: string,
    userName: string,
    endHourmeter?: number
  ): Promise<{ success: boolean; ackId?: string; error?: string }> => {
    try {
      // Validate minimum 1 evidence photo required
      if (!evidencePhotoIds || evidencePhotoIds.length === 0) {
        return { success: false, error: 'At least 1 evidence photo is required' };
      }

      // Get SLA days from settings
      const slaDays = await SupabaseDb.getAppSetting('deferred_ack_sla_days');
      const slaBusinessDays = parseInt(slaDays || '5', 10);

      // Get holidays for deadline calculation
      const currentYear = new Date().getFullYear();
      const { data: holidayData } = await supabase
        .from('public_holidays')
        .select('holiday_date')
        .gte('year', currentYear)
        .lte('year', currentYear + 1);
      const holidays = (holidayData || []).map(h => h.holiday_date);

      // Calculate deadline (SLA business days from now)
      const now = new Date();
      const deadline = addBusinessDaysMalaysia(now, slaBusinessDays, holidays);

      // Get job's customer_id and forklift_id
      const { data: job, error: jobFetchError } = await supabase
        .from('jobs')
        .select('customer_id, forklift_id, notes')
        .eq('job_id', jobId)
        .single();

      if (jobFetchError || !job?.customer_id) {
        return { success: false, error: 'Job not found or no customer assigned' };
      }

      // Update job with completion timestamps
      const currentNotes = Array.isArray(job.notes) ? job.notes : [];
      const updatedNotes = [...currentNotes, {
        text: `Deferred completion: ${reason}`,
        created_at: now.toISOString(),
        created_by: userName
      }];

      const jobUpdate: any = {
        status: 'Completed Awaiting Acknowledgement',
        verification_type: 'deferred',
        deferred_reason: reason,
        evidence_photo_ids: evidencePhotoIds,
        customer_notified_at: now.toISOString(),
        customer_response_deadline: deadline.toISOString(),
        notes: updatedNotes,
        // Set completion timestamps for reporting/invoicing
        completed_at: now.toISOString(),
        completion_time: now.toISOString(),
        repair_end_time: now.toISOString(),
        completed_by_user_id: userId,
        completed_by_name: userName
      };

      // Add hourmeter if provided
      if (endHourmeter !== undefined) {
        jobUpdate.end_hourmeter = endHourmeter;
      }

      const { error: updateError } = await supabase
        .from('jobs')
        .update(jobUpdate)
        .eq('job_id', jobId);

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      // Update forklift hourmeter if provided
      if (endHourmeter !== undefined && job.forklift_id) {
        await supabase
          .from('forklifts')
          .update({ hourmeter: endHourmeter })
          .eq('forklift_id', job.forklift_id);
      }

      // Create customer acknowledgement record
      const tokenExpiry = new Date(deadline);
      tokenExpiry.setDate(tokenExpiry.getDate() + 7); // Token valid 7 days after deadline

      const { data: ack, error: ackError } = await supabase
        .from('customer_acknowledgements')
        .insert({
          job_id: jobId,
          customer_id: job.customer_id,
          status: 'pending',
          token_expires_at: tokenExpiry.toISOString()
        })
        .select('ack_id, access_token')
        .single();

      if (ackError) {
        console.error('Failed to create ack record:', ackError.message);
        // Job is updated but ack record failed - still return success
        return { success: true };
      }

      return { success: true, ackId: ack.ack_id };
    } catch (e) {
      console.error('Defer job completion error:', e);
      return { success: false, error: 'Unexpected error' };
    }
  },

  // Get acknowledgement record for a job
  getJobAcknowledgement: async (jobId: string): Promise<any | null> => {
    try {
      const { data, error } = await supabase
        .from('customer_acknowledgements')
        .select('*, customer:customers(name, email, phone)')
        .eq('job_id', jobId)
        .single();

      if (error) {
        if (error.code !== 'PGRST116') { // Not found is OK
          console.error('Failed to get ack:', error.message);
        }
        return null;
      }
      return data;
    } catch (e) {
      console.error('Get ack error:', e);
      return null;
    }
  },

  // Customer acknowledges job (via portal/phone/email)
  acknowledgeJob: async (
    jobId: string,
    method: 'portal' | 'email' | 'phone',
    signature?: string,
    notes?: string
  ): Promise<boolean> => {
    try {
      const now = new Date().toISOString();

      // Update acknowledgement record
      const { error: ackError } = await supabase
        .from('customer_acknowledgements')
        .update({
          status: 'acknowledged',
          responded_at: now,
          response_method: method,
          response_notes: notes || null,
          customer_signature: signature || null,
          signed_at: signature ? now : null,
          updated_at: now
        })
        .eq('job_id', jobId);

      if (ackError) {
        console.error('Failed to update ack:', ackError.message);
        return false;
      }

      // Update job status
      const { error: jobError } = await supabase
        .from('jobs')
        .update({
          status: 'Completed',
          verification_type: 'deferred' // Keep as deferred to show it was deferred originally
        })
        .eq('job_id', jobId);

      if (jobError) {
        console.error('Failed to update job:', jobError.message);
        return false;
      }

      return true;
    } catch (e) {
      console.error('Acknowledge job error:', e);
      return false;
    }
  },

  // Customer disputes job completion
  disputeJob: async (
    jobId: string, 
    disputeNotes: string,
    method: 'portal' | 'email' | 'phone' = 'portal'
  ): Promise<boolean> => {
    try {
      const now = new Date().toISOString();

      // Update acknowledgement record
      const { error: ackError } = await supabase
        .from('customer_acknowledgements')
        .update({
          status: 'disputed',
          responded_at: now,
          response_method: method,
          response_notes: disputeNotes,
          updated_at: now
        })
        .eq('job_id', jobId);

      if (ackError) {
        console.error('Failed to update ack:', ackError.message);
        return false;
      }

      // Update job status
      const { error: jobError } = await supabase
        .from('jobs')
        .update({
          status: 'Disputed',
          verification_type: 'disputed',
          dispute_notes: disputeNotes,
          disputed_at: now
        })
        .eq('job_id', jobId);

      if (jobError) {
        console.error('Failed to update job:', jobError.message);
        return false;
      }

      return true;
    } catch (e) {
      console.error('Dispute job error:', e);
      return false;
    }
  },

  // Admin resolves dispute
  resolveDispute: async (
    jobId: string,
    resolution: string,
    finalStatus: 'Completed' | 'In Progress'
  ): Promise<boolean> => {
    try {
      const now = new Date().toISOString();

      const { error } = await supabase
        .from('jobs')
        .update({
          status: finalStatus,
          dispute_resolved_at: now,
          dispute_resolution: resolution,
          verification_type: finalStatus === 'Completed' ? 'disputed' : 'signed_onsite'
        })
        .eq('job_id', jobId);

      if (error) {
        console.error('Failed to resolve dispute:', error.message);
        return false;
      }

      return true;
    } catch (e) {
      console.error('Resolve dispute error:', e);
      return false;
    }
  },

  // Check and auto-complete expired deferred jobs
  checkAndAutoCompleteJobs: async (): Promise<{ checked: number; completed: number }> => {
    try {
      const now = new Date();

      // Get jobs past deadline
      const { data: jobs, error } = await supabase
        .from('jobs')
        .select('job_id')
        .eq('verification_type', 'deferred')
        .eq('status', 'Completed Awaiting Acknowledgement')
        .is('auto_completed_at', null)
        .lt('customer_response_deadline', now.toISOString());

      if (error || !jobs) {
        console.error('Failed to get expired jobs:', error?.message);
        return { checked: 0, completed: 0 };
      }

      let completed = 0;
      for (const job of jobs) {
        // Update job to auto-completed
        const { error: updateError } = await supabase
          .from('jobs')
          .update({
            status: 'Completed',
            verification_type: 'auto_completed',
            auto_completed_at: now.toISOString()
          })
          .eq('job_id', job.job_id);

        if (!updateError) {
          // Update ack record
          await supabase
            .from('customer_acknowledgements')
            .update({
              status: 'auto_completed',
              responded_at: now.toISOString(),
              response_method: 'auto',
              updated_at: now.toISOString()
            })
            .eq('job_id', job.job_id);

          completed++;
        }
      }

      return { checked: jobs.length, completed };
    } catch (e) {
      console.error('Auto-complete check error:', e);
      return { checked: 0, completed: 0 };
    }
  },

  // Get jobs awaiting acknowledgement
  getJobsAwaitingAck: async (): Promise<any[]> => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          job_id, title, status, deferred_reason, 
          customer_notified_at, customer_response_deadline,
          customer:customers(name, email, phone),
          forklift:forklifts!forklift_id(serial_number, model)
        `)
        .eq('status', 'Completed Awaiting Acknowledgement')
        .is('deleted_at', null)
        .order('customer_response_deadline', { ascending: true });

      if (error) {
        console.error('Failed to get awaiting ack jobs:', error.message);
        return [];
      }
      return data || [];
    } catch (e) {
      console.error('Get awaiting ack error:', e);
      return [];
    }
  },

  // Get disputed jobs
  getDisputedJobs: async (): Promise<any[]> => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          job_id, title, status, dispute_notes, disputed_at,
          customer:customers(name, email, phone),
          assigned_technician_name
        `)
        .eq('status', 'Disputed')
        .is('deleted_at', null)
        .order('disputed_at', { ascending: false });

      if (error) {
        console.error('Failed to get disputed jobs:', error.message);
        return [];
      }
      return data || [];
    } catch (e) {
      console.error('Get disputed jobs error:', e);
      return [];
    }
  },

  // =============================================
  // VAN STOCK MANAGEMENT
  // =============================================

  // Get all Van Stocks (Admin view - all technicians)
  getAllVanStocks: async (): Promise<VanStock[]> => {
    try {
      console.log('[VanStock] Fetching all van stocks...');
      const { data, error } = await supabase
        .from('van_stocks')
        .select(`
          *,
          technician:users!technician_id(*),
          items:van_stock_items(
            *,
            part:parts(*)
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[VanStock] Query failed:', error.message, error);
        return [];
      }
      console.log('[VanStock] Loaded:', data?.length || 0, 'records', data);

      // Calculate total value for each van stock
      return (data || []).map((vs: any) => ({
        ...vs,
        total_value: vs.items?.reduce((sum: number, item: any) => {
          const partCost = item.part?.cost_price || 0;
          return sum + (partCost * item.quantity);
        }, 0) || 0,
      })) as VanStock[];
    } catch (e) {
      console.warn('Van stocks not available:', e);
      return [];
    }
  },

  // Get Van Stock for a specific technician
  getVanStockByTechnician: async (technicianId: string): Promise<VanStock | null> => {
    try {
      const { data, error } = await supabase
        .from('van_stocks')
        .select(`
          *,
          technician:users!technician_id(*),
          items:van_stock_items(
            *,
            part:parts(*)
          )
        `)
        .eq('technician_id', technicianId)
        .eq('is_active', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // No rows found
        console.warn('Van stock query failed:', error.message);
        return null;
      }

      // Calculate total value
      const items = data.items || [];
      const total_value = items.reduce((sum: number, item: any) => {
        const partCost = item.part?.cost_price || 0;
        return sum + (partCost * item.quantity);
      }, 0);

      return { ...data, total_value } as VanStock;
    } catch (e) {
      console.warn('Van stock not available:', e);
      return null;
    }
  },

  // Get Van Stock by ID
  getVanStockById: async (vanStockId: string): Promise<VanStock | null> => {
    try {
      const { data, error } = await supabase
        .from('van_stocks')
        .select(`
          *,
          technician:users!technician_id(*),
          items:van_stock_items(
            *,
            part:parts(*)
          )
        `)
        .eq('van_stock_id', vanStockId)
        .single();

      if (error) {
        console.warn('Van stock query failed:', error.message);
        return null;
      }

      const items = data.items || [];
      const total_value = items.reduce((sum: number, item: any) => {
        const partCost = item.part?.cost_price || 0;
        return sum + (partCost * item.quantity);
      }, 0);

      return { ...data, total_value } as VanStock;
    } catch (e) {
      console.warn('Van stock not available:', e);
      return null;
    }
  },

  // Create Van Stock for a technician
  createVanStock: async (
    technicianId: string,
    technicianName: string,
    vanCode: string,
    createdById?: string,
    createdByName?: string,
    notes?: string
  ): Promise<VanStock> => {
    console.log('[VanStock] Creating van stock for:', technicianName, technicianId, 'Code:', vanCode);
    const { data, error } = await supabase
      .from('van_stocks')
      .insert({
        technician_id: technicianId,
        van_code: vanCode,
        notes: notes || null,
        max_items: 50,
        is_active: true,
        created_by_id: createdById,
        created_by_name: createdByName,
      })
      .select(`
        *,
        technician:users!technician_id(*)
      `)
      .single();

    if (error) {
      console.error('[VanStock] Create failed:', error.message, error);
      throw new Error(error.message);
    }
    // Add technician_name from joined data
    const result = {
      ...data,
      technician_name: data.technician?.name || technicianName,
    };
    console.log('[VanStock] Created successfully:', result);
    return result as VanStock;
  },

  // Update Van Stock details
  updateVanStock: async (
    vanStockId: string,
    updates: { van_code?: string; notes?: string; max_items?: number; is_active?: boolean; technician_id?: string }
  ): Promise<VanStock> => {
    const { data, error } = await supabase
      .from('van_stocks')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('van_stock_id', vanStockId)
      .select(`
        *,
        technician:users!technician_id(*)
      `)
      .single();

    if (error) throw new Error(error.message);
    return {
      ...data,
      technician_name: data.technician?.name,
    } as VanStock;
  },

  // Delete/Deactivate Van Stock
  deleteVanStock: async (vanStockId: string, hardDelete: boolean = false): Promise<void> => {
    if (hardDelete) {
      const { error } = await supabase
        .from('van_stocks')
        .delete()
        .eq('van_stock_id', vanStockId);
      if (error) throw new Error(error.message);
    } else {
      // Soft delete - just deactivate
      const { error } = await supabase
        .from('van_stocks')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('van_stock_id', vanStockId);
      if (error) throw new Error(error.message);
    }
  },

  // Transfer items between van stocks
  transferVanStockItems: async (
    fromVanStockId: string,
    toVanStockId: string,
    itemIds: string[]
  ): Promise<void> => {
    const { error } = await supabase
      .from('van_stock_items')
      .update({ van_stock_id: toVanStockId })
      .in('item_id', itemIds);
    if (error) throw new Error(error.message);
  },

  // Add item to Van Stock
  addVanStockItem: async (
    vanStockId: string,
    partId: string,
    quantity: number,
    minQuantity: number,
    maxQuantity: number,
    isCoreItem: boolean = true
  ): Promise<VanStockItem> => {
    const { data, error } = await supabase
      .from('van_stock_items')
      .insert({
        van_stock_id: vanStockId,
        part_id: partId,
        quantity,
        min_quantity: minQuantity,
        max_quantity: maxQuantity,
        is_core_item: isCoreItem,
      })
      .select(`
        *,
        part:parts(*)
      `)
      .single();

    if (error) throw new Error(error.message);
    return data as VanStockItem;
  },

  // Update Van Stock item quantity
  updateVanStockItemQuantity: async (
    itemId: string,
    quantity: number
  ): Promise<VanStockItem> => {
    const { data, error } = await supabase
      .from('van_stock_items')
      .update({
        quantity,
        updated_at: new Date().toISOString(),
      })
      .eq('item_id', itemId)
      .select(`
        *,
        part:parts(*)
      `)
      .single();

    if (error) throw new Error(error.message);
    return data as VanStockItem;
  },

  // Use part from Van Stock (deduct quantity)
  useVanStockPart: async (
    vanStockItemId: string,
    jobId: string,
    quantityUsed: number,
    usedById: string,
    usedByName: string,
    requiresApproval: boolean = false
  ): Promise<VanStockUsage> => {
    // First get current item quantity
    const { data: item, error: itemError } = await supabase
      .from('van_stock_items')
      .select('quantity')
      .eq('item_id', vanStockItemId)
      .single();

    if (itemError) throw new Error(itemError.message);
    if (!item || item.quantity < quantityUsed) {
      throw new Error('Insufficient Van Stock quantity');
    }

    // Create usage record
    const { data: usage, error: usageError } = await supabase
      .from('van_stock_usage')
      .insert({
        van_stock_item_id: vanStockItemId,
        job_id: jobId,
        quantity_used: quantityUsed,
        used_by_id: usedById,
        used_by_name: usedByName,
        requires_approval: requiresApproval,
        approval_status: requiresApproval ? 'pending' : 'approved',
      })
      .select()
      .single();

    if (usageError) throw new Error(usageError.message);

    // Deduct from Van Stock
    const { error: updateError } = await supabase
      .from('van_stock_items')
      .update({
        quantity: item.quantity - quantityUsed,
        last_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('item_id', vanStockItemId);

    if (updateError) throw new Error(updateError.message);

    return usage as VanStockUsage;
  },

  // Get pending Van Stock usage approvals (for customer-owned forklifts)
  getPendingVanStockApprovals: async (): Promise<VanStockUsage[]> => {
    try {
      const { data, error } = await supabase
        .from('van_stock_usage')
        .select(`
          *,
          van_stock_item:van_stock_items(
            *,
            part:parts(*)
          ),
          job:jobs(
            job_id, title, customer:customers(name)
          )
        `)
        .eq('requires_approval', true)
        .eq('approval_status', 'pending')
        .order('used_at', { ascending: false });

      if (error) {
        console.warn('Van stock approvals query failed:', error.message);
        return [];
      }
      return data as VanStockUsage[];
    } catch (e) {
      console.warn('Van stock approvals not available:', e);
      return [];
    }
  },

  // Approve Van Stock usage
  approveVanStockUsage: async (
    usageId: string,
    approvedById: string,
    approvedByName: string
  ): Promise<VanStockUsage> => {
    const { data, error } = await supabase
      .from('van_stock_usage')
      .update({
        approval_status: 'approved',
        approved_by_id: approvedById,
        approved_by_name: approvedByName,
        approved_at: new Date().toISOString(),
      })
      .eq('usage_id', usageId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as VanStockUsage;
  },

  // Reject Van Stock usage (and restore quantity)
  rejectVanStockUsage: async (
    usageId: string,
    approvedById: string,
    approvedByName: string,
    rejectionReason: string
  ): Promise<VanStockUsage> => {
    // Get the usage record to find quantity and item
    const { data: usage, error: usageError } = await supabase
      .from('van_stock_usage')
      .select('van_stock_item_id, quantity_used')
      .eq('usage_id', usageId)
      .single();

    if (usageError) throw new Error(usageError.message);

    // Restore quantity to Van Stock
    const { data: item } = await supabase
      .from('van_stock_items')
      .select('quantity')
      .eq('item_id', usage.van_stock_item_id)
      .single();

    if (item) {
      await supabase
        .from('van_stock_items')
        .update({
          quantity: item.quantity + usage.quantity_used,
          updated_at: new Date().toISOString(),
        })
        .eq('item_id', usage.van_stock_item_id);
    }

    // Update usage record
    const { data, error } = await supabase
      .from('van_stock_usage')
      .update({
        approval_status: 'rejected',
        approved_by_id: approvedById,
        approved_by_name: approvedByName,
        approved_at: new Date().toISOString(),
        rejection_reason: rejectionReason,
      })
      .eq('usage_id', usageId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as VanStockUsage;
  },

  // =============================================
  // VAN STOCK REPLENISHMENT
  // =============================================

  // Create replenishment request
  createReplenishmentRequest: async (
    vanStockId: string,
    technicianId: string,
    technicianName: string,
    items: { vanStockItemId: string; partId: string; partName: string; partCode: string; quantityRequested: number }[],
    requestType: 'manual' | 'auto_slot_in' | 'low_stock' = 'manual',
    triggeredByJobId?: string,
    notes?: string
  ): Promise<VanStockReplenishment> => {
    // Create replenishment record
    const { data: replenishment, error: repError } = await supabase
      .from('van_stock_replenishments')
      .insert({
        van_stock_id: vanStockId,
        technician_id: technicianId,
        technician_name: technicianName,
        status: 'pending',
        request_type: requestType,
        triggered_by_job_id: triggeredByJobId,
        notes,
      })
      .select()
      .single();

    if (repError) throw new Error(repError.message);

    // Create replenishment items
    const itemInserts = items.map(item => ({
      replenishment_id: replenishment.replenishment_id,
      van_stock_item_id: item.vanStockItemId,
      part_id: item.partId,
      part_name: item.partName,
      part_code: item.partCode,
      quantity_requested: item.quantityRequested,
      quantity_issued: 0,
      is_rejected: false,
    }));

    const { error: itemsError } = await supabase
      .from('van_stock_replenishment_items')
      .insert(itemInserts);

    if (itemsError) throw new Error(itemsError.message);

    return replenishment as VanStockReplenishment;
  },

  // Get replenishment requests (with filters)
  getReplenishmentRequests: async (filters?: {
    technicianId?: string;
    status?: ReplenishmentStatus;
  }): Promise<VanStockReplenishment[]> => {
    try {
      let query = supabase
        .from('van_stock_replenishments')
        .select(`
          *,
          items:van_stock_replenishment_items(*)
        `)
        .order('requested_at', { ascending: false });

      if (filters?.technicianId) {
        query = query.eq('technician_id', filters.technicianId);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('Replenishment requests query failed:', error.message);
        return [];
      }
      return data as VanStockReplenishment[];
    } catch (e) {
      console.warn('Replenishment requests not available:', e);
      return [];
    }
  },

  // Approve replenishment request (Admin 2)
  approveReplenishmentRequest: async (
    replenishmentId: string,
    approvedById: string,
    approvedByName: string
  ): Promise<VanStockReplenishment> => {
    const { data, error } = await supabase
      .from('van_stock_replenishments')
      .update({
        status: 'approved',
        approved_by_id: approvedById,
        approved_by_name: approvedByName,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('replenishment_id', replenishmentId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as VanStockReplenishment;
  },

  // Fulfill replenishment (issue parts)
  fulfillReplenishment: async (
    replenishmentId: string,
    itemsIssued: { itemId: string; quantityIssued: number; serialNumbers?: string[] }[],
    fulfilledById: string,
    fulfilledByName: string
  ): Promise<VanStockReplenishment> => {
    // Update each replenishment item
    for (const item of itemsIssued) {
      await supabase
        .from('van_stock_replenishment_items')
        .update({
          quantity_issued: item.quantityIssued,
          serial_numbers: item.serialNumbers || [],
        })
        .eq('item_id', item.itemId);
    }

    // Update replenishment status
    const { data, error } = await supabase
      .from('van_stock_replenishments')
      .update({
        status: 'in_progress',
        fulfilled_at: new Date().toISOString(),
        fulfilled_by_id: fulfilledById,
        fulfilled_by_name: fulfilledByName,
        updated_at: new Date().toISOString(),
      })
      .eq('replenishment_id', replenishmentId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as VanStockReplenishment;
  },

  // Technician confirms replenishment receipt
  confirmReplenishmentReceipt: async (
    replenishmentId: string,
    confirmationPhotoUrl?: string
  ): Promise<VanStockReplenishment> => {
    // Get replenishment with items
    const { data: replenishment, error: repError } = await supabase
      .from('van_stock_replenishments')
      .select(`
        *,
        items:van_stock_replenishment_items(*)
      `)
      .eq('replenishment_id', replenishmentId)
      .single();

    if (repError) throw new Error(repError.message);

    // Add issued quantities to Van Stock items
    for (const item of replenishment.items) {
      if (item.quantity_issued > 0 && !item.is_rejected) {
        const { data: vsItem } = await supabase
          .from('van_stock_items')
          .select('quantity')
          .eq('item_id', item.van_stock_item_id)
          .single();

        if (vsItem) {
          await supabase
            .from('van_stock_items')
            .update({
              quantity: vsItem.quantity + item.quantity_issued,
              last_replenished_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('item_id', item.van_stock_item_id);
        }
      }
    }

    // Update replenishment status
    const { data, error } = await supabase
      .from('van_stock_replenishments')
      .update({
        status: 'completed',
        confirmed_by_technician: true,
        confirmed_at: new Date().toISOString(),
        confirmation_photo_url: confirmationPhotoUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('replenishment_id', replenishmentId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as VanStockReplenishment;
  },

  // Get low stock items for a technician
  getLowStockItems: async (technicianId: string): Promise<VanStockItem[]> => {
    try {
      const { data: vanStock } = await supabase
        .from('van_stocks')
        .select(`
          items:van_stock_items(
            *,
            part:parts(*)
          )
        `)
        .eq('technician_id', technicianId)
        .eq('is_active', true)
        .single();

      if (!vanStock?.items) return [];

      return vanStock.items.filter((item: any) => item.quantity <= item.min_quantity) as VanStockItem[];
    } catch (e) {
      console.warn('Low stock items not available:', e);
      return [];
    }
  },

  // Schedule Van Stock audit
  scheduleVanStockAudit: async (
    vanStockId: string,
    technicianId: string,
    technicianName: string,
    scheduledDate: string
  ): Promise<VanStockAudit> => {
    const { data, error } = await supabase
      .from('van_stock_audits')
      .insert({
        van_stock_id: vanStockId,
        technician_id: technicianId,
        technician_name: technicianName,
        scheduled_date: scheduledDate,
        status: 'scheduled',
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as VanStockAudit;
  },

  // Get Van Stock usage history for a technician
  getVanStockUsageHistory: async (
    technicianId: string,
    limit: number = 50
  ): Promise<VanStockUsage[]> => {
    try {
      const { data, error } = await supabase
        .from('van_stock_usage')
        .select(`
          *,
          van_stock_item:van_stock_items(
            *,
            part:parts(*),
            van_stock:van_stocks!inner(technician_id)
          ),
          job:jobs(job_id, title)
        `)
        .eq('van_stock_item.van_stock.technician_id', technicianId)
        .order('used_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.warn('Usage history query failed:', error.message);
        return [];
      }
      return data as VanStockUsage[];
    } catch (e) {
      console.warn('Usage history not available:', e);
      return [];
    }
  },

  // =============================================
  // HOURMETER HISTORY
  // =============================================

  // Get hourmeter history for a specific forklift
  getForkliftHourmeterHistory: async (forkliftId: string): Promise<any[]> => {
    try {
      const { data, error } = await supabase
        .from('hourmeter_history')
        .select(`
          *,
          job:jobs(job_id, title, job_type)
        `)
        .eq('forklift_id', forkliftId)
        .order('recorded_at', { ascending: false });

      if (error) {
        console.warn('Hourmeter history query failed:', error.message);
        return [];
      }
      return data || [];
    } catch (e) {
      console.warn('Hourmeter history not available:', e);
      return [];
    }
  },

  // =============================================
  // HOURMETER AMENDMENT WORKFLOW
  // =============================================

  // Get all hourmeter amendments with optional status filter
  getHourmeterAmendments: async (statusFilter?: HourmeterAmendmentStatus): Promise<HourmeterAmendment[]> => {
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
        console.warn('Hourmeter amendments query failed:', error.message);
        return [];
      }
      return (data || []) as HourmeterAmendment[];
    } catch (e) {
      console.warn('Hourmeter amendments not available:', e);
      return [];
    }
  },

  // Create a hourmeter amendment request
  createHourmeterAmendment: async (
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
  },

  // Approve hourmeter amendment (Admin 1 / Service only)
  approveHourmeterAmendment: async (
    amendmentId: string,
    reviewedById: string,
    reviewedByName: string,
    reviewNotes?: string
  ): Promise<HourmeterAmendment> => {
    // Get amendment to apply the new reading
    const { data: amendment, error: fetchError } = await supabase
      .from('hourmeter_amendments')
      .select('job_id, forklift_id, amended_reading')
      .eq('amendment_id', amendmentId)
      .single();

    if (fetchError) throw new Error(fetchError.message);

    // Update the job's hourmeter reading
    await supabase
      .from('jobs')
      .update({
        hourmeter_reading: amendment.amended_reading,
        hourmeter_flagged: false, // Clear the flag
        hourmeter_flag_reasons: [],
        updated_at: new Date().toISOString(),
      })
      .eq('job_id', amendment.job_id);

    // Update the forklift's hourmeter if the new reading is higher
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

    // Update the amendment record
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
  },

  // Reject hourmeter amendment (Admin 1 / Service only)
  rejectHourmeterAmendment: async (
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
  },

  // Get hourmeter amendment for a specific job
  getJobHourmeterAmendment: async (jobId: string): Promise<HourmeterAmendment | null> => {
    try {
      const { data, error } = await supabase
        .from('hourmeter_amendments')
        .select('*')
        .eq('job_id', jobId)
        .order('requested_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // No rows found
        console.warn('Hourmeter amendment query failed:', error.message);
        return null;
      }
      return data as HourmeterAmendment;
    } catch (e) {
      return null;
    }
  },

  // Flag a job's hourmeter reading for review
  flagJobHourmeter: async (
    jobId: string,
    flagReasons: HourmeterFlagReason[]
  ): Promise<void> => {
    await supabase
      .from('jobs')
      .update({
        hourmeter_flagged: true,
        hourmeter_flag_reasons: flagReasons,
        updated_at: new Date().toISOString(),
      })
      .eq('job_id', jobId);
  },

  // Validate hourmeter reading and return any flags
  validateHourmeterReading: async (
    forkliftId: string,
    newReading: number
  ): Promise<{ isValid: boolean; flags: HourmeterFlagReason[] }> => {
    const flags: HourmeterFlagReason[] = [];

    // Get the forklift's current hourmeter
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

    // Check if reading is lower than current
    if (newReading < currentHourmeter) {
      flags.push('lower_than_previous');
    }

    // Check for excessive jump (more than 30 days worth of usage in one reading)
    const difference = newReading - currentHourmeter;
    const excessiveThreshold = avgDailyUsage * 30; // 30 days of avg usage
    if (difference > excessiveThreshold) {
      flags.push('excessive_jump');
    }

    return {
      isValid: flags.length === 0,
      flags,
    };
  },

  // =============================================
  // AUTOCOUNT EXPORT
  // =============================================

  // Get all AutoCount exports with optional status filter
  getAutoCountExports: async (statusFilter?: AutoCountExportStatus): Promise<AutoCountExport[]> => {
    try {
      let query = supabase
        .from('autocount_exports')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.warn('AutoCount exports query failed:', error.message);
        return [];
      }
      return (data || []) as AutoCountExport[];
    } catch (e) {
      console.warn('AutoCount exports not available:', e);
      return [];
    }
  },

  // Get jobs pending export (finalized but not yet exported)
  getJobsPendingExport: async (): Promise<Job[]> => {
    try {
      // Get jobs that are completed/finalized
      const { data: jobs, error } = await supabase
        .from('jobs')
        .select(`
          *,
          customer:customers(*),
          forklift:forklifts!forklift_id(*)
        `)
        .in('status', ['Completed', 'Awaiting Finalization'])
        .is('deleted_at', null)
        .order('completed_at', { ascending: false })
        .limit(100);

      if (error) {
        console.warn('Jobs query failed:', error.message);
        return [];
      }

      // Get already exported job IDs
      const { data: exports } = await supabase
        .from('autocount_exports')
        .select('job_id')
        .in('status', ['pending', 'exported']);

      const exportedJobIds = new Set((exports || []).map(e => e.job_id));

      // Filter out already exported jobs
      return (jobs || []).filter(j => !exportedJobIds.has(j.job_id)) as Job[];
    } catch (e) {
      console.warn('Jobs pending export not available:', e);
      return [];
    }
  },

  // Create AutoCount export for a job
  createAutoCountExport: async (
    jobId: string,
    exportedById: string,
    exportedByName: string
  ): Promise<AutoCountExport> => {
    // Get the job with related data
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select(`
        *,
        customer:customers(*),
        parts_used:job_parts(*),
        extra_charges:extra_charges(*)
      `)
      .eq('job_id', jobId)
      .single();

    if (jobError) throw new Error(jobError.message);

    // Build line items from parts and charges
    const lineItems: AutoCountLineItem[] = [];

    // Add labor charge
    if (job.labour_hours && job.labour_hours > 0) {
      const laborRate = 50; // Default labor rate per hour
      lineItems.push({
        description: 'Labor Charges',
        quantity: job.labour_hours,
        unit_price: laborRate,
        amount: job.labour_hours * laborRate,
        source_type: 'labor',
      });
    }

    // Add parts
    (job.parts_used || []).forEach((part: any) => {
      lineItems.push({
        item_code: part.part_code,
        description: part.part_name || 'Part',
        quantity: part.quantity || 1,
        unit_price: part.sell_price || 0,
        amount: (part.quantity || 1) * (part.sell_price || 0),
        source_type: 'part',
        source_id: part.job_part_id,
      });
    });

    // Add extra charges
    (job.extra_charges || []).forEach((charge: any) => {
      lineItems.push({
        description: charge.description || 'Extra Charge',
        quantity: 1,
        unit_price: charge.amount || 0,
        amount: charge.amount || 0,
        source_type: 'extra_charge',
        source_id: charge.charge_id,
      });
    });

    // Calculate total
    const totalAmount = lineItems.reduce((sum, item) => sum + item.amount, 0);

    // Create export record
    const { data, error } = await supabase
      .from('autocount_exports')
      .insert({
        job_id: jobId,
        export_type: 'invoice',
        status: 'pending',
        customer_name: job.customer?.name || 'Unknown',
        invoice_date: new Date().toISOString().split('T')[0],
        total_amount: totalAmount,
        currency: 'MYR',
        line_items: lineItems,
        exported_by_id: exportedById,
        exported_by_name: exportedByName,
        retry_count: 0,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as AutoCountExport;
  },

  // Retry a failed export
  retryAutoCountExport: async (
    exportId: string,
    retriedById: string,
    retriedByName: string
  ): Promise<AutoCountExport> => {
    // Get current export
    const { data: current } = await supabase
      .from('autocount_exports')
      .select('retry_count')
      .eq('export_id', exportId)
      .single();

    const { data, error } = await supabase
      .from('autocount_exports')
      .update({
        status: 'pending',
        export_error: null,
        retry_count: (current?.retry_count || 0) + 1,
        last_retry_at: new Date().toISOString(),
        exported_by_id: retriedById,
        exported_by_name: retriedByName,
        updated_at: new Date().toISOString(),
      })
      .eq('export_id', exportId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as AutoCountExport;
  },

  // Cancel a pending export
  cancelAutoCountExport: async (exportId: string): Promise<AutoCountExport> => {
    const { data, error } = await supabase
      .from('autocount_exports')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('export_id', exportId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as AutoCountExport;
  },

  // Mark export as completed (called after successful AutoCount API call)
  completeAutoCountExport: async (
    exportId: string,
    autocountInvoiceNumber: string
  ): Promise<AutoCountExport> => {
    const { data, error } = await supabase
      .from('autocount_exports')
      .update({
        status: 'exported',
        autocount_invoice_number: autocountInvoiceNumber,
        exported_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('export_id', exportId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as AutoCountExport;
  },

  // Mark export as failed
  failAutoCountExport: async (
    exportId: string,
    errorMessage: string
  ): Promise<AutoCountExport> => {
    const { data, error } = await supabase
      .from('autocount_exports')
      .update({
        status: 'failed',
        export_error: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq('export_id', exportId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as AutoCountExport;
  },

  // Get export for a specific job
  getJobAutoCountExport: async (jobId: string): Promise<AutoCountExport | null> => {
    try {
      const { data, error } = await supabase
        .from('autocount_exports')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // No rows found
        console.warn('Export query failed:', error.message);
        return null;
      }
      return data as AutoCountExport;
    } catch (e) {
      return null;
    }
  },
};

// ==========================================================================
// MALAYSIA TIMEZONE HELPERS (UTC+8)
// ==========================================================================

const MALAYSIA_TZ = 'Asia/Kuala_Lumpur';

// Get current time in Malaysia
function getMalaysiaTime(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: MALAYSIA_TZ }));
}

// Format date as YYYY-MM-DD in Malaysia timezone
function formatDateMalaysia(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: MALAYSIA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  };
  const parts = new Intl.DateTimeFormat('en-CA', options).formatToParts(date);
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

// Check if date is Sunday in Malaysia timezone
function isSundayMalaysia(date: Date): boolean {
  const dayStr = new Intl.DateTimeFormat('en-US', { 
    timeZone: MALAYSIA_TZ, 
    weekday: 'short' 
  }).format(date);
  return dayStr === 'Sun';
}

// Check if date is a holiday (comparing in Malaysia timezone)
function isHolidayMalaysia(date: Date, holidays: string[]): boolean {
  const dateStr = formatDateMalaysia(date);
  return holidays.includes(dateStr);
}

// Helper: Get next business day at 8 AM Malaysia time
function getNextBusinessDay8AM(date: Date, holidays: string[]): Date {
  // Start from the next day
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  
  // Skip Sundays and holidays (checking in Malaysia timezone)
  while (isSundayMalaysia(next) || isHolidayMalaysia(next, holidays)) {
    next.setDate(next.getDate() + 1);
  }
  
  // Set to 8:00 AM Malaysia time (UTC+8)
  // Get the date string in Malaysia timezone, then create a new date at 8 AM MYT
  const dateStr = formatDateMalaysia(next);
  // 8 AM MYT = 0 AM UTC (8 - 8 = 0)
  const myt8am = new Date(`${dateStr}T00:00:00.000Z`);
  
  return myt8am;
}

// Add business days to a date (Malaysia timezone)
function addBusinessDaysMalaysia(date: Date, days: number, holidays: string[]): Date {
  const result = new Date(date);
  let added = 0;
  
  while (added < days) {
    result.setDate(result.getDate() + 1);
    if (!isSundayMalaysia(result) && !isHolidayMalaysia(result, holidays)) {
      added++;
    }
  }
  
  return result;
}
