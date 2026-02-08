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
  } catch (e) {
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
  for (const item of itemsIssued) {
    await supabase
      .from('van_stock_replenishment_items')
      .update({
        quantity_issued: item.quantityIssued,
        serial_numbers: item.serialNumbers || [],
      })
      .eq('item_id', item.itemId);
  }

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
};

export const confirmReplenishmentReceipt = async (
  replenishmentId: string,
  confirmationPhotoUrl?: string
): Promise<VanStockReplenishment> => {
  const { data: replenishment, error: repError } = await supabase
    .from('van_stock_replenishments')
    .select(`*, items:van_stock_replenishment_items(*)`)
    .eq('replenishment_id', replenishmentId)
    .single();

  if (repError) throw new Error(repError.message);

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
};
