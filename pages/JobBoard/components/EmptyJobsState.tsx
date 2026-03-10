import { Briefcase } from 'lucide-react';
import React from 'react';

interface EmptyJobsStateProps {
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

/**
 * Empty state displayed when no jobs match the current filters
 */
export const EmptyJobsState: React.FC<EmptyJobsStateProps> = ({
  hasActiveFilters,
  onClearFilters,
}) => {
  return (
    <div className="col-span-full text-center py-12 text-theme-muted">
      <Briefcase className="w-10 h-10 mx-auto mb-2 opacity-15" />
      <p className="text-sm">No jobs</p>
      {hasActiveFilters && (
        <button 
          onClick={onClearFilters}
          className="mt-2 text-blue-600 hover:underline text-xs"
        >
          Clear filters
        </button>
      )}
    </div>
  );
};
