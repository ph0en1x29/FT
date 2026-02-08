import { Plus,Settings } from 'lucide-react';
import React from 'react';

interface ServiceIntervalsHeaderProps {
  onAddClick: () => void;
}

const ServiceIntervalsHeader: React.FC<ServiceIntervalsHeaderProps> = ({ onAddClick }) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold text-theme-primary flex items-center gap-2">
          <Settings className="w-7 h-7 text-indigo-500" />
          Service Intervals Config
        </h1>
        <p className="text-theme-secondary text-sm mt-1">
          Configure service intervals by forklift type. Changes affect prediction calculations.
        </p>
      </div>
      <button
        onClick={onAddClick}
        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition font-medium"
      >
        <Plus className="w-4 h-4" />
        Add Interval
      </button>
    </div>
  );
};

export default ServiceIntervalsHeader;
