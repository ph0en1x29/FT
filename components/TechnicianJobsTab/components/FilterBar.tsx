import React, { useMemo } from 'react';
import { Combobox, ComboboxOption } from '../../../components/Combobox';
import { JobStatus,JobType } from '../../../types';
import { FilterMode } from '../hooks/useJobFilters';

interface FilterBarProps {
  filterMode: FilterMode;
  setFilterMode: (mode: FilterMode) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  typeFilter: string;
  setTypeFilter: (type: string) => void;
  dateFrom: string;
  setDateFrom: (date: string) => void;
  dateTo: string;
  setDateTo: (date: string) => void;
  hasActiveFilters: boolean;
  clearFilters: () => void;
  currentJobsCount: number;
  completedTotal: number;
  totalJobs: number;
}

const FilterBar: React.FC<FilterBarProps> = ({
  filterMode,
  setFilterMode,
  statusFilter,
  setStatusFilter,
  typeFilter,
  setTypeFilter,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  hasActiveFilters,
  clearFilters,
  currentJobsCount,
  completedTotal,
  totalJobs,
}) => {
  const tabClass = (active: boolean) =>
    `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      active
        ? 'bg-theme-surface text-theme-accent shadow-sm'
        : 'text-theme-muted hover:text-[var(--text)]'
    }`;

  const statusOptions: ComboboxOption[] = useMemo(() => [
    { id: 'all', label: 'All Status' },
    { id: JobStatus.NEW, label: 'New' },
    { id: JobStatus.ASSIGNED, label: 'Assigned' },
    { id: JobStatus.IN_PROGRESS, label: 'In Progress' },
    { id: JobStatus.AWAITING_FINALIZATION, label: 'Awaiting Finalization' },
    { id: JobStatus.COMPLETED, label: 'Completed' },
  ], []);

  const typeOptions: ComboboxOption[] = useMemo(() => [
    { id: 'all', label: 'All Types' },
    { id: JobType.SERVICE, label: 'Service' },
    { id: JobType.REPAIR, label: 'Repair' },
    { id: JobType.CHECKING, label: 'Checking' },
    { id: JobType.SLOT_IN, label: 'Slot-In' },
    { id: JobType.COURIER, label: 'Courier' },
  ], []);

  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* Mode Tabs */}
      <div className="flex gap-1 bg-theme-surface-2 p-1 rounded-lg">
        <button onClick={() => setFilterMode('current')} className={tabClass(filterMode === 'current')}>
          Current ({currentJobsCount})
        </button>
        <button onClick={() => setFilterMode('history')} className={tabClass(filterMode === 'history')}>
          History ({completedTotal})
        </button>
        <button onClick={() => setFilterMode('all')} className={tabClass(filterMode === 'all')}>
          All ({totalJobs})
        </button>
      </div>

      {/* Additional Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div>
          <Combobox compact options={statusOptions} value={statusFilter} onChange={setStatusFilter} placeholder="All Status" />
        </div>
        <div>
          <Combobox compact options={typeOptions} value={typeFilter} onChange={setTypeFilter} placeholder="All Types" />
        </div>

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="px-2.5 py-1.5 bg-theme-surface border border-slate-300/60 rounded-xl text-xs text-theme shadow-sm"
        />
        <span className="text-theme-muted text-xs">-</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="px-2.5 py-1.5 bg-theme-surface border border-slate-300/60 rounded-xl text-xs text-theme shadow-sm"
        />

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="px-3 py-1.5 text-xs text-[var(--error)] hover:bg-[var(--error-bg)] rounded-xl transition-colors"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
};

export default FilterBar;
