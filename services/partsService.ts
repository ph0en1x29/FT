/**
 * Parts Service
 * 
 * Handles parts CRUD operations
 */

import type { Part } from '../types';
import { supabase } from './supabaseClient';
import { isLikelyLiquid } from '../types/inventory.types';
import { checkStockMismatch } from './liquidInventoryService';

const PARTS_SELECT = 'part_id, part_name, part_code, category, cost_price, sell_price, warranty_months, stock_quantity, last_updated_by, last_updated_by_name, updated_at, min_stock_level, supplier, location, unit, base_unit, container_unit, container_size, container_quantity, bulk_quantity, price_per_base_unit, is_liquid, avg_cost_per_liter, last_purchase_cost_per_liter';
const PARTS_LIST_SELECT = 'part_id, part_name, part_code, category, cost_price, sell_price, stock_quantity, is_liquid, base_unit, container_unit, container_size, container_quantity, bulk_quantity';
const PARTS_STATS_SELECT = 'part_id, category, part_code, cost_price, stock_quantity, min_stock_level, is_liquid, container_size, container_quantity, bulk_quantity';

export interface PartsCatalogFilters {
  searchQuery?: string;
  category?: string;
  stock?: 'all' | 'low' | 'out';
  page?: number;
  pageSize?: number;
}

export interface PartsCatalogPage {
  parts: Part[];
  total: number;
  page: number;
  pageSize: number;
}

export interface InventoryCatalogStats {
  total: number;
  lowStock: number;
  outOfStock: number;
  liquidMismatch: number;
  totalValue: number;
}

interface PartStockSnapshot {
  part_id: string;
  category: string;
  part_code: string;
  cost_price: number;
  stock_quantity: number;
  min_stock_level?: number;
  is_liquid?: boolean;
  container_size?: number;
  container_quantity?: number;
  bulk_quantity?: number;
}

const CATALOG_PAGE_SIZE = 50;
const BULK_PAGE_SIZE = 1000;

const normalizeSearchQuery = (searchQuery?: string) => searchQuery?.trim() || '';
const buildSearchClause = (searchQuery?: string) => {
  const normalized = normalizeSearchQuery(searchQuery);
  if (!normalized) return null;

  const escaped = normalized.replace(/[%_,]/g, '');
  return `part_name.ilike.%${escaped}%,part_code.ilike.%${escaped}%,category.ilike.%${escaped}%,supplier.ilike.%${escaped}%`;
};

const isPartLowStock = (part: Pick<Part, 'is_liquid' | 'container_quantity' | 'bulk_quantity' | 'stock_quantity' | 'min_stock_level'>) => {
  if (part.is_liquid) {
    const total = (part.container_quantity || 0) + (part.bulk_quantity || 0);
    return total > 0 && total <= (part.min_stock_level || 10);
  }

  return part.stock_quantity > 0 && part.stock_quantity <= (part.min_stock_level || 10);
};

const isPartOutOfStock = (part: Pick<Part, 'is_liquid' | 'container_quantity' | 'bulk_quantity' | 'stock_quantity'>) => {
  if (part.is_liquid) {
    return ((part.container_quantity || 0) + (part.bulk_quantity || 0)) === 0;
  }

  return part.stock_quantity === 0;
};

const sortParts = (parts: Part[]) => [...parts].sort((left, right) => {
  const categoryCompare = left.category.localeCompare(right.category);
  if (categoryCompare !== 0) return categoryCompare;
  return left.part_name.localeCompare(right.part_name);
});

const getLowStockPartIds = async (filters: Pick<PartsCatalogFilters, 'searchQuery' | 'category'>) => {
  const lowStockIds: string[] = [];
  let from = 0;
  const searchClause = buildSearchClause(filters.searchQuery);

  while (true) {
    let query = supabase
      .from('parts')
      .select(PARTS_STATS_SELECT)
      .order('category')
      .order('part_name')
      .range(from, from + BULK_PAGE_SIZE - 1);

    if (searchClause) {
      query = query.or(searchClause);
    }

    if (filters.category && filters.category !== 'all') {
      query = query.eq('category', filters.category);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;

    lowStockIds.push(...(data as PartStockSnapshot[]).filter(isPartLowStock).map(part => part.part_id));

    if (data.length < BULK_PAGE_SIZE) break;
    from += BULK_PAGE_SIZE;
  }

  return lowStockIds;
};

const getPartsByIds = async (partIds: string[]): Promise<Part[]> => {
  if (partIds.length === 0) return [];

  const parts: Part[] = [];
  for (let index = 0; index < partIds.length; index += BULK_PAGE_SIZE) {
    const idsChunk = partIds.slice(index, index + BULK_PAGE_SIZE);
    const { data, error } = await supabase
      .from('parts')
      .select(PARTS_SELECT)
      .in('part_id', idsChunk);

    if (error) throw new Error(error.message);
    parts.push(...((data || []) as Part[]));
  }

  return sortParts(parts);
};

export const getParts = async (): Promise<Part[]> => {
  // Supabase default limit is 1000 — fetch all parts in pages
  const allParts: Part[] = [];
  let from = 0;
  
  while (true) {
    const { data, error } = await supabase
      .from('parts')
      .select(PARTS_SELECT)
      .order('category')
      .order('part_name')
      .range(from, from + BULK_PAGE_SIZE - 1);

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    allParts.push(...(data as Part[]));
    if (data.length < BULK_PAGE_SIZE) break;
    from += BULK_PAGE_SIZE;
  }
  
  return allParts;
};

export const getPartsForList = async (): Promise<Part[]> => {
  const allParts: Part[] = [];
  let from = 0;
  
  while (true) {
    const { data, error } = await supabase
      .from('parts')
      .select(PARTS_LIST_SELECT)
      .order('category')
      .order('part_name')
      .range(from, from + BULK_PAGE_SIZE - 1);

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    allParts.push(...(data as Part[]));
    if (data.length < BULK_PAGE_SIZE) break;
    from += BULK_PAGE_SIZE;
  }
  
  return allParts;
};

export const getPartsPage = async (filters: PartsCatalogFilters = {}): Promise<PartsCatalogPage> => {
  const page = Math.max(filters.page || 1, 1);
  const pageSize = Math.max(filters.pageSize || CATALOG_PAGE_SIZE, 1);
  const searchClause = buildSearchClause(filters.searchQuery);

  if (filters.stock === 'low') {
    const lowStockIds = await getLowStockPartIds(filters);
    const total = lowStockIds.length;
    const pageIds = lowStockIds.slice((page - 1) * pageSize, page * pageSize);

    if (pageIds.length === 0) {
      return { parts: [], total, page, pageSize };
    }

    return {
      parts: await getPartsByIds(pageIds),
      total,
      page,
      pageSize,
    };
  }

  let query = supabase
    .from('parts')
    .select(PARTS_SELECT, { count: 'exact' })
    .order('category')
    .order('part_name')
    .range((page - 1) * pageSize, (page * pageSize) - 1);

  if (searchClause) {
    query = query.or(searchClause);
  }

  if (filters.category && filters.category !== 'all') {
    query = query.eq('category', filters.category);
  }

  if (filters.stock === 'out') {
    query = query.or(
      'and(is_liquid.eq.true,container_quantity.eq.0,bulk_quantity.eq.0),and(is_liquid.eq.false,stock_quantity.eq.0),and(is_liquid.is.null,stock_quantity.eq.0)'
    );
  }

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  return {
    parts: (data || []) as Part[],
    total: count || 0,
    page,
    pageSize,
  };
};

export const getPartsForExport = async (filters: Pick<PartsCatalogFilters, 'searchQuery' | 'category' | 'stock'> = {}): Promise<Part[]> => {
  if (filters.stock === 'low') {
    const lowStockIds = await getLowStockPartIds(filters);
    return getPartsByIds(lowStockIds);
  }

  const matchingParts: Part[] = [];
  let from = 0;
  const searchClause = buildSearchClause(filters.searchQuery);

  while (true) {
    let query = supabase
      .from('parts')
      .select(PARTS_SELECT)
      .order('category')
      .order('part_name')
      .range(from, from + BULK_PAGE_SIZE - 1);

    if (searchClause) {
      query = query.or(searchClause);
    }

    if (filters.category && filters.category !== 'all') {
      query = query.eq('category', filters.category);
    }

    if (filters.stock === 'out') {
      query = query.or(
        'and(is_liquid.eq.true,container_quantity.eq.0,bulk_quantity.eq.0),and(is_liquid.eq.false,stock_quantity.eq.0),and(is_liquid.is.null,stock_quantity.eq.0)'
      );
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;

    matchingParts.push(...(data as Part[]));

    if (data.length < BULK_PAGE_SIZE) break;
    from += BULK_PAGE_SIZE;
  }

  return matchingParts;
};

export const getPartCategories = async (): Promise<string[]> => {
  const categories = new Set<string>();
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('parts')
      .select('category')
      .order('category')
      .range(from, from + BULK_PAGE_SIZE - 1);

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;

    (data as Array<{ category: string | null }>).forEach(row => {
      if (row.category) categories.add(row.category);
    });

    if (data.length < BULK_PAGE_SIZE) break;
    from += BULK_PAGE_SIZE;
  }

  return Array.from(categories).sort();
};

export const getPartCodes = async (): Promise<string[]> => {
  const codes: string[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('parts')
      .select('part_code')
      .order('part_code')
      .range(from, from + BULK_PAGE_SIZE - 1);

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;

    (data as Array<{ part_code: string | null }>).forEach(row => {
      if (row.part_code) codes.push(row.part_code);
    });

    if (data.length < BULK_PAGE_SIZE) break;
    from += BULK_PAGE_SIZE;
  }

  return codes;
};

export const getInventoryCatalogStats = async (): Promise<InventoryCatalogStats> => {
  const snapshots: PartStockSnapshot[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('parts')
      .select(PARTS_STATS_SELECT)
      .range(from, from + BULK_PAGE_SIZE - 1);

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;

    snapshots.push(...(data as PartStockSnapshot[]));

    if (data.length < BULK_PAGE_SIZE) break;
    from += BULK_PAGE_SIZE;
  }

  return {
    total: snapshots.length,
    lowStock: snapshots.filter(isPartLowStock).length,
    outOfStock: snapshots.filter(isPartOutOfStock).length,
    liquidMismatch: snapshots.filter(part => part.is_liquid && checkStockMismatch(part).hasMismatch).length,
    totalValue: snapshots.reduce((sum, part) => {
      if (part.is_liquid) {
        return sum + ((part.cost_price || 0) * (part.container_quantity || 0));
      }

      return sum + ((part.cost_price || 0) * (part.stock_quantity || 0));
    }, 0),
  };
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
      unit: partData.unit,
      base_unit: partData.base_unit || 'pcs',
      container_unit: partData.container_unit || null,
      container_size: partData.container_size || null,
      container_quantity: partData.container_quantity || 0,
      bulk_quantity: partData.bulk_quantity || 0,
      price_per_base_unit: partData.price_per_base_unit || null,
      is_liquid: partData.is_liquid ?? isLikelyLiquid(partData.part_name || ''),
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
