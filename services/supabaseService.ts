import { createClient } from '@supabase/supabase-js';
import { Job, JobStatus, JobPriority, JobType, Part, User, UserRole, Customer, JobMedia, SignatureEntry, Forklift, ForkliftStatus } from '../types_with_invoice_tracking';

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

  updateUser: async (userId: string, updates: Partial<User>): Promise<User> => {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
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
      .order('created_at', { ascending: false });

    if (user.role === UserRole.TECHNICIAN) {
      query = query.eq('assigned_technician_id', user.user_id);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);
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
    return data as Job;
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
    return data as Job;
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
    return data as Job;
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
    const signatureEntry: SignatureEntry = {
      signed_by_name: signerName,
      signed_at: new Date().toISOString(),
      signature_url: signatureDataUrl,
    };

    const field = type === 'technician' ? 'technician_signature' : 'customer_signature';

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

  deleteJob: async (jobId: string): Promise<void> => {
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
    return data as Job;
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
};
