import React from 'react';
import { Search, Filter } from 'lucide-react';

interface InvoiceFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  filterCustomer: string;
  onCustomerChange: (value: string) => void;
  uniqueCustomers: string[];
  filterDateFrom: string;
  onDateFromChange: (value: string) => void;
  filterDateTo: string;
  onDateToChange: (value: string) => void;
  onClearFilters: () => void;
}

const InvoiceFilters: React.FC<InvoiceFiltersProps> = ({
  searchQuery,
  onSearchChange,
  filterCustomer,
  onCustomerChange,
  uniqueCustomers,
  filterDateFrom,
  onDateFromChange,
  filterDateTo,
  onDateToChange,
  onClearFilters,
}) => {
  const hasActiveFilters = filterCustomer !== 'all' || filterDateFrom || filterDateTo;

  return (
    <div className="card-theme rounded-xl p-4 space-y-4 theme-transition">
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-theme-muted" />
          <input
            type="text"
            placeholder="Search by invoice no, customer, equipment S/N..."
            className="w-full pl-10 pr-4 py-2.5 bg-theme-surface border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-theme placeholder-slate-400 theme-transition"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap gap-3 items-center">
        <Filter className="w-4 h-4 text-theme-muted" />

        <select
          className="px-3 py-2 bg-theme-surface border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-theme theme-transition"
          value={filterCustomer}
          onChange={(e) => onCustomerChange(e.target.value)}
        >
          <option value="all">All Customers</option>
          {uniqueCustomers.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <span className="text-sm text-theme-muted">From:</span>
          <input
            type="date"
            className="px-3 py-2 bg-theme-surface border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-theme theme-transition"
            value={filterDateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-theme-muted">To:</span>
          <input
            type="date"
            className="px-3 py-2 bg-theme-surface border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-theme theme-transition"
            value={filterDateTo}
            onChange={(e) => onDateToChange(e.target.value)}
          />
        </div>

        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="text-sm text-red-600 hover:text-red-700"
          >
            Clear Filters
          </button>
        )}
      </div>
    </div>
  );
};

export default InvoiceFilters;
