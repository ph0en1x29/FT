/**
 * Statistics cards component for VanStockPage
 */
import { Package,Users } from 'lucide-react';
import { FilterType,VanStockStats } from '../types';

interface VanStockStatsCardsProps {
  stats: VanStockStats;
  filterType: FilterType;
  onFilterChange: (filter: FilterType) => void;
}

export function VanStockStatsCards({ stats, filterType, onFilterChange }: VanStockStatsCardsProps) {
  const toggleFilter = (filter: FilterType) => {
    onFilterChange(filterType === filter ? 'all' : filter);
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {/* Technicians */}
      <div className="card-theme rounded-xl p-4 theme-transition">
        <div className="flex items-center gap-2 mb-2">
          <Users className="w-5 h-5 text-blue-500" />
        </div>
        <div className="text-2xl font-bold text-theme">{stats.totalTechnicians}</div>
        <div className="text-xs text-theme-muted">Technicians</div>
      </div>

      {/* Total Items */}
      <div className="card-theme rounded-xl p-4 theme-transition">
        <div className="flex items-center gap-2 mb-2">
          <Package className="w-5 h-5 text-indigo-500" />
        </div>
        <div className="text-2xl font-bold text-theme">{stats.totalItems}</div>
        <div className="text-xs text-theme-muted">Total Items</div>
      </div>

      {/* Total Value */}
      <div className="bg-green-50 rounded-xl p-4 border border-green-200">
        <div className="text-2xl font-bold text-green-600">
          RM {stats.totalValue.toLocaleString()}
        </div>
        <div className="text-xs text-green-700">Total Value</div>
      </div>

      {/* Low Stock - Clickable Filter */}
      <button
        className={`rounded-xl p-4 border-2 cursor-pointer transition-all text-left ${
          filterType === 'low_stock'
            ? 'bg-amber-100 border-amber-500 ring-2 ring-offset-2 ring-amber-500'
            : stats.lowStockCount > 0
            ? 'bg-amber-50 border-amber-200 hover:border-amber-300 hover:shadow-sm'
            : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
        }`}
        onClick={() => toggleFilter('low_stock')}
      >
        <div className={`text-2xl font-bold ${filterType === 'low_stock' ? 'text-amber-600' : stats.lowStockCount > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
          {stats.lowStockCount}
        </div>
        <div className={`text-xs ${filterType === 'low_stock' ? 'text-amber-700' : stats.lowStockCount > 0 ? 'text-amber-700' : 'text-slate-500'}`}>
          Low Stock Items
        </div>
      </button>

      {/* Audits Due - Clickable Filter */}
      <button
        className={`rounded-xl p-4 border-2 cursor-pointer transition-all text-left ${
          filterType === 'pending_audit'
            ? 'bg-purple-100 border-purple-500 ring-2 ring-offset-2 ring-purple-500'
            : stats.pendingAudits > 0
            ? 'bg-purple-50 border-purple-200 hover:border-purple-300 hover:shadow-sm'
            : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
        }`}
        onClick={() => toggleFilter('pending_audit')}
      >
        <div className={`text-2xl font-bold ${filterType === 'pending_audit' ? 'text-purple-600' : stats.pendingAudits > 0 ? 'text-purple-600' : 'text-slate-400'}`}>
          {stats.pendingAudits}
        </div>
        <div className={`text-xs ${filterType === 'pending_audit' ? 'text-purple-700' : stats.pendingAudits > 0 ? 'text-purple-700' : 'text-slate-500'}`}>
          Audits Due
        </div>
      </button>

      {/* Pending Requests - Clickable Filter */}
      <button
        className={`rounded-xl p-4 border-2 cursor-pointer transition-all text-left ${
          filterType === 'pending_replenishment'
            ? 'bg-orange-100 border-orange-500 ring-2 ring-offset-2 ring-orange-500'
            : stats.pendingReplenishments > 0
            ? 'bg-orange-50 border-orange-200 hover:border-orange-300 hover:shadow-sm'
            : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'
        }`}
        onClick={() => toggleFilter('pending_replenishment')}
      >
        <div className={`text-2xl font-bold ${filterType === 'pending_replenishment' ? 'text-orange-600' : stats.pendingReplenishments > 0 ? 'text-orange-600' : 'text-slate-400'}`}>
          {stats.pendingReplenishments}
        </div>
        <div className={`text-xs ${filterType === 'pending_replenishment' ? 'text-orange-700' : stats.pendingReplenishments > 0 ? 'text-orange-700' : 'text-slate-500'}`}>
          Pending Requests
        </div>
      </button>
    </div>
  );
}
