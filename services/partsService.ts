/**
 * Parts Service
 * 
 * Handles parts CRUD operations
 */

import type { Part } from '../types';
import { supabase } from './supabaseClient';

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
