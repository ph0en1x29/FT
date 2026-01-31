import React, { useState, useEffect, useMemo } from 'react';
import {
  User,
  VanStock,
  VanStockItem,
  VanStockUsage,
  VanStockReplenishment,
} from '../types';
import { SupabaseDb as MockDb } from '../services/supabaseService';
import { showToast } from '../services/toastService';
import {
  Package,
  AlertTriangle,
  CheckCircle,
  TrendingDown,
  Clock,
  RefreshCw,
  History,
  Truck,
  Plus,
  Search,
} from 'lucide-react';
import ReplenishmentRequestModal from '../components/ReplenishmentRequestModal';

interface MyVanStockProps {
  currentUser: User;
}

type TabType = 'stock' | 'history';

export default function MyVanStock({ currentUser }: MyVanStockProps) {
  const [vanStock, setVanStock] = useState<VanStock | null>(null);
  const [usageHistory, setUsageHistory] = useState<VanStockUsage[]>([]);
  const [replenishments, setReplenishments] = useState<VanStockReplenishment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('stock');
  const [searchQuery, setSearchQuery] = useState('');
  const [showReplenishmentModal, setShowReplenishmentModal] = useState(false);

  useEffect(() => {
    loadData();
  }, [currentUser.user_id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [stockData, historyData, replenishmentData] = await Promise.all([
        MockDb.getVanStockByTechnician(currentUser.user_id),
        MockDb.getVanStockUsageHistory(currentUser.user_id, 50),
        MockDb.getReplenishmentRequests({ technicianId: currentUser.user_id }),
      ]);
      setVanStock(stockData);
      setUsageHistory(historyData);
      setReplenishments(replenishmentData);
    } catch (error) {
      showToast.error('Failed to load Van Stock data');
    }
    setLoading(false);
  };

  // Calculate stats
  const stats = useMemo(() => {
    if (!vanStock?.items) {
      return { totalItems: 0, lowStock: 0, outOfStock: 0, totalValue: 0 };
    }

    const items = vanStock.items;
    const totalItems = items.length;
    const lowStock = items.filter(item => item.quantity > 0 && item.quantity <= item.min_quantity).length;
    const outOfStock = items.filter(item => item.quantity === 0).length;
    const totalValue = vanStock.total_value || 0;

    return { totalItems, lowStock, outOfStock, totalValue };
  }, [vanStock]);

  // Filter items
  const filteredItems = useMemo(() => {
    if (!vanStock?.items) return [];

    let result = [...vanStock.items];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item =>
        item.part?.part_name?.toLowerCase().includes(query) ||
        item.part?.part_code?.toLowerCase().includes(query)
      );
    }

    // Sort: out of stock first, then low stock, then by name
    result.sort((a, b) => {
      if (a.quantity === 0 && b.quantity > 0) return -1;
      if (a.quantity > 0 && b.quantity === 0) return 1;
      if (a.quantity <= a.min_quantity && b.quantity > b.min_quantity) return -1;
      if (a.quantity > a.min_quantity && b.quantity <= b.min_quantity) return 1;
      return (a.part?.part_name || '').localeCompare(b.part?.part_name || '');
    });

    return result;
  }, [vanStock?.items, searchQuery]);

  // Get low stock items for replenishment
  const lowStockItems = useMemo(() => {
    if (!vanStock?.items) return [];
    return vanStock.items.filter(item => item.quantity <= item.min_quantity);
  }, [vanStock?.items]);

  const getStockStatusBadge = (item: VanStockItem) => {
    if (item.quantity === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full font-medium">
          <TrendingDown className="w-3 h-3" /> Out of Stock
        </span>
      );
    }
    if (item.quantity <= item.min_quantity) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">
          <AlertTriangle className="w-3 h-3" /> Low Stock
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
        <CheckCircle className="w-3 h-3" /> In Stock
      </span>
    );
  };

  const getQuantityBarColor = (item: VanStockItem) => {
    const percent = (item.quantity / item.max_quantity) * 100;
    if (item.quantity === 0) return 'bg-red-500';
    if (percent <= 25) return 'bg-amber-500';
    return 'bg-green-500';
  };

  const handleReplenishmentSubmit = async (
    items: { vanStockItemId: string; partId: string; partName: string; partCode: string; quantityRequested: number }[],
    notes?: string
  ) => {
    if (!vanStock) return;

    try {
      await MockDb.createReplenishmentRequest(
        vanStock.van_stock_id,
        currentUser.user_id,
        currentUser.name,
        items,
        'manual',
        undefined,
        notes
      );
      showToast.success('Replenishment requested', 'Admin will process your request');
      setShowReplenishmentModal(false);
      loadData();
    } catch (error) {
      showToast.error('Failed to submit request', (error as Error).message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Loading your Van Stock...</div>
      </div>
    );
  }

  if (!vanStock) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Truck className="w-12 h-12 text-slate-300 mb-4" />
        <h3 className="text-lg font-medium text-slate-700 mb-2">No Van Stock Assigned</h3>
        <p className="text-sm text-slate-500 max-w-md">
          You don't have a Van Stock assigned yet. Please contact your supervisor to set up your Van Stock inventory.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-theme flex items-center gap-2">
            <Truck className="w-7 h-7" />
            My Van Stock
          </h1>
          <p className="text-sm text-theme-muted mt-1">
            Manage your mobile inventory
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2 border border-theme rounded-lg hover:bg-theme-surface-2 text-sm text-theme-muted theme-transition"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          {lowStockItems.length > 0 && (
            <button
              onClick={() => setShowReplenishmentModal(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 shadow-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Request Replenishment
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card-theme rounded-xl p-4 theme-transition">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-theme">{stats.totalItems}</div>
          <div className="text-xs text-theme-muted">Total Items</div>
        </div>

        <div className={`rounded-xl p-4 border ${stats.lowStock > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className={`w-5 h-5 ${stats.lowStock > 0 ? 'text-amber-500' : 'text-slate-400'}`} />
          </div>
          <div className={`text-2xl font-bold ${stats.lowStock > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
            {stats.lowStock}
          </div>
          <div className={`text-xs ${stats.lowStock > 0 ? 'text-amber-700' : 'text-slate-500'}`}>Low Stock</div>
        </div>

        <div className={`rounded-xl p-4 border ${stats.outOfStock > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className={`w-5 h-5 ${stats.outOfStock > 0 ? 'text-red-500' : 'text-slate-400'}`} />
          </div>
          <div className={`text-2xl font-bold ${stats.outOfStock > 0 ? 'text-red-600' : 'text-slate-400'}`}>
            {stats.outOfStock}
          </div>
          <div className={`text-xs ${stats.outOfStock > 0 ? 'text-red-700' : 'text-slate-500'}`}>Out of Stock</div>
        </div>

        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-green-600">
            {stats.totalItems - stats.lowStock - stats.outOfStock}
          </div>
          <div className="text-xs text-green-700">In Stock</div>
        </div>
      </div>

      {/* Pending Replenishments Alert */}
      {replenishments.filter(r => r.status === 'pending' || r.status === 'approved' || r.status === 'in_progress').length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-blue-600" />
            <div>
              <h4 className="font-medium text-blue-900">Replenishment In Progress</h4>
              <p className="text-sm text-blue-700">
                You have {replenishments.filter(r => ['pending', 'approved', 'in_progress'].includes(r.status)).length} pending replenishment request(s)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-theme">
        <nav className="flex gap-6">
          <button
            onClick={() => setActiveTab('stock')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'stock'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-theme-muted hover:text-theme'
            }`}
          >
            <Package className="w-4 h-4 inline mr-2" />
            Stock Items
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-theme-muted hover:text-theme'
            }`}
          >
            <History className="w-4 h-4 inline mr-2" />
            Usage History
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'stock' && (
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search parts..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Items List */}
          {filteredItems.length === 0 ? (
            <div className="card-theme rounded-xl p-8 text-center">
              <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No items found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item) => (
                <div
                  key={item.item_id}
                  className="card-theme rounded-xl p-4 theme-transition"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-theme">{item.part?.part_name || 'Unknown Part'}</h4>
                      <p className="text-xs text-theme-muted">{item.part?.part_code}</p>
                    </div>
                    {getStockStatusBadge(item)}
                  </div>

                  {/* Quantity Bar */}
                  <div className="mb-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-theme-muted">Quantity</span>
                      <span className="font-medium text-theme">
                        {item.quantity} / {item.max_quantity}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${getQuantityBarColor(item)} transition-all duration-300`}
                        style={{ width: `${Math.min(100, (item.quantity / item.max_quantity) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Meta Info */}
                  <div className="flex items-center justify-between text-xs text-theme-muted">
                    <span>Min: {item.min_quantity}</span>
                    {item.last_used_at && (
                      <span>Last used: {new Date(item.last_used_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="space-y-4">
          {usageHistory.length === 0 ? (
            <div className="card-theme rounded-xl p-8 text-center">
              <History className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">No usage history yet</p>
            </div>
          ) : (
            <div className="card-theme rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-theme-surface-2">
                  <tr>
                    <th className="text-left p-3 text-theme-muted">Part</th>
                    <th className="text-center p-3 text-theme-muted">Qty</th>
                    <th className="text-left p-3 text-theme-muted">Job</th>
                    <th className="text-left p-3 text-theme-muted">Date</th>
                    <th className="text-center p-3 text-theme-muted">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme">
                  {usageHistory.map((usage) => (
                    <tr key={usage.usage_id} className="hover:bg-theme-surface-2">
                      <td className="p-3">
                        <div className="font-medium text-theme">
                          {usage.van_stock_item?.part?.part_name || 'Unknown'}
                        </div>
                        <div className="text-xs text-theme-muted">
                          {usage.van_stock_item?.part?.part_code}
                        </div>
                      </td>
                      <td className="p-3 text-center font-medium text-theme">
                        {usage.quantity_used}
                      </td>
                      <td className="p-3">
                        <span className="text-theme">{usage.job?.title || usage.job_id}</span>
                      </td>
                      <td className="p-3 text-theme-muted">
                        {new Date(usage.used_at).toLocaleDateString()}
                      </td>
                      <td className="p-3 text-center">
                        {usage.approval_status === 'approved' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                            <CheckCircle className="w-3 h-3" /> Approved
                          </span>
                        ) : usage.approval_status === 'pending' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full">
                            <Clock className="w-3 h-3" /> Pending
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full">
                            <TrendingDown className="w-3 h-3" /> Rejected
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Replenishment History */}
          {replenishments.length > 0 && (
            <div className="mt-6">
              <h3 className="font-semibold text-theme mb-3">Replenishment History</h3>
              <div className="space-y-3">
                {replenishments.map((rep) => (
                  <div key={rep.replenishment_id} className="card-theme rounded-xl p-4 theme-transition">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-theme">
                        {rep.items?.length || 0} items requested
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full font-medium ${
                        rep.status === 'completed' ? 'bg-green-100 text-green-700' :
                        rep.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                        rep.status === 'approved' ? 'bg-indigo-100 text-indigo-700' :
                        rep.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {rep.status.charAt(0).toUpperCase() + rep.status.slice(1).replace('_', ' ')}
                      </span>
                    </div>
                    <div className="text-xs text-theme-muted">
                      Requested: {new Date(rep.requested_at).toLocaleDateString()}
                      {rep.fulfilled_at && ` • Fulfilled: ${new Date(rep.fulfilled_at).toLocaleDateString()}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Replenishment Modal */}
      {showReplenishmentModal && vanStock && (
        <ReplenishmentRequestModal
          vanStock={vanStock}
          lowStockItems={lowStockItems}
          onClose={() => setShowReplenishmentModal(false)}
          onSubmit={handleReplenishmentSubmit}
        />
      )}
    </div>
  );
}
