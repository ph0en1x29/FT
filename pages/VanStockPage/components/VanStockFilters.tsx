/**
 * Search and filter component for VanStockPage
 */
import React from 'react';
import { Search, Filter } from 'lucide-react';
import { FilterType } from '../types';

interface VanStockFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterType: FilterType;
  onFilterChange: (filter: FilterType) => void;
}

export function VanStockFilters({
  searchQuery,
  onSearchChange,
  filterType,
  onFilterChange,
}: VanStockFiltersProps) {
  return (
    <div className="card-theme rounded-xl p-4 theme-transition">
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by technician name, email, or van code..."
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Filter className={`w-4 h-4 ${filterType !== 'all' ? 'text-blue-600' : 'text-slate-400'}`} />
            <select
              className={`px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-colors ${
                filterType !== 'all'
                  ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                  : 'border-slate-200'
              }`}
              value={filterType}
              onChange={(e) => onFilterChange(e.target.value as FilterType)}
            >
              <option value="all">All Technicians</option>
              <option value="low_stock">With Low Stock</option>
              <option value="pending_audit">Audit Due</option>
              <option value="pending_replenishment">Pending Requests</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
