import { AlertTriangle, X } from 'lucide-react';
import React from 'react';

interface ConfirmBatchDeleteModalProps {
  count: number;
  show: boolean;
  isProcessing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmBatchDeleteModal: React.FC<ConfirmBatchDeleteModalProps> = ({
  count,
  show,
  isProcessing,
  onConfirm,
  onCancel,
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Delete {count} job{count !== 1 ? 's' : ''}?
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              This action can be undone from the Deleted Jobs section.
            </p>
          </div>
          <button onClick={onCancel} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isProcessing}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition disabled:opacity-50"
          >
            {isProcessing ? 'Deleting...' : `Delete ${count} Job${count !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
};
