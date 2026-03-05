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

const dateFilters: { id: DateFilter; label: string }[] = [
  { id: 'unfinished', label: 'Unfinished' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'all', label: 'All' },
  { id: 'custom', label: 'Custom' },
];

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
    <div className="card-theme p-3 rounded-xl space-y-3">
      {/* Date pill tabs */}
      <div className="flex items-center gap-1 overflow-x-auto">
        {dateFilters.map(df => (
          <button
            key={df.id}
            onClick={() => onDateFilterChange(df.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              dateFilter === df.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]'
            }`}
          >
            {df.label}
          </button>
        ))}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Filter + Clear buttons */}
        <button
          onClick={onToggleFilters}
          className={`px-3 py-1.5 rounded-full border transition flex items-center gap-1.5 text-xs font-medium shrink-0 ${
            showFilters
              ? 'bg-blue-50 border-blue-200 text-blue-600'
              : 'border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]'
          }`}
        >
          <Filter className="w-3 h-3" />
          Filters
        </button>

        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="px-3 py-1.5 rounded-full border border-red-200 text-red-500 hover:bg-red-50 transition flex items-center gap-1.5 text-xs font-medium shrink-0"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
        <input
          type="text"
          placeholder="Search jobs, customers, forklifts..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text)] focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-400"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Custom Date Range */}
      {dateFilter === 'custom' && (
        <div className="flex flex-wrap gap-3 pt-2 border-t border-[var(--border)]">
          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--text-muted)]">From:</label>
            <input
              type="date"
              value={customDateFrom}
              onChange={(e) => onCustomDateFromChange(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--text)]"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--text-muted)]">To:</label>
            <input
              type="date"
              value={customDateTo}
              onChange={(e) => onCustomDateToChange(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--text)]"
            />
          </div>
        </div>
      )}

      {/* Expandable status filter */}
      {showFilters && (
        <div className="flex flex-wrap gap-3 pt-2 border-t border-[var(--border)] items-center">
          <label className="text-xs text-[var(--text-muted)]">Status:</label>
          <div className="w-44">
            <Combobox compact options={statusOptions} value={statusFilter} onChange={onStatusFilterChange} placeholder="All Statuses" />
          </div>
        </div>
      )}

      {/* Results count */}
      <div className="text-xs text-[var(--text-muted)]">
        Showing {filteredCount} of {totalJobs} jobs
      </div>
    </div>
  );
};
