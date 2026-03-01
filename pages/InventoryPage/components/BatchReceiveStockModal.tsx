import { Loader2, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { receiveLiquidStock } from '../../../services/liquidInventoryService';
import { supabase } from '../../../services/supabaseClient';
import { showToast } from '../../../services/toastService';
import { Part } from '../../../types';

interface BatchReceiveStockModalProps {
  show: boolean;
  parts: Part[];
  currentUser: { user_id: string; name: string };
  onClose: () => void;
  onSuccess: () => void;
}

interface RowState {
  qtyReceived: string;
  unitCost: string;
}

const todayStr = () => new Date().toISOString().split('T')[0];

const BatchReceiveStockModal: React.FC<BatchReceiveStockModalProps> = ({
  show,
  parts,
  currentUser,
  onClose,
  onSuccess,
}) => {
  const [poReference, setPoReference] = useState('');
  const [receiveDate, setReceiveDate] = useState(todayStr());
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (show) {
      setPoReference('');
      setReceiveDate(todayStr());
      const initial: Record<string, RowState> = {};
      parts.forEach(p => { initial[p.part_id] = { qtyReceived: '', unitCost: '' }; });
      setRows(initial);
    }
  }, [show, parts]);

  if (!show) return null;

  const updateRow = (partId: string, field: keyof RowState, value: string) => {
    setRows(prev => ({ ...prev, [partId]: { ...prev[partId], [field]: value } }));
  };

  const getUnit = (part: Part) => part.is_liquid ? 'L' : (part.base_unit || 'pcs');

  const getCurrentStock = (part: Part) =>
    part.is_liquid ? (part.bulk_quantity ?? 0) : (part.stock_quantity ?? 0);

  const filledRows = parts.filter(p => {
    const r = rows[p.part_id];
    return r && parseFloat(r.qtyReceived) > 0;
  });

  const totalCost = filledRows.reduce((sum, p) => {
    const r = rows[p.part_id];
    const qty = parseFloat(r.qtyReceived) || 0;
    const cost = parseFloat(r.unitCost) || 0;
    return sum + qty * cost;
  }, 0);

  const handleSubmit = async () => {
    if (filledRows.length === 0) {
      showToast.error('Enter quantity for at least one item.');
      return;
    }

    setSubmitting(true);
    try {
      for (const part of filledRows) {
        const r = rows[part.part_id];
        const qty = parseFloat(r.qtyReceived);
        const unitCost = parseFloat(r.unitCost) || 0;
        const totalLineCost = qty * unitCost;

        if (part.is_liquid) {
          await receiveLiquidStock({
            partId: part.part_id,
            containerQty: 0,
            containerSize: 0,
            totalLiters: qty,
            totalPrice: totalLineCost,
            costPerLiter: unitCost,
            poReference: poReference || undefined,
            performedBy: currentUser.user_id,
            performedByName: currentUser.name,
          });
        } else {
          const { error: movErr } = await supabase.from('inventory_movements').insert({
            part_id: part.part_id,
            movement_type: 'purchase',
            container_qty_change: 0,
            bulk_qty_change: qty,
            performed_by: currentUser.user_id,
            performed_by_name: currentUser.name,
            reference_number: poReference || null,
            unit_cost_at_time: unitCost || null,
            total_cost: totalLineCost || null,
            notes: `Batch receive on ${receiveDate}`,
          });
          if (movErr) throw movErr;

          const newQty = (part.stock_quantity ?? 0) + qty;
          const updatePayload: Record<string, unknown> = { stock_quantity: newQty };
          if (unitCost > 0) updatePayload.cost_price = unitCost;

          const { error: upErr } = await supabase
            .from('parts')
            .update(updatePayload)
            .eq('part_id', part.part_id);
          if (upErr) throw upErr;
        }
      }

      showToast.success(`Received stock for ${filledRows.length} item(s) (Total: RM ${totalCost.toFixed(2)})`);
      onSuccess();
      onClose();
    } catch (e: unknown) {
      showToast.error(e instanceof Error ? e.message : 'Failed to receive stock.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-2">
      <div className="w-full max-w-5xl bg-[var(--surface)] rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
          <div>
            <h2 className="font-semibold text-[var(--text)]">Batch Receive Stock</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Enter quantities for all items received</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-[var(--bg-subtle)] rounded-lg transition-colors">
            <X className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-[var(--border)] flex flex-wrap gap-4 shrink-0">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">PO Reference</label>
            <input
              type="text"
              value={poReference}
              onChange={e => setPoReference(e.target.value)}
              placeholder="e.g. PO-2024-001"
              className="input-premium text-sm w-full"
            />
          </div>
          <div className="w-40">
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Date</label>
            <input
              type="date"
              value={receiveDate}
              onChange={e => setReceiveDate(e.target.value)}
              className="input-premium text-sm w-full"
            />
          </div>
        </div>

        <div className="overflow-auto flex-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--bg-subtle)] text-left">
                <th className="px-4 py-2.5 text-xs font-medium text-[var(--text-muted)] whitespace-nowrap">Part Name</th>
                <th className="px-4 py-2.5 text-xs font-medium text-[var(--text-muted)] whitespace-nowrap">Current Stock</th>
                <th className="px-4 py-2.5 text-xs font-medium text-[var(--text-muted)] whitespace-nowrap">Qty Received</th>
                <th className="px-4 py-2.5 text-xs font-medium text-[var(--text-muted)] whitespace-nowrap">Unit</th>
                <th className="px-4 py-2.5 text-xs font-medium text-[var(--text-muted)] whitespace-nowrap">Unit Cost (RM)</th>
                <th className="px-4 py-2.5 text-xs font-medium text-[var(--text-muted)] whitespace-nowrap">Total Cost (RM)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {parts.map(part => {
                const r = rows[part.part_id] ?? { qtyReceived: '', unitCost: '' };
                const qty = parseFloat(r.qtyReceived) || 0;
                const cost = parseFloat(r.unitCost) || 0;
                const lineCost = qty * cost;
                const unit = getUnit(part);
                const currentStock = getCurrentStock(part);

                return (
                  <tr key={part.part_id} className={qty > 0 ? 'bg-green-50/30' : ''}>
                    <td className="px-4 py-2">
                      <div className="font-medium text-[var(--text)]">{part.part_name}</div>
                      <div className="text-xs text-[var(--text-muted)]">{part.part_code}</div>
                    </td>
                    <td className="px-4 py-2 text-[var(--text-muted)] whitespace-nowrap">
                      {currentStock.toFixed(part.is_liquid ? 2 : 0)} {unit}
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        inputMode={part.is_liquid ? 'decimal' : 'numeric'}
                        min="0"
                        step={part.is_liquid ? '0.01' : '1'}
                        value={r.qtyReceived}
                        onChange={e => updateRow(part.part_id, 'qtyReceived', e.target.value)}
                        placeholder="0"
                        className="input-premium text-sm w-24"
                      />
                    </td>
                    <td className="px-4 py-2 text-[var(--text-muted)]">{unit}</td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        value={r.unitCost}
                        onChange={e => updateRow(part.part_id, 'unitCost', e.target.value)}
                        placeholder="0.00"
                        className="input-premium text-sm w-28"
                      />
                    </td>
                    <td className="px-4 py-2 text-[var(--text)] font-medium whitespace-nowrap">
                      {lineCost > 0 ? `RM ${lineCost.toFixed(2)}` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-4 border-t border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="text-sm text-[var(--text-muted)]">
            <span className="font-semibold text-[var(--text)]">{filledRows.length}</span> item(s) to receive
            {totalCost > 0 && (
              <> — Total: <span className="font-semibold text-[var(--text)]">RM {totalCost.toFixed(2)}</span></>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-premium btn-premium-secondary" disabled={submitting}>
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || filledRows.length === 0}
              className="btn-premium btn-premium-primary disabled:opacity-50"
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />Submitting...
                </span>
              ) : (
                `Receive ${filledRows.length} Item(s)`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BatchReceiveStockModal;
