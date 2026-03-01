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
        van_stock_id, van_code, van_plate, technician_id, is_active, van_status, last_audit_at, created_at,
        technician:users!technician_id(name),
        items:van_stock_items(
          item_id, part_id, quantity, container_quantity, bulk_quantity, min_quantity, max_quantity, last_replenished_at, last_used_at,
          part:parts(part_id, part_name, part_code, cost_price, sell_price, is_liquid, base_unit, container_unit, container_size)
        )
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      return [];
    }

    return (data || []).map((vs: any) => ({
      ...vs,
      technician_name: vs.technician?.name || 'Unknown',
      total_value: vs.items?.reduce((sum: number, item: VanStockItemRow) => {
        const partCost = item.part?.cost_price || 0;
        return sum + (partCost * item.quantity);
      }, 0) || 0,
    })) as unknown as VanStock[];
  } catch (_e) {
    return [];
  }
};

export const getVanStockByTechnician = async (technicianId: string): Promise<VanStock | null> => {
  try {
    // First check if tech is temporarily assigned to another van
    const { data: tempVan } = await supabase
      .from('van_stocks')
      .select(`
        van_stock_id, van_code, van_plate, technician_id, is_active, van_status, last_audit_at, created_at,
        technician:users!technician_id(name),
        items:van_stock_items(
          item_id, part_id, quantity, container_quantity, bulk_quantity, min_quantity, max_quantity, last_replenished_at, last_used_at,
          part:parts(part_id, part_name, part_code, cost_price, sell_price, is_liquid, base_unit, container_unit, container_size)
        )
      `)
      .eq('temporary_tech_id', technicianId)
      .eq('is_active', true)
      .single();

    // If temp-assigned, use that van
    const vanData = tempVan;

    // Otherwise fall back to their own van
    if (!vanData) {
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

      const items = (data.items || []) as unknown as VanStockItemRow[];
      const total_value = items.reduce((sum: number, item: VanStockItemRow) => {
        const partCost = item.part?.cost_price || 0;
        return sum + (partCost * item.quantity);
      }, 0);

      return { ...data, technician_name: (data as any).technician?.name || 'Unknown', total_value } as unknown as VanStock;
    }

    const items = (vanData.items || []) as unknown as VanStockItemRow[];
    const total_value = items.reduce((sum: number, item: VanStockItemRow) => {
      const partCost = item.part?.cost_price || 0;
      return sum + (partCost * item.quantity);
    }, 0);

    return { ...vanData, technician_name: (vanData as any).technician?.name || 'Unknown', total_value } as unknown as VanStock;
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
    return (data || []).map((vs: any) => ({
      ...vs,
      technician_name: vs.technician?.name || 'Unknown',
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
        van_stock_id, van_code, van_plate, technician_id, is_active, van_status, last_audit_at, created_at,
        technician:users!technician_id(name),
        items:van_stock_items(
          item_id, part_id, quantity, container_quantity, bulk_quantity, min_quantity, max_quantity, last_replenished_at, last_used_at,
          part:parts(part_id, part_name, part_code, cost_price, sell_price, is_liquid, base_unit, container_unit, container_size)
        )
      `)
      .eq('van_stock_id', vanStockId)
      .single();

    if (error) {
      return null;
    }

    const items = (data.items || []) as unknown as VanStockItemRow[];
    const total_value = items.reduce((sum: number, item: VanStockItemRow) => {
      const partCost = item.part?.cost_price || 0;
      return sum + (partCost * item.quantity);
    }, 0);

    return { ...data, technician_name: (data as any).technician?.name || 'Unknown', total_value } as unknown as VanStock;
  } catch (_e) {
    return null;
  }
};

export const createVanStock = async (
  technicianId: string,
  technicianName: string,
  vanCode: string,
  vanPlate?: string,
  createdById?: string,
  createdByName?: string,
  notes?: string
): Promise<VanStock> => {
  const { data, error } = await supabase
    .from('van_stocks')
    .insert({
      technician_id: technicianId,
      van_code: vanCode,
      van_plate: vanPlate || null,
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
  updates: { van_plate?: string; van_code?: string; notes?: string; max_items?: number; is_active?: boolean; technician_id?: string }
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

  // Log movement for audit trail
  // Get part_id and van_stock_id from the item
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
      notes: `Used ${quantityUsed} from van stock (non-liquid)`,
      van_container_qty_after: item.quantity - quantityUsed,
      van_bulk_qty_after: 0,
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
    return (data || []).filter((item) => {
      const min = item.min_quantity;
      const quantity = item.quantity;
      return min > 0 && quantity < min;
    }).length;
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

// =====================
// VAN FLEET MANAGEMENT
// =====================

import type { VanAccessRequest, VanAuditLogEntry, VanFleetItem, VanStatus } from '../types';

/** Get fleet overview for admin/supervisor */
export const getVanFleetOverview = async (): Promise<VanFleetItem[]> => {
  try {
    const { data, error } = await supabase
      .from('van_stocks')
      .select(`
        van_stock_id, van_code, van_plate, van_status, technician_id,
        temporary_tech_id, temporary_tech_name, is_active,
        technician:users!technician_id(name),
        items:van_stock_items(item_id)
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) return [];

    return (data || []).map((vs: Record<string, unknown>) => ({
      van_stock_id: vs.van_stock_id as string,
      van_code: vs.van_code as string | undefined,
      van_plate: vs.van_plate as string | undefined,
      van_status: (vs.van_status as VanStatus) || 'active',
      technician_id: vs.technician_id as string,
      technician_name: (vs.technician as Record<string, string>)?.name || 'Unknown',
      temporary_tech_id: vs.temporary_tech_id as string | null,
      temporary_tech_name: vs.temporary_tech_name as string | null,
      item_count: Array.isArray(vs.items) ? vs.items.length : 0,
      is_active: vs.is_active as boolean,
    }));
  } catch (_e) {
    return [];
  }
};

/** Update van status (active/in_service/decommissioned) */
export const updateVanStatus = async (
  vanStockId: string, newStatus: VanStatus, performedBy: { id: string; name: string }, reason?: string
): Promise<boolean> => {
  try {
    const { data: current } = await supabase
      .from('van_stocks').select('van_status').eq('van_stock_id', vanStockId).single();

    const { error } = await supabase
      .from('van_stocks')
      .update({ van_status: newStatus, updated_at: new Date().toISOString() })
      .eq('van_stock_id', vanStockId);

    if (error) return false;

    await supabase.from('van_audit_log').insert({
      van_stock_id: vanStockId, action: 'status_change',
      performed_by_id: performedBy.id, performed_by_name: performedBy.name,
      old_value: current?.van_status || 'unknown', new_value: newStatus,
      reason: reason || undefined,
    });
    return true;
  } catch (_e) {
    return false;
  }
};

/** Assign a temporary technician to a van */
export const assignTempTech = async (
  vanStockId: string, techId: string, techName: string,
  performedBy: { id: string; name: string }, reason?: string
): Promise<boolean> => {
  try {
    // Atomic RPC: clears old assignment + assigns new + audit log in one transaction
    const { error } = await supabase.rpc('assign_temp_tech', {
      p_van_stock_id: vanStockId,
      p_tech_id: techId,
      p_tech_name: techName,
      p_performed_by_id: performedBy.id,
      p_performed_by_name: performedBy.name,
      p_reason: reason || null,
    });
    return !error;
  } catch (_e) {
    return false;
  }
};

/** Remove temporary tech assignment from a van */
export const removeTempTech = async (
  vanStockId: string, performedBy: { id: string; name: string }, reason?: string
): Promise<boolean> => {
  try {
    const { data: current } = await supabase.from('van_stocks')
      .select('temporary_tech_id, temporary_tech_name')
      .eq('van_stock_id', vanStockId).single();

    const { error } = await supabase.from('van_stocks')
      .update({ temporary_tech_id: null, temporary_tech_name: null, temp_assigned_at: null, updated_at: new Date().toISOString() })
      .eq('van_stock_id', vanStockId);

    if (error) return false;

    if (current?.temporary_tech_id) {
      await supabase.from('van_audit_log').insert({
        van_stock_id: vanStockId, action: 'temp_removed',
        performed_by_id: performedBy.id, performed_by_name: performedBy.name,
        target_tech_id: current.temporary_tech_id, target_tech_name: current.temporary_tech_name,
        reason: reason || undefined,
      });
    }
    return true;
  } catch (_e) {
    return false;
  }
};

/** Submit van access request (tech requesting temp access) */
export const submitVanAccessRequest = async (
  vanStockId: string, requester: { id: string; name: string }, reason: string
): Promise<boolean> => {
  try {
    const { error } = await supabase.from('van_access_requests').insert({
      van_stock_id: vanStockId, requester_id: requester.id, requester_name: requester.name, reason,
    });
    if (error) return false;

    await supabase.from('van_audit_log').insert({
      van_stock_id: vanStockId, action: 'request_submitted',
      performed_by_id: requester.id, performed_by_name: requester.name, reason,
    });
    return true;
  } catch (_e) {
    return false;
  }
};

/** Review (approve/reject) a van access request */
export const reviewVanAccessRequest = async (
  requestId: string, approved: boolean, reviewer: { id: string; name: string }
): Promise<boolean> => {
  try {
    // Atomic RPC: locks row, checks status=pending, updates, auto-assigns if approved
    const { data, error } = await supabase.rpc('review_van_access_request', {
      p_request_id: requestId,
      p_approved: approved,
      p_reviewer_id: reviewer.id,
      p_reviewer_name: reviewer.name,
    });
    if (error) return false;
    return data === true;
  } catch (_e) {
    return false;
  }
};

/** Get pending van access requests */
export const getPendingVanRequests = async (): Promise<VanAccessRequest[]> => {
  try {
    const { data, error } = await supabase.from('van_access_requests')
      .select('*').eq('status', 'pending').order('created_at', { ascending: false });
    if (error) return [];
    return data as VanAccessRequest[];
  } catch (_e) {
    return [];
  }
};

/** Get audit log for a van */
export const getVanAuditLog = async (vanStockId: string): Promise<VanAuditLogEntry[]> => {
  try {
    const { data, error } = await supabase.from('van_audit_log')
      .select('*').eq('van_stock_id', vanStockId)
      .order('created_at', { ascending: false }).limit(50);
    if (error) return [];
    return data as VanAuditLogEntry[];
  } catch (_e) {
    return [];
  }
};

/** Search for a part across all active vans */
export const searchPartAcrossVans = async (searchTerm: string): Promise<Array<{
  van_stock_id: string; van_plate?: string; van_code?: string; technician_name: string;
  part_name: string; quantity: number;
}>> => {
  try {
    const { data, error } = await supabase
      .from('van_stock_items')
      .select(`
        quantity,
        part:parts!inner(name),
        van_stock:van_stocks!inner(van_stock_id, van_plate, van_code, van_status, technician:users!technician_id(name))
      `)
      .ilike('parts.name', `%${searchTerm}%`)
      .gt('quantity', 0);

    if (error) return [];

    return (data || [])
      .filter((row: Record<string, unknown>) => {
        const vs = row.van_stock as Record<string, unknown>;
        return vs && vs.van_status === 'active';
      })
      .map((row: Record<string, unknown>) => {
        const vs = row.van_stock as Record<string, unknown>;
        const part = row.part as Record<string, string>;
        return {
          van_stock_id: vs.van_stock_id as string,
          van_plate: vs.van_plate as string | undefined,
          van_code: vs.van_code as string | undefined,
          technician_name: (vs.technician as Record<string, string>)?.name || 'Unknown',
          part_name: part?.name || searchTerm,
          quantity: row.quantity as number,
        };
      });
  } catch (_e) {
    return [];
  }
};

/** Update van plate number and code */
export const updateVanIdentification = async (
  vanStockId: string, updates: { van_plate?: string; van_code?: string },
  performedBy: { id: string; name: string }
): Promise<boolean> => {
  try {
    const { error } = await supabase.from('van_stocks')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('van_stock_id', vanStockId);
    if (error) return false;

    await supabase.from('van_audit_log').insert({
      van_stock_id: vanStockId, action: 'van_updated',
      performed_by_id: performedBy.id, performed_by_name: performedBy.name,
      new_value: JSON.stringify(updates),
    });
    return true;
  } catch (_e) {
    return false;
  }
};
