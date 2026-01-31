import React, { useState } from 'react';
import { User, VanStockItem } from '../../types';
import { SupabaseDb as MockDb } from '../../services/supabaseService';
import { showToast } from '../../services/toastService';
import { Package, Clock, RefreshCw, History, Truck, Plus } from 'lucide-react';
import ReplenishmentRequestModal from '../../components/ReplenishmentRequestModal';
import { useVanStock } from './hooks/useVanStock';
import { StatsCards, StockItemsList, UsageHistoryTab } from './components';

interface MyVanStockProps {
  currentUser: User;
}

type TabType = 'stock' | 'history';

export default function MyVanStock({ currentUser }: MyVanStockProps) {
  const [activeTab, setActiveTab] = useState<TabType>('stock');
  const [showReplenishmentModal, setShowReplenishmentModal] = useState(false);

  const {
    vanStock,
    usageHistory,
    replenishments,
    loading,
    stats,
    lowStockItems,
    pendingReplenishmentsCount,
    loadData,
  } = useVanStock({ userId: currentUser.user_id });

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
      <StatsCards
        totalItems={stats.totalItems}
        lowStock={stats.lowStock}
        outOfStock={stats.outOfStock}
      />

      {/* Pending Replenishments Alert */}
      {pendingReplenishmentsCount > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-blue-600" />
            <div>
              <h4 className="font-medium text-blue-900">Replenishment In Progress</h4>
              <p className="text-sm text-blue-700">
                You have {pendingReplenishmentsCount} pending replenishment request(s)
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
        <StockItemsList items={vanStock.items || []} />
      )}

      {activeTab === 'history' && (
        <UsageHistoryTab usageHistory={usageHistory} replenishments={replenishments} />
      )}

      {/* Replenishment Modal */}
      {showReplenishmentModal && vanStock && (
        <ReplenishmentRequestModal
          vanStock={vanStock}
          lowStockItems={lowStockItems as VanStockItem[]}
          onClose={() => setShowReplenishmentModal(false)}
          onSubmit={handleReplenishmentSubmit}
        />
      )}
    </div>
  );
}
