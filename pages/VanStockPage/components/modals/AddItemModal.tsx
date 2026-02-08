/**
 * Modal for adding an item to van stock
 */
import { X } from 'lucide-react';
import { Part } from '../../../../types';

interface AddItemModalProps {
  isOpen: boolean;
  availableParts: Part[];
  selectedPartId: string;
  itemQuantity: number;
  itemMinQty: number;
  itemMaxQty: number;
  submitting: boolean;
  onClose: () => void;
  onPartChange: (id: string) => void;
  onQuantityChange: (qty: number) => void;
  onMinQtyChange: (qty: number) => void;
  onMaxQtyChange: (qty: number) => void;
  onSubmit: () => void;
}

export function AddItemModal({
  isOpen,
  availableParts,
  selectedPartId,
  itemQuantity,
  itemMinQty,
  itemMaxQty,
  submitting,
  onClose,
  onPartChange,
  onQuantityChange,
  onMinQtyChange,
  onMaxQtyChange,
  onSubmit,
}: AddItemModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-lg">Add Item to Van Stock</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Select Part
            </label>
            {availableParts.length === 0 ? (
              <p className="text-sm text-slate-500 p-3 bg-slate-50 rounded-lg">
                No parts available to add.
              </p>
            ) : (
              <select
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedPartId}
                onChange={(e) => onPartChange(e.target.value)}
              >
                <option value="">-- Select a part --</option>
                {availableParts.map((part) => (
                  <option key={part.part_id} value={part.part_id}>
                    {part.part_name} ({part.part_code})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Quantity
              </label>
              <input
                type="number"
                min="0"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={itemQuantity}
                onChange={(e) => onQuantityChange(parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Min Qty
              </label>
              <input
                type="number"
                min="0"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={itemMinQty}
                onChange={(e) => onMinQtyChange(parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Max Qty
              </label>
              <input
                type="number"
                min="1"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={itemMaxQty}
                onChange={(e) => onMaxQtyChange(parseInt(e.target.value) || 1)}
              />
            </div>
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
            onClick={onSubmit}
            disabled={!selectedPartId || submitting}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Adding...' : 'Add Item'}
          </button>
        </div>
      </div>
    </div>
  );
}
