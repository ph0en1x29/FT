/**
 * InventoryLedgerTab - Warehouse inventory ledger
 * Shows recent activity across all parts, or running balance per selected item
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../../services/supabaseClient';
import type { Part, InventoryMovement, InventoryMovementType } from '../../../types/inventory.types';

const ACTION_LABELS: Record<string, string> = {
  purchase: 'Purchase',
  break_container: 'Open Container',
  use_internal: 'Job Usage',
  sell_external: 'Special Sale',
  transfer_to_van: 'Van Transfer',
  return_to_store: 'Return',
  adjustment: 'Adjustment',
  initial_stock: 'Initial Stock',
  reversal: 'Reversal',
  stocktake: 'Stocktake Adjustment',
  van_transfer: 'Van Transfer',
  job_usage: 'Job Usage',
  special_sale: 'Special Sale',
};

const POSITIVE_TYPES = ['purchase', 'return_to_store', 'initial_stock', 'break_container'];

interface LedgerRow extends InventoryMovement {
  change_liters: number;
  balance_after: number;
  is_positive: boolean;
  action_label: string;
  reference: string;
}

interface RecentRow extends InventoryMovement {
  parts: { part_name: string; is_liquid: boolean; container_size: number | null } | null;
}

// ── Searchable Part LOV ──────────────────────────────────────────────────────
interface PartLOVProps {
  parts: Part[];
  selectedPartId: string;
  onSelect: (id: string) => void;
}

const PartLOV: React.FC<PartLOVProps> = ({ parts, selectedPartId, onSelect }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = parts.find(p => p.part_id === selectedPartId);

  const filtered = parts.filter(p => {
    const q = search.toLowerCase();
    return p.part_name.toLowerCase().includes(q) || (p.part_code ?? '').toLowerCase().includes(q);
  });

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
          {selected ? selected.part_name : 'Select a part…'}
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
                placeholder="Search by name or code…"
                className="w-full px-3 py-2 rounded-lg border border-theme bg-theme-surface-2 text-sm text-theme placeholder-theme-muted focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="overflow-y-auto flex-1">
              {filtered.length === 0 ? (
                <div className="text-center py-8 text-sm text-theme-muted">No parts found</div>
              ) : (
                filtered.map(p => (
                  <button
                    key={p.part_id}
                    type="button"
                    onClick={() => { onSelect(p.part_id); setOpen(false); }}
                    className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-theme-surface-2 transition-colors border-b border-theme/40 last:border-b-0 ${
                      p.part_id === selectedPartId ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-theme truncate">{p.part_name}</div>
                      <div className="text-xs text-theme-muted">{p.part_code ?? '—'}</div>
                    </div>
                    <span className={`ml-3 flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                      p.is_liquid ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {p.is_liquid ? 'L' : 'pcs'}
                    </span>
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

// ── Recent Activity Table ────────────────────────────────────────────────────
interface RecentActivityProps {
  rows: RecentRow[];
  loading: boolean;
}

const RecentActivity: React.FC<RecentActivityProps> = ({ rows, loading }) => {
  if (loading) {
    return (
      <div className="space-y-2 mt-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 bg-theme-surface-2 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }
  if (rows.length === 0) {
    return <div className="text-center py-12 text-sm text-theme-muted">No movements recorded yet</div>;
  }
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold text-theme-muted uppercase tracking-wide mb-2">Recent Activity</h3>
      <div className="overflow-x-auto rounded-xl border border-theme">
        <table className="w-full text-sm min-w-[520px]">
          <thead>
            <tr className="bg-theme-surface-2 border-b border-theme">
              <th className="text-left px-4 py-3 text-xs font-semibold text-theme-muted uppercase tracking-wide">Date</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-theme-muted uppercase tracking-wide">Part</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-theme-muted uppercase tracking-wide">Action</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-theme-muted uppercase tracking-wide">Change</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-theme-muted uppercase tracking-wide">By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-theme">
            {rows.map(row => {
              const isLiquid = row.parts?.is_liquid ?? true;
              const containerSize = row.parts?.container_size ?? 1;
              const cQty = row.container_qty_change ?? 0;
              const bQty = row.bulk_qty_change ?? 0;
              const change = isLiquid ? (cQty * containerSize + bQty) : cQty;
              const isPos = POSITIVE_TYPES.includes(row.movement_type) || change >= 0;
              const unit = isLiquid ? 'L' : 'pcs';
              return (
                <tr key={row.movement_id} className="hover:bg-theme-surface-2/50 transition-colors">
                  <td className="px-4 py-3 text-theme-muted whitespace-nowrap text-xs">
                    {new Date(row.performed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    <span className="block text-theme-muted/60">
                      {new Date(row.performed_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-theme text-sm font-medium">{row.parts?.part_name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      isPos ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {ACTION_LABELS[row.movement_type] ?? row.movement_type}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-right font-mono font-semibold text-sm ${isPos ? 'text-green-600' : 'text-red-500'}`}>
                    {isPos && change >= 0 ? '+' : ''}{Number(change).toFixed(2)} {unit}
                  </td>
                  <td className="px-4 py-3 text-theme-muted text-sm">{row.performed_by_name ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ── Main Component ───────────────────────────────────────────────────────────
const InventoryLedgerTab: React.FC = () => {
  const [allParts, setAllParts] = useState<Part[]>([]);
  const [selectedPartId, setSelectedPartId] = useState<string>('');
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [partsLoading, setPartsLoading] = useState(true);
  const [recentRows, setRecentRows] = useState<RecentRow[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setPartsLoading(true);
      const { data } = await supabase
        .from('parts')
        .select('part_id, part_name, part_code, is_liquid, container_size, base_unit')
        .order('part_name');
      if (data) setAllParts(data as Part[]);
      setPartsLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    const load = async () => {
      setRecentLoading(true);
      const { data } = await supabase
        .from('inventory_movements')
        .select('*, parts(part_name, is_liquid, container_size)')
        .order('performed_at', { ascending: false })
        .limit(10);
      if (data) setRecentRows(data as RecentRow[]);
      setRecentLoading(false);
    };
    load();
  }, []);

  const loadLedger = useCallback(async (partId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('inventory_movements')
      .select('*')
      .eq('part_id', partId)
      .order('performed_at', { ascending: true });

    if (error || !data) { setRows([]); setLoading(false); return; }

    const part = allParts.find(p => p.part_id === partId);
    const containerSize = part?.container_size ?? 1;
    const isLiquid = part?.is_liquid ?? true;

    let balance = 0;
    const computed: LedgerRow[] = (data as InventoryMovement[]).map(m => {
      const cQty = m.container_qty_change ?? 0;
      const bQty = m.bulk_qty_change ?? 0;
      const liters = isLiquid ? (cQty * containerSize + bQty) : cQty;
      const isPos = POSITIVE_TYPES.includes(m.movement_type) || liters >= 0;

      let balanceAfter: number;
      if (isLiquid && m.store_bulk_qty_after != null) {
        const cAfter = m.store_container_qty_after ?? 0;
        balanceAfter = cAfter * containerSize + Number(m.store_bulk_qty_after);
      } else {
        balance += liters;
        balanceAfter = balance;
      }
      balance = balanceAfter;

      let reference = m.notes ?? '';
      if (m.job_id) reference = 'Job #' + m.job_id.slice(0, 8);
      else if (m.van_stock_id) reference = 'Van #' + m.van_stock_id.slice(0, 8);

      return {
        ...m,
        change_liters: liters,
        balance_after: balanceAfter,
        is_positive: isPos,
        action_label: ACTION_LABELS[m.movement_type] ?? m.movement_type,
        reference,
      };
    });

    setRows([...computed].reverse());
    setLoading(false);
  }, [allParts]);

  useEffect(() => {
    if (selectedPartId) loadLedger(selectedPartId);
    else setRows([]);
  }, [selectedPartId, loadLedger]);

  const selectedPart = allParts.find(p => p.part_id === selectedPartId);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 max-w-sm">
          <label className="block text-xs font-medium text-theme-muted mb-1">Select Item</label>
          {partsLoading ? (
            <div className="h-10 bg-theme-surface-2 rounded-lg animate-pulse" />
          ) : (
            <PartLOV
              parts={allParts}
              selectedPartId={selectedPartId}
              onSelect={setSelectedPartId}
            />
          )}
        </div>
        {selectedPart && (
          <div className="flex items-center gap-3">
            <div className="text-xs text-theme-muted">
              Container size: <span className="font-medium">{selectedPart.container_size ?? '?'} {selectedPart.base_unit ?? 'L'}</span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedPartId('')}
              className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1"
            >
              ← Back to Recent Activity
            </button>
          </div>
        )}
      </div>

      {!selectedPartId ? (
        <RecentActivity rows={recentRows} loading={recentLoading} />
      ) : loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-sm text-theme-muted">Loading ledger…</div>
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-theme-muted text-sm">No movements recorded for this item</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-theme">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="bg-theme-surface-2 border-b border-theme">
                <th className="text-left px-4 py-3 text-xs font-semibold text-theme-muted uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-theme-muted uppercase tracking-wide">Action</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-theme-muted uppercase tracking-wide">Reference</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-theme-muted uppercase tracking-wide">Change</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-theme-muted uppercase tracking-wide">Balance After</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-theme-muted uppercase tracking-wide">Performed By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme">
              {rows.map(row => (
                <tr key={row.movement_id} className="hover:bg-theme-surface-2/50 transition-colors">
                  <td className="px-4 py-3 text-theme-muted whitespace-nowrap">
                    {new Date(row.performed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    <span className="block text-xs text-theme-muted/60">
                      {new Date(row.performed_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      row.is_positive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {row.action_label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-theme-muted text-xs max-w-[180px] truncate">
                    {row.reference || '—'}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono font-semibold ${
                    row.is_positive ? 'text-green-600' : 'text-red-500'
                  }`}>
                    {row.is_positive && row.change_liters >= 0 ? '+' : ''}{Number(row.change_liters).toFixed(2)} {selectedPart?.is_liquid ? 'L' : 'pcs'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-theme">
                    {Number(row.balance_after).toFixed(2)} {selectedPart?.is_liquid ? 'L' : 'pcs'}
                  </td>
                  <td className="px-4 py-3 text-theme-muted text-sm">
                    {row.performed_by_name ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default InventoryLedgerTab;
