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

interface PurchaseGroup {
  key: string;
  reference: string;
  date: string;
  invoicePath?: string;
  items: Array<{
    movement_id: string;
    part_code: string;
    part_name: string;
    qty: number;
    unit: string;
    unit_cost: number;
    total_cost: number;
    is_liquid: boolean;
  }>;
  totalCost: number;
  itemCount: number;
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
  const [view, setView] = useState<'recent' | 'purchases' | 'ledger'>('recent');
  const [allParts, setAllParts] = useState<Part[]>([]);
  const [selectedPartId, setSelectedPartId] = useState<string>('');
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [partsLoading, setPartsLoading] = useState(true);
  const [recentRows, setRecentRows] = useState<RecentRow[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [purchaseGroups, setPurchaseGroups] = useState<PurchaseGroup[]>([]);
  const [purchasesLoading, setPurchasesLoading] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [purchaseSearch, setPurchaseSearch] = useState('');

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

  useEffect(() => {
    if (view !== 'purchases') return;
    const load = async () => {
      setPurchasesLoading(true);
      const { data } = await supabase
        .from('inventory_movements')
        .select('*, parts(part_name, part_code, is_liquid, container_size)')
        .in('movement_type', ['purchase', 'initial_stock'])
        .order('performed_at', { ascending: false })
        .limit(200);

      if (data) {
        const grouped = new Map<string, PurchaseGroup>();
        
        for (const mov of data) {
          const date = new Date(mov.performed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
          const ref = mov.reference_number || 'No Reference';
          const key = `${ref}_${date}`;
          
          const isLiquid = mov.parts?.is_liquid ?? true;
          const containerSize = mov.parts?.container_size ?? 1;
          const cQty = mov.container_qty_change ?? 0;
          const bQty = mov.bulk_qty_change ?? 0;
          const qty = isLiquid ? (cQty * containerSize + bQty) : cQty;
          const unit = isLiquid ? 'L' : 'pcs';
          
          const item = {
            movement_id: mov.movement_id,
            part_code: mov.parts?.part_code ?? '—',
            part_name: mov.parts?.part_name ?? '—',
            qty,
            unit,
            unit_cost: mov.unit_cost ?? 0,
            total_cost: mov.total_cost ?? 0,
            is_liquid: isLiquid,
          };
          
          if (!grouped.has(key)) {
            let invoicePath: string | undefined;
            if (mov.reference_number && mov.reference_number.startsWith('receipt:')) {
              invoicePath = mov.reference_number.replace('receipt:', '');
            }
            
            grouped.set(key, {
              key,
              reference: ref,
              date,
              invoicePath,
              items: [item],
              totalCost: mov.total_cost ?? 0,
              itemCount: 1,
            });
          } else {
            const group = grouped.get(key)!;
            group.items.push(item);
            group.totalCost += mov.total_cost ?? 0;
            group.itemCount += 1;
          }
        }
        
        const groups = Array.from(grouped.values());
        setPurchaseGroups(groups);
        
        // Expand first group by default
        if (groups.length > 0) {
          setExpandedGroups(new Set([groups[0].key]));
        }
      }
      setPurchasesLoading(false);
    };
    load();
  }, [view]);

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

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const getInvoiceUrl = async (path: string) => {
    const { data, error } = await supabase.storage
      .from('invoices')
      .createSignedUrl(path, 3600);
    if (error) {
      console.error('Error getting signed URL:', error);
      return null;
    }
    return data.signedUrl;
  };

  return (
    <div className="space-y-4">
      {/* View Toggle */}
      <div className="inline-flex rounded-lg border border-theme bg-theme-surface-2 p-0.5">
        {(['recent', 'purchases', 'ledger'] as const).map(v => (
          <button
            key={v}
            onClick={() => {
              setView(v);
              if (v !== 'ledger') setSelectedPartId('');
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              view === v
                ? 'bg-white dark:bg-slate-700 text-theme shadow-sm'
                : 'text-theme-muted hover:text-theme'
            }`}
          >
            {v === 'recent' ? 'Recent Activity' : v === 'purchases' ? 'Purchase History' : 'Item Ledger'}
          </button>
        ))}
      </div>

      {/* Recent Activity View */}
      {view === 'recent' && (
        <RecentActivity rows={recentRows} loading={recentLoading} />
      )}

      {/* Purchase History View */}
      {view === 'purchases' && (
        <div className="mt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <h3 className="text-sm font-semibold text-theme-muted uppercase tracking-wide">Purchase History</h3>
            <input
              type="text"
              value={purchaseSearch}
              onChange={e => setPurchaseSearch(e.target.value)}
              placeholder="Search by PO, part name, or code..."
              className="w-full sm:w-64 px-3 py-2 text-sm rounded-lg border border-theme bg-theme-surface focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-theme-muted"
            />
          </div>
          {purchasesLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-theme-surface-2 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : purchaseGroups.length === 0 ? (
            <div className="text-center py-12 text-sm text-theme-muted">No purchase history recorded yet</div>
          ) : (
            <div className="space-y-3">
              {purchaseGroups.filter(group => {
                if (!purchaseSearch) return true;
                const q = purchaseSearch.toLowerCase();
                return group.reference.toLowerCase().includes(q) ||
                  group.items.some(i => i.part_name.toLowerCase().includes(q) || i.part_code.toLowerCase().includes(q));
              }).map(group => {
                const isExpanded = expandedGroups.has(group.key);
                return (
                  <div key={group.key} className="border border-theme rounded-lg overflow-hidden bg-theme-surface">
                    {/* Card Header */}
                    <button
                      onClick={() => toggleGroup(group.key)}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-theme-surface-2 transition-colors"
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-theme">{group.reference}</span>
                            {group.invoicePath && (
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const url = await getInvoiceUrl(group.invoicePath!);
                                  if (url) window.open(url, '_blank');
                                }}
                                className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1"
                              >
                                📎 View Invoice
                              </button>
                            )}
                          </div>
                          <div className="text-xs text-theme-muted mt-0.5">{group.date}</div>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <div className="text-theme-muted">
                            <span className="font-medium text-theme">{group.itemCount}</span> items
                          </div>
                          <div className="text-theme-muted">
                            Total: <span className="font-semibold text-theme">RM {group.totalCost.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                      <svg
                        className={`w-5 h-5 text-theme-muted flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Expanded Table */}
                    {isExpanded && (
                      <div className="border-t border-theme">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-theme-surface-2 border-b border-theme">
                                <th className="text-left px-4 py-2 text-xs font-semibold text-theme-muted uppercase tracking-wide">Part Code</th>
                                <th className="text-left px-4 py-2 text-xs font-semibold text-theme-muted uppercase tracking-wide">Part Name</th>
                                <th className="text-right px-4 py-2 text-xs font-semibold text-theme-muted uppercase tracking-wide">Qty Received</th>
                                <th className="text-center px-4 py-2 text-xs font-semibold text-theme-muted uppercase tracking-wide">Unit</th>
                                <th className="text-right px-4 py-2 text-xs font-semibold text-theme-muted uppercase tracking-wide">Unit Cost</th>
                                <th className="text-right px-4 py-2 text-xs font-semibold text-theme-muted uppercase tracking-wide">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-theme">
                              {group.items.map(item => (
                                <tr key={item.movement_id} className="hover:bg-theme-surface-2/50 transition-colors">
                                  <td className="px-4 py-2 text-theme-muted font-mono text-xs">{item.part_code}</td>
                                  <td className="px-4 py-2 text-theme">{item.part_name}</td>
                                  <td className="px-4 py-2 text-right font-mono text-theme">{item.qty.toFixed(2)}</td>
                                  <td className="px-4 py-2 text-center">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                                      item.is_liquid
                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                                    }`}>
                                      {item.unit}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 text-right font-mono text-theme-muted">RM {item.unit_cost.toFixed(2)}</td>
                                  <td className="px-4 py-2 text-right font-mono font-semibold text-theme">RM {item.total_cost.toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Item Ledger View */}
      {view === 'ledger' && (
        <>
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
              </div>
            )}
          </div>

          {!selectedPartId ? (
            <div className="text-center py-12 text-sm text-theme-muted">Select a part to view its ledger</div>
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
        </>
      )}
    </div>
  );
};

export default InventoryLedgerTab;
