import { Filter,Search,X } from 'lucide-react';
import React, { useMemo } from 'react';
import { Combobox, ComboboxOption } from '../../../components/Combobox';
import { JobStatus } from '../../../types';
import { DateFilter } from '../types';

interface SearchFilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  dateFilter: DateFilter;
  onDateFilterChange: (filter: DateFilter) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  showFilters: boolean;
  onToggleFilters: () => void;
  customDateFrom: string;
  onCustomDateFromChange: (date: string) => void;
  customDateTo: string;
  onCustomDateToChange: (date: string) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  totalJobs: number;
  filteredCount: number;
}

export const SearchFilterBar: React.FC<SearchFilterBarProps> = ({
  searchQuery,
  onSearchChange,
  dateFilter,
  onDateFilterChange,
  statusFilter,
  onStatusFilterChange,
  showFilters,
  onToggleFilters,
  customDateFrom,
  onCustomDateFromChange,
  customDateTo,
  onCustomDateToChange,
  hasActiveFilters,
  onClearFilters,
  totalJobs,
  filteredCount,
}) => {
  const dateOptions: ComboboxOption[] = useMemo(() => [
    { id: 'unfinished', label: '🔄 Unfinished' },
    { id: 'today', label: '📅 Today' },
    { id: 'week', label: '📆 This Week' },
    { id: 'month', label: '🗓️ This Month' },
    { id: 'all', label: '📋 All Jobs' },
    { id: 'custom', label: '🔍 Custom Range' },
  ], []);

  const statusOptions: ComboboxOption[] = useMemo(() => [
    { id: 'all', label: 'All Statuses' },
    { id: JobStatus.NEW, label: 'New' },
    { id: JobStatus.ASSIGNED, label: 'Assigned' },
    { id: JobStatus.IN_PROGRESS, label: 'In Progress' },
    { id: JobStatus.AWAITING_FINALIZATION, label: 'Awaiting Finalization' },
    { id: JobStatus.COMPLETED, label: 'Completed' },
    { id: JobStatus.COMPLETED_AWAITING_ACK, label: 'Awaiting Customer Ack' },
    { id: JobStatus.INCOMPLETE_CONTINUING, label: 'Incomplete - Continuing' },
    { id: JobStatus.INCOMPLETE_REASSIGNED, label: 'Incomplete - Reassigned' },
    { id: JobStatus.DISPUTED, label: 'Disputed' },
  ], []);

  return (
    <div className="card-theme p-4 rounded-xl space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-theme-muted" />
          <input
            type="text"
            placeholder="Search jobs, customers, forklifts, job numbers..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-theme bg-theme-surface text-theme focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-muted hover:text-theme"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Date Filter */}
        <div className="w-36">
          <Combobox compact options={dateOptions} value={dateFilter} onChange={(v) => onDateFilterChange(v as DateFilter)} placeholder="Unfinished" />
        </div>

        {/* Toggle Filters Button */}
        <button
          onClick={onToggleFilters}
          className={`px-4 py-2.5 rounded-lg border transition flex items-center gap-2 ${
            showFilters 
              ? 'bg-blue-50 border-blue-200 text-blue-600' 
              : 'border-theme text-theme-muted hover:bg-theme-surface-2'
          }`}
        >
          <Filter className="w-4 h-4" />
          <span className="hidden sm:inline text-sm">Filters</span>
        </button>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="px-4 py-2.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline text-sm">Clear</span>
          </button>
        )}
      </div>

      {/* Custom Date Range */}
      {dateFilter === 'custom' && (
        <div className="flex flex-wrap gap-3 pt-2 border-t border-theme-muted">
          <div className="flex items-center gap-2">
            <label className="text-sm text-theme-muted">From:</label>
            <input
              type="date"
              value={customDateFrom}
              onChange={(e) => onCustomDateFromChange(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-theme bg-theme-surface text-theme text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-theme-muted">To:</label>
            <input
              type="date"
              value={customDateTo}
              onChange={(e) => onCustomDateToChange(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-theme bg-theme-surface text-theme text-sm"
            />
          </div>
        </div>
      )}

      {/* Additional Filters (expandable) */}
      {showFilters && (
        <div className="flex flex-wrap gap-3 pt-2 border-t border-theme-muted items-center">
          <label className="text-sm text-theme-muted">Status:</label>
          <div className="w-44">
            <Combobox compact options={statusOptions} value={statusFilter} onChange={onStatusFilterChange} placeholder="All Statuses" />
          </div>
        </div>
      )}

      {/* Results count */}
      <div className="text-sm text-theme-muted">
        Showing {filteredCount} of {totalJobs} jobs
      </div>
    </div>
  );
};
