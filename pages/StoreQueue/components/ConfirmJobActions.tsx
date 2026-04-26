import { CheckCircle, XCircle } from 'lucide-react';
import type { QueueItem } from '../types';
import { formatTimeAgo } from '../utils';
import { StoreQueueSpinner } from './StoreQueueSpinner';

interface ConfirmJobActionsProps {
  item: QueueItem;
  isProcessing: boolean;
  onConfirm: (item: QueueItem) => void;
  onReject: (item: QueueItem) => void;
}

export function ConfirmJobActions({ item, isProcessing, onConfirm, onReject }: ConfirmJobActionsProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-3 pt-3 border-t border-[var(--border-subtle)]">
      <div className="flex items-center gap-3 text-sm">
        {item.completedAt && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            (Date.now() - new Date(item.completedAt).getTime()) > 86400000
              ? 'bg-red-100 text-red-600'
              : 'bg-[var(--bg-subtle)] text-[var(--text-muted)]'
          }`}>
            Completed {formatTimeAgo(item.completedAt)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <button
          onClick={() => onConfirm(item)}
          disabled={isProcessing}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 h-12 sm:h-auto text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition flex-1 sm:flex-none"
        >
          {isProcessing ? <StoreQueueSpinner /> : <CheckCircle className="w-3.5 h-3.5" />}
          Confirm Job
        </button>
        <button
          onClick={() => onReject(item)}
          disabled={isProcessing}
          className="p-2.5 h-12 sm:h-auto min-w-[44px] text-red-500 hover:bg-red-50 rounded-lg transition flex items-center justify-center"
        >
          <XCircle className="w-5 h-5 sm:w-4 sm:h-4" />
        </button>
      </div>
    </div>
  );
}
