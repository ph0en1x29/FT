/**
 * InventoryLedgerTab - Warehouse liquid inventory ledger
 * Shows running balance per fluid item with movement history
 */
import React, { useCallback, useEffect, useState } from 'react';
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
};

const POSITIVE_TYPES = ['purchase', 'return_to_store', 'initial_stock', 'break_container'];

interface LedgerRow extends InventoryMovement {
  change_liters: number;
  balance_after: number;
  is_positive: boolean;
  action_label: string;
  reference: string;
}

const InventoryLedgerTab: React.FC = () => {
  const [liquidParts, setLiquidParts] = useState<Part[]>([]);
  const [selectedPartId, setSelectedPartId] = useState<string>('');
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [partsLoading, setPartsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setPartsLoading(true);
      const { data } = await supabase
        .from('parts')
        .select('part_id, part_name, part_code, is_liquid, container_size, base_unit')
        .eq('is_liquid', true)
        .order('part_name');
      if (data) setLiquidParts(data as Part[]);
      setPartsLoading(false);
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

    const part = liquidParts.find(p => p.part_id === partId);
    const containerSize = part?.container_size ?? 1;

    let balance = 0;
    const computed: LedgerRow[] = (data as InventoryMovement[]).map(m => {
      const cQty = m.container_qty_change ?? 0;
      const bQty = m.bulk_qty_change ?? 0;
      const liters = cQty * containerSize + bQty;
      const isPos = POSITIVE_TYPES.includes(m.movement_type) || liters >= 0;

      let balanceAfter: number;
      if (m.store_bulk_qty_after != null) {
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
  }, [liquidParts]);

  useEffect(() => {
    if (selectedPartId) loadLedger(selectedPartId);
    else setRows([]);
  }, [selectedPartId, loadLedger]);

  const selectedPart = liquidParts.find(p => p.part_id === selectedPartId);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 max-w-sm">
          <label className="block text-xs font-medium text-theme-muted mb-1">Select Fluid Item</label>
          {partsLoading ? (
            <div className="h-10 bg-theme-surface-2 rounded-lg animate-pulse" />
          ) : (
            <select
              value={selectedPartId}
              onChange={e => setSelectedPartId(e.target.value)}
              className="w-full px-3 py-2 border border-theme rounded-lg bg-theme-surface text-theme text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Choose a fluid item —</option>
              {liquidParts.map(p => (
                <option key={p.part_id} value={p.part_id}>{p.part_name} ({p.part_code})</option>
              ))}
            </select>
          )}
        </div>
        {selectedPart && (
          <div className="text-xs text-theme-muted">
            Container size: <span className="font-medium">{selectedPart.container_size ?? '?'} {selectedPart.base_unit ?? 'L'}</span>
          </div>
        )}
      </div>

      {!selectedPartId ? (
        <div className="text-center py-16 text-theme-muted text-sm">Select a fluid item to view its ledger</div>
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
                <th className="text-right px-4 py-3 text-xs font-semibold text-theme-muted uppercase tracking-wide">Change (L)</th>
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
                    {row.is_positive && row.change_liters >= 0 ? '+' : ''}{Number(row.change_liters).toFixed(2)} L
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-theme">
                    {Number(row.balance_after).toFixed(2)} L
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
