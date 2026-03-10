import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmBatchDeleteModalProps {
  show: boolean;
  jobCount: number;
  deletionReason: string;
  onReasonChange: (reason: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isProcessing: boolean;
}

/**
 * Modal dialog for confirming batch deletion of jobs
 */
export const ConfirmBatchDeleteModal: React.FC<ConfirmBatchDeleteModalProps> = ({
  show,
  jobCount,
  deletionReason,
  onReasonChange,
  onConfirm,
  onCancel,
  isProcessing,
}) => {
  if (!show) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" 
      onClick={onCancel}
    >
      <div 
        className="bg-[var(--surface)] rounded-xl shadow-xl p-6 w-full max-w-md mx-4" 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold text-slate-800">
              Delete {jobCount} {jobCount === 1 ? 'Job' : 'Jobs'}?
            </h3>
            <p className="text-sm text-slate-600 mt-1">
              This action can be undone from the Deleted Jobs section within 30 days.
            </p>
          </div>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Reason for deletion (optional)
          </label>
          <textarea
            value={deletionReason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="Enter reason for deleting these jobs..."
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
            rows={3}
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isProcessing}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
          >
            {isProcessing ? 'Deleting...' : 'Delete Jobs'}
          </button>
        </div>
      </div>
    </div>
  );
};
