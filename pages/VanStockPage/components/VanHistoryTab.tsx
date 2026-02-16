/**
 * VanHistoryTab - Shows usage history for a van:
 *   - Which technicians have used it
 *   - Log of spare parts deducted from van stock
 */
import { Clock, Package, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  getVanUsageHistory,
  getVanTechnicianSummary,
  VanUsageRecord,
  VanTechnicianSummary,
} from '../../../services/vanHistoryService';

interface VanHistoryTabProps {
  vanStockId: string;
}

const PAGE_SIZE = 20;

export function VanHistoryTab({ vanStockId }: VanHistoryTabProps) {
  const [tab, setTab] = useState<'parts' | 'technicians'>('parts');
  const [records, setRecords] = useState<VanUsageRecord[]>([]);
  const [techSummary, setTechSummary] = useState<VanTechnicianSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const [usage, techs] = await Promise.all([
        getVanUsageHistory(vanStockId, PAGE_SIZE, page * PAGE_SIZE),
        page === 0 ? getVanTechnicianSummary(vanStockId) : Promise.resolve(techSummary),
      ]);
      setRecords(usage.records);
      setTotal(usage.total);
      if (page === 0) setTechSummary(techs);
    } catch (e) {
      console.error('Failed to load van history:', e);
    } finally {
      setLoading(false);
    }
  }, [vanStockId, page]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('en-MY', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const formatQty = (qty: number, unit: string) => {
    const display = Number.isInteger(qty) ? qty.toString() : qty.toFixed(2);
    return `${display} ${unit}`;
  };

  if (loading && records.length === 0) {
    return (
      <div className="text-center py-8 text-[var(--text-muted)]">
        <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        Loading history...
      </div>
    );
  }

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex gap-1 mb-4 bg-[var(--bg-subtle)] rounded-lg p-1">
        <button
          onClick={() => setTab('parts')}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition ${
            tab === 'parts'
              ? 'bg-[var(--surface)] text-[var(--text)] shadow-sm'
              : 'text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <Package className="w-4 h-4" /> Parts Log ({total})
        </button>
        <button
          onClick={() => setTab('technicians')}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition ${
            tab === 'technicians'
              ? 'bg-[var(--surface)] text-[var(--text)] shadow-sm'
              : 'text-[var(--text-muted)] hover:text-[var(--text)]'
          }`}
        >
          <User className="w-4 h-4" /> Technicians ({techSummary.length})
        </button>
      </div>

      {tab === 'parts' && (
        <>
          {records.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-muted)]">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No parts deducted from this van yet</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {records.map((r) => (
                  <div
                    key={r.usage_id}
                    className="flex items-start justify-between p-3 bg-[var(--bg-subtle)] rounded-xl border border-[var(--border-subtle)]"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-[var(--text)]">
                          {r.part_name}
                        </span>
                        {r.part_code && (
                          <span className="text-xs text-[var(--text-muted)] bg-[var(--surface)] px-1.5 py-0.5 rounded">
                            {r.part_code}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-muted)]">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" /> {r.used_by_name}
                        </span>
                        <span>Job: {r.job_title}</span>
                        {r.customer_name && <span>· {r.customer_name}</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <div className="text-sm font-semibold text-red-600">
                        −{formatQty(r.quantity_used, r.part_unit)}
                      </div>
                      <div className="text-xs text-[var(--text-muted)] flex items-center gap-1 justify-end mt-0.5">
                        <Clock className="w-3 h-3" /> {formatDateTime(r.used_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--border-subtle)]">
                  <span className="text-xs text-[var(--text-muted)]">
                    Page {page + 1} of {totalPages}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="p-1.5 rounded-lg hover:bg-[var(--bg-subtle)] disabled:opacity-30 transition"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                      className="p-1.5 rounded-lg hover:bg-[var(--bg-subtle)] disabled:opacity-30 transition"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {tab === 'technicians' && (
        <>
          {techSummary.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-muted)]">
              <User className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No technician usage recorded</p>
            </div>
          ) : (
            <div className="space-y-2">
              {techSummary.map((t) => (
                <div
                  key={t.technician_id}
                  className="p-3 bg-[var(--bg-subtle)] rounded-xl border border-[var(--border-subtle)]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-blue-600 font-semibold text-sm">
                          {t.technician_name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-sm text-[var(--text)]">{t.technician_name}</div>
                        <div className="text-xs text-[var(--text-muted)]">
                          {t.total_jobs} job{t.total_jobs !== 1 ? 's' : ''} · {t.total_parts_used} parts used
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-xs text-[var(--text-muted)]">
                      <div>{formatDate(t.first_used)} – {formatDate(t.last_used)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
