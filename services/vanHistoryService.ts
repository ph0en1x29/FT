/**
 * Van History Service
 * Fetches usage history, technician assignments, and parts deduction logs for a van.
 */
import { supabase } from './supabaseClient';

export interface VanUsageRecord {
  usage_id: string;
  van_stock_item_id: string;
  job_id: string;
  quantity_used: number;
  used_at: string;
  used_by_id: string;
  used_by_name: string;
  part_name: string;
  part_code: string;
  part_unit: string;
  job_title: string;
  customer_name: string;
}

export interface VanTechnicianSummary {
  technician_id: string;
  technician_name: string;
  total_parts_used: number;
  total_jobs: number;
  first_used: string;
  last_used: string;
}

/**
 * Get parts deduction log for a van (most recent first)
 */
export async function getVanUsageHistory(
  vanStockId: string,
  limit = 50,
  offset = 0
): Promise<{ records: VanUsageRecord[]; total: number }> {
  // Get all item IDs for this van
  const { data: items, error: itemsError } = await supabase
    .from('van_stock_items')
    .select('item_id')
    .eq('van_stock_id', vanStockId);

  if (itemsError || !items || items.length === 0) {
    return { records: [], total: 0 };
  }

  const itemIds = items.map(i => i.item_id);

  // Get total count
  const { count } = await supabase
    .from('van_stock_usage')
    .select('usage_id', { count: 'exact', head: true })
    .in('van_stock_item_id', itemIds);

  // Get usage records with joins
  const { data: usage, error: usageError } = await supabase
    .from('van_stock_usage')
    .select(`
      usage_id,
      van_stock_item_id,
      job_id,
      quantity_used,
      used_at,
      used_by_id,
      used_by_name,
      van_stock_item:van_stock_items!inner(
        part:parts(part_name, part_code, unit)
      ),
      job:jobs(title, customer:customers(name))
    `)
    .in('van_stock_item_id', itemIds)
    .order('used_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (usageError) {
    console.error('Error fetching van usage history:', usageError);
    return { records: [], total: 0 };
  }

  const records: VanUsageRecord[] = (usage || []).map((u: Record<string, unknown>) => {
    const item = u.van_stock_item as Record<string, unknown> | null;
    const part = item?.part as Record<string, unknown> | null;
    const job = u.job as Record<string, unknown> | null;
    const customer = job?.customer as Record<string, unknown> | null;
    return {
      usage_id: u.usage_id as string,
      van_stock_item_id: u.van_stock_item_id as string,
      job_id: u.job_id as string,
      quantity_used: u.quantity_used as number,
      used_at: u.used_at as string,
      used_by_id: u.used_by_id as string,
      used_by_name: u.used_by_name as string,
      part_name: (part?.part_name as string) || 'Unknown',
      part_code: (part?.part_code as string) || '',
      part_unit: (part?.unit as string) || 'pcs',
      job_title: (job?.title as string) || 'Unknown Job',
      customer_name: (customer?.name as string) || '',
    };
  });

  return { records, total: count || 0 };
}

/**
 * Get technician usage summary for a van
 */
export async function getVanTechnicianSummary(
  vanStockId: string
): Promise<VanTechnicianSummary[]> {
  const { data: items } = await supabase
    .from('van_stock_items')
    .select('item_id')
    .eq('van_stock_id', vanStockId);

  if (!items || items.length === 0) return [];

  const itemIds = items.map(i => i.item_id);

  const { data: usage, error } = await supabase
    .from('van_stock_usage')
    .select('used_by_id, used_by_name, quantity_used, used_at, job_id')
    .in('van_stock_item_id', itemIds)
    .order('used_at', { ascending: false });

  if (error || !usage) return [];

  // Group by technician
  const techMap = new Map<string, {
    name: string;
    totalParts: number;
    jobs: Set<string>;
    firstUsed: string;
    lastUsed: string;
  }>();

  for (const u of usage) {
    const existing = techMap.get(u.used_by_id);
    if (existing) {
      existing.totalParts += u.quantity_used;
      existing.jobs.add(u.job_id);
      if (u.used_at < existing.firstUsed) existing.firstUsed = u.used_at;
      if (u.used_at > existing.lastUsed) existing.lastUsed = u.used_at;
    } else {
      techMap.set(u.used_by_id, {
        name: u.used_by_name,
        totalParts: u.quantity_used,
        jobs: new Set([u.job_id]),
        firstUsed: u.used_at,
        lastUsed: u.used_at,
      });
    }
  }

  return Array.from(techMap.entries()).map(([id, data]) => ({
    technician_id: id,
    technician_name: data.name,
    total_parts_used: data.totalParts,
    total_jobs: data.jobs.size,
    first_used: data.firstUsed,
    last_used: data.lastUsed,
  }));
}
