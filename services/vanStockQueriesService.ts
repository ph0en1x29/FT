/**
 * Van Stock Query Service
 *
 * Read-only van stock lookups and stock summary helpers.
 */

import type { VanStock, VanStockItem, VanStockUsage } from '../types';
import { supabase } from './supabaseClient';
import type { VanStockItemRow, VanStockRow } from './vanStockTypes';

export const getAllVanStocks = async (): Promise<VanStock[]> => {
  try {
    const { data, error } = await supabase
      .from('van_stocks')
      .select(`
        van_stock_id, van_code, van_plate, technician_id, is_active, van_status, max_items, last_audit_at, created_at,
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

    return ((data || []) as unknown as VanStockRow[]).map((vs) => ({
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
    const { data: tempVan } = await supabase
      .from('van_stocks')
      .select(`
        van_stock_id, van_code, van_plate, technician_id, is_active, van_status, max_items, last_audit_at, created_at,
        technician:users!technician_id(name),
        items:van_stock_items(
          item_id, part_id, quantity, container_quantity, bulk_quantity, min_quantity, max_quantity, last_replenished_at, last_used_at,
          part:parts(part_id, part_name, part_code, cost_price, sell_price, is_liquid, base_unit, container_unit, container_size)
        )
      `)
      .eq('temporary_tech_id', technicianId)
      .eq('is_active', true)
      .single();

    const vanData = tempVan;

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

      const row = data as unknown as VanStockRow;
      return { ...row, technician_name: row.technician?.name || 'Unknown', total_value } as unknown as VanStock;
    }

    const tempRow = vanData as unknown as VanStockRow;
    const items = (tempRow.items || []) as VanStockItemRow[];
    const total_value = items.reduce((sum: number, item: VanStockItemRow) => {
      const partCost = item.part?.cost_price || 0;
      return sum + (partCost * item.quantity);
    }, 0);

    return { ...tempRow, technician_name: tempRow.technician?.name || 'Unknown', total_value } as unknown as VanStock;
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
    return ((data || []) as unknown as VanStockRow[]).map((vs) => ({
      ...vs,
      technician_name: vs.technician?.name || 'Unknown',
    })) as unknown as VanStock[];
  } catch (_e) {
    return [];
  }
};

export const getVanStockById = async (vanStockId: string): Promise<VanStock | null> => {
  try {
    const { data, error } = await supabase
      .from('van_stocks')
      .select(`
        van_stock_id, van_code, van_plate, technician_id, is_active, van_status, max_items, last_audit_at, created_at,
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

    const row = data as unknown as VanStockRow;
    return { ...row, technician_name: row.technician?.name || 'Unknown', total_value } as unknown as VanStock;
  } catch (_e) {
    return null;
  }
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
