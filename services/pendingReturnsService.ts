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
      job:jobs!inner(title, status, deleted_at,
        customer:customers(name),
        forklift:forklifts!forklift_id(serial_number))
    `)
    .eq('return_status', 'pending_return')
    .is('job.deleted_at', null)
    .order('return_requested_at', { ascending: true });

  if (error) throw new Error(error.message);

  const rows = (data as unknown as RawJoinedRow[]) || [];
  return rows.map(r => ({
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
 * Quick fetch of the IDs currently in pending_return — used to seed the
 * toast-notifier "seen" set so historical rows don't blast notifications
 * the first time the realtime subscription fires.
 */
export const listPendingReturnIds = async (): Promise<string[]> => {
  const { data, error } = await supabase
    .from('job_parts')
    .select('job_part_id')
    .eq('return_status', 'pending_return');
  if (error) return [];
  return (data || []).map(r => (r as { job_part_id: string }).job_part_id);
};

// =============================================================================
// Realtime: shared singleton subscription
// =============================================================================
//
// Every admin session mounts three consumers (badge count, queue list, toast
// notifier). Earlier each opened its own channel and refetched on EVERY
// job_parts event across the whole org. With ~20 admins online and dozens of
// part edits per day that fanned out into hundreds of redundant joined
// queries / hour. We collapse them into one ref-counted singleton with a
// shared debounce, and the channel itself filters to events that touch a
// pending_return state transition (predicate runs once per event, not once
// per consumer).
//
// Subscribers get a typed event payload; they decide what to do (refetch
// list, refetch count, fire toast). The "INITIAL_DATA" event lets toast
// notifiers know the seed phase is complete.

export type PendingReturnEvent =
  | { type: 'transition_in'; jobPartId: string }    // row entered pending_return
  | { type: 'transition_out'; jobPartId: string }   // row left pending_return (returned / cancelled)
  | { type: 'noop' };

type Listener = (ev: PendingReturnEvent) => void;

interface SharedChannel {
  channel: ReturnType<typeof supabase.channel>;
  listeners: Set<Listener>;
  debounceTimer: ReturnType<typeof setTimeout> | null;
}

let _shared: SharedChannel | null = null;

const fanout = (ev: PendingReturnEvent) => {
  if (!_shared) return;
  for (const fn of _shared.listeners) {
    try { fn(ev); } catch { /* keep going */ }
  }
};

const ensureChannel = () => {
  if (_shared) return _shared;
  const channel = supabase
    .channel('pending-returns-shared')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'job_parts' },
      (payload) => {
        const newRow = payload.new as { job_part_id?: string; return_status?: string | null } | null;
        const oldRow = payload.old as { job_part_id?: string; return_status?: string | null } | null;
        const newStatus = newRow?.return_status ?? null;
        const oldStatus = oldRow?.return_status ?? null;

        // Predicate: only fan out when the row's pending_return state
        // actually changed. Quietly drop unrelated edits (qty change, price
        // edit, auto_populated flip…) so we don't trigger N joined refetches.
        const id = newRow?.job_part_id ?? oldRow?.job_part_id;
        if (!id) return;
        if (oldStatus === newStatus) return;
        if (newStatus === 'pending_return') fanout({ type: 'transition_in', jobPartId: id });
        else if (oldStatus === 'pending_return') fanout({ type: 'transition_out', jobPartId: id });
      },
    )
    .subscribe();

  _shared = { channel, listeners: new Set<Listener>(), debounceTimer: null };
  return _shared;
};

/**
 * Subscribe to pending-return state transitions. Multiple subscribers share
 * a single Supabase channel; the channel is torn down when the last
 * subscriber unsubscribes.
 */
export const subscribeToPendingReturns = (listener: Listener): { unsubscribe: () => void } => {
  const shared = ensureChannel();
  shared.listeners.add(listener);
  return {
    unsubscribe: () => {
      if (!_shared) return;
      _shared.listeners.delete(listener);
      if (_shared.listeners.size === 0) {
        if (_shared.debounceTimer) clearTimeout(_shared.debounceTimer);
        supabase.removeChannel(_shared.channel);
        _shared = null;
      }
    },
  };
};
