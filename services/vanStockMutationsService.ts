/**
 * Van Stock Mutation Service
 *
 * Writes van stock records and item quantities.
 */

import type { VanStock, VanStockItem } from '../types';
import { supabase } from './supabaseClient';

export const createVanStock = async (
  technicianId: string,
  technicianName: string,
  vanCode: string | null,
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
  updates: { van_plate?: string; van_code?: string | null; notes?: string; max_items?: number; is_active?: boolean; technician_id?: string }
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
  _fromVanStockId: string,
  toVanStockId: string,
  itemIds: string[]
): Promise<void> => {
  const { error } = await supabase
    .from('van_stock_items')
    .update({ van_stock_id: toVanStockId })
    .in('item_id', itemIds);
  if (error) throw new Error(error.message);
};

export const transferPartToVan = async (
  partId: string,
  vanStockId: string,
  quantity: number,
  reason: string,
  performedById: string,
  performedByName: string
): Promise<VanStockItem> => {
  const { data, error } = await supabase.rpc('rpc_transfer_part_to_van', {
    p_part_id: partId,
    p_van_stock_id: vanStockId,
    p_quantity: quantity,
    p_performed_by: performedById,
    p_performed_by_name: performedByName,
    p_reason: reason,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Transfer succeeded but returned no row — please refresh');

  const itemId = Array.isArray(data) ? data[0]?.item_id : (data as { item_id: string }).item_id;
  if (!itemId) throw new Error('Transfer returned invalid payload');

  const { data: joined, error: joinErr } = await supabase
    .from('van_stock_items')
    .select('*, part:parts(*)')
    .eq('item_id', itemId)
    .single();
  if (joinErr) throw new Error(joinErr.message);
  return joined as VanStockItem;
};

export const returnPartToStore = async (
  vanStockItemId: string,
  quantity: number,
  reason: string,
  performedById: string,
  performedByName: string
): Promise<VanStockItem> => {
  const { data, error } = await supabase.rpc('rpc_return_part_to_store', {
    p_van_stock_item_id: vanStockItemId,
    p_quantity: quantity,
    p_performed_by: performedById,
    p_performed_by_name: performedByName,
    p_reason: reason,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Return succeeded but returned no row — please refresh');

  const itemId = Array.isArray(data) ? data[0]?.item_id : (data as { item_id: string }).item_id;
  if (!itemId) throw new Error('Return returned invalid payload');

  const { data: joined, error: joinErr } = await supabase
    .from('van_stock_items')
    .select('*, part:parts(*)')
    .eq('item_id', itemId)
    .single();
  if (joinErr) throw new Error(joinErr.message);
  return joined as VanStockItem;
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
  const { error } = await supabase.rpc('increment_van_stock_quantity', {
    p_item_id: itemId,
    p_increment: incrementBy,
  });
  if (error) throw new Error(error.message);

  const { data: item, error: fetchError } = await supabase
    .from('van_stock_items')
    .select(`*, part:parts(*)`)
    .eq('item_id', itemId)
    .single();
  if (fetchError) throw new Error(fetchError.message);
  return item as VanStockItem;
};
