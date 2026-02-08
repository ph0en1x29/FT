import { Briefcase } from 'lucide-react';
import React from 'react';
import { FilterMode } from '../hooks/useJobFilters';

interface EmptyStateProps {
  filterMode: FilterMode;
}

const EmptyState: React.FC<EmptyStateProps> = ({ filterMode }) => {
  const getMessage = () => {
    switch (filterMode) {
      case 'current':
        return 'No active jobs assigned';
      case 'history':
        return 'No completed jobs yet';
      default:
        return 'No jobs match the current filters';
    }
  };

  return (
    <div className="card-theme rounded-xl p-12 text-center">
      <Briefcase className="w-12 h-12 text-theme-muted opacity-40 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-theme-secondary mb-2">No jobs found</h3>
      <p className="text-sm text-theme-muted">{getMessage()}</p>
    </div>
  );
};

export default EmptyState;
