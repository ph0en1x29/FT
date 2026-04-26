import { XCircle } from 'lucide-react';

interface StoreQueueRejectModalProps {
  rejectingId: string | null;
  rejectType: 'request' | 'parts' | 'job';
  rejectReason: string;
  isProcessing: boolean;
  onReasonChange: (reason: string) => void;
  onCancel: () => void;
  onReject: () => void;
}

export function StoreQueueRejectModal({
  rejectingId,
  rejectType,
  rejectReason,
  isProcessing,
  onReasonChange,
  onCancel,
  onReject,
}: StoreQueueRejectModalProps) {
  if (!rejectingId) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onCancel}>
      <div className="bg-[var(--surface)] rounded-t-2xl sm:rounded-2xl p-5 w-full sm:max-w-sm shadow-xl" onClick={e => e.stopPropagation()}>
        <h4 className="font-semibold text-[var(--text)] mb-3 flex items-center gap-2">
          <XCircle className="w-5 h-5 text-red-500" />
          Reject {rejectType === 'request' ? 'Request' : rejectType === 'parts' ? 'Parts' : 'Job'}
        </h4>
        <textarea
          value={rejectReason}
          onChange={e => onReasonChange(e.target.value)}
          className="input-premium w-full h-24 resize-none mb-3"
          placeholder="Reason for rejection..."
          autoFocus
        />
        <div className="flex gap-2">
          <button onClick={onCancel} className="btn-premium btn-premium-ghost flex-1">Cancel</button>
          <button
            onClick={onReject}
            disabled={!rejectReason.trim() || isProcessing}
            className="btn-premium bg-[var(--error)] text-white hover:opacity-90 flex-1 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}
