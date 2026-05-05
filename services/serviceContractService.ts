/**
 * Service Contract Service — ACWER service operations flow (Phase 2)
 *
 * CRUD over `service_contracts`. Drives Path A classification in
 * `services/billingPathService.ts:classifyBillingPath()` — when a customer
 * has an active contract that covers a forklift, jobs on that forklift
 * classify as AMC (Path A).
 *
 * Phase 2 ships the data layer + customer-page UI. Phase 4 will add the
 * enforcement gates (auto-flip to chargeable on excluded part / expired
 * contract); Phase 2 itself does NOT enforce — contract presence is
 * advisory until Phase 4 turns the logic on.
 */
import type { ServiceContract } from '../types';
import { logDebug,supabase } from './supabaseClient';

interface CreateContractInput {
  customer_id: string;
  contract_number?: string | null;
  contract_type: 'amc' | 'warranty' | 'maintenance';
  start_date: string;          // YYYY-MM-DD
  end_date: string;            // YYYY-MM-DD
  covered_forklift_ids?: string[] | null;
  includes_parts?: boolean;
  includes_labor?: boolean;
  wear_tear_part_ids?: string[] | null;
  notes?: string | null;
  // Recurrence defaults (added 2026-05-06) — picked up by trigger
  // trg_seed_recurring_from_contract to auto-seed recurring_schedules rows.
  auto_generate_recurring?: boolean;
  default_frequency?: 'monthly' | 'quarterly' | 'yearly' | 'hourmeter' | null;
  default_hourmeter_interval?: number | null;
  default_lead_time_days?: number;
}

interface UpdateContractInput extends Partial<CreateContractInput> {
  is_active?: boolean;
}

/** List all contracts (active + inactive) for a customer, newest first. */
export async function getContractsForCustomer(customerId: string): Promise<ServiceContract[]> {
  if (!customerId) return [];
  const { data, error } = await supabase
    .from('service_contracts')
    .select('*')
    .eq('customer_id', customerId)
    .order('end_date', { ascending: false });
  if (error) {
    logDebug('[serviceContractService] getContractsForCustomer error:', error);
    return [];
  }
  return (data ?? []) as ServiceContract[];
}

/** Read one contract by id. */
export async function getContractById(contractId: string): Promise<ServiceContract | null> {
  if (!contractId) return null;
  const { data, error } = await supabase
    .from('service_contracts')
    .select('*')
    .eq('contract_id', contractId)
    .single();
  if (error || !data) return null;
  return data as ServiceContract;
}

/** Create a contract. RLS gates: admin / admin_service / supervisor only. */
export async function createContract(
  input: CreateContractInput,
  createdById?: string,
  createdByName?: string,
): Promise<ServiceContract> {
  const payload = {
    customer_id: input.customer_id,
    contract_number: input.contract_number ?? null,
    contract_type: input.contract_type,
    start_date: input.start_date,
    end_date: input.end_date,
    covered_forklift_ids: input.covered_forklift_ids ?? null,
    includes_parts: input.includes_parts ?? true,
    includes_labor: input.includes_labor ?? true,
    wear_tear_part_ids: input.wear_tear_part_ids ?? null,
    notes: input.notes ?? null,
    is_active: true,
    auto_generate_recurring: input.auto_generate_recurring ?? false,
    default_frequency: input.default_frequency ?? null,
    default_hourmeter_interval: input.default_hourmeter_interval ?? null,
    default_lead_time_days: input.default_lead_time_days ?? 7,
    created_by_id: createdById ?? null,
    created_by_name: createdByName ?? null,
  };
  const { data, error } = await supabase
    .from('service_contracts')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as ServiceContract;
}

/** Update an existing contract (any subset of fields). */
export async function updateContract(
  contractId: string,
  updates: UpdateContractInput,
  updatedById?: string,
  updatedByName?: string,
): Promise<ServiceContract> {
  const payload: Record<string, unknown> = {
    ...updates,
    updated_at: new Date().toISOString(),
    updated_by_id: updatedById ?? null,
    updated_by_name: updatedByName ?? null,
  };
  const { data, error } = await supabase
    .from('service_contracts')
    .update(payload)
    .eq('contract_id', contractId)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as ServiceContract;
}

/** Soft-deactivate a contract (sets `is_active = false`). Reversible. */
export async function deactivateContract(
  contractId: string,
  updatedById?: string,
  updatedByName?: string,
): Promise<ServiceContract> {
  return updateContract(contractId, { is_active: false }, updatedById, updatedByName);
}
