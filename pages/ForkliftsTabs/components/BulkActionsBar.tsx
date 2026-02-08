import { Building2,CircleOff } from 'lucide-react';
import React from 'react';

interface BulkActionsBarProps {
  totalCount: number;
  selectedCount: number;
  availableCount: number;
  rentedCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBulkRent: () => void;
  onBulkEndRental: () => void;
}

const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
  totalCount,
  selectedCount,
  availableCount,
  rentedCount,
  onSelectAll,
  onDeselectAll,
  onBulkRent,
  onBulkEndRental,
}) => {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onSelectAll}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Select All ({totalCount})
          </button>
          <span className="text-slate-300">|</span>
          <button
            onClick={onDeselectAll}
            className="text-sm text-slate-600 hover:text-slate-800 font-medium"
          >
            Deselect All
          </button>
        </div>

        {selectedCount > 0 && (
          <div className="flex flex-wrap gap-2">
            <div className="text-sm text-slate-600 mr-2 self-center">
              <span className="font-medium">{availableCount}</span> available,
              <span className="font-medium ml-1">{rentedCount}</span> rented
            </div>

            {availableCount > 0 && (
              <button
                onClick={onBulkRent}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium shadow-sm"
              >
                <Building2 className="w-4 h-4" /> Rent Out ({availableCount})
              </button>
            )}

            {rentedCount > 0 && (
              <button
                onClick={onBulkEndRental}
                className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm font-medium shadow-sm"
              >
                <CircleOff className="w-4 h-4" /> End Rental ({rentedCount})
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BulkActionsBar;
