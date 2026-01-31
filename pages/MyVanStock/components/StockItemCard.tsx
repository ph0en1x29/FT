import React from 'react';
import { VanStockItem } from '../../../types';
import { AlertTriangle, CheckCircle, TrendingDown } from 'lucide-react';

interface StockItemCardProps {
  item: VanStockItem;
}

function getStockStatusBadge(item: VanStockItem) {
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
}

function getQuantityBarColor(item: VanStockItem) {
  const percent = (item.quantity / item.max_quantity) * 100;
  if (item.quantity === 0) return 'bg-red-500';
  if (percent <= 25) return 'bg-amber-500';
  return 'bg-green-500';
}

export function StockItemCard({ item }: StockItemCardProps) {
  return (
    <div className="card-theme rounded-xl p-4 theme-transition">
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
  );
}
