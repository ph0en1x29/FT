/**
 * Detail modal for viewing a van stock's items
 */
import {
AlertTriangle,
ArrowDownToLine,
ArrowRightLeft,
ArrowUpFromLine,
CheckCircle,
Edit2,
History,
MoreVertical,
Package,
Plus,
Trash2,
TrendingDown,
X,
} from 'lucide-react';
import { useEffect,useState } from 'react';
import { transferToVan, returnToStore } from '../../../../services/liquidInventoryService';
import { showToast } from '../../../../services/toastService';
import { VanStock,VanStockItem } from '../../../../types';
import { getLowStockItems,getStockStatusColor } from '../../hooks/useVanStockData';
import { VanHistoryTab } from '../VanHistoryTab';
import { TransferPartModal } from './TransferPartModal';

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
  /** Invoked after a successful store↔van transfer so the parent can re-fetch the van stock. */
  onRefresh?: () => void;
  currentUserId?: string;
  currentUserName?: string;
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
  onRefresh,
  currentUserId,
  currentUserName,
}: VanStockDetailModalProps) {
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'stock' | 'history'>('stock');
  // Admin 2 transfer-modal state. `mode` is null when closed; `item` is null
  // for the footer "Transfer from Store" path (no pre-selection).
  const [transferState, setTransferState] = useState<{ mode: 'in' | 'out'; item: VanStockItem | null } | null>(null);

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
      <div className="bg-[var(--surface)] rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
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
                    className="absolute right-0 top-full mt-1 w-48 bg-[var(--surface)] rounded-lg shadow-lg border py-1 z-[60]"
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

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 px-4">
          <button
            onClick={() => setActiveTab('stock')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === 'stock'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Package className="w-4 h-4" /> Stock Items
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === 'history'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <History className="w-4 h-4" /> History
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'history' && vanStock && (
            <VanHistoryTab vanStockId={vanStock.van_stock_id} />
          )}

          {activeTab === 'stock' && <>
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
                  <th className="p-3 text-center text-xs font-semibold text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme">
                {(vanStock.items || []).map((item) => (
                  <tr key={item.item_id} className="clickable-row">
                    <td className="p-3">
                      <div className="font-medium">{item.part?.part_name || 'Unknown'}</div>
                      <div className="text-xs text-slate-500">{item.part?.part_code}</div>
                    </td>
                    <td className="p-3 text-center font-semibold">
                      {item.part?.is_liquid ? (
                        <div>
                          {(((item.container_quantity || 0) * (item.part?.container_size || 1)) + (item.bulk_quantity || 0)).toFixed(1)} {item.part?.base_unit || 'L'}
                        </div>
                      ) : item.quantity}
                    </td>
                    <td className="p-3 text-center text-slate-500">{item.min_quantity}</td>
                    <td className="p-3 text-center text-slate-500">{item.max_quantity}</td>
                    <td className="p-3 text-center">
                      <StockStatusBadge item={item} />
                    </td>
                    <td className="p-3 text-center">
                      {isAdmin && (
                        <div className="flex gap-1 justify-center">
                          {item.part?.is_liquid ? (
                            <>
                              {/* Liquid parts keep their sealed-container semantics — handled by the
                                  existing liquidInventoryService. Prompt() UX preserved from the
                                  2026-02 liquid rollout; revisit alongside a unified bulk/container picker. */}
                              <button
                                type="button"
                                onClick={async () => {
                                  const qty = prompt('How many sealed containers to transfer FROM store TO van?');
                                  if (!qty || isNaN(Number(qty)) || Number(qty) <= 0) return;
                                  try {
                                    await transferToVan(item.part_id, item.item_id, vanStock.van_stock_id, Number(qty), currentUserId || '', currentUserName);
                                    showToast.success('Transfer complete', `${qty} container(s) moved to van`);
                                    onRefresh?.();
                                  } catch (err) {
                                    showToast.error('Transfer failed', (err as Error).message);
                                  }
                                }}
                                className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                                title="Transfer sealed containers from store to van"
                                aria-label="Transfer from store"
                              >
                                <ArrowDownToLine className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  const qty = prompt('How many sealed containers to return FROM van TO store?');
                                  if (!qty || isNaN(Number(qty)) || Number(qty) <= 0) return;
                                  try {
                                    await returnToStore(item.part_id, item.item_id, vanStock.van_stock_id, Number(qty), currentUserId || '', currentUserName);
                                    showToast.success('Return complete', `${qty} container(s) returned to store`);
                                    onRefresh?.();
                                  } catch (err) {
                                    showToast.error('Return failed', (err as Error).message);
                                  }
                                }}
                                className="p-1.5 bg-amber-50 text-amber-600 rounded hover:bg-amber-100"
                                title="Return sealed containers from van to store"
                                aria-label="Return to store"
                              >
                                <ArrowUpFromLine className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              {/* Non-liquid (count-based) parts use the new atomic RPC via TransferPartModal.
                                  The same modal handles both directions — mode is 'in' or 'out'. */}
                              <button
                                type="button"
                                onClick={() => setTransferState({ mode: 'in', item })}
                                className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                                title="Transfer more of this part from central store to van"
                                aria-label="Transfer from store"
                              >
                                <ArrowDownToLine className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setTransferState({ mode: 'out', item })}
                                disabled={(item.quantity ?? 0) <= 0}
                                className="p-1.5 bg-amber-50 text-amber-600 rounded hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed"
                                title={(item.quantity ?? 0) <= 0 ? 'Nothing to return' : 'Return this part from van to central store'}
                                aria-label="Return to store"
                              >
                                <ArrowUpFromLine className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      )}
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
          </>}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t flex flex-wrap gap-2 justify-between">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={onAddItem}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              title="Register a part on this van (no central stock change)"
            >
              <Plus className="w-4 h-4" /> Add Item
            </button>
            {isAdmin && (
              <button
                onClick={() => setTransferState({ mode: 'in', item: null })}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                title="Transfer a part from central store to this van — decrements central stock"
              >
                <ArrowDownToLine className="w-4 h-4" /> Transfer from Store
              </button>
            )}
          </div>
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

      {/* Store ↔ Van transfer modal — used for both directions on non-liquid parts
          and for the footer "Transfer from Store" flow (new SKU onto a van). */}
      {transferState && (
        <TransferPartModal
          isOpen={true}
          mode={transferState.mode}
          vanStock={vanStock}
          vanStockItem={transferState.item}
          currentUserId={currentUserId || ''}
          currentUserName={currentUserName || ''}
          onClose={() => setTransferState(null)}
          onSuccess={() => {
            setTransferState(null);
            onRefresh?.();
          }}
        />
      )}
    </div>
  );
}

/**
 * Stock status badge component
 */
function StockStatusBadge({ item }: { item: VanStockItem }) {
  const colorClass = getStockStatusColor(item);

  const effectiveQty = item.part?.is_liquid
    ? ((item.container_quantity || 0) * (item.part?.container_size || 1)) + (item.bulk_quantity || 0)
    : (item.quantity || 0);
  if (effectiveQty === 0) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
        <TrendingDown className="w-3 h-3" /> Out
      </span>
    );
  }

  if (effectiveQty <= item.min_quantity) {
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
