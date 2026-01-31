import React from 'react';
import { Package, AlertTriangle, TrendingDown, CheckCircle } from 'lucide-react';

interface StatsCardsProps {
  totalItems: number;
  lowStock: number;
  outOfStock: number;
}

export function StatsCards({ totalItems, lowStock, outOfStock }: StatsCardsProps) {
  const inStock = totalItems - lowStock - outOfStock;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="card-theme rounded-xl p-4 theme-transition">
        <div className="flex items-center gap-2 mb-2">
          <Package className="w-5 h-5 text-blue-500" />
        </div>
        <div className="text-2xl font-bold text-theme">{totalItems}</div>
        <div className="text-xs text-theme-muted">Total Items</div>
      </div>

      <div className={`rounded-xl p-4 border ${lowStock > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className={`w-5 h-5 ${lowStock > 0 ? 'text-amber-500' : 'text-slate-400'}`} />
        </div>
        <div className={`text-2xl font-bold ${lowStock > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
          {lowStock}
        </div>
        <div className={`text-xs ${lowStock > 0 ? 'text-amber-700' : 'text-slate-500'}`}>Low Stock</div>
      </div>

      <div className={`rounded-xl p-4 border ${outOfStock > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex items-center gap-2 mb-2">
          <TrendingDown className={`w-5 h-5 ${outOfStock > 0 ? 'text-red-500' : 'text-slate-400'}`} />
        </div>
        <div className={`text-2xl font-bold ${outOfStock > 0 ? 'text-red-600' : 'text-slate-400'}`}>
          {outOfStock}
        </div>
        <div className={`text-xs ${outOfStock > 0 ? 'text-red-700' : 'text-slate-500'}`}>Out of Stock</div>
      </div>

      <div className="bg-green-50 rounded-xl p-4 border border-green-200">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle className="w-5 h-5 text-green-500" />
        </div>
        <div className="text-2xl font-bold text-green-600">{inStock}</div>
        <div className="text-xs text-green-700">In Stock</div>
      </div>
    </div>
  );
}
