import { ChevronDown,Filter,Search,X } from 'lucide-react';
import React from 'react';
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

/**
 * Search and filter bar with expandable advanced filters
 */
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
  return (
    <div className="card-theme p-4 rounded-xl space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-theme-muted" />
          <input
            type="text"
            placeholder="Search jobs, customers, forklifts..."
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

        {/* Date Filter Dropdown */}
        <div className="relative">
          <select
            value={dateFilter}
            onChange={(e) => onDateFilterChange(e.target.value as DateFilter)}
            className="appearance-none pl-4 pr-10 py-2.5 rounded-lg border border-theme bg-theme-surface text-theme focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer min-w-[160px]"
          >
            <option value="unfinished">🔄 Unfinished</option>
            <option value="today">📅 Today</option>
            <option value="week">📆 This Week</option>
            <option value="month">🗓️ This Month</option>
            <option value="all">📋 All Jobs</option>
            <option value="custom">🔍 Custom Range</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted pointer-events-none" />
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
          <span className="hidden sm:inline">Filters</span>
        </button>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="px-4 py-2.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">Clear</span>
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
        <div className="flex flex-wrap gap-3 pt-2 border-t border-theme-muted">
          <div className="flex items-center gap-2">
            <label className="text-sm text-theme-muted">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-theme bg-theme-surface text-theme text-sm"
            >
              <option value="all">All Statuses</option>
              <option value={JobStatus.NEW}>New</option>
              <option value={JobStatus.ASSIGNED}>Assigned</option>
              <option value={JobStatus.IN_PROGRESS}>In Progress</option>
              <option value={JobStatus.AWAITING_FINALIZATION}>Awaiting Finalization</option>
              <option value={JobStatus.COMPLETED}>Completed</option>
              <option value={JobStatus.COMPLETED_AWAITING_ACK}>Awaiting Customer Ack</option>
              <option value={JobStatus.INCOMPLETE_CONTINUING}>Incomplete - Continuing</option>
              <option value={JobStatus.INCOMPLETE_REASSIGNED}>Incomplete - Reassigned</option>
              <option value={JobStatus.DISPUTED}>Disputed</option>
            </select>
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
