import { Filter, Search, X } from 'lucide-react';
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
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="search"
            placeholder="Search by job, customer, forklift, account, site..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)]/40 pl-10 pr-11 text-sm text-[var(--text)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] transition hover:text-[var(--text)]"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <button
            onClick={onToggleFilters}
            className={`inline-flex h-11 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition ${
              showFilters
                ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
                : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>

          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-700 transition hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
            >
              <X className="h-4 w-4" />
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {dateFilters.map((dateOption) => (
          <button
            key={dateOption.id}
            onClick={() => onDateFilterChange(dateOption.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              dateFilter === dateOption.id
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            {dateOption.label}
          </button>
        ))}
      </div>

      {showFilters && (
        <div className="mt-4 grid gap-3 border-t border-[var(--border)] pt-4 md:grid-cols-[180px_1fr_1fr]">
          <div className="space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-theme-muted">Status</div>
            <Combobox compact options={statusOptions} value={statusFilter} onChange={onStatusFilterChange} placeholder="All Statuses" />
          </div>

          {dateFilter === 'custom' && (
            <>
              <label className="space-y-1 text-sm text-theme-muted">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-theme-muted">From</span>
                <input
                  type="date"
                  value={customDateFrom}
                  onChange={(e) => onCustomDateFromChange(e.target.value)}
                  className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </label>
              <label className="space-y-1 text-sm text-theme-muted">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-theme-muted">To</span>
                <input
                  type="date"
                  value={customDateTo}
                  onChange={(e) => onCustomDateToChange(e.target.value)}
                  className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </label>
            </>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-3 text-xs text-theme-muted">
        <span>Showing {filteredCount} of {totalJobs} jobs</span>
        <span>{showFilters ? 'Advanced filters open' : 'Filters collapsed'}</span>
      </div>
    </div>
  );
};
