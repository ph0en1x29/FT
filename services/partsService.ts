/**
 * Parts Service
 * 
 * Handles parts CRUD operations
 */

import type { Part } from '../types';
import { supabase } from './supabaseClient';
import { isLikelyLiquid } from '../types/inventory.types';

const PARTS_SELECT = 'part_id, part_name, part_code, category, cost_price, sell_price, warranty_months, stock_quantity, last_updated_by, last_updated_by_name, updated_at, min_stock_level, supplier, location, unit, base_unit, container_unit, container_size, container_quantity, bulk_quantity, price_per_base_unit, is_liquid, avg_cost_per_liter, last_purchase_cost_per_liter, is_warranty_excluded';
const PARTS_LIST_SELECT = 'part_id, part_name, part_code, category, cost_price, sell_price, stock_quantity, is_liquid, base_unit, container_unit, container_size, container_quantity, bulk_quantity, is_warranty_excluded';

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

const CATALOG_PAGE_SIZE = 50;
const BULK_PAGE_SIZE = 1000;

const normalizeSearchQuery = (searchQuery?: string) => searchQuery?.trim() || '';
const buildSearchClause = (searchQuery?: string) => {
  const normalized = normalizeSearchQuery(searchQuery);
  if (!normalized) return null;

  const escaped = normalized.replace(/[%_,]/g, '');
  // Limited to columns backed by a pg_trgm GIN index (see migration
  // 20260501_search_perf_trigram_and_low_stock.sql). Category and supplier
  // are usually selected via dropdown, not free-text — search them via
  // .eq() filters in the page query, not ILIKE.
  return `part_name.ilike.%${escaped}%,part_code.ilike.%${escaped}%`;
};

const sortParts = (parts: Part[]) => [...parts].sort((left, right) => {
  const categoryCompare = left.category.localeCompare(right.category);
  if (categoryCompare !== 0) return categoryCompare;
  return left.part_name.localeCompare(right.part_name);
});

const getLowStockPartIds = async (filters: Pick<PartsCatalogFilters, 'searchQuery' | 'category'>) => {
  // SQL-side low-stock filter via get_low_stock_part_ids() RPC + the
  // `effective_stock` generated column / partial index added in
  // 20260501_search_perf_trigram_and_low_stock.sql.
  //
  // Replaces the previous client-side loop that fetched the entire catalog
  // (BULK_PAGE_SIZE pages) and applied isPartLowStock in JS.
  // PostgREST can't express the `effective_stock <= min_stock_level`
  // column-vs-column predicate, hence the RPC.
  const normalizedSearch = normalizeSearchQuery(filters.searchQuery);
  const { data, error } = await supabase.rpc('get_low_stock_part_ids', {
    p_search_query: normalizedSearch || null,
    p_category: filters.category && filters.category !== 'all' ? filters.category : null,
  });

  if (error) throw new Error(error.message);
  return (data as { part_id: string }[] | null)?.map(p => p.part_id) ?? [];
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
  // Single RPC replacing the previous client-side loop over the entire
  // catalog (3000+ rows on each mount). The aggregates run in one query
  // against the parts table; see migration
  // 20260501_search_perf_trigram_and_low_stock.sql.
  const { data, error } = await supabase.rpc('get_inventory_catalog_stats');
  if (error) throw new Error(error.message);

  const row = (data as Array<{
    total: number | string;
    low_stock: number | string;
    out_of_stock: number | string;
    liquid_mismatch: number | string;
    total_value: number | string;
  }> | null)?.[0];

  return {
    total: Number(row?.total ?? 0),
    lowStock: Number(row?.low_stock ?? 0),
    outOfStock: Number(row?.out_of_stock ?? 0),
    liquidMismatch: Number(row?.liquid_mismatch ?? 0),
    totalValue: Number(row?.total_value ?? 0),
  };
};

/**
 * Lightweight read for dashboards: returns the minimal columns needed to
 * render low-stock / out-of-stock alerts without paying the full Part shape.
 * The caller does its own filtering (low vs OOS) — this keeps the contract
 * small and reusable across dashboards.
 */
export const getStockAlertParts = async (): Promise<Array<Pick<Part, 'part_name' | 'stock_quantity' | 'min_stock_level'>>> => {
  const { data, error } = await supabase
    .from('parts')
    .select('part_name, stock_quantity, min_stock_level');

  if (error) throw new Error(error.message);
  return (data as Array<Pick<Part, 'part_name' | 'stock_quantity' | 'min_stock_level'>>) || [];
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
