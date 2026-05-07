/**
 * Job Completion Service
 *
 * Wrappers around the SQL-side completion gates:
 *
 *   - check_job_completion_readiness(p_job_ids) — read-only readiness pre-check
 *     used by the bulk-sign banner to render per-job blockers BEFORE the tech
 *     swipes (instead of writing signatures and silently failing on the trigger).
 *
 *   - rpc_bulk_complete_jobs(...) — atomic per-job sign-and-finalize. Replaces
 *     the previous 3-write pattern (tech sig → customer sig → status) that
 *     left jobs stuck in a half-state when the trigger rejected the status
 *     transition.
 *
 * Both RPCs delegate gate logic to the shared `evaluate_job_completion`
 * helper (single source of truth shared with the trigger). See
 * `supabase/migrations/20260507_completion_evaluator_and_readiness_rpc.sql`
 * and `20260507_rpc_bulk_complete_jobs.sql`.
 */

import { supabase } from './supabaseClient';

export interface JobCompletionReadinessRow {
  job_id: string;
  can_complete: boolean;
  blocker: string | null;
}

export interface JobCompletionResultRow {
  job_id: string;
  ok: boolean;
  blocker: string | null;
}

/**
 * Returns a Map<job_id, { canComplete, blocker }> for the given job_ids,
 * mirroring what the completion trigger would say if each job were
 * transitioned to 'Awaiting Finalization' right now.
 */
export const checkJobCompletionReadiness = async (
  jobIds: string[]
): Promise<Map<string, { canComplete: boolean; blocker: string | null }>> => {
  if (jobIds.length === 0) return new Map();

  const { data, error } = await supabase.rpc('check_job_completion_readiness', {
    p_job_ids: jobIds,
  });
  if (error) throw new Error(error.message);

  const out = new Map<string, { canComplete: boolean; blocker: string | null }>();
  for (const row of (data ?? []) as JobCompletionReadinessRow[]) {
    out.set(row.job_id, { canComplete: row.can_complete, blocker: row.blocker });
  }
  return out;
};

export interface BulkCompleteInput {
  jobIds: string[];
  techName: string;
  techSignedAt?: string; // ISO timestamp when the tech completed the swipe gesture
  customerName: string;
  customerIc: string;
  customerSignedAt?: string;
}

/**
 * Atomically signs (idempotent on tech sig) and transitions each job to
 * 'Awaiting Finalization'. Per-job: pre-evaluates via the shared helper, locks
 * the row (FOR UPDATE NOWAIT), and writes everything in one statement. Failed
 * jobs do NOT leave behind partial signature writes.
 *
 * Returns one row per input job_id with `ok` and either a NULL blocker or
 * the specific reason from the trigger gates.
 */
export const bulkCompleteJobs = async (
  input: BulkCompleteInput
): Promise<JobCompletionResultRow[]> => {
  if (input.jobIds.length === 0) return [];

  const { data, error } = await supabase.rpc('rpc_bulk_complete_jobs', {
    p_job_ids: input.jobIds,
    p_tech_name: input.techName,
    p_tech_signed_at: input.techSignedAt ?? new Date().toISOString(),
    p_customer_name: input.customerName,
    p_customer_ic: input.customerIc,
    p_customer_signed_at: input.customerSignedAt ?? new Date().toISOString(),
  });
  if (error) throw new Error(error.message);

  return (data ?? []) as JobCompletionResultRow[];
};
