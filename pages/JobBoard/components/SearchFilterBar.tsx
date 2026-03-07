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
    <div className="card-theme rounded-2xl p-4 space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search jobs, customers, forklifts..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] py-3 pl-10 pr-10 text-sm text-[var(--text)] focus:border-transparent focus:ring-2 focus:ring-blue-500 placeholder-slate-400"
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

        <div className="hidden md:block md:w-56">
          <Combobox compact options={statusOptions} value={statusFilter} onChange={onStatusFilterChange} placeholder="All Statuses" />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleFilters}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition ${
              showFilters
                ? 'bg-blue-50 border-blue-200 text-blue-600'
                : 'border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]'
            }`}
          >
            <Filter className="w-3 h-3" />
            More Filters
          </button>

          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-xs font-medium text-red-500 transition hover:bg-red-50"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-3 md:flex-row md:items-center md:justify-between">
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
        </div>

        <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Showing {filteredCount} of {totalJobs} jobs
        </div>
      </div>

      {(showFilters || dateFilter === 'custom') && (
        <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-3 md:flex-row md:flex-wrap md:items-center">
          <div className="md:hidden md:w-44">
            <Combobox compact options={statusOptions} value={statusFilter} onChange={onStatusFilterChange} placeholder="All Statuses" />
          </div>
          {dateFilter === 'custom' && (
            <>
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
            </>
          )}
        </div>
      )}

      <div className="text-xs text-[var(--text-muted)]">
        Use the status picker and date chips to narrow the queue before opening individual job cards.
      </div>
    </div>
  );
};
