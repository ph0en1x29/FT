import { Filter,Search } from 'lucide-react';
import React from 'react';

interface ServiceRecordsFiltersProps {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  filterCustomer: string;
  setFilterCustomer: (value: string) => void;
  filterTechnician: string;
  setFilterTechnician: (value: string) => void;
  filterDateFrom: string;
  setFilterDateFrom: (value: string) => void;
  filterDateTo: string;
  setFilterDateTo: (value: string) => void;
  uniqueCustomers: string[];
  uniqueTechnicians: string[];
}

/**
 * Filter controls for service records - search, customer, technician, and date filters
 */
const ServiceRecordsFilters: React.FC<ServiceRecordsFiltersProps> = ({
  searchQuery,
  setSearchQuery,
  filterCustomer,
  setFilterCustomer,
  filterTechnician,
  setFilterTechnician,
  filterDateFrom,
  setFilterDateFrom,
  filterDateTo,
  setFilterDateTo,
  uniqueCustomers,
  uniqueTechnicians,
}) => {
  const hasActiveFilters = filterCustomer !== 'all' || filterTechnician !== 'all' || filterDateFrom || filterDateTo;

  const clearAllFilters = () => {
    setFilterCustomer('all');
    setFilterTechnician('all');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  return (
    <div className="card-theme rounded-xl p-4 space-y-4 theme-transition">
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-theme-muted" />
          <input
            type="text"
            placeholder="Search by job title, customer, S/N, technician..."
            className="w-full pl-10 pr-4 py-2.5 bg-theme-surface border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-theme placeholder-slate-400 theme-transition"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap gap-3 items-center">
        <Filter className="w-4 h-4 text-theme-muted" />
        
        <select
          className="px-3 py-2 bg-theme-surface border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-theme theme-transition"
          value={filterCustomer}
          onChange={(e) => setFilterCustomer(e.target.value)}
        >
          <option value="all">All Customers</option>
          {uniqueCustomers.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          className="px-3 py-2 bg-theme-surface border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-theme theme-transition"
          value={filterTechnician}
          onChange={(e) => setFilterTechnician(e.target.value)}
        >
          <option value="all">All Technicians</option>
          {uniqueTechnicians.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <span className="text-sm text-theme-muted">From:</span>
          <input
            type="date"
            className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">To:</span>
          <input
            type="date"
            className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
          />
        </div>

        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="text-sm text-red-600 hover:text-red-700"
          >
            Clear Filters
          </button>
        )}
      </div>
    </div>
  );
};

export default ServiceRecordsFilters;
