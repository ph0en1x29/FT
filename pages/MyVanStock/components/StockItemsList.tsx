import React, { useMemo, useState } from 'react';
import { VanStockItem } from '../../../types';
import { Package, Search } from 'lucide-react';
import { StockItemCard } from './StockItemCard';

interface StockItemsListProps {
  items: VanStockItem[];
}

export function StockItemsList({ items }: StockItemsListProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter and sort items
  const filteredItems = useMemo(() => {
    let result = [...items];

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
  }, [items, searchQuery]);

  return (
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
            <div key={item.item_id}>
              <StockItemCard item={item} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
