/* eslint-disable max-lines */
/**
 * Inventory Service
 * 
 * Handles parts CRUD and van stock management
 */

import type {
  Part,
  VanStock,
  VanStockAudit,
  VanStockItem,
  VanStockUsage
} from '../types';
import { supabase } from './supabaseClient';

// Re-exports for backward compatibility
export { createPart, deletePart, getParts, getPartsForList, updatePart } from './partsService';
export { approveReplenishmentRequest, confirmReplenishmentReceipt, createReplenishmentRequest, fulfillReplenishment, getReplenishmentRequests } from './replenishmentService';

// Database row types for Supabase responses (before transformation)
interface VanStockItemRow extends VanStockItem {
  part?: Part;
}

interface VanStockRow extends VanStock {
  items?: VanStockItemRow[];
}

// =====================
// VAN STOCK MANAGEMENT
// =====================

export const getAllVanStocks = async (): Promise<VanStock[]> => {
  try {
    const { data, error } = await supabase
      .from('van_stocks')
      .select(`
        *,
        technician:users!technician_id(*),
        items:van_stock_items(*, part:parts(*))
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      return [];
    }

    return (data || []).map((vs: VanStockRow) => ({
      ...vs,
      technician_name: vs.technician?.name || vs.technician_name || 'Unknown',
      total_value: vs.items?.reduce((sum: number, item: VanStockItemRow) => {
        const partCost = item.part?.cost_price || 0;
        return sum + (partCost * item.quantity);
      }, 0) || 0,
    })) as VanStock[];
  } catch (_e) {
    return [];
  }
};

export const getVanStockByTechnician = async (technicianId: string): Promise<VanStock | null> => {
  try {
    const { data, error } = await supabase
      .from('van_stocks')
      .select(`
        *,
        technician:users!technician_id(*),
        items:van_stock_items(*, part:parts(*))
      `)
      .eq('technician_id', technicianId)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      return null;
    }

    const items = (data.items || []) as VanStockItemRow[];
    const total_value = items.reduce((sum: number, item: VanStockItemRow) => {
      const partCost = item.part?.cost_price || 0;
      return sum + (partCost * item.quantity);
    }, 0);

    return { ...data, technician_name: data.technician?.name || data.technician_name || 'Unknown', total_value } as VanStock;
  } catch (_e) {
    return null;
  }
};

/** Lightweight list of active vans (no items loaded) for dropdowns */
export const getActiveVansList = async (): Promise<VanStock[]> => {
  try {
    const { data, error } = await supabase
      .from('van_stocks')
      .select(`*, technician:users!technician_id(name)`)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) return [];
    return (data || []).map((vs: VanStockRow) => ({
      ...vs,
      technician_name: vs.technician?.name || vs.technician_name || 'Unknown',
      // No items loaded — lightweight for dropdown use
    })) as VanStock[];
  } catch (_e) {
    return [];
  }
};

export const getVanStockById = async (vanStockId: string): Promise<VanStock | null> => {
  try {
    const { data, error } = await supabase
      .from('van_stocks')
      .select(`
        *,
        technician:users!technician_id(*),
        items:van_stock_items(*, part:parts(*))
      `)
      .eq('van_stock_id', vanStockId)
      .single();

    if (error) {
      return null;
    }

    const items = (data.items || []) as VanStockItemRow[];
    const total_value = items.reduce((sum: number, item: VanStockItemRow) => {
      const partCost = item.part?.cost_price || 0;
      return sum + (partCost * item.quantity);
    }, 0);

    return { ...data, technician_name: data.technician?.name || data.technician_name || 'Unknown', total_value } as VanStock;
  } catch (_e) {
    return null;
  }
};

export const createVanStock = async (
  technicianId: string,
  technicianName: string,
  vanCode: string,
  createdById?: string,
  createdByName?: string,
  notes?: string
): Promise<VanStock> => {
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
    .select(`*, technician:users!technician_id(*)`)
    .single();

  if (error) {
    throw new Error(error.message);
  }
  const result = {
    ...data,
    technician_name: data.technician?.name || technicianName,
  };
  return result as VanStock;
};

export const updateVanStock = async (
  vanStockId: string,
  updates: { van_code?: string; notes?: string; max_items?: number; is_active?: boolean; technician_id?: string }
): Promise<VanStock> => {
  const { data, error } = await supabase
    .from('van_stocks')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('van_stock_id', vanStockId)
    .select(`*, technician:users!technician_id(*)`)
    .single();

  if (error) throw new Error(error.message);
  return { ...data, technician_name: data.technician?.name } as VanStock;
};

export const deleteVanStock = async (vanStockId: string, hardDelete: boolean = false): Promise<void> => {
  if (hardDelete) {
    const { error } = await supabase
      .from('van_stocks')
      .delete()
      .eq('van_stock_id', vanStockId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from('van_stocks')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('van_stock_id', vanStockId);
    if (error) throw new Error(error.message);
  }
};

export const transferVanStockItems = async (
  fromVanStockId: string,
  toVanStockId: string,
  itemIds: string[]
): Promise<void> => {
  const { error } = await supabase
    .from('van_stock_items')
    .update({ van_stock_id: toVanStockId })
    .in('item_id', itemIds);
  if (error) throw new Error(error.message);
};

export const addVanStockItem = async (
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
    .select(`*, part:parts(*)`)
    .single();

  if (error) throw new Error(error.message);
  return data as VanStockItem;
};

export const updateVanStockItemQuantity = async (itemId: string, quantity: number): Promise<VanStockItem> => {
  const { data, error } = await supabase
    .from('van_stock_items')
    .update({ quantity, updated_at: new Date().toISOString() })
    .eq('item_id', itemId)
    .select(`*, part:parts(*)`)
    .single();

  if (error) throw new Error(error.message);
  return data as VanStockItem;
};

/** Atomically increment van stock item quantity (avoids stale read race condition) */
export const incrementVanStockItemQuantity = async (itemId: string, incrementBy: number): Promise<VanStockItem> => {
  const { data, error } = await supabase.rpc('increment_van_stock_quantity', {
    p_item_id: itemId,
    p_increment: incrementBy,
  });
  if (error) throw new Error(error.message);

  // Re-fetch with part join since RPC doesn't return joined data
  const { data: item, error: fetchError } = await supabase
    .from('van_stock_items')
    .select(`*, part:parts(*)`)
    .eq('item_id', itemId)
    .single();
  if (fetchError) throw new Error(fetchError.message);
  return item as VanStockItem;
};

export const useVanStockPart = async (
  vanStockItemId: string,
  jobId: string,
  quantityUsed: number,
  usedById: string,
  usedByName: string,
  requiresApproval: boolean = false
): Promise<VanStockUsage> => {
  const { data: item, error: itemError } = await supabase
    .from('van_stock_items')
    .select('quantity')
    .eq('item_id', vanStockItemId)
    .single();

  if (itemError) throw new Error(itemError.message);
  if (!item || item.quantity < quantityUsed) {
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

export const getLowStockItems = async (technicianId: string): Promise<VanStockItem[]> => {
  try {
    const { data: vanStock } = await supabase
      .from('van_stocks')
      .select(`items:van_stock_items(*, part:parts(*))`)
      .eq('technician_id', technicianId)
      .eq('is_active', true)
      .single();

    if (!vanStock?.items) return [];

    return (vanStock.items as VanStockItemRow[]).filter((item) => item.quantity <= item.min_quantity) as VanStockItem[];
  } catch (_e) {
    return [];
  }
};

/**
 * Get count of all low-stock van stock items across all technicians (for admin dashboard)
 */
export const getGlobalLowStockCount = async (): Promise<number> => {
  try {
    const { data } = await supabase
      .from('van_stock_items')
      .select('quantity, min_quantity');
    return (data || []).filter(i => i.quantity <= i.min_quantity).length;
  } catch {
    return 0;
  }
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

export const getVanStockUsageHistory = async (
  technicianId: string,
  limit: number = 50
): Promise<VanStockUsage[]> => {
  try {
    const { data, error } = await supabase
      .from('van_stock_usage')
      .select(`
        *,
        van_stock_item:van_stock_items(*, part:parts(*), van_stock:van_stocks!inner(technician_id)),
        job:jobs(job_id, title)
      `)
      .eq('van_stock_item.van_stock.technician_id', technicianId)
      .order('used_at', { ascending: false })
      .limit(limit);

    if (error) {
      return [];
    }
    return data as VanStockUsage[];
  } catch (_e) {
    return [];
  }
};
