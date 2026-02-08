import { X } from 'lucide-react';
import { RejectionModalProps } from '../types';

export function RejectionModal({
  isOpen,
  rejectionType,
  rejectionReason,
  processing,
  onReasonChange,
  onClose,
  onReject,
}: RejectionModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--surface)] rounded-xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-theme">
            Reject {rejectionType === 'parts' ? 'Parts' : 'Job'} Confirmation
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[var(--bg-subtle)] rounded-lg"
          >
            <X className="w-5 h-5 text-theme-muted" />
          </button>
        </div>

        <p className="text-sm text-theme-muted mb-4">
          Please provide a reason for rejection. The technician will be notified.
        </p>

        <textarea
          value={rejectionReason}
          onChange={(e) => onReasonChange(e.target.value)}
          placeholder="Enter rejection reason..."
          className="w-full p-3 border border-theme rounded-lg bg-theme-surface text-theme resize-none h-24"
        />

        <div className="flex gap-3 mt-4">
          <button
            onClick={onClose}
            className="flex-1 btn-premium btn-premium-secondary"
          >
            Cancel
          </button>
          <button
            onClick={onReject}
            disabled={processing || !rejectionReason.trim()}
            className="flex-1 btn-premium bg-red-600 hover:bg-red-700 text-white border-red-600"
          >
            {processing ? 'Rejecting...' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  );
}
