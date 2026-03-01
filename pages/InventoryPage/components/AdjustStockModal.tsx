import { Loader2, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { supabase } from '../../../services/supabaseClient';
import { showToast } from '../../../services/toastService';
import { Part } from '../../../types';

const REASON_CODES = ['Damage', 'Theft', 'Spillage', 'Counting Error', 'Expired', 'Other'] as const;
type ReasonCode = typeof REASON_CODES[number];

interface AdjustStockModalProps {
  show: boolean;
  parts: Part[];
  currentUser: { user_id: string; name: string };
  onClose: () => void;
  onSuccess: () => void;
}

const AdjustStockModal: React.FC<AdjustStockModalProps> = ({
  show,
  parts,
  currentUser,
  onClose,
  onSuccess,
}) => {
  const [selectedPartId, setSelectedPartId] = useState('');
  const [adjustType, setAdjustType] = useState<'+' | '-'>('+');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState<ReasonCode | ''>('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (show) {
      setSelectedPartId('');
      setAdjustType('+');
      setQuantity('');
      setReason('');
      setNotes('');
      setError('');
    }
  }, [show]);

  if (!show) return null;

  const allParts = parts;
  const selectedPart = allParts.find(p => p.part_id === selectedPartId);

  const handleSubmit = async () => {
    if (!selectedPartId) { setError('Please select a part.'); return; }
    if (!quantity || parseFloat(quantity) <= 0) { setError('Please enter a valid quantity.'); return; }
    if (!reason) { setError('Please select a reason code.'); return; }
    if (reason === 'Other' && !notes.trim()) { setError('Notes are required when reason is "Other".'); return; }

    setSubmitting(true);
    setError('');

    const qtyNum = parseFloat(quantity);
    const signedQty = adjustType === '+' ? qtyNum : -qtyNum;

    try {
      const { error: insertError } = await supabase
        .from('inventory_movements')
        .insert({
          part_id: selectedPartId,
          movement_type: 'adjustment',
          bulk_qty_change: signedQty,
          container_qty_change: 0,
          performed_by: currentUser.user_id,
          performed_by_name: currentUser.name,
          adjustment_reason: reason,
          notes: notes || null,
          requires_approval: true,
          is_pending: true,
        });

      if (insertError) throw insertError;

      showToast.success('Adjustment submitted for approval');
      onSuccess();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to submit adjustment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md bg-[var(--surface)] rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div>
            <h2 className="font-semibold text-[var(--text)]">Stock Adjustment</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Requires admin approval</p>
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

          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Part</label>
            <select
              value={selectedPartId}
              onChange={e => setSelectedPartId(e.target.value)}
              className="input-premium text-sm w-full"
            >
              <option value="">Select a part...</option>
              {allParts.map(p => (
                <option key={p.part_id} value={p.part_id}>{p.part_name}</option>
              ))}
            </select>
            {selectedPart && (
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Current stock: {selectedPart.is_liquid ? ((selectedPart.bulk_quantity ?? 0).toFixed(2) + ' L') : ((selectedPart.stock_quantity ?? 0) + ' ' + (selectedPart.base_unit || 'pcs'))}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Adjustment</label>
            <div className="flex gap-2">
              <div className="flex rounded-lg border border-[var(--border)] overflow-hidden shrink-0">
                <button
                  type="button"
                  onClick={() => setAdjustType('+')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${adjustType === '+' ? 'bg-green-500 text-white' : 'text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]'}`}
                >
                  + Add
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustType('-')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${adjustType === '-' ? 'bg-red-500 text-white' : 'text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]'}`}
                >
                  − Remove
                </button>
              </div>
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                placeholder={selectedPart?.is_liquid ? "Liters" : (selectedPart?.base_unit || "pcs")}
                className="input-premium text-sm flex-1"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Reason Code</label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value as ReasonCode | '')}
              className="input-premium text-sm w-full"
            >
              <option value="">Select reason...</option>
              {REASON_CODES.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">
              Notes {reason === 'Other' ? <span className="text-red-500">*</span> : <span className="font-normal">(optional)</span>}
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={reason === 'Other' ? 'Please describe the reason...' : 'Additional details...'}
              rows={3}
              className="input-premium text-sm w-full resize-none"
            />
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
            This adjustment will be submitted for admin approval. Stock levels will only change after approval.
          </div>
        </div>

        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose} className="btn-premium btn-premium-secondary flex-1" disabled={submitting}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="btn-premium btn-premium-primary flex-1 disabled:opacity-50"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />Submitting...
              </span>
            ) : (
              'Submit for Approval'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdjustStockModal;
