/**
 * Billing Path Service — ACWER Service Operations Flow (Phase 0)
 *
 * Pure classifier + thin Supabase fetchers. NO mutations in Phase 0; the
 * classifier is consumed by the JobBoard/Detail UI in Phase 1 to display
 * the auto-derived path advisor only.
 *
 * Three-path semantics:
 *   - FLEET (Path C): forklift.ownership === 'company'
 *   - AMC (Path A):   customer-owned forklift covered by an active contract
 *   - CHARGEABLE (B): customer-owned forklift, no active contract
 *   - UNSET:          missing forklift / not enough info to classify
 *
 * The function is **pure** — no Supabase or side effects. Service contracts
 * are passed in as a parameter so the caller controls when/how to fetch
 * them (Phase 1 callers will use getActiveContractsForCustomer below).
 */

import type { Forklift, ServiceContract } from '../types';
import { BillingPath, type BillingPathClassification } from '../types/service-flow.types';
import { supabase } from './supabaseClient';

// ----------------------------------------------------------------------
// Pure classifier
// ----------------------------------------------------------------------

export interface ClassifyArgs {
  forklift?: Forklift | null;
  /** Customer ID is required to look up contracts. Pass even when forklift is null. */
  customer_id?: string | null;
  /** Active contracts already loaded for this customer. Pass [] when none. */
  active_contracts?: ServiceContract[];
  /** Reference date for contract validity checks. Defaults to "now". */
  current_date?: Date;
}

export function classifyBillingPath(args: ClassifyArgs): BillingPathClassification {
  const { forklift, active_contracts = [], current_date = new Date() } = args;

  // Path C wins regardless of contract — fleet jobs are non-chargeable by default
  if (forklift?.ownership === 'company') {
    return {
      path: BillingPath.FLEET,
      reason: 'Forklift is Acwer-owned (Path C — Fleet)',
    };
  }

  // Cannot classify without a forklift OR with a customer-owned forklift but no customer
  if (!forklift) {
    return {
      path: BillingPath.UNSET,
      reason: 'No forklift selected — path cannot be determined yet',
    };
  }

  // Path A: customer-owned + active contract that covers this forklift
  const today = current_date;
  const covering = active_contracts.find((c) => {
    if (!c.is_active) return false;
    const start = new Date(c.start_date);
    const end = new Date(c.end_date);
    if (start > today || end < today) return false;
    const covered = c.covered_forklift_ids;
    if (!covered || covered.length === 0) return true;
    return covered.includes(forklift.forklift_id);
  });
  if (covering) {
    return {
      path: BillingPath.AMC,
      reason: `Active contract ${covering.contract_number ?? covering.contract_id} (Path A — AMC)`,
      contract_id: covering.contract_id,
    };
  }

  // Path B: customer-owned, no active contract
  if (forklift.ownership === 'customer') {
    return {
      path: BillingPath.CHARGEABLE,
      reason: 'Customer-owned, no active contract (Path B — Chargeable)',
    };
  }

  // Fallback: forklift exists but ownership unknown
  return {
    path: BillingPath.UNSET,
    reason: 'Forklift ownership not set — path cannot be determined',
  };
}

// ----------------------------------------------------------------------
// Thin Supabase fetchers (used by Phase 1 UI; safe to call in Phase 0)
// ----------------------------------------------------------------------

/**
 * Fetch all active service contracts for a customer.
 * Returns [] on error or no rows. Phase 0: table is empty, returns [].
 */
export async function getActiveContractsForCustomer(
  customerId: string,
): Promise<ServiceContract[]> {
  if (!customerId) return [];
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('service_contracts')
    .select('*')
    .eq('customer_id', customerId)
    .eq('is_active', true)
    .lte('start_date', today)
    .gte('end_date', today)
    .order('end_date', { ascending: false });
  if (error || !data) return [];
  return data as ServiceContract[];
}

/**
 * Read-only fetch of the single global ACWER settings row.
 * Returns null only if the table is somehow empty (Phase 0 guarantees 1 row).
 */
export async function getAcwerSettings() {
  const { data, error } = await supabase
    .from('acwer_settings')
    .select('*')
    .eq('id', 1)
    .single();
  if (error || !data) return null;
  return data;
}
