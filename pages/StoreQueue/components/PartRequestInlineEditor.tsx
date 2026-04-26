import { Check, X, XCircle } from 'lucide-react';
import { Combobox, type ComboboxOption } from '../../../components/Combobox';
import type { InlinePartRow, QueueItem } from '../types';
import { StoreQueueSpinner } from './StoreQueueSpinner';

interface PartRequestInlineEditorProps {
  item: QueueItem;
  rows: InlinePartRow[];
  partOptions: ComboboxOption[];
  isSearching: boolean;
  isProcessing: boolean;
  onSearch: (query: string) => void;
  onUpdateInline: (requestId: string, index: number, updates: Partial<InlinePartRow>) => void;
  onAddInlineRow: (requestId: string) => void;
  onRemoveInlineRow: (requestId: string, index: number) => void;
  onApprove: (item: QueueItem) => void;
  onReject: (item: QueueItem) => void;
}

export function PartRequestInlineEditor({
  item,
  rows,
  partOptions,
  isSearching,
  isProcessing,
  onSearch,
  onUpdateInline,
  onAddInlineRow,
  onRemoveInlineRow,
  onApprove,
  onReject,
}: PartRequestInlineEditorProps) {
  if (!item.requestId) return null;

  const requestId = item.requestId;
  const hasAnyPart = rows.some(row => row.partId);

  return (
    <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] overflow-visible space-y-2">
      {rows.map((row, idx) => (
        <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex-1 w-full sm:w-auto relative z-20">
            <Combobox
              options={partOptions}
              value={row.partId || ''}
              onChange={(val) => onUpdateInline(requestId, idx, { partId: val })}
              placeholder="Select part..."
              onSearch={onSearch}
              isSearching={isSearching}
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="number" min="0.1" step="any"
              inputMode="numeric"
              value={row.quantity || '1'}
              onChange={e => onUpdateInline(requestId, idx, { quantity: e.target.value })}
              className="w-16 px-2 py-1.5 h-10 sm:h-auto text-sm border border-[var(--border)] rounded-lg text-center bg-[var(--surface)]"
            />
            {rows.length > 1 && (
              <button
                onClick={() => onRemoveInlineRow(requestId, idx)}
                className="p-2 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                title="Remove row"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      ))}
      <div className="flex items-center gap-2 mt-1">
        <button
          onClick={() => onAddInlineRow(requestId)}
          className="text-xs text-[var(--accent)] hover:underline"
        >
          + Add part
        </button>
        <div className="flex-1" />
        <button
          onClick={() => onApprove(item)}
          disabled={isProcessing || !hasAnyPart}
          className="inline-flex items-center justify-center gap-1 px-3 py-1.5 h-10 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
        >
          {isProcessing ? <StoreQueueSpinner /> : <Check className="w-3.5 h-3.5" />}
          Approve
        </button>
        <button
          onClick={() => onReject(item)}
          disabled={isProcessing}
          className="p-2.5 h-10 min-w-[44px] text-red-500 hover:bg-red-50 rounded-lg transition flex items-center justify-center"
        >
          <XCircle className="w-5 h-5 sm:w-4 sm:h-4" />
        </button>
      </div>
    </div>
  );
}
