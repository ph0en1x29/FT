/**
 * ReplenishmentsTab - Van stock replenishment requests
 * Moved from StoreManager to Inventory page
 */
import { AlertTriangle, CheckCircle, Clock, Package, RefreshCw, Truck, Users } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { approveReplenishmentRequest, fulfillReplenishment, getReplenishmentRequests } from '../../../services/replenishmentService';
import { showToast } from '../../../services/toastService';
import type { User, VanStockReplenishment } from '../../../types';

interface ReplenishmentsTabProps {
  currentUser: User;
}

type ReplenishFilter = 'pending' | 'approved' | 'in_progress' | 'completed' | 'all';

const ReplenishmentsTab: React.FC<ReplenishmentsTabProps> = ({ currentUser }) => {
  const [replenishments, setReplenishments] = useState<VanStockReplenishment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ReplenishFilter>('pending');

  const loadReplenishments = useCallback(async () => {
    setLoading(true);
    try {
      const filters = filter !== 'all' ? { status: filter as VanStockReplenishment['status'] } : undefined;
      const data = await getReplenishmentRequests(filters);
      setReplenishments(data);
    } catch { showToast.error('Error loading replenishments'); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => {
    loadReplenishments();
  }, [loadReplenishments]);

  const handleApprove = async (id: string) => {
    try {
      await approveReplenishmentRequest(id, currentUser.user_id, currentUser.name);
      showToast.success('Replenishment approved');
      loadReplenishments();
    } catch { showToast.error('Failed to approve'); }
  };

  const handleFulfill = async (rep: VanStockReplenishment) => {
    try {
      const itemsIssued = (rep.items || []).map(item => ({
        itemId: item.item_id,
        quantityIssued: item.quantity_requested,
      }));
      await fulfillReplenishment(rep.replenishment_id, itemsIssued, currentUser.user_id, currentUser.name);
      showToast.success('Replenishment fulfilled', 'Technician will confirm receipt');
      loadReplenishments();
    } catch { showToast.error('Failed to fulfill'); }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
      pending: { bg: 'bg-amber-100', text: 'text-amber-700', icon: <Clock className="w-3 h-3" />, label: 'Pending' },
      approved: { bg: 'bg-green-100', text: 'text-green-700', icon: <CheckCircle className="w-3 h-3" />, label: 'Approved' },
      in_progress: { bg: 'bg-blue-100', text: 'text-blue-700', icon: <Truck className="w-3 h-3" />, label: 'Dispatched' },
      completed: { bg: 'bg-green-100', text: 'text-green-700', icon: <CheckCircle className="w-3 h-3" />, label: 'Completed' },
      cancelled: { bg: 'bg-red-100', text: 'text-red-700', icon: <AlertTriangle className="w-3 h-3" />, label: 'Cancelled' },
    };
    const s = styles[status] || styles.pending;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
        {s.icon} {s.label}
      </span>
    );
  };

  const filters: { id: ReplenishFilter; label: string }[] = [
    { id: 'pending', label: 'Pending' },
    { id: 'approved', label: 'Approved' },
    { id: 'in_progress', label: 'Dispatched' },
    { id: 'completed', label: 'Completed' },
    { id: 'all', label: 'All' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text)]">Van Stock Replenishments</h2>
          <p className="text-sm text-[var(--text-muted)]">Manage stock restocking for technician vans</p>
        </div>
        <button onClick={loadReplenishments} className="p-2 hover:bg-[var(--bg-subtle)] rounded-lg transition">
          <RefreshCw className={`w-5 h-5 text-[var(--text-muted)] ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filter pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition ${
              filter === f.id
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-[var(--text-muted)]">
          <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          Loading...
        </div>
      ) : replenishments.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-12 h-12 mx-auto mb-3 text-[var(--text-muted)] opacity-40" />
          <p className="text-[var(--text-muted)]">No {filter !== 'all' ? filter : ''} replenishments</p>
        </div>
      ) : (
        <div className="space-y-3">
          {replenishments.map(rep => (
            <div key={rep.replenishment_id} className="card-theme rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {getStatusBadge(rep.status)}
                    <span className="text-xs text-[var(--text-muted)]">{new Date(rep.created_at).toLocaleString()}</span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-[var(--bg-subtle)] text-[var(--text-muted)]">
                      <Users className="w-3 h-3" /> {rep.technician_name || 'Unknown Tech'}
                    </span>
                  </div>
                  {/* Items */}
                  <div className="mt-2 space-y-1">
                    {(rep.items || []).map(item => (
                      <div key={item.item_id} className="flex items-center gap-2 text-xs">
                        <span className="font-medium text-[var(--text)]">{item.quantity_requested}×</span>
                        <span className="text-[var(--text)]">{item.part_name}</span>
                        <span className="text-[var(--text-muted)]">({item.part_code})</span>
                        {item.quantity_issued > 0 && item.quantity_issued !== item.quantity_requested && (
                          <span className="text-amber-600">→ {item.quantity_issued} issued</span>
                        )}
                        {item.is_rejected && <span className="text-red-500">Rejected</span>}
                      </div>
                    ))}
                  </div>
                  {rep.notes && <p className="mt-2 text-xs text-[var(--text-muted)]">{rep.notes}</p>}
                  {rep.request_type !== 'manual' && (
                    <span className="inline-block mt-1 text-xs text-purple-600">
                      Auto: {rep.request_type === 'low_stock' ? 'Low stock trigger' : 'Slot-in job'}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  {rep.status === 'pending' && (
                    <button onClick={() => handleApprove(rep.replenishment_id)} className="btn-premium btn-premium-primary text-xs px-3 py-1.5">
                      <CheckCircle className="w-3.5 h-3.5" /> Approve
                    </button>
                  )}
                  {rep.status === 'approved' && (
                    <button onClick={() => handleFulfill(rep)} className="btn-premium btn-premium-primary text-xs px-3 py-1.5">
                      <Truck className="w-3.5 h-3.5" /> Dispatch
                    </button>
                  )}
                  {rep.status === 'in_progress' && (
                    <span className="text-xs text-blue-600 font-medium">Awaiting tech confirmation</span>
                  )}
                  {rep.status === 'completed' && rep.confirmed_at && (
                    <span className="text-xs text-green-600">✓ {new Date(rep.confirmed_at).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReplenishmentsTab;
