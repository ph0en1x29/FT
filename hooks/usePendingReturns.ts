/**
 * Pending Returns hooks
 *
 * usePendingReturnsCount — keeps a live count of job_parts.return_status =
 * 'pending_return' for the Approvals tab badge. Refetches on any realtime
 * job_parts change that touches a pending_return row.
 *
 * usePendingReturnsToastNotifier — for admins, fires a sonner toast on a
 * brand-new pending return when the user is NOT on the page where they would
 * already be looking at the list. Uses route matching to stay quiet on the
 * approvals tab. Only fires for rows seen for the first time within the
 * current session — historical rows on initial load don't trigger toasts.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { countPendingReturns, subscribeToPendingReturns } from '../services/pendingReturnsService';

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
    const sub = subscribeToPendingReturns(({ newRow, oldRow }) => {
      if (newRow?.return_status === 'pending_return' || oldRow?.return_status === 'pending_return') {
        refresh();
      }
    });
    return () => sub.unsubscribe();
  }, [refresh]);

  return count;
};

/**
 * Mounts at the app shell for admin/supervisor roles. Pops a sonner toast
 * the first time we see a row in pending_return, unless the user is already
 * looking at the Approvals tab.
 */
export const usePendingReturnsToastNotifier = (enabled: boolean): void => {
  const location = useLocation();
  const navigate = useNavigate();
  const seen = useRef<Set<string>>(new Set());
  const initialized = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    let active = true;
    const sub = subscribeToPendingReturns(({ eventType, newRow }) => {
      if (!active) return;
      if (!newRow || newRow.return_status !== 'pending_return') return;
      if (seen.current.has(newRow.job_part_id)) return;
      seen.current.add(newRow.job_part_id);

      // First load: don't toast historical rows. We seed the set silently on
      // the first INSERT/UPDATE batch by checking initialized.
      if (!initialized.current) return;
      // Stay quiet if the admin is already on the approvals tab.
      const onApprovalsTab = location.pathname.startsWith('/jobs')
        && new URLSearchParams(location.search).get('tab') === 'approvals';
      if (onApprovalsTab) return;
      // Skip self-echoes — confirm/cancel actions raise UPDATEs that don't
      // reach this branch (status is no longer pending_return), but suppress
      // any unexpected duplicates.
      if (eventType === 'DELETE') return;

      toast.info('New part return', {
        description: 'A technician flagged a part for return.',
        action: { label: 'Review', onClick: () => navigate('/jobs?tab=approvals') },
      });
    });

    // Mark initialized after the first turn so we don't blast toasts for the
    // backlog of pending rows that already exist on app load.
    const initTimer = setTimeout(() => { initialized.current = true; }, 1500);

    return () => {
      active = false;
      clearTimeout(initTimer);
      sub.unsubscribe();
    };
  }, [enabled, location.pathname, location.search, navigate]);
};
