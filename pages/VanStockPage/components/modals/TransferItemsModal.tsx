/**
 * Modal for transferring items between van stocks
 */
import { ArrowRightLeft,X } from 'lucide-react';
import { VanStock } from '../../../../types';

interface TransferItemsModalProps {
  isOpen: boolean;
  sourceVanStock: VanStock | null;
  transferTargets: VanStock[];
  transferTargetId: string;
  selectedItemsForTransfer: Set<string>;
  submitting: boolean;
  onClose: () => void;
  onTargetChange: (id: string) => void;
  onToggleItem: (itemId: string) => void;
  onConfirm: () => void;
}

export function TransferItemsModal({
  isOpen,
  sourceVanStock,
  transferTargets,
  transferTargetId,
  selectedItemsForTransfer,
  submitting,
  onClose,
  onTargetChange,
  onToggleItem,
  onConfirm,
}: TransferItemsModalProps) {
  if (!isOpen || !sourceVanStock) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--surface)] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-lg">Transfer Items</h2>
            <p className="text-sm text-slate-500">
              From {sourceVanStock.technician_name}'s van
              {sourceVanStock.van_code && ` (${sourceVanStock.van_code})`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Transfer To <span className="text-red-500">*</span>
            </label>
            {transferTargets.length === 0 ? (
              <p className="text-sm text-slate-500 p-3 bg-slate-50 rounded-lg">
                No other active van stocks available for transfer.
              </p>
            ) : (
              <select
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={transferTargetId}
                onChange={(e) => onTargetChange(e.target.value)}
              >
                <option value="">-- Select destination --</option>
                {transferTargets.map((vs) => (
                  <option key={vs.van_stock_id} value={vs.van_stock_id}>
                    {vs.technician_name} {vs.van_code && `(${vs.van_code})`}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Select Items to Transfer
            </label>
            {(sourceVanStock.items || []).length === 0 ? (
              <p className="text-sm text-slate-500 p-3 bg-slate-50 rounded-lg">
                No items in this van stock.
              </p>
            ) : (
              <div className="border rounded-lg divide-y max-h-64 overflow-y-auto">
                {(sourceVanStock.items || []).map((item) => (
                  <label
                    key={item.item_id}
                    className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedItemsForTransfer.has(item.item_id)}
                      onChange={() => onToggleItem(item.item_id)}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{item.part?.part_name}</div>
                      <div className="text-xs text-slate-500">{item.part?.part_code}</div>
                    </div>
                    <div className="text-sm text-slate-600">
                      Qty: {item.quantity}
                    </div>
                  </label>
                ))}
              </div>
            )}
            {selectedItemsForTransfer.size > 0 && (
              <p className="text-sm text-blue-600 mt-2">
                {selectedItemsForTransfer.size} item(s) selected
              </p>
            )}
          </div>
        </div>
        <div className="p-4 border-t flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!transferTargetId || selectedItemsForTransfer.size === 0 || submitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <ArrowRightLeft className="w-4 h-4" />
            {submitting ? 'Transferring...' : 'Transfer Items'}
          </button>
        </div>
      </div>
    </div>
  );
}
