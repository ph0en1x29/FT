/**
 * Inventory Service
 * 
 * Handles parts CRUD and van stock management
 */

import { supabase } from './supabaseClient';
import type { 
  Part, 
  VanStock, 
  VanStockItem, 
  VanStockUsage, 
  VanStockReplenishment,
  VanStockAudit,
  ReplenishmentStatus 
} from '../types';

// Database row types for Supabase responses (before transformation)
interface VanStockItemRow extends VanStockItem {
  part?: Part;
}

interface VanStockRow extends VanStock {
  items?: VanStockItemRow[];
}

// =====================
// PARTS CRUD
// =====================

export const getParts = async (): Promise<Part[]> => {
  const { data, error } = await supabase
    .from('parts')
    .select('*')
    .order('category')
    .order('part_name');

  if (error) throw new Error(error.message);
  return data as Part[];
};

export const getPartsForList = async (): Promise<Pick<Part, 'part_id' | 'part_name' | 'part_code' | 'category' | 'sell_price'>[]> => {
  const { data, error } = await supabase
    .from('parts')
    .select('part_id, part_name, part_code, category, sell_price')
    .order('category')
    .order('part_name');

  if (error) throw new Error(error.message);
  return data as Pick<Part, 'part_id' | 'part_name' | 'part_code' | 'category' | 'sell_price'>[];
};

export const createPart = async (partData: Partial<Part>): Promise<Part> => {
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
};

export const updatePart = async (partId: string, updates: Partial<Part>): Promise<Part> => {
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
};

export const deletePart = async (partId: string): Promise<void> => {
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
};

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

    return (data || []).map((vs: any) => ({
      ...vs,
      total_value: vs.items?.reduce((sum: number, item: any) => {
        const partCost = item.part?.cost_price || 0;
        return sum + (partCost * item.quantity);
      }, 0) || 0,
    })) as VanStock[];
  } catch (e) {
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

    const items = data.items || [];
    const total_value = items.reduce((sum: number, item: any) => {
      const partCost = item.part?.cost_price || 0;
      return sum + (partCost * item.quantity);
    }, 0);

    return { ...data, total_value } as VanStock;
  } catch (e) {
    return null;
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

    const items = data.items || [];
    const total_value = items.reduce((sum: number, item: any) => {
      const partCost = item.part?.cost_price || 0;
      return sum + (partCost * item.quantity);
    }, 0);

    return { ...data, total_value } as VanStock;
  } catch (e) {
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
  } catch (e) {
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

// =====================
// VAN STOCK REPLENISHMENT
// =====================

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

export const getLowStockItems = async (technicianId: string): Promise<VanStockItem[]> => {
  try {
    const { data: vanStock } = await supabase
      .from('van_stocks')
      .select(`items:van_stock_items(*, part:parts(*))`)
      .eq('technician_id', technicianId)
      .eq('is_active', true)
      .single();

    if (!vanStock?.items) return [];

    return vanStock.items.filter((item: any) => item.quantity <= item.min_quantity) as VanStockItem[];
  } catch (e) {
    return [];
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
  } catch (e) {
    return [];
  }
};
