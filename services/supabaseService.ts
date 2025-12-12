import { createClient } from '@supabase/supabase-js';
import { Job, JobStatus, JobPriority, Part, User, UserRole, Customer, JobMedia, SignatureEntry } from '../types_with_invoice_tracking';

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

  getParts: async (): Promise<Part[]> => {
    const { data, error } = await supabase
      .from('parts')
      .select('*')
      .order('part_name');

    if (error) throw new Error(error.message);
    return data as Part[];
  },

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

  // UPDATED: Now includes extra_charges in the query
  getJobs: async (user: User): Promise<Job[]> => {
    let query = supabase
      .from('jobs')
      .select(`
        *,
        customer:customers(*),
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

  // UPDATED: Now includes extra_charges in the query
  getJobById: async (jobId: string): Promise<Job | null> => {
    const { data, error } = await supabase
      .from('jobs')
      .select(`
        *,
        customer:customers(*),
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

  createJob: async (jobData: Partial<Job>): Promise<Job> => {
    const { data, error } = await supabase
      .from('jobs')
      .insert({
        customer_id: jobData.customer_id,
        title: jobData.title,
        description: jobData.description,
        priority: jobData.priority || JobPriority.MEDIUM,
        status: jobData.status || JobStatus.NEW,
        assigned_technician_id: jobData.assigned_technician_id || null,
        assigned_technician_name: jobData.assigned_technician_name || null,
        notes: jobData.notes || [],
        labor_cost: jobData.labor_cost || 150, // Default labor cost
      })
      .select(`
        *,
        customer:customers(*),
        parts_used:job_parts(*),
        media:job_media(*),
        extra_charges:extra_charges(*)
      `)
      .single();

    if (error) throw new Error(error.message);
    return data as Job;
  },

  assignJob: async (jobId: string, technicianId: string, technicianName: string): Promise<Job> => {
    const { data, error } = await supabase
      .from('jobs')
      .update({
        assigned_technician_id: technicianId,
        assigned_technician_name: technicianName,
        status: JobStatus.ASSIGNED,
      })
      .eq('job_id', jobId)
      .select(`
        *,
        customer:customers(*),
        parts_used:job_parts(*),
        media:job_media(*),
        extra_charges:extra_charges(*)
      `)
      .single();

    if (error) throw new Error(error.message);
    return data as Job;
  },

  updateJobStatus: async (jobId: string, status: JobStatus): Promise<Job> => {
    const updates: any = { status };

    if (status === JobStatus.IN_PROGRESS) {
      updates.arrival_time = new Date().toISOString();
    }
    if (status === JobStatus.AWAITING_FINALIZATION) {
      updates.completion_time = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('jobs')
      .update(updates)
      .eq('job_id', jobId)
      .select(`
        *,
        customer:customers(*),
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

  addMedia: async (jobId: string, media: Omit<JobMedia, 'media_id' | 'job_id'>): Promise<Job> => {
    const { error } = await supabase
      .from('job_media')
      .insert({
        job_id: jobId,
        ...media,
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
    // First get the part details to restore stock
    const { data: jobPart } = await supabase
      .from('job_parts')
      .select('part_id, quantity')
      .eq('job_part_id', jobPartId)
      .single();

    if (jobPart) {
      // Restore stock quantity
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

    // Delete the job_part record
    const { error } = await supabase
      .from('job_parts')
      .delete()
      .eq('job_part_id', jobPartId)
      .eq('job_id', jobId);

    if (error) throw new Error(error.message);
    
    return SupabaseDb.getJobById(jobId) as Promise<Job>;
  },

  // NEW: Update labor cost for a job
  updateLaborCost: async (jobId: string, laborCost: number): Promise<Job> => {
    const { data, error } = await supabase
      .from('jobs')
      .update({ labor_cost: laborCost })
      .eq('job_id', jobId)
      .select(`
        *,
        customer:customers(*),
        parts_used:job_parts(*),
        media:job_media(*),
        extra_charges:extra_charges(*)
      `)
      .single();

    if (error) throw new Error(error.message);
    return data as Job;
  },

  // NEW: Add an extra charge to a job
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

  // NEW: Remove an extra charge from a job
  removeExtraCharge: async (jobId: string, chargeId: string): Promise<Job> => {
    const { error } = await supabase
      .from('extra_charges')
      .delete()
      .eq('charge_id', chargeId)
      .eq('job_id', jobId);

    if (error) throw new Error(error.message);
    
    return SupabaseDb.getJobById(jobId) as Promise<Job>;
  },

  // Finalize invoice with tracking
  finalizeInvoice: async (jobId: string, accountantId: string, accountantName: string): Promise<Job> => {
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
        parts_used:job_parts(*),
        media:job_media(*),
        extra_charges:extra_charges(*)
      `)
      .single();

    if (error) throw new Error(error.message);
    return data as Job;
  },

  // Send invoice to customer
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
        parts_used:job_parts(*),
        media:job_media(*),
        extra_charges:extra_charges(*)
      `)
      .single();

    if (error) throw new Error(error.message);
    return data as Job;
  },

  // Generate invoice text for sending
  generateInvoiceText: (job: Job): string => {
    const totalParts = job.parts_used.reduce((acc, p) => acc + (p.sell_price_at_time * p.quantity), 0);
    const laborCost = job.labor_cost || 150;
    const extraCharges = (job.extra_charges || []).reduce((acc, c) => acc + c.amount, 0);
    const total = totalParts + laborCost + extraCharges;

    let text = `*INVOICE - ${job.title}*\n\n`;
    text += `Customer: ${job.customer.name}\n`;
    text += `Address: ${job.customer.address}\n`;
    text += `Date: ${new Date(job.created_at).toLocaleDateString()}\n\n`;
    
    text += `*Services Provided:*\n`;
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
};