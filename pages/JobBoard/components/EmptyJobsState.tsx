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
      <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-20" />
      <p className="mb-2">No jobs found.</p>
      {hasActiveFilters && (
        <button 
          onClick={onClearFilters}
          className="text-blue-600 hover:underline text-sm"
        >
          Clear filters to see all jobs
        </button>
      )}
    </div>
  );
};
