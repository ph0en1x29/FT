/**
 * Parts Usage Quota Service — ACWER Phase 6 + Tier 3.2 admin overrides.
 *
 * CRUD over `parts_usage_quotas`. Phase 6 seeded 3 default global quotas
 * ('Wheels & Tyres' / 'Lights & Bulbs' / 'Filters' all at 4/year). This
 * service lets admin add per-forklift or per-customer overrides, e.g.
 * "Forklift FLT-12 gets 6 tires/year due to heavy use".
 *
 * Resolution order at part-add time (in `addPartToJob`):
 *   1. per_forklift quota for this forklift+category if any
 *   2. per_customer quota for this customer+category if any
 *   3. global quota for this category if any
 *   (Note: current Phase 6 enforcement only consults global. Per-scope
 *    resolution is a small follow-up in addPartToJob — service-side ready.)
 */
import type { PartsUsageQuota } from '../types';
import { logDebug, supabase } from './supabaseClient';

interface CreateQuotaInput {
  scope_type: 'global' | 'per_forklift' | 'per_customer';
  scope_id?: string | null;
  part_id?: string | null;
  part_category?: string | null;
  period_unit?: 'year' | 'quarter' | 'month';
  max_quantity: number;
  notes?: string | null;
}

export async function listQuotas(filters?: {
  scope_type?: 'global' | 'per_forklift' | 'per_customer';
  scope_id?: string;
  active_only?: boolean;
}): Promise<PartsUsageQuota[]> {
  let query = supabase.from('parts_usage_quotas').select('*').order('created_at', { ascending: false });
  if (filters?.scope_type) query = query.eq('scope_type', filters.scope_type);
  if (filters?.scope_id) query = query.eq('scope_id', filters.scope_id);
  if (filters?.active_only) query = query.eq('is_active', true);
  const { data, error } = await query;
  if (error) {
    logDebug('[partsUsageQuotaService] listQuotas error:', error);
    return [];
  }
  return (data ?? []) as PartsUsageQuota[];
}

export async function listQuotasForForklift(forkliftId: string): Promise<PartsUsageQuota[]> {
  return listQuotas({ scope_type: 'per_forklift', scope_id: forkliftId, active_only: true });
}

export async function listQuotasForCustomer(customerId: string): Promise<PartsUsageQuota[]> {
  return listQuotas({ scope_type: 'per_customer', scope_id: customerId, active_only: true });
}

export async function createQuota(input: CreateQuotaInput): Promise<PartsUsageQuota> {
  if (!input.part_id && !input.part_category) {
    throw new Error('Either part_id or part_category is required');
  }
  if (input.max_quantity <= 0) {
    throw new Error('max_quantity must be positive');
  }
  const payload = {
    scope_type: input.scope_type,
    scope_id: input.scope_id ?? null,
    part_id: input.part_id ?? null,
    part_category: input.part_category ?? null,
    period_unit: input.period_unit ?? 'year',
    max_quantity: input.max_quantity,
    notes: input.notes ?? null,
    is_active: true,
  };
  const { data, error } = await supabase
    .from('parts_usage_quotas')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as PartsUsageQuota;
}

export async function updateQuota(
  quotaId: string,
  updates: Partial<CreateQuotaInput> & { is_active?: boolean },
): Promise<PartsUsageQuota> {
  const { data, error } = await supabase
    .from('parts_usage_quotas')
    .update(updates)
    .eq('quota_id', quotaId)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as PartsUsageQuota;
}

export async function deactivateQuota(quotaId: string): Promise<PartsUsageQuota> {
  return updateQuota(quotaId, { is_active: false });
}
