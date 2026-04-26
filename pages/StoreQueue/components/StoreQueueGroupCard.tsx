import { Check, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import type { ComboboxOption } from '../../../components/Combobox';
import type { InlinePartRow, JobGroup, QueueItem } from '../types';
import { formatTimeAgo } from '../utils';
import { QueueItemCard } from './QueueItemCard';
import { StoreQueueSpinner } from './StoreQueueSpinner';

interface StoreQueueGroupCardProps {
  group: JobGroup;
  isExpanded: boolean;
  isGroupProcessing: boolean;
  processing: Set<string>;
  inlineState: Record<string, InlinePartRow[]>;
  partOptions: ComboboxOption[];
  isSearching: boolean;
  onSearch: (query: string) => void;
  onToggleJob: (jobId: string) => void;
  onApproveAllForJob: (group: JobGroup) => void;
  onOpenJob: (jobId: string) => void;
  onUpdateInline: (requestId: string, index: number, updates: Partial<InlinePartRow>) => void;
  onAddInlineRow: (requestId: string) => void;
  onRemoveInlineRow: (requestId: string, index: number) => void;
  onApproveRequest: (item: QueueItem) => void;
  onConfirmJob: (item: QueueItem) => void;
  onRejectRequest: (item: QueueItem) => void;
  onRejectJob: (item: QueueItem) => void;
}

export function StoreQueueGroupCard({
  group,
  isExpanded,
  isGroupProcessing,
  processing,
  inlineState,
  partOptions,
  isSearching,
  onSearch,
  onToggleJob,
  onApproveAllForJob,
  onOpenJob,
  onUpdateInline,
  onAddInlineRow,
  onRemoveInlineRow,
  onApproveRequest,
  onConfirmJob,
  onRejectRequest,
  onRejectJob,
}: StoreQueueGroupCardProps) {
  return (
    <div className="card-theme rounded-xl p-4 overflow-visible">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => onToggleJob(group.jobId)}
          className="flex items-start gap-3 flex-1 min-w-0 text-left"
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-[var(--bg-subtle)] text-[var(--text-muted)]">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm text-[var(--text)] truncate">{group.jobTitle || 'Unknown Job'}</p>
              <span className="px-2 py-0.5 text-xs font-medium rounded-full border border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--text-muted)]">
                {group.items.length} item{group.items.length === 1 ? '' : 's'}
              </span>
              <span className="text-xs text-[var(--text-muted)]">{formatTimeAgo(group.oldestCreatedAt)}</span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-[var(--text-muted)] flex-wrap">
              {group.customerName && <span>{group.customerName}</span>}
              {group.customerName && group.technicianName && <span>·</span>}
              {group.technicianName && <span>{group.technicianName}</span>}
            </div>
          </div>
        </button>

        <div className="flex items-center gap-2 flex-shrink-0">
          {group.canShowApproveAll && (
            <button
              onClick={() => onApproveAllForJob(group)}
              disabled={isGroupProcessing}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition"
            >
              {isGroupProcessing ? <StoreQueueSpinner /> : <Check className="w-3.5 h-3.5" />}
              Approve All
            </button>
          )}
          <button
            onClick={() => onOpenJob(group.jobId)}
            className="p-1.5 hover:bg-[var(--bg-subtle)] rounded-lg transition"
            title="View job details"
          >
            <ExternalLink className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
          <button
            type="button"
            onClick={() => onToggleJob(group.jobId)}
            className="p-1.5 hover:bg-[var(--bg-subtle)] rounded-lg transition"
            aria-label={isExpanded ? 'Collapse job items' : 'Expand job items'}
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-[var(--text-muted)]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
            )}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] space-y-3 overflow-visible">
          {group.items.map(item => (
            <QueueItemCard
              key={item.id}
              item={item}
              isProcessing={processing.has(item.id)}
              inlineRows={item.requestId ? inlineState[item.requestId] || [{ partId: '', quantity: '1' }] : []}
              partOptions={partOptions}
              isSearching={isSearching}
              onSearch={onSearch}
              onUpdateInline={onUpdateInline}
              onAddInlineRow={onAddInlineRow}
              onRemoveInlineRow={onRemoveInlineRow}
              onApproveRequest={onApproveRequest}
              onConfirmJob={onConfirmJob}
              onRejectRequest={onRejectRequest}
              onRejectJob={onRejectJob}
              onOpenJob={onOpenJob}
            />
          ))}
        </div>
      )}
    </div>
  );
}
