import { Filter,Search } from 'lucide-react';
import React, { useMemo } from 'react';
import { Combobox, ComboboxOption } from '../../../components/Combobox';

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
  const categoryOptions: ComboboxOption[] = useMemo(() => [
    { id: 'all', label: 'All Categories' },
    ...categories.map(cat => ({ id: cat, label: cat })),
  ], [categories]);

  const stockOptions: ComboboxOption[] = useMemo(() => [
    { id: 'all', label: 'All Stock Levels' },
    { id: 'low', label: 'Low Stock' },
    { id: 'out', label: 'Out of Stock' },
  ], []);

  return (
    <div className="bg-[var(--surface)] rounded-xl shadow-sm p-3 md:p-4 space-y-3 md:space-y-4">
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
        <div className="grid grid-cols-2 gap-2 lg:flex lg:items-center">
          <Filter className="w-3.5 h-3.5 text-slate-400 hidden lg:block" />
          <div>
            <Combobox compact options={categoryOptions} value={filterCategory} onChange={onCategoryChange} placeholder="All Categories" />
          </div>
          <div>
            <Combobox compact options={stockOptions} value={filterStock} onChange={(v) => onStockChange(v as 'all' | 'low' | 'out')} placeholder="All Stock Levels" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryFilters;
