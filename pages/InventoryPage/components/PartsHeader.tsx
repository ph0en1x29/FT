import { Download,Plus } from 'lucide-react';
import React from 'react';

interface PartsHeaderProps {
  filteredCount: number;
  totalCount: number;
  isAdmin: boolean;
  onExport: () => void;
  onAddNew: () => void;
}

const PartsHeader: React.FC<PartsHeaderProps> = ({
  filteredCount,
  totalCount,
  isAdmin,
  onExport,
  onAddNew,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <p className="text-sm text-theme-muted">
        {filteredCount} of {totalCount} items
      </p>
      <div className="flex gap-2 w-full sm:w-auto">
        <button
          onClick={onExport}
          className="flex items-center justify-center gap-2 px-4 py-2 h-10 md:h-auto border border-theme rounded-lg hover:bg-theme-surface-2 text-sm text-theme-muted theme-transition flex-1 sm:flex-none"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
        {isAdmin && (
          <button
            onClick={onAddNew}
            className="flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 h-10 md:h-auto rounded-lg hover:bg-blue-700 shadow-sm font-medium flex-1 sm:flex-none"
          >
            <Plus className="w-4 h-4" /> Add Part
          </button>
        )}
      </div>
    </div>
  );
};

export default PartsHeader;
