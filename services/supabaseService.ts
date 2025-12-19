import { createClient } from '@supabase/supabase-js';
import { Job, JobStatus, JobPriority, JobType, Part, User, UserRole, Customer, JobMedia, SignatureEntry, Forklift, ForkliftStatus, ForkliftRental, RentalStatus, Notification, NotificationType, ScheduledService } from '../types_with_invoice_tracking';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);

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
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: userData.email!,
      password: userData.password || 'temp123',
    });

    if (authError) throw new Error(authError.message);
    if (!authData.user) throw new Error('Failed to create auth user');

    const { data, error } = await supabase
      .from('users')
      .insert({
        auth_id: authData.user.id,
        name: userData.name,
        email: userData.email,
        role: userData.role || UserRole.TECHNICIAN,
        is_active: userData.is_active ?? true,
      })
      .select()
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

  updateForklift: async (forkliftId: string, updates: Partial<Forklift>): Promise<Forklift> => {
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
    return data as Forklift;
  },

  deleteForklift: async (forkliftId: string): Promise<void> => {
    // Check if forklift has any jobs
    const { data: jobs } = await supabase
      .from('jobs')
      .select('job_id')
      .eq('forklift_id', forkliftId);
    
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

  getJobs: async (user: User): Promise<Job[]> => {
    console.log('[getJobs] Fetching jobs for user:', user.user_id, user.role, user.name);
    
    let query = supabase
      .from('jobs')
      .select(`
        *,
        customer:customers(*),
        forklift:forklifts(*),
        parts_used:job_parts(*),
        media:job_media(*),
        extra_charges:extra_charges(*)
      `)
      .is('deleted_at', null) // Filter out soft-deleted jobs
      .order('created_at', { ascending: false });

    if (user.role === UserRole.TECHNICIAN) {
      console.log('[getJobs] Filtering for technician:', user.user_id);
      query = query.eq('assigned_technician_id', user.user_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[getJobs] Error fetching jobs:', error);
      throw new Error(error.message);
    }
    
    console.log('[getJobs] Found jobs:', data?.length || 0);
    return data as Job[];
  },

  getJobById: async (jobId: string): Promise<Job | null> => {
    const { data, error } = await supabase
      .from('jobs')
      .select(`
        *,
        customer:customers(*),
        forklift:forklifts(*),
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
    return data as Job;
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
        forklift:forklifts(*),
        parts_used:job_parts(*),
        media:job_media(*),
        extra_charges:extra_charges(*)
      `)
      .single();

    if (error) throw new Error(error.message);
    
    const job = data as Job;
    
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
        forklift:forklifts(*),
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
    const updates: any = { status };
    const now = new Date().toISOString();

    if (status === JobStatus.IN_PROGRESS) {
      updates.arrival_time = now;
      updates.started_at = now;
    }
    if (status === JobStatus.AWAITING_FINALIZATION) {
      updates.completion_time = now;
      updates.repair_end_time = now;
      // Audit: Job Completed (awaiting finalization by accountant)
      updates.completed_at = now;
      updates.completed_by_id = completedById || null;
      updates.completed_by_name = completedByName || null;
    }

    const { data, error } = await supabase
      .from('jobs')
      .update(updates)
      .eq('job_id', jobId)
      .select(`
        *,
        customer:customers(*),
        forklift:forklifts(*),
        parts_used:job_parts(*),
        media:job_media(*),
        extra_charges:extra_charges(*)
      `)
      .single();

    if (error) throw new Error(error.message);
    
    const job = data as Job;
    
    // Notify accountants when job is pending finalization
    if (status === JobStatus.AWAITING_FINALIZATION) {
      await SupabaseDb.notifyPendingFinalization(job);
    }
    
    return job;
  },

  // Update job's hourmeter reading
  updateJobHourmeter: async (jobId: string, hourmeterReading: number): Promise<Job> => {
    const { data, error } = await supabase
      .from('jobs')
      .update({ hourmeter_reading: hourmeterReading })
      .eq('job_id', jobId)
      .select(`
        *,
        customer:customers(*),
        forklift:forklifts(*),
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
        forklift:forklifts(*),
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
    customPrice?: number
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

    await supabase
      .from('parts')
      .update({ stock_quantity: part.stock_quantity - quantity })
      .eq('part_id', partId);

    return SupabaseDb.getJobById(jobId) as Promise<Job>;
  },

  addMedia: async (
    jobId: string, 
    media: Omit<JobMedia, 'media_id' | 'job_id'>,
    uploadedById?: string,
    uploadedByName?: string
  ): Promise<Job> => {
    const { error } = await supabase
      .from('job_media')
      .insert({
        job_id: jobId,
        ...media,
        uploaded_by_id: uploadedById || null,
        uploaded_by_name: uploadedByName || null,
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
        forklift:forklifts(*),
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

  removePartFromJob: async (jobId: string, jobPartId: string): Promise<Job> => {
    const { data: jobPart } = await supabase
      .from('job_parts')
      .select('part_id, quantity')
      .eq('job_part_id', jobPartId)
      .single();

    if (jobPart) {
      const { data: part } = await supabase
        .from('parts')
        .select('stock_quantity')
        .eq('part_id', jobPart.part_id)
        .single();

      if (part) {
        await supabase
          .from('parts')
          .update({ stock_quantity: part.stock_quantity + jobPart.quantity })
          .eq('part_id', jobPart.part_id);
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
        forklift:forklifts(*),
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
        forklift:forklifts(*),
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
        forklift:forklifts(*),
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

  // Soft delete job (recommended for enterprise - preserves audit trail)
  deleteJob: async (jobId: string, deletedById?: string, deletedByName?: string): Promise<void> => {
    const now = new Date().toISOString();
    
    // Use soft delete - sets deleted_at timestamp instead of hard delete
    // This preserves audit history and allows recovery if needed
    // Note: We don't change status as it has a check constraint
    const { error } = await supabase
      .from('jobs')
      .update({
        deleted_at: now,
        deleted_by: deletedById || null,
      })
      .eq('job_id', jobId);

    if (error) throw new Error(error.message);
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
    const { data: jobs } = await supabase
      .from('jobs')
      .select('job_id')
      .eq('customer_id', customerId);
    
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
        forklift:forklifts(*),
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
        forklift:forklifts(*),
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
        forklift:forklifts(*),
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
      .single();

    if (error) {
      console.warn('No service record found:', error.message);
      return null;
    }
    return data;
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
        forklift:forklifts(*),
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
        forklift:forklifts(*),
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
          current_customer:customers(*)
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

  // Get service history for a forklift
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

  createNotification: async (notification: Partial<Notification>): Promise<Notification | null> => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          user_id: notification.user_id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          reference_type: notification.reference_type,
          reference_id: notification.reference_id,
          priority: notification.priority || 'normal',
        })
        .select()
        .single();

      if (error) {
        console.warn('Failed to create notification:', error.message);
        return null;
      }
      return data as Notification;
    } catch (e) {
      console.warn('Notification creation failed:', e);
      return null;
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

  // =====================
  // SCHEDULED SERVICE OPERATIONS
  // =====================

  getScheduledServices: async (filters?: { forklift_id?: string; status?: string }): Promise<ScheduledService[]> => {
    try {
      let query = supabase
        .from('scheduled_services')
        .select(`
          *,
          forklift:forklifts(*)
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
          forklift:forklifts(*)
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
          forklift:forklifts(*)
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
          forklift:forklifts(*)
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
          forklift:forklifts(*),
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
};
