import {
AlertTriangle,
CheckSquare,
Minus,
Package,
Plus,
Send,
Square,
X,
} from 'lucide-react';
import { useMemo,useState } from 'react';
import {
VanStock,
VanStockItem,
} from '../types';

interface ReplenishmentRequestModalProps {
  vanStock: VanStock;
  lowStockItems: VanStockItem[];
  onClose: () => void;
  onSubmit: (
    items: { vanStockItemId: string; partId: string; partName: string; partCode: string; quantityRequested: number }[],
    notes?: string
  ) => Promise<void>;
}

interface SelectedItem {
  item: VanStockItem;
  quantityRequested: number;
}

export default function ReplenishmentRequestModal({
  vanStock,
  lowStockItems,
  onClose,
  onSubmit,
}: ReplenishmentRequestModalProps) {
  const [selectedItems, setSelectedItems] = useState<Map<string, SelectedItem>>(() => {
    const initial = new Map<string, SelectedItem>();
    // Pre-select low stock items with calculated quantity
    lowStockItems.forEach(item => {
      initial.set(item.item_id, {
        item,
        quantityRequested: item.max_quantity - item.quantity,
      });
    });
    return initial;
  });
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // All items for selection
  const allItems = vanStock.items || [];

  // Toggle item selection
  const toggleItem = (item: VanStockItem) => {
    const newSelected = new Map(selectedItems);
    if (newSelected.has(item.item_id)) {
      newSelected.delete(item.item_id);
    } else {
      newSelected.set(item.item_id, {
        item,
        quantityRequested: Math.max(1, item.max_quantity - item.quantity),
      });
    }
    setSelectedItems(newSelected);
  };

  // Update quantity for selected item
  const updateQuantity = (itemId: string, quantity: number) => {
    const selected = selectedItems.get(itemId);
    if (!selected) return;

    const maxNeeded = selected.item.max_quantity - selected.item.quantity;
    const newQuantity = Math.min(Math.max(1, quantity), maxNeeded);

    const newSelected = new Map(selectedItems);
    newSelected.set(itemId, {
      ...selected,
      quantityRequested: newQuantity,
    });
    setSelectedItems(newSelected);
  };

  // Calculate total items to request
  const totalItemsToRequest = useMemo(() => {
    let count = 0;
    selectedItems.forEach(selected => {
      count += selected.quantityRequested;
    });
    return count;
  }, [selectedItems]);

  // Handle submit
  const handleSubmit = async () => {
    if (selectedItems.size === 0) return;

    setSubmitting(true);
    try {
      const selectedArray: SelectedItem[] = Array.from(selectedItems.values());
      const items = selectedArray.map(selected => ({
        vanStockItemId: selected.item.item_id,
        partId: selected.item.part_id,
        partName: selected.item.part?.part_name || '',
        partCode: selected.item.part?.part_code || '',
        quantityRequested: selected.quantityRequested,
      }));

      await onSubmit(items, notes || undefined);
    } finally {
      setSubmitting(false);
    }
  };

  // Select all low stock items
  const selectAllLowStock = () => {
    const newSelected = new Map<string, SelectedItem>();
    lowStockItems.forEach(item => {
      newSelected.set(item.item_id, {
        item,
        quantityRequested: item.max_quantity - item.quantity,
      });
    });
    setSelectedItems(newSelected);
  };

  // Clear all selections
  const clearSelection = () => {
    setSelectedItems(new Map());
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--surface)] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-lg">Request Replenishment</h2>
            <p className="text-sm text-slate-500">Select items to replenish your Van Stock</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Quick Actions */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={selectAllLowStock}
              className="flex items-center gap-2 px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              <CheckSquare className="w-4 h-4" />
              Select All Low Stock ({lowStockItems.length})
            </button>
            <button
              onClick={clearSelection}
              className="flex items-center gap-2 px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              <Square className="w-4 h-4" />
              Clear Selection
            </button>
          </div>

          {/* Items List */}
          <div className="space-y-2">
            {allItems.map((item) => {
              const isSelected = selectedItems.has(item.item_id);
              const selected = selectedItems.get(item.item_id);
              const isLowStock = item.quantity <= item.min_quantity;
              const maxNeeded = item.max_quantity - item.quantity;

              return (
                <div
                  key={item.item_id}
                  className={`border rounded-lg p-3 transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : isLowStock
                      ? 'border-amber-200 bg-amber-50'
                      : 'border-slate-200 bg-[var(--surface)]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleItem(item)}
                      className={`w-5 h-5 rounded border flex items-center justify-center ${
                        isSelected
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-slate-300'
                      }`}
                    >
                      {isSelected && (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>

                    {/* Item Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {item.part?.part_name || 'Unknown'}
                        </span>
                        {isLowStock && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded">
                            <AlertTriangle className="w-3 h-3" />
                            Low
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">
                        {item.part?.part_code} • Current: {item.quantity} / Max: {item.max_quantity}
                      </div>
                    </div>

                    {/* Quantity Control */}
                    {isSelected && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.item_id, (selected?.quantityRequested || 1) - 1)}
                          disabled={(selected?.quantityRequested || 0) <= 1}
                          className="w-7 h-7 rounded-full border border-slate-300 flex items-center justify-center hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={maxNeeded}
                          value={selected?.quantityRequested || 0}
                          onChange={(e) => updateQuantity(item.item_id, parseInt(e.target.value) || 1)}
                          className="w-14 text-center border border-slate-300 rounded-lg py-1 text-sm"
                        />
                        <button
                          onClick={() => updateQuantity(item.item_id, (selected?.quantityRequested || 1) + 1)}
                          disabled={(selected?.quantityRequested || 0) >= maxNeeded}
                          className="w-7 h-7 rounded-full border border-slate-300 flex items-center justify-center hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Notes */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special requests or notes for this replenishment..."
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-slate-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-600">
              <Package className="w-4 h-4 inline mr-1" />
              {selectedItems.size} item(s) selected • {totalItemsToRequest} units total
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-[var(--surface)] text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={selectedItems.size === 0 || submitting}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                <Send className="w-4 h-4" />
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
