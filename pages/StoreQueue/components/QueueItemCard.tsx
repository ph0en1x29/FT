import { ExternalLink } from 'lucide-react';
import type { ComboboxOption } from '../../../components/Combobox';
import SwipeableRow from '../../../components/mobile/SwipeableRow';
import type { InlinePartRow, QueueItem } from '../types';
import { formatTimeAgo, getTypeColor, getTypeIcon, getTypeLabel } from '../utils';
import { ConfirmJobActions } from './ConfirmJobActions';
import { PartRequestInlineEditor } from './PartRequestInlineEditor';

interface QueueItemCardProps {
  item: QueueItem;
  isProcessing: boolean;
  inlineRows: InlinePartRow[];
  partOptions: ComboboxOption[];
  isSearching: boolean;
  onSearch: (query: string) => void;
  onUpdateInline: (requestId: string, index: number, updates: Partial<InlinePartRow>) => void;
  onAddInlineRow: (requestId: string) => void;
  onRemoveInlineRow: (requestId: string, index: number) => void;
  onApproveRequest: (item: QueueItem) => void;
  onConfirmJob: (item: QueueItem) => void;
  onRejectRequest: (item: QueueItem) => void;
  onRejectJob: (item: QueueItem) => void;
  onOpenJob: (jobId: string) => void;
}

export function QueueItemCard({
  item,
  isProcessing,
  inlineRows,
  partOptions,
  isSearching,
  onSearch,
  onUpdateInline,
  onAddInlineRow,
  onRemoveInlineRow,
  onApproveRequest,
  onConfirmJob,
  onRejectRequest,
  onRejectJob,
  onOpenJob,
}: QueueItemCardProps) {
  const Icon = getTypeIcon(item.type);
  const typeColor = getTypeColor(item.type);
  const [iconBg, iconText] = typeColor.split(' ');

  const handleSwipeApprove = () => {
    if (isProcessing) return;
    if (item.type === 'part_request') onApproveRequest(item);
    if (item.type === 'confirm_job') onConfirmJob(item);
  };

  const handleSwipeReject = () => {
    if (isProcessing) return;
    if (item.type === 'part_request') onRejectRequest(item);
    if (item.type === 'confirm_job') onRejectJob(item);
  };

  return (
    <div>
      <SwipeableRow
        onSwipeRight={handleSwipeApprove}
        onSwipeLeft={handleSwipeReject}
        rightLabel={item.type === 'confirm_job' ? 'Confirm' : 'Approve'}
        leftLabel="Reject"
        rightColor="bg-green-600"
        leftColor="bg-red-600"
      >
        <div className="rounded-xl border border-[var(--border-subtle)] p-3 bg-[var(--surface)] overflow-visible">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                <Icon className={`w-4 h-4 ${iconText}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${typeColor}`}>
                    {getTypeLabel(item.type)}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">{formatTimeAgo(item.createdAt)}</span>
                </div>
                <p className="font-medium text-sm text-[var(--text)] mt-1">
                  {item.type === 'part_request'
                    ? item.requestDescription
                    : item.jobTitle
                  }
                </p>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-[var(--text-muted)] flex-wrap">
                  {(item.type === 'part_request') && (
                    <>
                      <span>{item.requestedByName}</span>
                      <span>·</span>
                    </>
                  )}
                  <span>{item.jobTitle}</span>
                  {item.customerName && <><span>·</span><span>{item.customerName}</span></>}
                  {item.technicianName && <><span>·</span><span>{item.technicianName}</span></>}
                  {item.forkliftSerial && <><span>·</span><span>{item.forkliftSerial}</span></>}
                </div>
              </div>
            </div>
            <button
              onClick={() => onOpenJob(item.jobId)}
              className="p-1.5 hover:bg-[var(--bg-subtle)] rounded-lg transition flex-shrink-0"
              title="View job details"
            >
              <ExternalLink className="w-4 h-4 text-[var(--text-muted)]" />
            </button>
          </div>

          {item.type === 'part_request' && (
            <PartRequestInlineEditor
              item={item}
              rows={inlineRows}
              partOptions={partOptions}
              isSearching={isSearching}
              isProcessing={isProcessing}
              onSearch={onSearch}
              onUpdateInline={onUpdateInline}
              onAddInlineRow={onAddInlineRow}
              onRemoveInlineRow={onRemoveInlineRow}
              onApprove={onApproveRequest}
              onReject={onRejectRequest}
            />
          )}

          {item.type === 'confirm_job' && (
            <ConfirmJobActions
              item={item}
              isProcessing={isProcessing}
              onConfirm={onConfirmJob}
              onReject={onRejectJob}
            />
          )}
        </div>
      </SwipeableRow>
    </div>
  );
}
