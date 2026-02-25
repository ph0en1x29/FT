/**
 * Inventory Movement History Modal
 * Shows audit trail for a specific part
 */
import { ArrowDownRight, ArrowUpRight, Clock, Package, Scissors, Truck, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { getMovementHistory } from '../../../services/liquidInventoryService';
import type { InventoryMovement } from '../../../types/inventory.types';

interface MovementHistoryModalProps {
  isOpen: boolean;
  partId: string;
  partName: string;
  onClose: () => void;
}

const MOVEMENT_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  purchase: { label: 'Purchase', color: 'text-green-600 bg-green-50', icon: ArrowDownRight },
  break_container: { label: 'Container Opened', color: 'text-amber-600 bg-amber-50', icon: Scissors },
  use_internal: { label: 'Internal Use', color: 'text-blue-600 bg-blue-50', icon: Package },
  sell_external: { label: 'External Sale', color: 'text-purple-600 bg-purple-50', icon: ArrowUpRight },
  transfer_to_van: { label: 'To Van', color: 'text-cyan-600 bg-cyan-50', icon: Truck },
  return_to_store: { label: 'From Van', color: 'text-teal-600 bg-teal-50', icon: ArrowDownRight },
  adjustment: { label: 'Adjustment', color: 'text-slate-600 bg-slate-50', icon: Clock },
  initial_stock: { label: 'Initial Stock', color: 'text-slate-600 bg-slate-50', icon: Package },
};

export function MovementHistoryModal({ isOpen, partId, partName, onClose }: MovementHistoryModalProps) {
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !partId) return;
    setLoading(true);
    getMovementHistory(partId, 100)
      .then(setMovements)
      .catch(() => setMovements([]))
      .finally(() => setLoading(false));
  }, [isOpen, partId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-semibold text-lg">Movement History</h2>
            <p className="text-xs text-slate-500">{partName}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="text-sm text-slate-500 text-center py-8">Loading...</p>
          ) : movements.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">No movements recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {movements.map((m) => {
                const config = MOVEMENT_CONFIG[m.movement_type] || MOVEMENT_CONFIG.adjustment;
                const Icon = config.icon;
                return (
                  <div key={m.movement_id} className="flex gap-3 items-start">
                    <div className={`p-1.5 rounded-lg shrink-0 ${config.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-900">{config.label}</span>
                        <span className="text-xs text-slate-400 shrink-0">
                          {new Date(m.performed_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {m.container_qty_change !== 0 && (
                          <span className={m.container_qty_change > 0 ? 'text-green-600' : 'text-red-500'}>
                            {m.container_qty_change > 0 ? '+' : ''}{m.container_qty_change} containers{' '}
                          </span>
                        )}
                        {m.bulk_qty_change !== 0 && (
                          <span className={m.bulk_qty_change > 0 ? 'text-green-600' : 'text-red-500'}>
                            {m.bulk_qty_change > 0 ? '+' : ''}{m.bulk_qty_change} bulk{' '}
                          </span>
                        )}
                      </div>
                      {m.notes && <p className="text-xs text-slate-400 mt-0.5">{m.notes}</p>}
                      <p className="text-xs text-slate-400">by {m.performed_by_name || 'System'}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
