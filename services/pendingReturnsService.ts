/**
 * Pending Returns Service
 *
 * Read + realtime subscription for tech-initiated job_parts returns awaiting
 * admin confirmation. Powers the admin "Pending Returns" section, the
 * Approvals tab badge, and the global new-return toast notifier.
 *
 * Pairs with jobPartReturnService (which holds the RPCs called by the UI).
 */

import { supabase } from './supabaseClient';

export interface PendingReturnRow {
  job_part_id: string;
  job_id: string;
  part_id: string | null;
  part_name: string;
  quantity: number;
  return_reason: string | null;
  return_requested_by: string | null;
  return_requested_at: string | null;
  // Joined / lightweight context
  requested_by_name: string | null;
  job_title: string | null;
  job_status: string | null;
  customer_name: string | null;
  forklift_serial: string | null;
}

interface RawJoinedRow {
  job_part_id: string;
  job_id: string;
  part_id: string | null;
  part_name: string;
  quantity: number;
  return_reason: string | null;
  return_requested_by: string | null;
  return_requested_at: string | null;
  requester?: { full_name?: string | null; name?: string | null } | null;
  job?: {
    title?: string | null;
    status?: string | null;
    customer?: { name?: string | null } | null;
    forklift?: { serial_number?: string | null } | null;
  } | null;
}

/**
 * Lists every job_parts row currently in pending_return state, with the
 * lightweight context the admin needs to make a Confirm decision.
 *
 * Excludes returns whose underlying job has been soft-deleted — those rows
 * are noise once the parent job is gone.
 */
export const listPendingReturns = async (): Promise<PendingReturnRow[]> => {
  const { data, error } = await supabase
    .from('job_parts')
    .select(`
      job_part_id, job_id, part_id, part_name, quantity,
      return_reason, return_requested_by, return_requested_at,
      requester:users!job_parts_return_requested_by_fkey(full_name, name),
      job:jobs(title, status, deleted_at,
        customer:customers(name),
        forklift:forklifts!forklift_id(serial_number))
    `)
    .eq('return_status', 'pending_return')
    .order('return_requested_at', { ascending: true });

  if (error) throw new Error(error.message);

  const rows = (data as unknown as RawJoinedRow[]) || [];
  return rows
    .filter(r => r.job && !(r.job as { deleted_at?: string | null }).deleted_at)
    .map(r => ({
      job_part_id: r.job_part_id,
      job_id: r.job_id,
      part_id: r.part_id,
      part_name: r.part_name,
      quantity: r.quantity,
      return_reason: r.return_reason,
      return_requested_by: r.return_requested_by,
      return_requested_at: r.return_requested_at,
      requested_by_name: r.requester?.full_name || r.requester?.name || null,
      job_title: r.job?.title || null,
      job_status: r.job?.status || null,
      customer_name: r.job?.customer?.name || null,
      forklift_serial: r.job?.forklift?.serial_number || null,
    }));
};

/**
 * Lightweight count for the nav/tab badge — server-side count only, no joins.
 */
export const countPendingReturns = async (): Promise<number> => {
  const { count, error } = await supabase
    .from('job_parts')
    .select('job_part_id', { count: 'exact', head: true })
    .eq('return_status', 'pending_return');

  if (error) throw new Error(error.message);
  return count ?? 0;
};

/**
 * Subscribes to job_parts UPDATEs and INSERTs and invokes the callback with
 * the raw payload whenever return_status appears anywhere in the row. Caller
 * decides what to do (refetch list, increment count, fire toast).
 *
 * The realtime broadcast doesn't filter on column changes, so consumers
 * filter on `payload.new.return_status === 'pending_return'` themselves.
 */
let _channelCounter = 0;

export const subscribeToPendingReturns = (
  onChange: (payload: {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    newRow: { job_part_id: string; return_status: string | null } | null;
    oldRow: { job_part_id: string; return_status: string | null } | null;
  }) => void,
): { unsubscribe: () => void } => {
  // Unique channel name per subscription so multiple consumers (badge hook,
  // section list, global toast notifier) don't share a single channel and
  // tear each other down on unmount.
  _channelCounter += 1;
  const channelName = `pending-returns-${_channelCounter}`;
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'job_parts' },
      (payload) => {
        const newRow = (payload.new as { job_part_id?: string; return_status?: string | null } | null) ?? null;
        const oldRow = (payload.old as { job_part_id?: string; return_status?: string | null } | null) ?? null;
        onChange({
          eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
          newRow: newRow?.job_part_id
            ? { job_part_id: newRow.job_part_id, return_status: newRow.return_status ?? null }
            : null,
          oldRow: oldRow?.job_part_id
            ? { job_part_id: oldRow.job_part_id, return_status: oldRow.return_status ?? null }
            : null,
        });
      },
    )
    .subscribe();

  return {
    unsubscribe: () => {
      supabase.removeChannel(channel);
    },
  };
};
