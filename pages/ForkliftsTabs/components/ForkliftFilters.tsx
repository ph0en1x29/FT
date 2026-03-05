import { Filter,Search } from 'lucide-react';
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
    <div className="bg-[var(--surface)] rounded-xl shadow-sm p-4 space-y-4">
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by S/N, make, model, location, customer..."
            className="w-full pl-10 pr-4 py-2.5 bg-theme-surface border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-theme placeholder-slate-400"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <Filter className="w-4 h-4 text-theme-muted hidden lg:block" />
          <div className="w-36">
            <Combobox options={typeOptions} value={filterType} onChange={setFilterType} placeholder="All Types" />
          </div>
          <div className="w-36">
            <Combobox options={statusOptions} value={filterStatus} onChange={setFilterStatus} placeholder="All Status" />
          </div>
          <div className="w-36">
            <Combobox options={rentalOptions} value={filterAssigned} onChange={setFilterAssigned} placeholder="All Rentals" />
          </div>
          {uniqueMakes.length > 0 && (
            <div className="w-36">
              <Combobox options={makeOptions} value={filterMake} onChange={setFilterMake} placeholder="All Makes" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForkliftFilters;
