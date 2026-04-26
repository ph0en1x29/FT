/**
 * Van Fleet Service
 *
 * Handles van fleet status, temporary access, audit log, and cross-van search.
 */

import type { VanAccessRequest, VanAuditLogEntry, VanFleetItem, VanStatus } from '../types';
import { supabase } from './supabaseClient';

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
      .select('request_id, van_stock_id, requester_id, requester_name, reason, status, reviewed_by_id, reviewed_by_name, reviewed_at, created_at, van_plate, van_code, van_tech_name').eq('status', 'pending').order('created_at', { ascending: false });
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
      .select('id, van_stock_id, action, performed_by_id, performed_by_name, target_tech_id, target_tech_name, reason, old_value, new_value, created_at').eq('van_stock_id', vanStockId)
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
