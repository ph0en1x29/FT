import React from 'react';

interface RejectJobModalProps {
  show: boolean;
  rejectReason: string;
  onReasonChange: (reason: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isProcessing: boolean;
}

/**
 * Modal dialog for rejecting a job assignment with reason
 */
export const RejectJobModal: React.FC<RejectJobModalProps> = ({
  show,
  rejectReason,
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
        className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4" 
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-slate-800 mb-4">
          Reject Job Assignment
        </h3>
        <p className="text-sm text-slate-600 mb-4">
          Please provide a reason for rejecting this job. Admin will be notified and can reassign it.
        </p>
        <textarea
          value={rejectReason}
          onChange={(e) => onReasonChange(e.target.value)}
          placeholder="Enter reason for rejection..."
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
          rows={3}
          autoFocus
        />
        <div className="flex gap-3 mt-4">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!rejectReason.trim() || isProcessing}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
          >
            {isProcessing ? 'Rejecting...' : 'Reject Job'}
          </button>
        </div>
      </div>
    </div>
  );
};
