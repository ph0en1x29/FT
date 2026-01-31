import React from 'react';
import { Search } from 'lucide-react';
import { OperationalStatus } from '../types';
import { STATUS_CONFIG } from '../constants';

interface SearchBarProps {
  searchQuery: string;
  activeFilter: OperationalStatus | 'all';
  onSearchChange: (query: string) => void;
  onClearFilter: () => void;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  searchQuery,
  activeFilter,
  onSearchChange,
  onClearFilter
}) => {
  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by S/N, make, model, customer..."
          className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {activeFilter !== 'all' && (
        <button
          onClick={onClearFilter}
          className="flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg"
        >
          Clear filter
        </button>
      )}
    </div>
  );
};

interface ResultsCountProps {
  displayedCount: number;
  filteredCount: number;
  activeFilter: OperationalStatus | 'all';
}

export const ResultsCount: React.FC<ResultsCountProps> = ({
  displayedCount,
  filteredCount,
  activeFilter
}) => {
  return (
    <p className="text-sm text-slate-500">
      Showing {displayedCount} of {filteredCount} units
      {activeFilter !== 'all' && ` • Filtered by: ${STATUS_CONFIG[activeFilter].label}`}
    </p>
  );
};
