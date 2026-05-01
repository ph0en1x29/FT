/**
 * Replenishment Service
 * 
 * Handles van stock replenishment request workflows
 */

import type {
  ReplenishmentStatus,
  VanStockReplenishment,
} from '../types';
import { supabase } from './supabaseClient';

export const createReplenishmentRequest = async (
  vanStockId: string,
  technicianId: string,
  technicianName: string,
  items: { vanStockItemId: string; partId: string; partName: string; partCode: string; quantityRequested: number }[],
  requestType: 'manual' | 'auto_slot_in' | 'low_stock' = 'manual',
  triggeredByJobId?: string,
  notes?: string
): Promise<VanStockReplenishment> => {
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
};

export const getReplenishmentRequests = async (filters?: {
  technicianId?: string;
  status?: ReplenishmentStatus;
}): Promise<VanStockReplenishment[]> => {
  try {
    let query = supabase
      .from('van_stock_replenishments')
      .select(`*, items:van_stock_replenishment_items(*)`)
      .order('requested_at', { ascending: false });

    if (filters?.technicianId) query = query.eq('technician_id', filters.technicianId);
    if (filters?.status) query = query.eq('status', filters.status);

    const { data, error } = await query;
    if (error) {
      return [];
    }
    return data as VanStockReplenishment[];
  } catch (_e) {
    return [];
  }
};

export const approveReplenishmentRequest = async (
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
};

export const fulfillReplenishment = async (
  replenishmentId: string,
  itemsIssued: { itemId: string; quantityIssued: number; serialNumbers?: string[] }[],
  fulfilledById: string,
  fulfilledByName: string
): Promise<VanStockReplenishment> => {
  // Batched via fulfill_replenishment(uuid, jsonb, uuid, text) RPC.
  // See migration 20260501_replenishment_batch_rpcs.sql. Replaces a per-item
  // UPDATE loop that issued one round-trip per replenishment line.
  const itemsPayload = itemsIssued.map(item => ({
    item_id: item.itemId,
    quantity_issued: item.quantityIssued,
    serial_numbers: item.serialNumbers || [],
  }));

  const { error: rpcError } = await supabase.rpc('fulfill_replenishment', {
    p_replenishment_id: replenishmentId,
    p_items: itemsPayload,
    p_fulfilled_by_id: fulfilledById,
    p_fulfilled_by_name: fulfilledByName,
  });
  if (rpcError) throw new Error(rpcError.message);

  const { data, error } = await supabase
    .from('van_stock_replenishments')
    .select()
    .eq('replenishment_id', replenishmentId)
    .single();

  if (error) throw new Error(error.message);
  return data as VanStockReplenishment;
};

export const confirmReplenishmentReceipt = async (
  replenishmentId: string,
  confirmationPhotoUrl?: string
): Promise<VanStockReplenishment> => {
  // Batched via confirm_replenishment_receipt(uuid, text) RPC. Replaces a
  // read-modify-write loop (one SELECT + one UPDATE per replenishment line)
  // with a single SQL statement that increments quantities in place.
  const { error: rpcError } = await supabase.rpc('confirm_replenishment_receipt', {
    p_replenishment_id: replenishmentId,
    p_confirmation_photo_url: confirmationPhotoUrl ?? null,
  });
  if (rpcError) throw new Error(rpcError.message);

  const { data, error } = await supabase
    .from('van_stock_replenishments')
    .select()
    .eq('replenishment_id', replenishmentId)
    .single();

  if (error) throw new Error(error.message);
  return data as VanStockReplenishment;
};
