/**
 * StoreQueue - Unified inbox for Store Admin
 * Replaces PendingConfirmations + Part Requests tab.
 * Single prioritized list: part requests -> issue -> parts confirmation -> job confirmation
 */
import { RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { SkeletonJobList } from '../../components/Skeleton';
import { PendingReturnsSection } from './components/PendingReturnsSection';
import { StoreQueueEmptyState } from './components/StoreQueueEmptyState';
import { StoreQueueFilters } from './components/StoreQueueFilters';
import { StoreQueueGroupCard } from './components/StoreQueueGroupCard';
import { StoreQueueRejectModal } from './components/StoreQueueRejectModal';
import { StoreQueueSearch } from './components/StoreQueueSearch';
import { useStoreQueueController } from './hooks/useStoreQueueController';
import type { FilterType, StoreQueuePageProps } from './types';

export default function StoreQueuePage({ currentUser, hideHeader = false }: StoreQueuePageProps) {
  const navigate = useNavigate();
  const queue = useStoreQueueController(currentUser);
  const filters: { id: FilterType; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: queue.counts.all },
    { id: 'part_request', label: 'Requests', count: queue.counts.part_request },
    { id: 'confirm_job', label: 'Confirm Jobs', count: queue.counts.confirm_job },
  ];

  return (
    <div className="space-y-3 md:space-y-4 pb-24 md:pb-8">
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg md:text-xl font-bold text-[var(--text)]">Store Queue</h1>
            <p className="text-xs md:text-sm text-[var(--text-muted)]">
              {queue.counts.all} item{queue.counts.all !== 1 ? 's' : ''} need attention
            </p>
          </div>
          <button onClick={queue.loadQueue} className="p-2 hover:bg-[var(--bg-subtle)] rounded-lg transition">
            <RefreshCw className={`w-5 h-5 text-[var(--text-muted)] ${queue.loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      )}

      <PendingReturnsSection />
      <StoreQueueFilters filters={filters} activeFilter={queue.filter} onChange={queue.setFilter} />
      <StoreQueueSearch value={queue.searchQuery} onChange={queue.setSearchQuery} />

      {queue.loading ? (
        <SkeletonJobList count={4} />
      ) : queue.groupedQueue.length === 0 ? (
        <StoreQueueEmptyState filter={queue.filter} filters={filters} />
      ) : (
        <div className="space-y-3">
          {queue.groupedQueue.map(group => (
            <StoreQueueGroupCard
              key={group.jobId}
              group={group}
              isExpanded={queue.expandedJobs.has(group.jobId)}
              isGroupProcessing={group.items.some(item => queue.processing.has(item.id))}
              processing={queue.processing}
              inlineState={queue.inlineState}
              partOptions={queue.partOptions}
              isSearching={queue.isSearching}
              onSearch={queue.search}
              onToggleJob={queue.toggleJob}
              onApproveAllForJob={queue.handleApproveAllForJob}
              onOpenJob={(jobId) => navigate(`/jobs/${jobId}`)}
              onUpdateInline={queue.updateInline}
              onAddInlineRow={queue.addInlineRow}
              onRemoveInlineRow={queue.removeInlineRow}
              onApproveRequest={queue.handleApproveRequest}
              onConfirmJob={queue.handleConfirmJob}
              onRejectRequest={(item) => queue.openReject('request', item.id)}
              onRejectJob={(item) => queue.openReject('job', item.id)}
            />
          ))}
        </div>
      )}

      <StoreQueueRejectModal
        rejectingId={queue.rejectingId}
        rejectType={queue.rejectType}
        rejectReason={queue.rejectReason}
        isProcessing={queue.rejectingId ? queue.processing.has(queue.rejectingId) : false}
        onReasonChange={queue.setRejectReason}
        onCancel={() => queue.setRejectingId(null)}
        onReject={queue.handleReject}
      />
    </div>
  );
}
