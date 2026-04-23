import { Loader2, PackageCheck, PackageX, RefreshCw, Undo2 } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cancelPartReturn, confirmPartReturn } from '../../../services/jobPartReturnService';
import { listPendingReturns, PendingReturnRow, subscribeToPendingReturns } from '../../../services/pendingReturnsService';
import { showToast } from '../../../services/toastService';

const formatTimeAgo = (iso: string | null): string => {
  if (!iso) return '';
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString();
};

/**
 * Admin-side queue of tech-initiated part returns awaiting physical receipt.
 * Mounted inside StoreQueuePage (and shown to admins / supervisors only). The
 * realtime subscription keeps the list in sync as techs flag new returns.
 */
export const PendingReturnsSection: React.FC = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<PendingReturnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listPendingReturns());
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load pending returns';
      showToast.error('Could not load pending returns', msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const sub = subscribeToPendingReturns(({ newRow, oldRow }) => {
      // Refetch on any transition that touches a pending_return row.
      // (Filtering at the channel level by column value is not supported in
      // Supabase realtime, so we filter client-side and then refetch to pick
      // up the joined fields.)
      if (newRow?.return_status === 'pending_return' || oldRow?.return_status === 'pending_return') {
        refresh();
      }
    });
    return () => sub.unsubscribe();
  }, [refresh]);

  const handleConfirm = async (row: PendingReturnRow) => {
    if (busyId) return;
    setBusyId(row.job_part_id);
    try {
      await confirmPartReturn(row.job_part_id);
      showToast.success('Return confirmed', `${row.part_name} restocked.`);
      setRows(prev => prev.filter(r => r.job_part_id !== row.job_part_id));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to confirm return';
      showToast.error('Could not confirm return', msg);
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (row: PendingReturnRow) => {
    if (busyId) return;
    setBusyId(row.job_part_id);
    try {
      await cancelPartReturn(row.job_part_id);
      showToast.success('Return cancelled', 'Part is back in active use on the job.');
      setRows(prev => prev.filter(r => r.job_part_id !== row.job_part_id));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel return';
      showToast.error('Could not cancel return', msg);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[var(--warning-bg)] flex items-center justify-center">
            <PackageX className="w-4.5 h-4.5 text-[var(--warning)]" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-[var(--text)]">Pending Part Returns</h3>
            <p className="text-xs text-[var(--text-muted)]">
              {rows.length === 0
                ? 'Techs have nothing pending — all caught up.'
                : `${rows.length} return${rows.length === 1 ? '' : 's'} awaiting physical receipt`}
            </p>
          </div>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="p-2 rounded-lg hover:bg-[var(--bg-subtle)] disabled:opacity-50"
          title="Refresh"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 text-[var(--text-muted)]" />}
        </button>
      </header>

      {rows.length > 0 && (
        <ul className="divide-y divide-[var(--border-subtle)]">
          {rows.map(r => {
            const isBusy = busyId === r.job_part_id;
            return (
              <li key={r.job_part_id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-[var(--text)]">
                      {Number.isInteger(r.quantity) ? r.quantity : r.quantity.toFixed(2)}× {r.part_name}
                    </span>
                    {r.return_reason && (
                      <span className="text-[10px] uppercase tracking-wide text-[var(--warning)] bg-[var(--warning-bg)] px-1.5 py-0.5 rounded-full">
                        {r.return_reason}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
                    {r.requested_by_name ?? 'Unknown tech'}
                    {' · '}
                    <button
                      onClick={() => navigate(`/jobs/${r.job_id}`)}
                      className="underline hover:text-[var(--accent)]"
                    >
                      {r.job_title || r.job_id.slice(0, 8)}
                    </button>
                    {r.customer_name && <> · {r.customer_name}</>}
                    {r.forklift_serial && <> · {r.forklift_serial}</>}
                    {' · '}
                    {formatTimeAgo(r.return_requested_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    onClick={() => handleCancel(r)}
                    disabled={isBusy}
                    className="btn-premium btn-premium-ghost text-xs flex items-center gap-1 disabled:opacity-50"
                    title="Reject return — put the part back in active use"
                  >
                    <Undo2 className="w-3.5 h-3.5" /> Cancel
                  </button>
                  <button
                    onClick={() => handleConfirm(r)}
                    disabled={isBusy}
                    className="btn-premium btn-premium-primary text-xs flex items-center gap-1 disabled:opacity-50"
                  >
                    {isBusy
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Confirming…</>
                      : <><PackageCheck className="w-3.5 h-3.5" /> Confirm Return</>}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
