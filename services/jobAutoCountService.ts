/**
 * Job AutoCount Service — ACWER Phase 8 wiring.
 *
 * Implements the export queue surface for the AutoCount integration tables
 * created in `20260115000006_autocount_integration.sql`. The actual SAP-style
 * export to AutoCount Cloud is still external — this service prepares the
 * export record (via the existing `prepare_autocount_export(uuid)` RPC) and
 * tracks status transitions for an admin queue UI.
 *
 * Status semantics:
 *   - 'pending'   → ready to be sent to AutoCount (or being retried)
 *   - 'exported'  → admin has confirmed the row landed in AutoCount
 *   - 'failed'    → most recent attempt failed; export_error has the reason
 *   - 'cancelled' → admin chose not to send this row
 */
import type { AutoCountExport, Job } from '../types';
import { logDebug, supabase } from './supabaseClient';

// ----------------------------------------------------------------------
// Create / prepare an export record for a finalized job
// ----------------------------------------------------------------------

/**
 * Snapshot a finalized job's invoice into a new `autocount_exports` row.
 * Wraps the SQL `prepare_autocount_export(uuid)` RPC. Returns the export_id.
 */
export const createAutoCountExport = async (
  jobId: string,
  userId?: string,
  userName?: string,
): Promise<string> => {
  logDebug('[JobAutoCountService] createAutoCountExport called for job:', jobId);
  const { data, error } = await supabase.rpc('prepare_autocount_export', {
    p_job_id: jobId,
  });
  if (error) throw new Error(error.message);
  const exportId = data as string;

  // Stamp the actor on the just-created row so the admin queue can show
  // who initiated the export. The RPC itself doesn't capture the actor.
  if (exportId && userId) {
    await supabase
      .from('autocount_exports')
      .update({
        exported_by_id: userId,
        exported_by_name: userName ?? null,
      })
      .eq('export_id', exportId);
  }
  return exportId;
};

// ----------------------------------------------------------------------
// Read paths — admin export queue
// ----------------------------------------------------------------------

/** All exports, newest first. */
export const getAutoCountExports = async (
  filters?: { status?: 'pending' | 'exported' | 'failed' | 'cancelled' },
): Promise<AutoCountExport[]> => {
  let query = supabase.from('autocount_exports').select('*').order('created_at', { ascending: false });
  if (filters?.status) query = query.eq('status', filters.status);
  const { data, error } = await query;
  if (error) {
    logDebug('[JobAutoCountService] getAutoCountExports error:', error);
    return [];
  }
  return (data ?? []) as AutoCountExport[];
};

/**
 * Jobs that are finalized (Admin 1 + Admin 2 confirmed) but don't have an
 * AutoCount export yet. Used to populate the "ready to export" queue.
 */
export const getJobsPendingExport = async (): Promise<Job[]> => {
  const { data, error } = await supabase
    .from('jobs')
    .select(`
      *,
      customer:customers(*),
      forklift:forklifts!forklift_id(*),
      parts_used:job_parts(*),
      media:job_media!job_media_job_id_fkey(*),
      extra_charges:extra_charges(*)
    `)
    .not('parts_confirmed_at', 'is', null)
    .not('job_confirmed_at', 'is', null)
    .is('autocount_export_id', null)
    .is('deleted_at', null)
    .neq('billing_path', 'fleet')               // Path C non-chargeable: no invoice
    .order('job_confirmed_at', { ascending: false });
  if (error) {
    logDebug('[JobAutoCountService] getJobsPendingExport error:', error);
    return [];
  }
  return (data ?? []) as Job[];
};

// ----------------------------------------------------------------------
// Status transitions
// ----------------------------------------------------------------------

export interface MarkExportedInput {
  exportId: string;
  autocountInvoiceNumber: string;
  userId?: string;
  userName?: string;
}

/**
 * Admin confirms the export landed in AutoCount and stamps the AutoCount
 * invoice number. Transitions status to 'exported'.
 */
export const markExportedInAutoCount = async (input: MarkExportedInput): Promise<AutoCountExport> => {
  const { data, error } = await supabase
    .from('autocount_exports')
    .update({
      status: 'exported',
      autocount_invoice_number: input.autocountInvoiceNumber,
      exported_at: new Date().toISOString(),
      exported_by_id: input.userId ?? null,
      exported_by_name: input.userName ?? null,
      export_error: null,
    })
    .eq('export_id', input.exportId)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  // Stamp the linked job with the export timestamp so the JobDetail header
  // can show "exported to AutoCount" without a second roundtrip.
  if (data?.job_id) {
    await supabase
      .from('jobs')
      .update({ autocount_exported_at: new Date().toISOString() })
      .eq('job_id', data.job_id);
  }
  return data as AutoCountExport;
};

/**
 * Retry a failed export. Increments retry_count, stamps last_retry_at, and
 * leaves it as 'pending' for the next manual export attempt.
 */
export const retryAutoCountExport = async (exportId: string): Promise<AutoCountExport> => {
  const { data: current } = await supabase
    .from('autocount_exports')
    .select('retry_count')
    .eq('export_id', exportId)
    .single();
  const { data, error } = await supabase
    .from('autocount_exports')
    .update({
      status: 'pending',
      retry_count: (current?.retry_count ?? 0) + 1,
      last_retry_at: new Date().toISOString(),
      export_error: null,
    })
    .eq('export_id', exportId)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as AutoCountExport;
};

/** Cancel an export (admin chose not to send to AutoCount). */
export const cancelAutoCountExport = async (exportId: string): Promise<AutoCountExport> => {
  const { data, error } = await supabase
    .from('autocount_exports')
    .update({ status: 'cancelled' })
    .eq('export_id', exportId)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as AutoCountExport;
};

/** Mark an export as failed and capture the error reason. */
export const markExportFailed = async (exportId: string, errorMsg: string): Promise<AutoCountExport> => {
  const { data, error } = await supabase
    .from('autocount_exports')
    .update({ status: 'failed', export_error: errorMsg })
    .eq('export_id', exportId)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as AutoCountExport;
};
