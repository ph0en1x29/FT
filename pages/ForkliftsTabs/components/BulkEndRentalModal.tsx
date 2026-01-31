import React from 'react';
import { X, CircleOff, Loader2 } from 'lucide-react';

interface BulkEndRentalModalProps {
  isOpen: boolean;
  onClose: () => void;
  count: number;
  endDate: string;
  setEndDate: (date: string) => void;
  onSubmit: () => void;
  isProcessing: boolean;
}

const BulkEndRentalModal: React.FC<BulkEndRentalModalProps> = ({
  isOpen,
  onClose,
  count,
  endDate,
  setEndDate,
  onSubmit,
  isProcessing,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <CircleOff className="w-5 h-5 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              End {count} Rental{count !== 1 ? 's' : ''}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            disabled={isProcessing}
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600">
            You are about to end {count} rental{count !== 1 ? 's' : ''}. This will make the
            forklift{count !== 1 ? 's' : ''} available for new rentals.
          </p>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              disabled={isProcessing}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg font-medium transition-colors"
            disabled={isProcessing}
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={isProcessing}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CircleOff className="w-4 h-4" />
                End Rental{count !== 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkEndRentalModal;
