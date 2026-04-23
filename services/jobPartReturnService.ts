/**
 * Job Part Return Service
 *
 * Wraps the three RPCs added in 20260423_part_return_flow.sql:
 *   - request_part_return  — tech initiates a return (wrong model, damaged, etc.)
 *   - cancel_part_return   — tech withdraws a pending return before admin confirms
 *   - confirm_part_return  — admin confirms physical receipt; stock is restored
 *
 * The completion-gate trigger updated in 20260423_completion_gate_skip_returns.sql
 * already excludes pending_return / returned rows from the "approved request must
 * be used" check, so calling these RPCs is sufficient to unblock job completion.
 *
 * Per the FT layering contract (see CLAUDE.md), this service holds NO per-job-type
 * branching — the policy lives in the trigger and the UI helpers.
 */

import { supabase } from './supabaseClient';
import type { JobPartUsed } from '../types';

export type PartReturnReason =
  | 'wrong_model'
  | 'damaged'
  | 'not_compatible'
  | 'other';

export const PART_RETURN_REASON_LABELS: Record<PartReturnReason, string> = {
  wrong_model: 'Wrong model',
  damaged: 'Damaged',
  not_compatible: 'Not compatible',
  other: 'Other',
};

const buildReasonString = (reason: PartReturnReason, freeText?: string): string => {
  const trimmed = freeText?.trim();
  if (reason === 'other') {
    if (!trimmed) throw new Error('A description is required when selecting "Other"');
    return `other: ${trimmed}`;
  }
  return trimmed ? `${reason}: ${trimmed}` : reason;
};

/**
 * Tech requests a return on a job_parts row. Reason is a structured tag plus
 * optional free-text. Free-text becomes mandatory when the tag is 'other'.
 *
 * Throws on the DB error message — typically "Part is already in return status"
 * if called twice or "Part not found" if the row was deleted.
 */
export const requestPartReturn = async (
  jobPartId: string,
  reason: PartReturnReason,
  freeText?: string,
): Promise<JobPartUsed> => {
  const reasonString = buildReasonString(reason, freeText);
  const { data, error } = await supabase.rpc('request_part_return', {
    p_job_part_id: jobPartId,
    p_reason: reasonString,
  });
  if (error) throw new Error(error.message);
  return data as JobPartUsed;
};

/**
 * Tech cancels a pending return (e.g. realized the part does fit after all).
 * Only valid before admin confirms; refuses on a 'returned' row.
 */
export const cancelPartReturn = async (jobPartId: string): Promise<JobPartUsed> => {
  const { data, error } = await supabase.rpc('cancel_part_return', {
    p_job_part_id: jobPartId,
  });
  if (error) throw new Error(error.message);
  return data as JobPartUsed;
};

/**
 * Admin confirms physical receipt of the returned part. Atomically increments
 * stock and writes an inventory_movements row of type 'tech_return'.
 *
 * Role-gated to admin / supervisor / store-admin variants — non-admins get a
 * "Only admins or supervisors can confirm" error.
 */
export const confirmPartReturn = async (
  jobPartId: string,
  notes?: string,
): Promise<JobPartUsed> => {
  const { data, error } = await supabase.rpc('confirm_part_return', {
    p_job_part_id: jobPartId,
    p_notes: notes?.trim() || null,
  });
  if (error) throw new Error(error.message);
  return data as JobPartUsed;
};

/**
 * Helper: a part is "active on the invoice" only when it isn't being returned.
 * Used by every parts-total reducer (jobInvoiceService, customerService,
 * JobDetail/utils.ts, AutoCountExport, KPI hooks) so returned stock isn't billed.
 */
export const isPartActiveOnInvoice = (part: Pick<JobPartUsed, 'return_status'>): boolean =>
  part.return_status !== 'pending_return' && part.return_status !== 'returned';
