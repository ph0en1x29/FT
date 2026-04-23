/**
 * Pending Returns hooks
 *
 * usePendingReturnsCount — keeps a live count of job_parts.return_status =
 * 'pending_return' for the Approvals tab badge. Refetches only on
 * transitions in/out of pending_return (the shared channel pre-filters).
 *
 * usePendingReturnsToastNotifier — for admins, fires a sonner toast on a
 * brand-new pending return when the user is NOT on the page where they
 * would already be looking at the list. Pre-seeds the "seen" set from a
 * synchronous initial fetch so a slow realtime connect can't blast toasts
 * for the historical backlog.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  countPendingReturns,
  listPendingReturnIds,
  subscribeToPendingReturns,
} from '../services/pendingReturnsService';

export const usePendingReturnsCount = (): number => {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      setCount(await countPendingReturns());
    } catch {
      // Soft-fail — badge missing is better than crashing the app shell.
    }
  }, []);

  useEffect(() => {
    refresh();
    const sub = subscribeToPendingReturns((ev) => {
      if (ev.type === 'transition_in' || ev.type === 'transition_out') refresh();
    });
    return () => sub.unsubscribe();
  }, [refresh]);

  return count;
};

/**
 * Mounts at the app shell for admin/supervisor roles. Pops a sonner toast
 * the first time we see a row in pending_return, unless the user is already
 * looking at the Approvals tab. Pre-seeds the "seen" set from the current
 * pending list so historical rows can never trigger a toast (no race with
 * realtime subscription latency).
 *
 * Effect dependencies stay minimal — `enabled` only — so navigating between
 * pages doesn't tear down the realtime subscription. The approvals-tab
 * suppression is checked at toast time via window.location, not via a stale
 * react-router closure.
 */
export const usePendingReturnsToastNotifier = (enabled: boolean): void => {
  const navigate = useNavigate();
  const seen = useRef<Set<string>>(new Set());
  const initialized = useRef(false);
  const navigateRef = useRef(navigate);

  // Keep the latest navigate fn in a ref so the long-lived subscription can
  // call it without being a dep of the effect.
  useEffect(() => { navigateRef.current = navigate; }, [navigate]);

  useEffect(() => {
    if (!enabled) return;

    let active = true;
    seen.current = new Set();
    initialized.current = false;

    // Seed FIRST, then subscribe. Any realtime transition_in we see post-seed
    // is genuinely new, so we can toast safely.
    (async () => {
      try {
        const ids = await listPendingReturnIds();
        if (!active) return;
        ids.forEach(id => seen.current.add(id));
      } catch {
        // Soft-fail — without seeding we'd toast historical rows; better to
        // mark initialized and live with the noise than to never toast.
      } finally {
        initialized.current = true;
      }
    })();

    const sub = subscribeToPendingReturns((ev) => {
      if (!active) return;
      if (ev.type !== 'transition_in') return;
      if (seen.current.has(ev.jobPartId)) return;
      seen.current.add(ev.jobPartId);
      if (!initialized.current) return;

      // Stay quiet if the admin is already on the approvals tab. Read from
      // window.location at fire time so we react to the live route, not a
      // stale snapshot from when the effect ran.
      const path = window.location.pathname;
      const search = window.location.search;
      const onApprovalsTab = path.startsWith('/jobs')
        && new URLSearchParams(search).get('tab') === 'approvals';
      if (onApprovalsTab) return;

      toast.info('New part return', {
        description: 'A technician flagged a part for return.',
        action: { label: 'Review', onClick: () => navigateRef.current('/jobs?tab=approvals') },
      });
    });

    return () => {
      active = false;
      sub.unsubscribe();
    };
  }, [enabled]);
};
