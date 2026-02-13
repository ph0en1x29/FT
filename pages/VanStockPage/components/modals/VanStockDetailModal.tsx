/**
 * Detail modal for viewing a van stock's items
 */
import {
AlertTriangle,
ArrowRightLeft,
CheckCircle,
Edit2,
MoreVertical,
Plus,
Trash2,
TrendingDown,
X,
} from 'lucide-react';
import { useEffect,useState } from 'react';
import { VanStock,VanStockItem } from '../../../../types';
import { getLowStockItems,getStockStatusColor } from '../../hooks/useVanStockData';

interface VanStockDetailModalProps {
  isOpen: boolean;
  vanStock: VanStock | null;
  isAdmin: boolean;
  onClose: () => void;
  onAddItem: () => void;
  onEdit: () => void;
  onTransfer: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
  onScheduleAudit: (vanStock: VanStock) => void;
}

export function VanStockDetailModal({
  isOpen,
  vanStock,
  isAdmin,
  onClose,
  onAddItem,
  onEdit,
  onTransfer,
  onDeactivate,
  onDelete,
  onScheduleAudit,
}: VanStockDetailModalProps) {
  const [actionMenuOpen, setActionMenuOpen] = useState(false);

  // Close action menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (actionMenuOpen) {
        setActionMenuOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [actionMenuOpen]);

  if (!isOpen || !vanStock) return null;

  const lowItems = getLowStockItems(vanStock.items);
  const vanIdentifier = vanStock.van_plate || vanStock.van_code || 'No Plate';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-semibold">
                {vanStock.technician_name?.charAt(0) || 'T'}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-lg">{vanIdentifier}</h2>
                {!vanStock.is_active && (
                  <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded">
                    Inactive
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm text-slate-600">{vanStock.technician_name}</span>
                {vanStock.van_code && vanStock.van_plate && (
                  <span className="text-sm font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                    {vanStock.van_code}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500">
                {vanStock.notes || 'Van Stock Details'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActionMenuOpen(!actionMenuOpen);
                  }}
                  className="p-2 hover:bg-slate-100 rounded-lg"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
                {actionMenuOpen && (
                  <div
                    className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border py-1 z-[60]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActionMenuOpen(false);
                        onEdit();
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                    >
                      <Edit2 className="w-4 h-4" /> Edit Van Details
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActionMenuOpen(false);
                        onTransfer();
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2"
                    >
                      <ArrowRightLeft className="w-4 h-4" /> Transfer Items
                    </button>
                    <hr className="my-1" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActionMenuOpen(false);
                        onDeactivate();
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center gap-2 text-amber-600"
                    >
                      <Trash2 className="w-4 h-4" /> Deactivate
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActionMenuOpen(false);
                        onDelete();
                      }}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 flex items-center gap-2 text-red-600"
                    >
                      <Trash2 className="w-4 h-4" /> Delete Permanently
                    </button>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-3 bg-slate-50 rounded-lg">
              <div className="text-2xl font-bold text-slate-900">
                {vanStock.items?.length || 0}
              </div>
              <div className="text-xs text-slate-600">Total Items</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                RM {(vanStock.total_value || 0).toLocaleString()}
              </div>
              <div className="text-xs text-green-700">Total Value</div>
            </div>
            <div className="text-center p-3 bg-amber-50 rounded-lg">
              <div className="text-2xl font-bold text-amber-600">
                {lowItems.length}
              </div>
              <div className="text-xs text-amber-700">Low Stock</div>
            </div>
          </div>

          {/* Items Table */}
          <h3 className="font-semibold mb-3">Stock Items</h3>
          <div className="border border-theme rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-theme-surface-2">
                <tr>
                  <th className="text-left p-3 text-theme-muted">Part</th>
                  <th className="text-center p-3 text-theme-muted">Qty</th>
                  <th className="text-center p-3 text-theme-muted">Min</th>
                  <th className="text-center p-3 text-theme-muted">Max</th>
                  <th className="text-center p-3 text-theme-muted">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme">
                {(vanStock.items || []).map((item) => (
                  <tr key={item.item_id} className="clickable-row">
                    <td className="p-3">
                      <div className="font-medium">{item.part?.part_name || 'Unknown'}</div>
                      <div className="text-xs text-slate-500">{item.part?.part_code}</div>
                    </td>
                    <td className="p-3 text-center font-semibold">{item.quantity}</td>
                    <td className="p-3 text-center text-slate-500">{item.min_quantity}</td>
                    <td className="p-3 text-center text-slate-500">{item.max_quantity}</td>
                    <td className="p-3 text-center">
                      <StockStatusBadge item={item} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Audit Info */}
          <div className="mt-6 p-4 bg-slate-50 rounded-lg">
            <h4 className="font-medium mb-2">Audit Information</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-500">Last Audit:</span>{' '}
                <span className="font-medium">
                  {vanStock.last_audit_at
                    ? new Date(vanStock.last_audit_at).toLocaleDateString()
                    : 'Never'}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Next Audit Due:</span>{' '}
                <span className="font-medium">
                  {vanStock.next_audit_due
                    ? new Date(vanStock.next_audit_due).toLocaleDateString()
                    : 'Not scheduled'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t flex justify-between">
          <button
            onClick={onAddItem}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Plus className="w-4 h-4" /> Add Item
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Close
            </button>
            <button
              onClick={() => onScheduleAudit(vanStock)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Schedule Audit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Stock status badge component
 */
function StockStatusBadge({ item }: { item: VanStockItem }) {
  const colorClass = getStockStatusColor(item);

  if (item.quantity === 0) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
        <TrendingDown className="w-3 h-3" /> Out
      </span>
    );
  }

  if (item.quantity <= item.min_quantity) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
        <AlertTriangle className="w-3 h-3" /> Low
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
      <CheckCircle className="w-3 h-3" /> OK
    </span>
  );
}
