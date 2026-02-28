import { AlertTriangle, Loader2, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { receiveLiquidStock } from '../../../services/liquidInventoryService';
import { Part } from '../../../types';

interface ReceiveStockModalProps {
  show: boolean;
  part: Part | null;
  currentUser: { user_id: string; name: string };
  onClose: () => void;
  onSuccess: () => void;
}

const ReceiveStockModal: React.FC<ReceiveStockModalProps> = ({
  show,
  part,
  currentUser,
  onClose,
  onSuccess,
}) => {
  const [containerQty, setContainerQty] = useState('1');
  const [containerSize, setContainerSize] = useState('');
  const [totalPrice, setTotalPrice] = useState('');
  const [poRef, setPoRef] = useState('');
  const [notes, setNotes] = useState('');
  const [batchLabel, setBatchLabel] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (show && part) {
      setContainerQty('1');
      setContainerSize(part.container_size ? String(part.container_size) : '');
      setTotalPrice('');
      setPoRef('');
      setNotes('');
      setBatchLabel('');
      setExpiresAt('');
      setError('');
    }
  }, [show, part]);

  if (!show || !part) return null;

  const cQty = parseFloat(containerQty) || 0;
  const cSize = parseFloat(containerSize) || 0;
  const totalLiters = cQty * cSize;
  const totalPriceNum = parseFloat(totalPrice) || 0;
  const costPerLiter = totalLiters > 0 ? totalPriceNum / totalLiters : 0;

  // Cost variance alert
  const avgCost = part.avg_cost_per_liter;
  let costVarianceBanner: React.ReactNode = null;
  if (costPerLiter > 0 && avgCost && avgCost > 0) {
    const diff = ((costPerLiter - avgCost) / avgCost) * 100;
    if (Math.abs(diff) > 10) {
      const direction = diff > 0 ? 'higher' : 'lower';
      const absDiff = Math.abs(diff).toFixed(1);
      costVarianceBanner = (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <span>
            <strong>Price alert:</strong> Cost per liter is{' '}
            <strong>RM {costPerLiter.toFixed(2)}</strong> — that&apos;s{' '}
            <strong>{absDiff}% {direction}</strong> than the average (RM {avgCost.toFixed(2)}).
            Verify with supplier before confirming.
          </span>
        </div>
      );
    }
  }

  const handleSubmit = async () => {
    if (!containerQty || !containerSize || !totalPrice) {
      setError('Container quantity, container size, and total price are required.');
      return;
    }
    if (totalLiters <= 0) {
      setError('Total liters must be greater than zero.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await receiveLiquidStock({
        partId: part.part_id,
        containerQty: cQty,
        containerSize: cSize,
        totalLiters,
        totalPrice: totalPriceNum,
        costPerLiter,
        poReference: poRef || undefined,
        notes: notes || undefined,
        batchLabel: batchLabel || undefined,
        expiresAt: expiresAt || undefined,
        performedBy: currentUser.user_id,
        performedByName: currentUser.name,
      });
      onSuccess();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to receive stock.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md bg-[var(--surface)] rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div>
            <h2 className="font-semibold text-[var(--text)]">Receive Stock</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{part.part_name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-[var(--bg-subtle)] rounded-lg transition-colors">
            <X className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                Containers Received
              </label>
              <input
                type="number"
                inputMode="decimal"
                min="1"
                step="1"
                value={containerQty}
                onChange={(e) => setContainerQty(e.target.value)}
                placeholder="e.g. 2"
                className="input-premium text-sm w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                Container Size (L)
              </label>
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={containerSize}
                onChange={(e) => setContainerSize(e.target.value)}
                placeholder="e.g. 209"
                className="input-premium text-sm w-full"
              />
            </div>
          </div>

          <div className="bg-[var(--bg-subtle)] rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-[var(--text-muted)]">Total Liters</span>
            <span className="font-semibold text-[var(--text)]">
              {totalLiters > 0 ? totalLiters.toFixed(2) + ' L' : '—'}
            </span>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
              Total Purchase Price (RM)
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-xs">RM</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={totalPrice}
                onChange={(e) => setTotalPrice(e.target.value)}
                placeholder="e.g. 3500.00"
                className="input-premium pl-8 text-sm w-full"
              />
            </div>
          </div>

          <div className="bg-[var(--bg-subtle)] rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-[var(--text-muted)]">Cost per Liter</span>
            <span className="font-semibold text-[var(--text)]">
              {costPerLiter > 0 ? 'RM ' + costPerLiter.toFixed(4) : '—'}
            </span>
          </div>

          {/* Cost variance warning — between cost display and submit */}
          {costVarianceBanner}

          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
              PO Reference <span className="font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={poRef}
              onChange={(e) => setPoRef(e.target.value)}
              placeholder="e.g. PO-2024-001"
              className="input-premium text-sm w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                Batch Label <span className="font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={batchLabel}
                onChange={(e) => setBatchLabel(e.target.value)}
                placeholder="e.g. Batch 2026-02"
                className="input-premium text-sm w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                Expiry Date <span className="font-normal">(optional)</span>
              </label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="input-premium text-sm w-full"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
              Notes <span className="font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              rows={2}
              className="input-premium text-sm w-full resize-none"
            />
          </div>
        </div>

        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose} className="btn-premium btn-premium-secondary flex-1" disabled={submitting}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !containerQty || !containerSize || !totalPrice}
            className="btn-premium btn-premium-primary flex-1 disabled:opacity-50"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />Saving...
              </span>
            ) : (
              'Receive Stock'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReceiveStockModal;
