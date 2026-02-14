/**
 * Van Stock Stats — Compact summary bar
 * Left: key metrics inline | Right: actionable filter pills
 */
import { AlertTriangle, ClipboardCheck, Clock, Package, Truck, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { FilterType, VanStockStats } from '../types';

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
    <div className="card-theme rounded-xl p-5 theme-transition">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Left — Key metrics */}
        <div className="flex items-center gap-5 flex-wrap">
          {/* Fleet status breakdown */}
          <div className="flex items-center gap-3">
            <Truck className="w-4 h-4 text-theme-muted" />
            <span className="flex items-center gap-1 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-base font-bold text-theme">{stats.activeVans}</span>
              <span className="text-theme-muted">Active</span>
            </span>
            {stats.inServiceVans > 0 && (
              <span className="flex items-center gap-1 text-xs">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-base font-bold text-theme">{stats.inServiceVans}</span>
                <span className="text-theme-muted">In Service</span>
              </span>
            )}
            {stats.decommissionedVans > 0 && (
              <span className="flex items-center gap-1 text-xs">
                <span className="w-2 h-2 rounded-full bg-gray-400" />
                <span className="text-base font-bold text-theme">{stats.decommissionedVans}</span>
                <span className="text-theme-muted">Retired</span>
              </span>
            )}
          </div>
          <div className="w-px h-4 bg-theme-surface-2 hidden lg:block" />
          <div className="flex items-center gap-1.5 text-xs">
            <Users className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-base font-bold text-theme">{stats.totalTechnicians}</span>
            <span className="text-theme-muted">Techs</span>
          </div>
          <div className="w-px h-4 bg-theme-surface-2 hidden lg:block" />
          <div className="flex items-center gap-1.5 text-xs">
            <Package className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-base font-bold text-theme">{stats.totalItems}</span>
            <span className="text-theme-muted">Items</span>
          </div>
          <div className="w-px h-4 bg-theme-surface-2 hidden lg:block" />
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-base font-bold text-green-600">RM {stats.totalValue.toLocaleString()}</span>
            <span className="text-theme-muted">Value</span>
          </div>
        </div>

        {/* Right — Actionable filter pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <FilterPill
            active={filterType === 'low_stock'}
            count={stats.lowStockCount}
            label="Low Stock"
            icon={<AlertTriangle className="w-3.5 h-3.5" />}
            color="amber"
            onClick={() => toggleFilter('low_stock')}
          />
          <FilterPill
            active={filterType === 'pending_audit'}
            count={stats.pendingAudits}
            label="Audits Due"
            icon={<ClipboardCheck className="w-3.5 h-3.5" />}
            color="purple"
            onClick={() => toggleFilter('pending_audit')}
          />
          <FilterPill
            active={filterType === 'pending_replenishment'}
            count={stats.pendingReplenishments}
            label="Requests"
            icon={<Clock className="w-3.5 h-3.5" />}
            color="orange"
            onClick={() => toggleFilter('pending_replenishment')}
          />
        </div>
      </div>
    </div>
  );
}

function FilterPill({ active, count, label, icon, color, onClick }: {
  active: boolean;
  count: number;
  label: string;
  icon: ReactNode;
  color: 'amber' | 'purple' | 'orange';
  onClick: () => void;
}) {
  const colorMap = {
    amber: {
      active: 'bg-amber-100 text-amber-700 border-amber-300 ring-2 ring-amber-200',
      hasCount: 'bg-amber-50 text-amber-700 border-amber-200 hover:border-amber-300',
      empty: 'text-theme-muted border-theme hover:border-theme-muted',
    },
    purple: {
      active: 'bg-purple-100 text-purple-700 border-purple-300 ring-2 ring-purple-200',
      hasCount: 'bg-purple-50 text-purple-700 border-purple-200 hover:border-purple-300',
      empty: 'text-theme-muted border-theme hover:border-theme-muted',
    },
    orange: {
      active: 'bg-orange-100 text-orange-700 border-orange-300 ring-2 ring-orange-200',
      hasCount: 'bg-orange-50 text-orange-700 border-orange-200 hover:border-orange-300',
      empty: 'text-theme-muted border-theme hover:border-theme-muted',
    },
  };

  const style = active ? colorMap[color].active : count > 0 ? colorMap[color].hasCount : colorMap[color].empty;

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all cursor-pointer ${style}`}
    >
      {icon}
      <span className="font-bold">{count}</span>
      {label}
    </button>
  );
}
