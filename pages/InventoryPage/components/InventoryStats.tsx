import React from 'react';
import { InventoryStats as StatsType } from '../hooks/useInventoryData';

interface InventoryStatsProps {
  stats: StatsType;
  canViewPricing?: boolean;
}

const InventoryStats: React.FC<InventoryStatsProps> = ({ stats, canViewPricing = true }) => {
  return (
    <div className={`grid grid-cols-2 ${canViewPricing ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-4`}>
      <div className="card-theme rounded-xl p-4 theme-transition">
        <div className="text-2xl font-bold text-theme">{stats.total}</div>
        <div className="text-sm text-theme-muted">Total Items</div>
      </div>
      <div className="bg-amber-50 rounded-xl shadow-sm p-4 border border-amber-200">
        <div className="text-2xl font-bold text-amber-600">{stats.lowStock}</div>
        <div className="text-sm text-amber-700">Low Stock</div>
      </div>
      <div className="bg-red-50 rounded-xl shadow-sm p-4 border border-red-200">
        <div className="text-2xl font-bold text-red-600">{stats.outOfStock}</div>
        <div className="text-sm text-red-700">Out of Stock</div>
      </div>
      {canViewPricing && (
        <div className="bg-green-50 rounded-xl shadow-sm p-4 border border-green-200">
          <div className="text-2xl font-bold text-green-600">
            RM {stats.totalValue.toLocaleString()}
          </div>
          <div className="text-sm text-green-700">Inventory Value</div>
        </div>
      )}
    </div>
  );
};

export default InventoryStats;
