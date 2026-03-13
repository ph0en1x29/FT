import { Box, RotateCcw, X } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import type { JobPartUsed } from '../../../types';

export interface ReconciliationEntry {
  job_part_id: string;
  part_id: string;
  part_name: string;
  quantity_issued: number;
  quantity_used: number;
  quantity_returned: number;
}

interface PartsReconciliationModalProps {
  show: boolean;
  parts: JobPartUsed[];
  submitting: boolean;
  onConfirm: (entries: ReconciliationEntry[], notes?: string) => void;
  onClose: () => void;
}

export const PartsReconciliationModal: React.FC<PartsReconciliationModalProps> = ({
  show,
  parts,
  submitting,
  onConfirm,
  onClose,
}) => {
  const initialEntries = useMemo(() =>
    parts.map((p) => ({
      job_part_id: p.job_part_id,
      part_id: p.part_id,
      part_name: p.part_name,
      quantity_issued: p.quantity,
      quantity_used: p.quantity,
      quantity_returned: 0,
    })),
    [parts]
  );

  const [entries, setEntries] = useState<ReconciliationEntry[]>(initialEntries);
  const [notes, setNotes] = useState('');

  // Reset state when parts change (modal re-opens)
  const resetState = useCallback(() => {
    setEntries(
      parts.map((p) => ({
        job_part_id: p.job_part_id,
        part_id: p.part_id,
        part_name: p.part_name,
        quantity_issued: p.quantity,
        quantity_used: p.quantity,
        quantity_returned: 0,
      }))
    );
    setNotes('');
  }, [parts]);

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleUsedChange = (index: number, value: string) => {
    const numVal = parseInt(value, 10);
    if (isNaN(numVal) || numVal < 0) return;

    setEntries((prev) => {
      const updated = [...prev];
      const entry = { ...updated[index] };
      entry.quantity_used = Math.min(numVal, entry.quantity_issued);
      entry.quantity_returned = entry.quantity_issued - entry.quantity_used;
      updated[index] = entry;
      return updated;
    });
  };

  const handleSubmit = () => {
    onConfirm(entries, notes.trim() || undefined);
  };

  const totalReturned = entries.reduce((sum, e) => sum + e.quantity_returned, 0);
  const hasReturns = totalReturned > 0;

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-lg shadow-premium-elevated max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-bold text-lg text-[var(--text)] flex items-center gap-2">
            <Box className="w-5 h-5 text-[var(--accent)]" />
            Reconcile Parts
          </h4>
          <button onClick={handleClose} className="p-1 hover:bg-[var(--bg-subtle)] rounded-lg">
            <X className="w-5 h-5 text-[var(--text-muted)]" />
          </button>
        </div>

        {/* Parts List */}
        <div className="flex-1 overflow-y-auto space-y-3 mb-4">
          {entries.map((entry, idx) => (
            <div key={entry.job_part_id} className="bg-[var(--bg-subtle)] rounded-xl p-4">
              <div className="font-medium text-sm text-[var(--text)] mb-2">{entry.part_name}</div>
              <div className="grid grid-cols-3 gap-3">
                {/* Issued */}
                <div>
                  <label className="text-xs text-[var(--text-muted)] block mb-1">Issued</label>
                  <div className="text-sm font-semibold text-[var(--text)] bg-[var(--surface)] rounded-lg px-3 py-2 text-center">
                    {entry.quantity_issued}
                  </div>
                </div>
                {/* Qty Used */}
                <div>
                  <label className="text-xs text-[var(--text-muted)] block mb-1">Qty Used</label>
                  <input
                    type="number"
                    min={0}
                    max={entry.quantity_issued}
                    value={entry.quantity_used}
                    onChange={(e) => handleUsedChange(idx, e.target.value)}
                    className="w-full text-sm font-semibold text-[var(--text)] bg-[var(--surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-center focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>
                {/* Returned */}
                <div>
                  <label className="text-xs text-[var(--text-muted)] block mb-1">Returned</label>
                  <div
                    className={`text-sm font-semibold rounded-lg px-3 py-2 text-center ${
                      entry.quantity_returned > 0
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'text-[var(--text)] bg-[var(--surface)]'
                    }`}
                  >
                    {entry.quantity_returned}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Return summary */}
        {hasReturns && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4 text-sm text-amber-800">
            <RotateCcw className="w-4 h-4 shrink-0" />
            <span>{totalReturned} item{totalReturned !== 1 ? 's' : ''} will be returned to stock</span>
          </div>
        )}

        {/* Notes */}
        <div className="mb-4">
          <label className="text-xs text-[var(--text-muted)] block mb-1">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any notes about the reconciliation..."
            rows={2}
            className="w-full text-sm text-[var(--text)] bg-[var(--bg-subtle)] border border-[var(--border)] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleClose}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] bg-[var(--bg-subtle)] rounded-xl hover:bg-[var(--border)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-[var(--accent)] rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {submitting ? 'Confirming...' : 'Confirm & Restock'}
          </button>
        </div>
      </div>
    </div>
  );
};
