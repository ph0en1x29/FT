import { AlertTriangle, CheckCircle, ClipboardList, Loader2, Plus, XCircle } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../services/supabaseClient';
import { Part, User } from '../../../types';

interface StocktakeTabProps {
  currentUser: User;
}

interface StocktakeRow {
  part: Part;
  physicalQty: string;
  reason: string;
}

interface Stocktake {
  stocktake_id: string;
  part_id: string;
  system_qty: number;
  physical_qty: number;
  variance: number;
  variance_reason: string | null;
  performed_by: string;
  performed_by_name: string;
  approved_by: string | null;
  approved_at: string | null;
  status: 'pending' | 'approved' | 'rejected';
  notes: string | null;
  created_at: string;
  parts?: { part_name: string };
}

const VARIANCE_REASONS = [
  'Damage',
  'Theft',
  'Spillage',
  'Counting Error',
  'Evaporation',
  'Other',
];

const StocktakeTab: React.FC<StocktakeTabProps> = ({ currentUser }) => {
  const [parts, setParts] = useState<Part[]>([]);
  const [stocktakes, setStocktakes] = useState<Stocktake[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [rows, setRows] = useState<StocktakeRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const isAdmin = currentUser.role === 'admin';

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [partsRes, stocktakesRes] = await Promise.all([
        supabase
          .from('parts')
          .select('*')
          .eq('is_liquid', true)
          .order('part_name'),
        supabase
          .from('stocktakes')
          .select('*, parts(part_name)')
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      if (partsRes.error) throw partsRes.error;
      if (stocktakesRes.error) throw stocktakesRes.error;

      setParts((partsRes.data ?? []) as Part[]);
      setStocktakes((stocktakesRes.data ?? []) as Stocktake[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getSystemQty = (part: Part) => {
    const containers = part.container_quantity ?? 0;
    const bulk = part.bulk_quantity ?? 0;
    const size = part.container_size ?? 0;
    return containers * size + bulk;
  };

  const startNewStocktake = () => {
    setRows(
      parts.map((part) => ({
        part,
        physicalQty: '',
        reason: '',
      }))
    );
    setShowForm(true);
    setError('');
  };

  const updateRow = (index: number, field: 'physicalQty' | 'reason', value: string) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const getVariance = (row: StocktakeRow): number | null => {
    const physical = parseFloat(row.physicalQty);
    if (isNaN(physical)) return null;
    const system = getSystemQty(row.part);
    return physical - system;
  };

  const handleSubmit = async () => {
    const rowsWithVariance = rows.filter((row) => {
      const variance = getVariance(row);
      return variance !== null && Math.abs(variance) > 0.001;
    });

    if (rowsWithVariance.length === 0) {
      setError('No variances detected. Nothing to submit.');
      return;
    }

    const missingReasons = rowsWithVariance.filter((row) => !row.reason);
    if (missingReasons.length > 0) {
      setError(`Please select a reason for all parts with variance (${missingReasons.length} missing).`);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const inserts = rowsWithVariance.map((row) => ({
        part_id: row.part.part_id,
        location_type: 'warehouse',
        system_qty: getSystemQty(row.part),
        physical_qty: parseFloat(row.physicalQty),
        variance_reason: row.reason,
        performed_by: currentUser.user_id,
        performed_by_name: currentUser.name,
        status: 'pending',
      }));

      const { error: insertError } = await supabase.from('stocktakes').insert(inserts);
      if (insertError) throw insertError;

      setShowForm(false);
      await loadData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to submit stocktake');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (stocktake: Stocktake) => {
    if (stocktake.performed_by === currentUser.user_id) {
      alert('You cannot approve your own stocktake.');
      return;
    }

    setApprovingId(stocktake.stocktake_id);
    try {
      const { error: approveErr } = await supabase
        .from('stocktakes')
        .update({
          status: 'approved',
          approved_by: currentUser.user_id,
          approved_at: new Date().toISOString(),
        })
        .eq('stocktake_id', stocktake.stocktake_id);
      if (approveErr) throw approveErr;

      const { error: partUpdateErr } = await supabase
        .from('parts')
        .update({ bulk_quantity: stocktake.physical_qty })
        .eq('part_id', stocktake.part_id);
      if (partUpdateErr) throw partUpdateErr;

      const { error: movErr } = await supabase.from('inventory_movements').insert({
        part_id: stocktake.part_id,
        movement_type: 'adjustment',
        bulk_qty_change: stocktake.variance,
        performed_by: currentUser.user_id,
        performed_by_name: currentUser.name,
        store_bulk_qty_after: stocktake.physical_qty,
        notes: `Stocktake adjustment: ${stocktake.variance >= 0 ? '+' : ''}${stocktake.variance.toFixed(2)} (Reason: ${stocktake.variance_reason})`,
        adjustment_reason: stocktake.variance_reason,
      });
      if (movErr) throw movErr;

      await loadData();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to approve stocktake');
    } finally {
      setApprovingId(null);
    }
  };

  const getVarianceColor = (variance: number) => {
    if (Math.abs(variance) < 0.001) return 'text-green-600';
    if (variance < 0) return 'text-red-600';
    return 'text-amber-600';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle className="w-3 h-3" /> Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <XCircle className="w-3 h-3" /> Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
            <AlertTriangle className="w-3 h-3" /> Pending
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-theme">Stocktake</h2>
          <p className="text-xs text-theme-muted mt-0.5">Physical stock count and variance approval</p>
        </div>
        {isAdmin && !showForm && (
          <button
            onClick={startNewStocktake}
            className="btn-premium btn-premium-primary flex items-center gap-2 text-sm"
          >
            <Plus className="w-4 h-4" />
            New Stocktake
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {showForm && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-subtle)]">
            <h3 className="text-sm font-semibold text-theme flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              Physical Count — {new Date().toLocaleDateString()}
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--border)]">
                <tr className="text-xs font-medium text-theme-muted uppercase tracking-wide">
                  <th className="text-left px-4 py-2.5">Part</th>
                  <th className="text-right px-4 py-2.5 whitespace-nowrap">System Qty</th>
                  <th className="text-right px-4 py-2.5 whitespace-nowrap">Physical Qty</th>
                  <th className="text-right px-4 py-2.5">Variance</th>
                  <th className="text-left px-4 py-2.5">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {rows.map((row, index) => {
                  const systemQty = getSystemQty(row.part);
                  const variance = getVariance(row);
                  const hasVariance = variance !== null && Math.abs(variance) > 0.001;

                  return (
                    <tr key={row.part.part_id} className="hover:bg-[var(--bg-subtle)]">
                      <td className="px-4 py-2.5 font-medium text-theme">{row.part.part_name}</td>
                      <td className="px-4 py-2.5 text-right text-theme-muted tabular-nums">
                        {systemQty.toFixed(2)} {row.part.base_unit ?? 'L'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="0.01"
                          value={row.physicalQty}
                          onChange={(e) => updateRow(index, 'physicalQty', e.target.value)}
                          placeholder="0.00"
                          className="input-premium text-sm text-right w-28"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                        {variance !== null ? (
                          <span className={getVarianceColor(variance)}>
                            {variance >= 0 ? '+' : ''}{variance.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-theme-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {hasVariance ? (
                          <select
                            value={row.reason}
                            onChange={(e) => updateRow(index, 'reason', e.target.value)}
                            className="input-premium text-sm w-40"
                          >
                            <option value="">Select reason…</option>
                            {VARIANCE_REASONS.map((r) => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-theme-muted text-xs">No variance</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 border-t border-[var(--border)] flex gap-2 justify-end">
            <button
              onClick={() => setShowForm(false)}
              className="btn-premium btn-premium-secondary text-sm"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="btn-premium btn-premium-primary text-sm flex items-center gap-2"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Submitting…</>
              ) : (
                'Submit Stocktake'
              )}
            </button>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-theme mb-3">Stocktake History</h3>
        {stocktakes.length === 0 ? (
          <div className="text-center py-12 text-theme-muted text-sm">
            No stocktakes recorded yet.
          </div>
        ) : (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-[var(--border)]">
                  <tr className="text-xs font-medium text-theme-muted uppercase tracking-wide">
                    <th className="text-left px-4 py-2.5">Part</th>
                    <th className="text-right px-4 py-2.5">System</th>
                    <th className="text-right px-4 py-2.5">Physical</th>
                    <th className="text-right px-4 py-2.5">Variance</th>
                    <th className="text-left px-4 py-2.5">Reason</th>
                    <th className="text-left px-4 py-2.5">By</th>
                    <th className="text-left px-4 py-2.5">Date</th>
                    <th className="text-left px-4 py-2.5">Status</th>
                    {isAdmin && <th className="text-left px-4 py-2.5">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {stocktakes.map((st) => (
                    <tr key={st.stocktake_id} className="hover:bg-[var(--bg-subtle)]">
                      <td className="px-4 py-2.5 font-medium text-theme">
                        {st.parts?.part_name ?? st.part_id}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-theme-muted">
                        {st.system_qty.toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {st.physical_qty.toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                        <span className={getVarianceColor(st.variance)}>
                          {st.variance >= 0 ? '+' : ''}{st.variance.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-theme-muted">{st.variance_reason ?? '—'}</td>
                      <td className="px-4 py-2.5 text-theme-muted">{st.performed_by_name}</td>
                      <td className="px-4 py-2.5 text-theme-muted whitespace-nowrap">
                        {new Date(st.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2.5">{getStatusBadge(st.status)}</td>
                      {isAdmin && (
                        <td className="px-4 py-2.5">
                          {st.status === 'pending' && st.performed_by !== currentUser.user_id ? (
                            <button
                              onClick={() => handleApprove(st)}
                              disabled={approvingId === st.stocktake_id}
                              className="text-xs px-3 py-1 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50 flex items-center gap-1"
                            >
                              {approvingId === st.stocktake_id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <CheckCircle className="w-3 h-3" />
                              )}
                              Approve
                            </button>
                          ) : st.status === 'pending' ? (
                            <span className="text-xs text-theme-muted italic">Self-submitted</span>
                          ) : null}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StocktakeTab;
