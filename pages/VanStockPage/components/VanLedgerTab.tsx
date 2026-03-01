/**
 * VanLedgerTab - Van inventory ledger (liquid and solid parts)
 * Shows running balance per van/part with warning on negative balance
 */
import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '../../../services/supabaseClient';
import type { InventoryMovement } from '../../../types/inventory.types';
import type { User } from '../../../types';

interface VanInfo {
  van_stock_id: string;
  van_code?: string;
  van_plate?: string;
  technician_name?: string;
  technician?: { name: string } | null;
}

interface PartInfo {
  part_id: string;
  part_name: string;
  part_code: string;
  container_size?: number;
  base_unit?: string;
  is_liquid?: boolean;
}

interface LedgerRow extends InventoryMovement {
  change_liters: number;
  balance_after: number;
  is_positive: boolean;
  action_label: string;
  reference: string;
  is_liquid: boolean;
}

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

const VAN_POSITIVE_TYPES = ['transfer_to_van', 'return_to_store'];

interface VanLedgerTabProps {
  currentUser: User;
}

const VanLedgerTab: React.FC<VanLedgerTabProps> = () => {
  const [vans, setVans] = useState<VanInfo[]>([]);
  const [selectedVanId, setSelectedVanId] = useState('');
  const [vanParts, setVanParts] = useState<PartInfo[]>([]);
  const [selectedPartId, setSelectedPartId] = useState('');
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [vansLoading, setVansLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setVansLoading(true);
      const { data } = await supabase
        .from('van_stocks')
        .select('van_stock_id, van_code, van_plate, technician:users!technician_id(name)')
        .eq('is_active', true)
        .order('van_code');
      if (data) setVans((data as any[]).map(v => ({ ...v, technician_name: v.technician?.name })) as VanInfo[]);
      setVansLoading(false);
    };
    load();
  }, []);

  // Load all parts for selected van (liquid and solid)
  useEffect(() => {
    if (!selectedVanId) { setVanParts([]); setSelectedPartId(''); return; }
    const load = async () => {
      const { data: movs } = await supabase
        .from('inventory_movements')
        .select('part_id')
        .eq('van_stock_id', selectedVanId);
      
      if (!movs || movs.length === 0) { setVanParts([]); return; }
      
      const partIds = [...new Set(movs.map((m: { part_id: string }) => m.part_id))];
      const { data: parts } = await supabase
        .from('parts')
        .select('part_id, part_name, part_code, container_size, base_unit, is_liquid')
        .in('part_id', partIds);
      
      if (parts) setVanParts(parts as PartInfo[]);
      setSelectedPartId('');
    };
    load();
  }, [selectedVanId]);

  const loadLedger = useCallback(async (vanId: string, partId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('inventory_movements')
      .select('*')
      .eq('van_stock_id', vanId)
      .eq('part_id', partId)
      .order('performed_at', { ascending: true });

    if (error || !data) { setRows([]); setLoading(false); return; }

    const part = vanParts.find(p => p.part_id === partId);
    const containerSize = part?.container_size ?? 1;
    const isLiquid = part?.is_liquid ?? false;

    let balance = 0;
    const computed: LedgerRow[] = (data as InventoryMovement[]).map(m => {
      const cQty = m.container_qty_change ?? 0;
      const bQty = m.bulk_qty_change ?? 0;
      // For liquid: change = cQty * containerSize + bQty (liters)
      // For solid: change = cQty (pcs)
      const change = isLiquid ? cQty * containerSize + bQty : cQty;
      
      const isPos = VAN_POSITIVE_TYPES.includes(m.movement_type) || change > 0;

      let balanceAfter: number;
      if (isLiquid && m.van_bulk_qty_after != null) {
        const cAfter = m.van_container_qty_after ?? 0;
        balanceAfter = cAfter * containerSize + Number(m.van_bulk_qty_after);
      } else if (!isLiquid && m.van_container_qty_after != null) {
        balanceAfter = m.van_container_qty_after;
      } else {
        balance += change;
        balanceAfter = balance;
      }
      balance = balanceAfter;

      let reference = m.notes ?? '';
      if (m.job_id) reference = 'Job #' + m.job_id.slice(0, 8);

      return {
        ...m,
        change_liters: change,
        balance_after: balanceAfter,
        is_positive: isPos,
        action_label: ACTION_LABELS[m.movement_type] ?? m.movement_type,
        reference,
        is_liquid: isLiquid,
      };
    });

    setRows([...computed].reverse());
    setLoading(false);
  }, [vanParts]);

  useEffect(() => {
    if (selectedVanId && selectedPartId) loadLedger(selectedVanId, selectedPartId);
    else setRows([]);
  }, [selectedVanId, selectedPartId, loadLedger]);

  const selectedVan = vans.find(v => v.van_stock_id === selectedVanId);
  const selectedPart = vanParts.find(p => p.part_id === selectedPartId);
  const selectedIsLiquid = selectedPart?.is_liquid ?? false;
  const unit = selectedIsLiquid ? 'L' : 'pcs';

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 max-w-sm">
          <label className="block text-xs font-medium text-theme-muted mb-1">Select Van</label>
          {vansLoading ? (
            <div className="h-10 bg-theme-surface-2 rounded-lg animate-pulse" />
          ) : (
            <select
              value={selectedVanId}
              onChange={e => setSelectedVanId(e.target.value)}
              className="w-full px-3 py-2 border border-theme rounded-lg bg-theme-surface text-theme text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Choose a van —</option>
              {vans.map(v => (
                <option key={v.van_stock_id} value={v.van_stock_id}>
                  {v.van_code ?? v.van_plate ?? v.van_stock_id.slice(0, 8)}
                  {v.technician_name ? ` — ${v.technician_name}` : ''}
                  {v.van_plate ? ` (${v.van_plate})` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {selectedVanId && (
          <div className="flex-1 max-w-sm">
            <label className="block text-xs font-medium text-theme-muted mb-1">Select Part</label>
            {vanParts.length === 0 ? (
              <div className="px-3 py-2 text-xs text-theme-muted border border-theme rounded-lg bg-theme-surface">
                No parts found for this van
              </div>
            ) : (
              <select
                value={selectedPartId}
                onChange={e => setSelectedPartId(e.target.value)}
                className="w-full px-3 py-2 border border-theme rounded-lg bg-theme-surface text-theme text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Choose a part —</option>
                {vanParts.map(p => (
                  <option key={p.part_id} value={p.part_id}>{p.part_name} ({p.part_code})</option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {selectedVan && (
        <div className="text-xs text-theme-muted">
          Viewing: <span className="font-medium">{selectedVan.van_code} {selectedVan.van_plate ? `(${selectedVan.van_plate})` : ''}</span>
          {selectedVan.technician_name && <> · <span className="font-medium">{selectedVan.technician_name}</span></>}
        </div>
      )}

      {!selectedVanId || !selectedPartId ? (
        <div className="text-center py-16 text-theme-muted text-sm">
          Select a van and part to view its ledger
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-sm text-theme-muted">Loading ledger…</div>
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-theme-muted text-sm">No movements recorded for this van/part</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-theme">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="bg-theme-surface-2 border-b border-theme">
                <th className="text-left px-4 py-3 text-xs font-semibold text-theme-muted uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-theme-muted uppercase tracking-wide">Action</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-theme-muted uppercase tracking-wide">Reference</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-theme-muted uppercase tracking-wide">Change ({unit})</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-theme-muted uppercase tracking-wide">Balance After</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-theme-muted uppercase tracking-wide">Performed By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme">
              {rows.map(row => {
                const isNegBal = row.balance_after < 0;
                return (
                  <tr key={row.movement_id} className={`transition-colors ${isNegBal ? 'bg-amber-50/60' : 'hover:bg-theme-surface-2/50'}`}>
                    <td className="px-4 py-3 text-theme-muted whitespace-nowrap">
                      {new Date(row.performed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      <span className="block text-xs text-theme-muted/60">
                        {new Date(row.performed_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
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
                      {row.is_positive && row.change_liters >= 0 ? '+' : ''}
                      {row.is_liquid ? Number(row.change_liters).toFixed(2) : Math.round(row.change_liters)} {unit}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-semibold ${isNegBal ? 'text-amber-600' : 'text-theme'}`}>
                      {isNegBal && <AlertTriangle className="w-3 h-3 inline mr-1 text-amber-500" />}
                      {row.is_liquid ? Number(row.balance_after).toFixed(2) : Math.round(row.balance_after)} {unit}
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
