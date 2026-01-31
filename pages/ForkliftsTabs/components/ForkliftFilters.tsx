import React from 'react';
import { Search, Filter } from 'lucide-react';
import { ForkliftType, ForkliftStatus } from '../../../types';

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
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 space-y-4">
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

        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-theme-muted" />
            <select
              className="px-3 py-2 bg-theme-surface border border-theme rounded-lg text-sm text-theme"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">All Types</option>
              {Object.values(ForkliftType).map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <select
            className="px-3 py-2 bg-theme-surface border border-theme rounded-lg text-sm text-theme"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Status</option>
            {Object.values(ForkliftStatus).map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <select
            className="px-3 py-2 bg-theme-surface border border-theme rounded-lg text-sm text-theme"
            value={filterAssigned}
            onChange={(e) => setFilterAssigned(e.target.value)}
          >
            <option value="all">All Rentals</option>
            <option value="assigned">Rented</option>
            <option value="unassigned">Available</option>
          </select>

          {uniqueMakes.length > 0 && (
            <select
              className="px-3 py-2 bg-theme-surface border border-theme rounded-lg text-sm text-theme"
              value={filterMake}
              onChange={(e) => setFilterMake(e.target.value)}
            >
              <option value="all">All Makes</option>
              {uniqueMakes.map((make) => (
                <option key={make} value={make}>
                  {make}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForkliftFilters;
