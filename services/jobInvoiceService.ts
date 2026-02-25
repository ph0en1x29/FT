/**
 * Job Invoice Service
 * 
 * Handles invoice/billing related operations, parts, and extra charges.
 */

import type { Job } from '../types';
import { JobStatus as JobStatusEnum,UserRole } from '../types';
import { updateForkliftHourmeter } from './forkliftService';
import { supabase } from './supabaseClient';
import { useInternalBulk, sellContainersExternal } from './liquidInventoryService';

// Forward declaration to avoid circular dependency
const getJobById = async (jobId: string): Promise<Job | null> => {
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
    .is('deleted_at', null)
    .single();

  if (error) {
    console.error('Error fetching job:', error);
    return null;
  }

  return data as Job;
};

// =====================
// PARTS MANAGEMENT
// =====================

export const addPartToJob = async (
  jobId: string,
  partId: string,
  quantity: number,
  customPrice?: number,
  actorRole?: UserRole,
  actorId?: string,
  actorName?: string
): Promise<Job> => {
  const { data: part, error: partError } = await supabase
    .from('parts')
    .select('*')
    .eq('part_id', partId)
    .single();

  if (partError) throw new Error(partError.message);
  // Admin can add parts regardless of stock (pre-allocation, ordering, etc.)
  // Technicians are blocked if insufficient stock
  if (actorRole !== UserRole.ADMIN && part.stock_quantity < quantity) {
    throw new Error('Insufficient stock');
  }

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

  if (actorRole === UserRole.ADMIN || actorRole === UserRole.TECHNICIAN) {
    if (part.is_liquid && part.container_size) {
      // Liquid item — use dual-unit deduction
      // For now, deduct from bulk (internal use) by default
      // External sales (sealed containers) should use sellContainersExternal directly
      try {
        await useInternalBulk(partId, quantity, jobId, actorId || '', actorName);
      } catch (liquidErr) {
        console.warn('Liquid stock deduction failed, falling back to legacy:', (liquidErr as Error).message);
        // Fallback to legacy stock_quantity deduction
        const newStock = Math.max(0, part.stock_quantity - quantity);
        await supabase.from('parts').update({ stock_quantity: newStock }).eq('part_id', partId);
      }
    } else {
      // Non-liquid — legacy deduction
      const newStock = Math.max(0, part.stock_quantity - quantity);
      const { error: stockError } = await supabase
        .from('parts')
        .update({ stock_quantity: newStock })
        .eq('part_id', partId);
      if (stockError) {
        console.warn('Part added, but stock update failed (RLS?):', stockError.message);
      }
    }
  }

  // Auto-confirm parts (and job for unified admin) when admin adds them
  if (actorRole === UserRole.ADMIN && actorId && actorName) {
    const now = new Date().toISOString();
    const { error: confirmError } = await supabase
      .from('jobs')
      .update({
        parts_confirmed_at: now,
        parts_confirmed_by_id: actorId,
        parts_confirmed_by_name: actorName,
        job_confirmed_at: now,
        job_confirmed_by_id: actorId,
        job_confirmed_by_name: actorName,
      })
      .eq('job_id', jobId);
    if (confirmError) {
      console.warn('Part added, but auto-confirm failed:', confirmError.message);
    }
  }

  return getJobById(jobId) as Promise<Job>;
};

export const updatePartPrice = async (jobId: string, jobPartId: string, newPrice: number): Promise<Job> => {
  const { error } = await supabase
    .from('job_parts')
    .update({ sell_price_at_time: newPrice })
    .eq('job_part_id', jobPartId)
    .eq('job_id', jobId);

  if (error) throw new Error(error.message);
  return getJobById(jobId) as Promise<Job>;
};

export const removePartFromJob = async (jobId: string, jobPartId: string, actorRole?: UserRole): Promise<Job> => {
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
  return getJobById(jobId) as Promise<Job>;
};

// =====================
// LABOR & EXTRA CHARGES
// =====================

export const updateLaborCost = async (jobId: string, laborCost: number): Promise<Job> => {
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
};

export const addExtraCharge = async (
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
  return getJobById(jobId) as Promise<Job>;
};

export const removeExtraCharge = async (jobId: string, chargeId: string): Promise<Job> => {
  const { error } = await supabase
    .from('extra_charges')
    .delete()
    .eq('charge_id', chargeId)
    .eq('job_id', jobId);

  if (error) throw new Error(error.message);
  return getJobById(jobId) as Promise<Job>;
};

// =====================
// INVOICE OPERATIONS
// =====================

export const finalizeInvoice = async (jobId: string, accountantId: string, accountantName: string): Promise<Job> => {
  const job = await getJobById(jobId);
  
  if (job && job.forklift_id && job.hourmeter_reading) {
    await updateForkliftHourmeter(job.forklift_id, job.hourmeter_reading);
  }

  const { data, error } = await supabase
    .from('jobs')
    .update({
      status: JobStatusEnum.COMPLETED,
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
};

export const sendInvoice = async (jobId: string, method: 'email' | 'whatsapp' | 'both'): Promise<Job> => {
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
};

export const generateInvoiceText = (job: Job): string => {
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
};
