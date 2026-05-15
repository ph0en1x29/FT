/**
 * Van Stock Usage Service
 *
 * Handles usage entries, approvals, rejections, and audit scheduling.
 */

import type { JobPartUsed, VanStockAudit, VanStockUsage } from '../types';
import { supabase } from './supabaseClient';

/**
 * Atomic non-liquid van-stock consumption (PR 2 2026-05-07).
 * Wraps the rpc_use_van_stock_part RPC so decrement + usage + movement +
 * job_parts insert happen in one Postgres transaction. Idempotent via
 * idempotencyKey: same key returns the same job_parts row, no double-decrement.
 *
 * Caller MUST mint a stable idempotency key per logical user action (e.g. one
 * "Add to job" button click). Re-mint on retry, not on each call inside a retry.
 */
export const consumeVanStockPartAtomic = async (args: {
  itemId: string;
  jobId: string;
  quantity: number;
  idempotencyKey: string;
  useBulk?: boolean;
  notes?: string;
}): Promise<JobPartUsed> => {
  const { data, error } = await supabase.rpc('rpc_use_van_stock_part', {
    p_item_id: args.itemId,
    p_job_id: args.jobId,
    p_quantity: args.quantity,
    p_idempotency_key: args.idempotencyKey,
    p_use_bulk: args.useBulk ?? false,
    p_notes: args.notes ?? null,
  });
  if (error) throw new Error(error.message);
  return data as JobPartUsed;
};

export const useVanStockPart = async (
  vanStockItemId: string,
  jobId: string,
  quantityUsed: number,
  usedById: string,
  usedByName: string,
  requiresApproval: boolean = false
): Promise<VanStockUsage> => {
  // Liquid-aware fetch: for liquid items, .quantity is 0 by the
  // route-trigger contract; real on-hand is effective_quantity
  // (containers × size + bulk). Use that for the availability check so
  // liquids aren't always rejected as "insufficient" here.
  const { data: item, error: itemError } = await supabase
    .from('van_stock_items')
    .select('quantity, container_quantity, bulk_quantity, effective_quantity, part:parts(is_liquid, container_size)')
    .eq('item_id', vanStockItemId)
    .single();

  if (itemError) throw new Error(itemError.message);
  const itemAny = item as unknown as {
    quantity?: number | null;
    container_quantity?: number | null;
    bulk_quantity?: number | null;
    effective_quantity?: number | null;
    part?: { is_liquid?: boolean | null; container_size?: number | null } | null;
  } | null;
  const isLiquid = !!itemAny?.part?.is_liquid;
  const onHand = itemAny?.effective_quantity != null
    ? Number(itemAny.effective_quantity)
    : isLiquid
      ? (Number(itemAny?.container_quantity ?? 0) * Number(itemAny?.part?.container_size ?? 0)) + Number(itemAny?.bulk_quantity ?? 0)
      : Number(itemAny?.quantity ?? 0);
  if (onHand < quantityUsed) {
    throw new Error('Insufficient Van Stock quantity');
  }

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

  // Liquid-aware decrement: for liquid items the .quantity is held at 0
  // by trg_route_liquid_to_bulk_quantity; the real on-hand lives in
  // bulk_quantity (or split across containers). Decrement bulk_quantity for
  // simple cases; if bulk is insufficient and we have containers, the
  // caller should use the atomic rpc_use_van_stock_part instead — this
  // legacy path only handles bulk-only liquids cleanly.
  const updatePayload = isLiquid
    ? {
        bulk_quantity: Math.max(0, Number(itemAny?.bulk_quantity ?? 0) - quantityUsed),
        last_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    : {
        quantity: Number(itemAny?.quantity ?? 0) - quantityUsed,
        last_used_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
  const { error: updateError } = await supabase
    .from('van_stock_items')
    .update(updatePayload)
    .eq('item_id', vanStockItemId);

  if (updateError) throw new Error(updateError.message);

  const { data: itemDetail } = await supabase
    .from('van_stock_items')
    .select('part_id, van_stock_id')
    .eq('item_id', vanStockItemId)
    .single();

  if (itemDetail) {
    await supabase.from('inventory_movements').insert({
      part_id: itemDetail.part_id,
      movement_type: 'use_internal',
      container_qty_change: -quantityUsed,
      bulk_qty_change: 0,
      job_id: jobId,
      van_stock_id: itemDetail.van_stock_id,
      van_stock_item_id: vanStockItemId,
      performed_by: usedById,
      performed_by_name: usedByName,
      notes: `Used ${quantityUsed} from van stock`,
      van_container_qty_after: isLiquid
        ? Number(itemAny?.container_quantity ?? 0)
        : Number(itemAny?.quantity ?? 0) - quantityUsed,
      van_bulk_qty_after: isLiquid
        ? Math.max(0, Number(itemAny?.bulk_quantity ?? 0) - quantityUsed)
        : 0,
    }).then(({ error: mvErr }) => {
      if (mvErr) console.warn('Movement log failed:', mvErr.message);
    });
  }

  return usage as VanStockUsage;
};

export const getPendingVanStockApprovals = async (): Promise<VanStockUsage[]> => {
  try {
    const { data, error } = await supabase
      .from('van_stock_usage')
      .select(`
        *,
        van_stock_item:van_stock_items(*, part:parts(*)),
        job:jobs(job_id, title, customer:customers(name))
      `)
      .eq('requires_approval', true)
      .eq('approval_status', 'pending')
      .order('used_at', { ascending: false });

    if (error) {
      return [];
    }
    return data as VanStockUsage[];
  } catch (_e) {
    return [];
  }
};

export const approveVanStockUsage = async (
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
};

export const rejectVanStockUsage = async (
  usageId: string,
  approvedById: string,
  approvedByName: string,
  rejectionReason: string
): Promise<VanStockUsage> => {
  const { data: usage, error: usageError } = await supabase
    .from('van_stock_usage')
    .select('van_stock_item_id, quantity_used')
    .eq('usage_id', usageId)
    .single();

  if (usageError) throw new Error(usageError.message);

  // Liquid-aware refund: for liquids the .quantity column is 0 by the
  // route-trigger contract; the real bucket is bulk_quantity. Crediting
  // back .quantity for a liquid usage would corrupt the row and the
  // refund would be invisible.
  const { data: rejItem } = await supabase
    .from('van_stock_items')
    .select('quantity, bulk_quantity, part:parts(is_liquid)')
    .eq('item_id', usage.van_stock_item_id)
    .single();

  if (rejItem) {
    const rejAny = rejItem as unknown as {
      quantity?: number | null;
      bulk_quantity?: number | null;
      part?: { is_liquid?: boolean | null } | null;
    };
    const refundUpdate = rejAny.part?.is_liquid
      ? {
          bulk_quantity: Number(rejAny.bulk_quantity ?? 0) + Number(usage.quantity_used),
          updated_at: new Date().toISOString(),
        }
      : {
          quantity: Number(rejAny.quantity ?? 0) + Number(usage.quantity_used),
          updated_at: new Date().toISOString(),
        };
    await supabase
      .from('van_stock_items')
      .update(refundUpdate)
      .eq('item_id', usage.van_stock_item_id);
  }

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
};

export const scheduleVanStockAudit = async (
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
};
