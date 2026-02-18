import { Filter,Search } from 'lucide-react';
import React from 'react';

interface InventoryFiltersProps {
  searchQuery: string;
  filterCategory: string;
  filterStock: 'all' | 'low' | 'out';
  categories: string[];
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onStockChange: (value: 'all' | 'low' | 'out') => void;
}

const InventoryFilters: React.FC<InventoryFiltersProps> = ({
  searchQuery,
  filterCategory,
  filterStock,
  categories,
  onSearchChange,
  onCategoryChange,
  onStockChange,
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm p-3 md:p-4 space-y-3 md:space-y-4">
      <div className="flex flex-col lg:flex-row gap-3 md:gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, code, category, or supplier..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm md:text-base"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <select
              className="w-full lg:w-auto px-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm h-10"
              value={filterCategory}
              onChange={(e) => onCategoryChange(e.target.value)}
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <select
            className="w-full lg:w-auto px-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm h-10"
            value={filterStock}
            onChange={(e) => onStockChange(e.target.value as 'all' | 'low' | 'out')}
          >
            <option value="all">All Stock Levels</option>
            <option value="low">Low Stock</option>
            <option value="out">Out of Stock</option>
          </select>
        </div>
      </div>
    </div>
  );
};

export default InventoryFilters;
