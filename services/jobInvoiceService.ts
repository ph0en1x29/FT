/**
 * Job Invoice Service
 * 
 * Handles invoice/billing related operations, parts, and extra charges.
 */

import type { Job } from '../types';
import { JobStatus as JobStatusEnum,UserRole } from '../types';
import { updateForkliftHourmeter } from './forkliftService';
import { supabase } from './supabaseClient';
import { useInternalBulk as consumeInternalBulk, sellContainersExternal } from './liquidInventoryService';

// Forward declaration to avoid circular dependency
const getJobById = async (jobId: string): Promise<Job | null> => {
  const { data, error } = await supabase
    .from('jobs')
    .select(`
      *,
      customer:customers(*),
      forklift:forklifts!forklift_id(*),
      parts_used:job_parts(*),
      media:job_media!job_media_job_id_fkey(*),
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
  actorName?: string,
  sellSealed?: boolean,
  // Van-stock provenance (added 2026-05-07). When set, the resulting
  // job_parts row is flagged from_van_stock=true with the source item_id.
  // The "(VS)" marker on the JobDetail parts list keys off these.
  vanStockOptions?: {
    fromVanStock: boolean;
    vanStockItemId?: string;
  }
): Promise<Job> => {
  const { data: part, error: partError } = await supabase
    .from('parts')
    .select('part_id, part_name, part_code, category, cost_price, sell_price, warranty_months, stock_quantity, last_updated_by, last_updated_by_name, updated_at, min_stock_level, supplier, location, unit, base_unit, container_unit, container_size, container_quantity, bulk_quantity, price_per_base_unit, is_liquid, avg_cost_per_liter, last_purchase_cost_per_liter, is_warranty_excluded')
    .eq('part_id', partId)
    .single();

  if (partError) throw new Error(partError.message);
  // Admin can add parts regardless of stock (pre-allocation, ordering, etc.)
  // Technicians are blocked if insufficient stock — UNLESS it's coming from
  // van stock (already deducted from van), in which case the catalog stock
  // check is moot.
  if (
    actorRole !== UserRole.ADMIN &&
    !vanStockOptions?.fromVanStock &&
    part.stock_quantity < quantity
  ) {
    throw new Error('Insufficient stock');
  }

  const { error: insertError } = await supabase
    .from('job_parts')
    .insert({
      job_id: jobId,
      part_id: partId,
      part_name: part.part_name,
      quantity,
      sell_price_at_time: customPrice !== undefined ? customPrice : (part.sell_price ?? part.cost_price ?? 0),
      // ACWER Phase 9b — snapshot the part's cost at insertion so the
      // internal-cost report variant (ServiceReportPDF view='internal_cost')
      // can compute margin without a parts JOIN at read time. Falls back to
      // 0 if cost_price isn't set on the master row.
      cost_price_at_time: part.cost_price ?? 0,
      from_van_stock: vanStockOptions?.fromVanStock ?? false,
      van_stock_item_id: vanStockOptions?.vanStockItemId ?? null,
    });

  if (insertError) throw new Error(insertError.message);

  // ACWER Phase 7 — read the deferred-deduction feature flag. When TRUE,
  // skip the immediate stock decrement; deduction will run in
  // acwer_finalize_job_part_deduction() once Admin 2 confirms parts.
  // Defaults FALSE — preserves the legacy immediate-deduct behaviour.
  let deferDeduction = false;
  try {
    const { data: settings } = await supabase
      .from('acwer_settings')
      .select('feature_deduct_on_finalize')
      .eq('id', 1)
      .single();
    deferDeduction = settings?.feature_deduct_on_finalize === true;
  } catch (_e) { /* fail-open: keep legacy behaviour */ }

  // ACWER Phase 7 — stamp deducted_at on the newly-inserted job_parts row
  // when deduction actually happens at add time. That's: never deferred for
  // liquids (Phase 7 finalize doesn't handle them) AND not deferred for
  // non-liquids when feature_deduct_on_finalize=FALSE. When deduction is
  // deferred, deducted_at stays NULL until acwer_finalize_job_part_deduction
  // stamps it at Admin 2 confirm time.
  const stampDeductedAtNow = part.is_liquid === true || !deferDeduction;
  if (stampDeductedAtNow) {
    await supabase
      .from('job_parts')
      .update({
        deducted_at: new Date().toISOString(),
        deducted_by_id: actorId ?? null,
        deducted_by_name: actorName ?? null,
      })
      .eq('job_id', jobId)
      .eq('part_id', partId)
      .is('deducted_at', null);
  }

  // Liquid parts always deduct immediately (the Phase 7 deferred-deduction
  // function intentionally doesn't handle liquids — sealed/internal split
  // semantics make deferral too lossy). Non-liquid parts honour the flag.
  // Skip main-inventory deduction entirely when this part came from van
  // stock — the van-side deduction already happened upstream
  // (vanStockUsageService / liquidInventoryService).
  const shouldRunImmediateDeduction =
    !vanStockOptions?.fromVanStock &&
    (actorRole === UserRole.ADMIN || actorRole === UserRole.TECHNICIAN) &&
    (part.is_liquid === true || !deferDeduction);
  if (shouldRunImmediateDeduction) {
    if (part.is_liquid && part.container_size) {
      // Liquid item — branch on sell mode
      try {
        if (sellSealed) {
          // Sell sealed containers to external client
          await sellContainersExternal(partId, quantity, jobId, actorId || '', actorName);
        } else {
          // Use loose bulk liters internally
          await consumeInternalBulk(partId, quantity, jobId, actorId || '', actorName);
        }
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
      } else {
        // Log movement for audit trail
        await supabase.from('inventory_movements').insert({
          part_id: partId,
          movement_type: 'use_internal',
          container_qty_change: -quantity,
          bulk_qty_change: 0,
          job_id: jobId,
          performed_by: actorId || '',
          performed_by_name: actorName || null,
          notes: `Used ${quantity} ${part.unit || 'pcs'} on job (non-liquid)`,
          store_container_qty_after: newStock,
          store_bulk_qty_after: 0,
        }).then(({ error: mvErr }) => {
          if (mvErr) console.warn('Movement log failed:', mvErr.message);
        });
      }
    }
  }

  // ACWER Phase 4 — Path A enforcement: if this is an AMC-classified job and
  // the part is wear-and-tear (`is_warranty_excluded`), auto-flip the job's
  // billing_path to 'chargeable' with a system override stamp. Idempotent —
  // if the job is already non-AMC, this is a no-op.
  if (part.is_warranty_excluded === true) {
    const { data: jobRow } = await supabase
      .from('jobs')
      .select('billing_path')
      .eq('job_id', jobId)
      .single();
    if (jobRow?.billing_path === 'amc') {
      const reason = `Auto-flipped from AMC to Chargeable: contains wear-and-tear part "${part.part_name}"`;
      const { error: flipError } = await supabase
        .from('jobs')
        .update({
          billing_path: 'chargeable',
          billing_path_reason: reason,
          billing_path_overridden_at: new Date().toISOString(),
          billing_path_overridden_by_id: actorId ?? null,
        })
        .eq('job_id', jobId);
      if (flipError) {
        console.warn('Path A auto-flip failed:', flipError.message);
      }
    }
  }

  // ACWER Phase 6 — Path C overage enforcement: if this is a fleet-classified
  // job and the part's category is on the parts_usage_quotas list, check the
  // running yearly total via the helper. If we'd exceed the quota with this
  // add, flip the job to chargeable. Idempotent — only flips if currently 'fleet'.
  if (part.category) {
    const { data: jobRow } = await supabase
      .from('jobs')
      .select('billing_path, forklift_id')
      .eq('job_id', jobId)
      .single();
    if (jobRow?.billing_path === 'fleet' && jobRow.forklift_id) {
      const { data: quotaRow } = await supabase
        .from('parts_usage_quotas')
        .select('max_quantity')
        .eq('scope_type', 'global')
        .eq('part_category', part.category)
        .eq('is_active', true)
        .maybeSingle();
      if (quotaRow?.max_quantity) {
        const { data: usedSoFar } = await supabase.rpc('acwer_part_category_usage_for_forklift', {
          p_forklift_id: jobRow.forklift_id,
          p_category: part.category,
          p_days_back: 365,
        });
        const used = Number(usedSoFar ?? 0);
        const max = Number(quotaRow.max_quantity);
        if (used + quantity > max) {
          const reason = `Auto-flipped from Fleet to Chargeable: consumable overage on category "${part.category}" — ${used + quantity}/${max} used in last 365 days`;
          const { error: flipError } = await supabase
            .from('jobs')
            .update({
              billing_path: 'chargeable',
              billing_path_reason: reason,
              billing_path_overridden_at: new Date().toISOString(),
              billing_path_overridden_by_id: actorId ?? null,
            })
            .eq('job_id', jobId);
          if (flipError) {
            console.warn('Path C overage auto-flip failed:', flipError.message);
          }
        }
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

/**
 * Add a tech-purchased external part to a job (the "wildcard" flow).
 *
 * Used when inventory is short and the technician buys the part from an
 * outside vendor. No catalog entry exists, so `part_id` stays NULL and
 * the row is flagged `is_external_purchase=true`. No stock deduction
 * happens (there's no catalog row to deduct from).
 *
 * Cost and sell price default to the same value (what the tech paid is
 * what the customer is charged). Admin can edit the sell price afterward
 * via `updatePartPrice` if a markup is needed.
 *
 * (Added 2026-05-07.)
 */
export const addExternalPartToJob = async (
  jobId: string,
  partName: string,
  quantity: number,
  pricePaid: number,
  options?: {
    notes?: string;
    sellPrice?: number; // defaults to pricePaid
    actorId?: string;
    actorName?: string;
    actorRole?: UserRole;
  }
): Promise<Job> => {
  const trimmed = partName.trim();
  if (!trimmed) throw new Error('Part name is required');
  if (quantity <= 0) throw new Error('Quantity must be greater than 0');
  if (pricePaid < 0) throw new Error('Price must be non-negative');

  const sellPrice = options?.sellPrice ?? pricePaid;

  const { error: insertError } = await supabase
    .from('job_parts')
    .insert({
      job_id: jobId,
      part_id: null,
      part_name: trimmed,
      quantity,
      sell_price_at_time: sellPrice,
      cost_price_at_time: pricePaid,
      from_van_stock: false,
      is_external_purchase: true,
      external_purchase_notes: options?.notes?.trim() || null,
      // Externally-purchased parts are immediately "deducted" — there's
      // nothing to defer because there's no catalog row.
      deducted_at: new Date().toISOString(),
      deducted_by_id: options?.actorId ?? null,
      deducted_by_name: options?.actorName ?? null,
    });

  if (insertError) throw new Error(insertError.message);

  // Auto-confirm parts when admin adds them — same shortcut as addPartToJob.
  if (options?.actorRole === UserRole.ADMIN && options.actorId && options.actorName) {
    const now = new Date().toISOString();
    await supabase
      .from('jobs')
      .update({
        parts_confirmed_at: now,
        parts_confirmed_by_id: options.actorId,
        parts_confirmed_by_name: options.actorName,
      })
      .eq('job_id', jobId);
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
      media:job_media!job_media_job_id_fkey(*),
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
      media:job_media!job_media_job_id_fkey(*),
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
      media:job_media!job_media_job_id_fkey(*),
      extra_charges:extra_charges(*)
    `)
    .single();

  if (error) throw new Error(error.message);
  return data as Job;
};

export const generateInvoiceText = (job: Job): string => {
  // Tech-returned parts (pending_return / returned) are excluded from the
  // invoice — see jobPartReturnService.isPartActiveOnInvoice.
  const billableParts = job.parts_used.filter(
    p => p.return_status !== 'pending_return' && p.return_status !== 'returned'
  );
  const totalParts = billableParts.reduce((acc, p) => acc + (p.sell_price_at_time * p.quantity), 0);
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

  if (billableParts.length > 0) {
    text += `*Parts Used:*\n`;
    billableParts.forEach(p => {
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
