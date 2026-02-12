import { AlertTriangle, Check, CheckSquare, Package, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Combobox, ComboboxOption } from '../../../components/Combobox';
import { usePartsForList } from '../../../hooks/useQueryHooks';
import { JobRequest, Part } from '../../../types';

interface BulkApproveItem {
  request: JobRequest;
  partId: string;
  quantity: number;
  matched: boolean;
  notes: string;
  skip: boolean;
}

interface BulkApproveRequestsModalProps {
  show: boolean;
  requests: JobRequest[];
  submitting: boolean;
  onApproveAll: (items: { requestId: string; partId: string; quantity: number; notes?: string }[]) => void;
  onClose: () => void;
}

/**
 * Auto-match a request description to parts inventory using fuzzy keyword matching.
 */
function findBestPartMatch(description: string, parts: Part[]): Part | null {
  if (!description || parts.length === 0) return null;
  
  const descLower = description.toLowerCase();
  const descWords = descLower.split(/[\s,]+/).filter(w => w.length > 2);
  
  let bestMatch: Part | null = null;
  let bestScore = 0;

  for (const part of parts) {
    if (part.stock_quantity <= 0) continue; // Skip out-of-stock
    const partLower = part.part_name.toLowerCase();
    
    // Exact match
    if (partLower === descLower) return part;
    
    // Word overlap scoring
    let score = 0;
    for (const word of descWords) {
      if (partLower.includes(word)) score += word.length;
    }
    
    // Also check if description contains the part name
    if (descLower.includes(partLower)) score += partLower.length * 2;
    if (partLower.includes(descLower)) score += descLower.length * 2;
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = part;
    }
  }

  return bestScore >= 3 ? bestMatch : null;
}

export const BulkApproveRequestsModal: React.FC<BulkApproveRequestsModalProps> = ({
  show,
  requests,
  submitting,
  onApproveAll,
  onClose,
}) => {
  const { data: cachedParts = [] } = usePartsForList();
  const parts = cachedParts as unknown as Part[];

  const [items, setItems] = useState<BulkApproveItem[]>([]);

  const partOptions: ComboboxOption[] = useMemo(() => parts.map(p => ({
    id: p.part_id,
    label: p.part_name,
    subLabel: `RM${p.sell_price} | Stock: ${p.stock_quantity}`,
  })), [parts]);

  // Auto-match on open
  useEffect(() => {
    if (show && requests.length > 0 && parts.length > 0) {
      setItems(requests.map(req => {
        const match = findBestPartMatch(req.description, parts);
        return {
          request: req,
          partId: match?.part_id || '',
          quantity: 1,
          matched: !!match,
          notes: '',
          skip: false,
        };
      }));
    }
  }, [show, requests, parts]);

  const updateItem = useCallback((index: number, updates: Partial<BulkApproveItem>) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, ...updates } : item));
  }, []);

  const approveableCount = items.filter(i => !i.skip && i.partId).length;
  const unmatchedCount = items.filter(i => !i.skip && !i.partId).length;

  const handleApproveAll = () => {
    const toApprove = items
      .filter(i => !i.skip && i.partId)
      .map(i => ({
        requestId: i.request.request_id,
        partId: i.partId,
        quantity: i.quantity,
        notes: i.notes || undefined,
      }));
    onApproveAll(toApprove);
  };

  if (!show || requests.length === 0) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[var(--surface)] rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <CheckSquare className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-[var(--text)]">Bulk Approve Requests</h3>
              <p className="text-xs text-[var(--text-muted)]">{requests.length} pending requests</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--bg-subtle)] transition">
            <X className="w-5 h-5 text-[var(--text-muted)]" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto max-h-[60vh] space-y-4">
          {items.map((item, idx) => {
            const selectedPart = parts.find(p => p.part_id === item.partId);
            return (
              <div
                key={item.request.request_id}
                className={`rounded-xl border p-4 transition ${
                  item.skip
                    ? 'border-[var(--border)] opacity-50'
                    : item.partId
                      ? 'border-green-200 bg-green-50/50'
                      : 'border-amber-200 bg-amber-50/50'
                }`}
              >
                {/* Request info */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--text)]">{item.request.description}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      By {item.request.requested_by_user?.full_name || item.request.requested_by_user?.name || 'Unknown'}
                    </p>
                  </div>
                  <button
                    onClick={() => updateItem(idx, { skip: !item.skip })}
                    className={`text-xs px-2 py-1 rounded-lg transition ${
                      item.skip
                        ? 'bg-gray-100 text-gray-500'
                        : 'bg-red-50 text-red-500 hover:bg-red-100'
                    }`}
                  >
                    {item.skip ? 'Include' : 'Skip'}
                  </button>
                </div>

                {!item.skip && (
                  <div className="space-y-2">
                    {/* Part selector */}
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Combobox
                          options={partOptions}
                          value={item.partId}
                          onChange={(val) => updateItem(idx, { partId: val, matched: true })}
                          placeholder="Select part..."
                        />
                      </div>
                      <input
                        type="number"
                        min={1}
                        max={selectedPart?.stock_quantity || 999}
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                        className="w-16 px-2 py-1.5 text-sm border border-[var(--border)] rounded-lg text-center bg-[var(--surface)]"
                      />
                    </div>

                    {/* Match status */}
                    {item.partId ? (
                      <div className="flex items-center gap-1 text-xs text-green-600">
                        <Check className="w-3 h-3" />
                        {selectedPart?.part_name} — RM{selectedPart?.sell_price} (Stock: {selectedPart?.stock_quantity})
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-xs text-amber-600">
                        <AlertTriangle className="w-3 h-3" />
                        No auto-match found — select a part manually
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-[var(--border)] flex items-center justify-between">
          <div className="text-sm text-[var(--text-muted)]">
            {approveableCount} ready to approve
            {unmatchedCount > 0 && (
              <span className="text-amber-600 ml-2">· {unmatchedCount} need manual selection</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="btn-premium btn-premium-ghost text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleApproveAll}
              disabled={submitting || approveableCount === 0}
              className="btn-premium btn-premium-primary text-sm flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <Package className="w-4 h-4" />
                  Approve {approveableCount} Request{approveableCount !== 1 ? 's' : ''}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
