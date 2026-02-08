import React from 'react';
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
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-theme-surface border border-theme rounded-lg text-sm text-theme"
        >
          <option value="all">All Status</option>
          <option value={JobStatus.NEW}>New</option>
          <option value={JobStatus.ASSIGNED}>Assigned</option>
          <option value={JobStatus.IN_PROGRESS}>In Progress</option>
          <option value={JobStatus.AWAITING_FINALIZATION}>Awaiting Finalization</option>
          <option value={JobStatus.COMPLETED}>Completed</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 bg-theme-surface border border-theme rounded-lg text-sm text-theme"
        >
          <option value="all">All Types</option>
          <option value={JobType.SERVICE}>Service</option>
          <option value={JobType.REPAIR}>Repair</option>
          <option value={JobType.CHECKING}>Checking</option>
          <option value={JobType.SLOT_IN}>Slot-In</option>
          <option value={JobType.COURIER}>Courier</option>
        </select>

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="px-3 py-2 bg-theme-surface border border-theme rounded-lg text-sm text-theme"
          placeholder="From"
        />
        <span className="text-theme-muted">-</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="px-3 py-2 bg-theme-surface border border-theme rounded-lg text-sm text-theme"
          placeholder="To"
        />

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="px-3 py-2 text-sm text-[var(--error)] hover:bg-[var(--error-bg)] rounded-lg transition-colors"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
};

export default FilterBar;
