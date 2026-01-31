import React from 'react';
import { FORKLIFT_TYPES } from '../constants';
import { getTypeIcon } from '../utils';

interface FilterTabsProps {
  selectedType: string;
  onSelectType: (type: string) => void;
}

const FilterTabs: React.FC<FilterTabsProps> = ({ selectedType, onSelectType }) => {
  return (
    <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
      <button
        onClick={() => onSelectType('all')}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
          selectedType === 'all'
            ? 'bg-indigo-600 text-white'
            : 'bg-theme-card text-theme-secondary hover:bg-theme-hover'
        }`}
      >
        All Types
      </button>
      {FORKLIFT_TYPES.map((type) => (
        <button
          key={type}
          onClick={() => onSelectType(type)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap flex items-center gap-2 ${
            selectedType === type
              ? 'bg-indigo-600 text-white'
              : 'bg-theme-card text-theme-secondary hover:bg-theme-hover'
          }`}
        >
          {getTypeIcon(type)}
          {type}
        </button>
      ))}
    </div>
  );
};

export default FilterTabs;
