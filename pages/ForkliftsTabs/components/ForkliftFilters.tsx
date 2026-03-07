import { Filter, Search, X } from 'lucide-react';
import React, { useMemo } from 'react';
import { Combobox, ComboboxOption } from '../../../components/Combobox';
import { ForkliftStatus,ForkliftType } from '../../../types';

interface ForkliftFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filterType: string;
  setFilterType: (type: string) => void;
  filterStatus: string;
  setFilterStatus: (status: string) => void;
  filterAssigned: string;
  setFilterAssigned: (assigned: string) => void;
  filterMake: string;
  setFilterMake: (make: string) => void;
  uniqueMakes: string[];
  filteredCount: number;
  totalCount: number;
  hasFilters: boolean;
  onClearFilters: () => void;
}

const ForkliftFilters: React.FC<ForkliftFiltersProps> = ({
  searchQuery,
  setSearchQuery,
  filterType,
  setFilterType,
  filterStatus,
  setFilterStatus,
  filterAssigned,
  setFilterAssigned,
  filterMake,
  setFilterMake,
  uniqueMakes,
  filteredCount,
  totalCount,
  hasFilters,
  onClearFilters,
}) => {
  const typeOptions: ComboboxOption[] = useMemo(() => [
    { id: 'all', label: 'All Types' },
    ...Object.values(ForkliftType).map(t => ({ id: t, label: t })),
  ], []);

  const statusOptions: ComboboxOption[] = useMemo(() => [
    { id: 'all', label: 'All Status' },
    ...Object.values(ForkliftStatus).map(s => ({ id: s, label: s })),
  ], []);

  const rentalOptions: ComboboxOption[] = useMemo(() => [
    { id: 'all', label: 'All Rentals' },
    { id: 'assigned', label: 'Rented' },
    { id: 'unassigned', label: 'Available' },
  ], []);

  const makeOptions: ComboboxOption[] = useMemo(() => [
    { id: 'all', label: 'All Makes' },
    ...uniqueMakes.map(m => ({ id: m, label: m })),
  ], [uniqueMakes]);

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
            <Filter className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-theme">Filter Fleet</h3>
            <p className="text-xs text-theme-muted">Showing {filteredCount} of {totalCount} units</p>
          </div>
        </div>
        {hasFilters && (
          <button
            onClick={onClearFilters}
            className="inline-flex items-center gap-1.5 self-start rounded-xl border border-red-200 px-3 py-2 text-xs font-medium text-red-500 transition hover:bg-red-50"
          >
            <X className="w-3 h-3" />
            Clear Filters
          </button>
        )}
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by S/N, make, model, location, customer..."
            className="w-full pl-9 pr-4 py-3 bg-theme-surface border border-theme rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-theme placeholder-slate-400"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:flex lg:gap-2 lg:shrink-0">
          <Combobox compact options={typeOptions} value={filterType} onChange={setFilterType} placeholder="All Types" />
          <Combobox compact options={statusOptions} value={filterStatus} onChange={setFilterStatus} placeholder="All Status" />
          <Combobox compact options={rentalOptions} value={filterAssigned} onChange={setFilterAssigned} placeholder="All Rentals" />
          {uniqueMakes.length > 0 ? (
            <Combobox compact options={makeOptions} value={filterMake} onChange={setFilterMake} placeholder="All Makes" />
          ) : <div className="hidden lg:block" />}
        </div>
      </div>
    </div>
  );
};

export default ForkliftFilters;
