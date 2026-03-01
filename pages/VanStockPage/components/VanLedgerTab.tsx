/**
 * VanLedgerTab - Van inventory ledger
 * Select a van → show ALL recent movements across all parts, newest first.
 * Running balance is computed per-part within the van.
 * Van selector is searchable (tech name, van_code, van_plate).
 */
import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '../../../services/supabaseClient';
import type { User } from '../../../types';

// ── Types ────────────────────────────────────────────────────────────────────

interface VanInfo {
  van_stock_id: string;
  van_code?: string | null;
  van_plate?: string | null;
  technician?: { name: string } | null;
}

interface MovementRow {
  movement_id: string;
  performed_at: string;
  movement_type: string;
  part_id: string;
  container_qty_change: number | null;
  bulk_qty_change: number | null;
  van_container_qty_after: number | null;
  van_bulk_qty_after: number | null;
  performed_by_name: string | null;
  notes: string | null;
  job_id: string | null;
  parts: {
    part_name: string;
    is_liquid: boolean;
    container_size: number | null;
  } | null;
  // computed
  change: number;
  balance_after: number;
  is_positive: boolean;
}

// ── Constants ────────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  purchase: 'Purchase',
  break_container: 'Open Container',
  use_internal: 'Job Usage',
  sell_external: 'Special Sale',
  transfer_to_van: 'Received from Warehouse',
  return_to_store: 'Returned to Store',
  adjustment: 'Adjustment',
  initial_stock: 'Initial Stock',
  van_transfer: 'Received from Warehouse',
  job_usage: 'Job Usage',
  special_sale: 'Special Sale',
  reversal: 'Reversal',
  stocktake: 'Stocktake Adjustment',
};

const VAN_POSITIVE_TYPES = new Set([
  'transfer_to_van', 'van_transfer', 'initial_stock', 'purchase', 'return_to_store',
]);

// ── Helpers ──────────────────────────────────────────────────────────────────

function getVanLabel(v: VanInfo): string {
  const techName = v.technician?.name;
  const base = techName ? `${techName}'s Van` : 'Unknown Van';
  if (v.van_code) return `${base} (${v.van_code})`;
  if (v.van_plate) return `${base} (${v.van_plate})`;
  return base;
}

function vanMatchesSearch(v: VanInfo, q: string): boolean {
  const lower = q.toLowerCase();
  return (
    (v.technician?.name ?? '').toLowerCase().includes(lower) ||
    (v.van_code ?? '').toLowerCase().includes(lower) ||
    (v.van_plate ?? '').toLowerCase().includes(lower)
  );
}

// ── VanLOV (searchable van picker) ───────────────────────────────────────────

interface VanLOVProps {
  vans: VanInfo[];
  selectedVanId: string;
  onSelect: (id: string) => void;
}

const VanLOV: React.FC<VanLOVProps> = ({ vans, selectedVanId, onSelect }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = vans.find(v => v.van_stock_id === selectedVanId);
  const filtered = search ? vans.filter(v => vanMatchesSearch(v, search)) : vans;

  useEffect(() => {
    if (open) {
      setSearch('');
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between px-3 py-2 border border-theme rounded-lg bg-theme-surface text-sm text-left focus:ring-2 focus:ring-blue-500 hover:bg-theme-surface-2 transition-colors"
      >
        <span className={selected ? 'text-theme' : 'text-theme-muted'}>
          {selected ? getVanLabel(selected) : 'Select a van…'}
        </span>
        <svg className="w-4 h-4 text-theme-muted flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md bg-theme-surface rounded-xl shadow-2xl flex flex-col overflow-hidden"
            style={{ maxHeight: '80vh' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="p-3 border-b border-theme">
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by tech name, van code, or plate…"
                className="w-full px-3 py-2 rounded-lg border border-theme bg-theme-surface-2 text-sm text-theme placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="overflow-y-auto flex-1">
              {filtered.length === 0 ? (
                <div className="text-center py-8 text-sm text-theme-muted">No vans found</div>
              ) : (
                filtered.map(v => (
                  <button
                    key={v.van_stock_id}
                    type="button"
                    onClick={() => { onSelect(v.van_stock_id); setOpen(false); }}
                    className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-theme-surface-2 transition-colors border-b border-theme/40 last:border-b-0 ${
                      v.van_stock_id === selectedVanId ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-theme truncate">{getVanLabel(v)}</div>
                      {v.van_plate && v.van_code && (
                        <div className="text-xs text-theme-muted">{v.van_plate}</div>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

interface VanLedgerTabProps {
  currentUser: User;
}

const VanLedgerTab: React.FC<VanLedgerTabProps> = () => {
  const [vans, setVans] = useState<VanInfo[]>([]);
  const [selectedVanId, setSelectedVanId] = useState('');
  const [rows, setRows] = useState<MovementRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [vansLoading, setVansLoading] = useState(true);

  // Load van list
  useEffect(() => {
    const load = async () => {
      setVansLoading(true);
      const { data } = await supabase
        .from('van_stocks')
        .select('van_stock_id, van_code, van_plate, technician:users!technician_id(name)')
        .eq('is_active', true)
        .order('van_code');
      if (data) setVans(data as unknown as VanInfo[]);
      setVansLoading(false);
    };
    load();
  }, []);

  // Load all movements for selected van, all parts mixed, parts joined
  useEffect(() => {
    if (!selectedVanId) { setRows([]); return; }

    const load = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from('inventory_movements')
        .select('*, parts(part_name, is_liquid, container_size)')
        .eq('van_stock_id', selectedVanId)
        .order('performed_at', { ascending: true });

      if (error || !data) { setRows([]); setLoading(false); return; }

      // Running balance tracked per part_id (ascending order first)
      const balancePerPart: Record<string, number> = {};

      const computed: MovementRow[] = (data as any[]).map(m => {
        const part = m.parts as MovementRow['parts'];
        const isLiquid = part?.is_liquid ?? false;
        const containerSize = part?.container_size ?? 1;

        const cQty = m.container_qty_change ?? 0;
        const bQty = m.bulk_qty_change ?? 0;
        const change = isLiquid ? cQty * containerSize + bQty : cQty;

        // Prefer DB-recorded balance snapshot when available
        let balanceAfter: number;
        if (isLiquid && m.van_bulk_qty_after != null) {
          const cAfter = m.van_container_qty_after ?? 0;
          balanceAfter = cAfter * containerSize + Number(m.van_bulk_qty_after);
        } else if (!isLiquid && m.van_container_qty_after != null) {
          balanceAfter = m.van_container_qty_after;
        } else {
          balanceAfter = (balancePerPart[m.part_id] ?? 0) + change;
        }
        balancePerPart[m.part_id] = balanceAfter;

        const isPositive = VAN_POSITIVE_TYPES.has(m.movement_type) || change > 0;

        return {
          movement_id: m.movement_id,
          performed_at: m.performed_at,
          movement_type: m.movement_type,
          part_id: m.part_id,
          container_qty_change: m.container_qty_change,
          bulk_qty_change: m.bulk_qty_change,
          van_container_qty_after: m.van_container_qty_after,
          van_bulk_qty_after: m.van_bulk_qty_after,
          performed_by_name: m.performed_by_name,
          notes: m.notes,
          job_id: m.job_id,
          parts: part,
          change,
          balance_after: balanceAfter,
          is_positive: isPositive,
        } satisfies MovementRow;
      });

      // Reverse to show newest first
      setRows([...computed].reverse());
      setLoading(false);
    };

    load();
  }, [selectedVanId]);

  const selectedVan = vans.find(v => v.van_stock_id === selectedVanId);

  return (
    <div className="space-y-4">
      {/* Van selector */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1 max-w-sm">
          <label className="block text-xs font-medium text-theme-muted mb-1">Select Van</label>
          {vansLoading ? (
            <div className="h-10 bg-theme-surface-2 rounded-lg animate-pulse" />
          ) : (
            <VanLOV
              vans={vans}
              selectedVanId={selectedVanId}
              onSelect={setSelectedVanId}
            />
          )}
        </div>

        {selectedVan && (
          <div className="pb-2 flex items-center gap-3">
            <div className="text-xs text-theme-muted">
              Viewing: <span className="font-medium text-theme">{getVanLabel(selectedVan)}</span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedVanId('')}
              className="text-xs text-blue-500 hover:text-blue-600"
            >
              ← Change van
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {!selectedVanId ? (
        <div className="text-center py-16 text-theme-muted text-sm">
          Select a van to view its movement history
        </div>
      ) : loading ? (
        <div className="space-y-2 mt-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-theme-surface-2 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-theme-muted text-sm">
          No movements recorded for this van
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-theme">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="bg-theme-surface-2 border-b border-theme">
                <th className="text-left px-4 py-3 text-xs font-semibold text-theme-muted uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-theme-muted uppercase tracking-wide">Part</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-theme-muted uppercase tracking-wide">Action</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-theme-muted uppercase tracking-wide">Change</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-theme-muted uppercase tracking-wide">Balance</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-theme-muted uppercase tracking-wide">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme">
              {rows.map(row => {
                const isLiquid = row.parts?.is_liquid ?? false;
                const unit = isLiquid ? 'L' : 'pcs';
                const isNegBal = row.balance_after < 0;
                const changeStr = isLiquid
                  ? Number(row.change).toFixed(2)
                  : Math.round(row.change).toString();
                const balStr = isLiquid
                  ? Number(row.balance_after).toFixed(2)
                  : Math.round(row.balance_after).toString();

                return (
                  <tr
                    key={row.movement_id}
                    className={`transition-colors ${isNegBal ? 'bg-amber-50/60 dark:bg-amber-900/10' : 'hover:bg-theme-surface-2/50'}`}
                  >
                    <td className="px-4 py-3 text-theme-muted whitespace-nowrap text-xs">
                      {new Date(row.performed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      <span className="block text-theme-muted/60">
                        {new Date(row.performed_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-theme font-medium text-sm">
                      {row.parts?.part_name ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        row.is_positive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {ACTION_LABELS[row.movement_type] ?? row.movement_type}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-semibold ${
                      row.is_positive ? 'text-green-600' : 'text-red-500'
                    }`}>
                      {row.is_positive && row.change >= 0 ? '+' : ''}{changeStr} {unit}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-semibold ${
                      isNegBal ? 'text-amber-600' : 'text-theme'
                    }`}>
                      {isNegBal && <AlertTriangle className="w-3 h-3 inline mr-1 text-amber-500" />}
                      {balStr} {unit}
                    </td>
                    <td className="px-4 py-3 text-theme-muted text-sm">
                      {row.performed_by_name ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default VanLedgerTab;
