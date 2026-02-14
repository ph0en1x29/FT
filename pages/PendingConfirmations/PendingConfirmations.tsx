import { CheckCircle, CheckSquare, Square, X, XCircle } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SkeletonJobList, SkeletonStats } from '../../components/Skeleton';
import { Job, JobStatus } from '../../types';
import {
  EmptyState,
  Header,
  JobCard,
  RejectionModal,
  SummaryCards,
  Tabs,
  getHoursPending,
} from './components';
import { usePendingConfirmations } from './hooks/usePendingConfirmations';
import { PendingConfirmationsProps } from './types';

export default function PendingConfirmations({ currentUser, hideHeader = false }: PendingConfirmationsProps) {
  const navigate = useNavigate();

  const {
    jobs,
    loading,
    activeTab,
    processing,
    canConfirm,
    showRejectModal,
    rejectionReason,
    rejectionType,
    jobsPendingPartsConfirmation,
    jobsPendingJobConfirmation,
    setActiveTab,
    setRejectionReason,
    loadJobs,
    handleConfirmParts,
    handleConfirmJob,
    handleSkipPartsConfirmation,
    openRejectModal,
    handleReject,
    closeRejectModal,
  } = usePendingConfirmations(currentUser);

  const currentJobs = activeTab === 'parts' ? jobsPendingPartsConfirmation : jobsPendingJobConfirmation;

  // Multi-select state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const toggleSelect = (jobId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(currentJobs.map(j => j.job_id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectMode(false);
  };

  const handleBulkConfirm = async () => {
    if (selectedIds.size === 0 || bulkProcessing) return;
    setBulkProcessing(true);
    const selected = currentJobs.filter(j => selectedIds.has(j.job_id));
    for (const job of selected) {
      try {
        if (activeTab === 'parts') {
          await handleConfirmParts(job.job_id);
        } else {
          await handleConfirmJob(job.job_id);
        }
      } catch {
        // Individual errors handled by the hook's toast
      }
    }
    setBulkProcessing(false);
    clearSelection();
  };

  const handleBulkReject = () => {
    // Open reject modal for first selected job — rejection applies to all
    if (selectedIds.size === 0) return;
    const firstId = Array.from(selectedIds)[0];
    openRejectModal(firstId, activeTab === 'parts' ? 'parts' : 'job');
  };

  // Calculate overdue count
  const overdueCount = [...jobsPendingPartsConfirmation, ...jobsPendingJobConfirmation]
    .filter(j => getHoursPending(j) >= 24).length;

  // Count confirmed today
  const confirmedToday = jobs.filter(j => j.status === JobStatus.COMPLETED).length;

  // Reset selection when switching tabs
  const handleTabChange = (tab: 'parts' | 'jobs') => {
    setActiveTab(tab);
    setSelectedIds(new Set());
    setSelectMode(false);
  };

  if (loading) {
    return (
      <div className="space-y-6 fade-in">
        <SkeletonStats count={3} />
        <SkeletonJobList count={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      {!hideHeader && (
        <Header loading={loading} onRefresh={loadJobs} />
      )}

      {/* Tabs */}
      <Tabs
        activeTab={activeTab}
        onTabChange={handleTabChange}
        partsCount={jobsPendingPartsConfirmation.length}
        jobsCount={jobsPendingJobConfirmation.length}
      />

      {/* Summary Cards */}
      <SummaryCards
        partsPending={jobsPendingPartsConfirmation.length}
        jobsPending={jobsPendingJobConfirmation.length}
        overdueCount={overdueCount}
        confirmedToday={confirmedToday}
      />

      {/* Multi-select toolbar */}
      {canConfirm && currentJobs.length > 0 && (
        <div className="flex items-center justify-end gap-3">
          {!selectMode ? (
            <button
              onClick={() => setSelectMode(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
            >
              <CheckSquare className="w-4 h-4" />
              Select
            </button>
          ) : (
            <>
              {/* Bulk actions (left) */}
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2 mr-auto">
                  <span className="text-sm text-blue-600 font-semibold">{selectedIds.size} selected</span>
                  <button
                    onClick={handleBulkConfirm}
                    disabled={bulkProcessing}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    {bulkProcessing ? 'Processing...' : `Confirm All (${selectedIds.size})`}
                  </button>
                  <button
                    onClick={handleBulkReject}
                    disabled={bulkProcessing}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Reject
                  </button>
                </div>
              )}
              <button
                onClick={selectAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-theme-muted hover:text-theme hover:bg-theme-surface-2 rounded-lg transition-colors"
              >
                <Square className="w-4 h-4" />
                All
              </button>
              <button
                onClick={clearSelection}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </>
          )}
        </div>
      )}

      {/* Job List */}
      {currentJobs.length === 0 ? (
        <EmptyState activeTab={activeTab} />
      ) : (
        <div className="space-y-4">
          {currentJobs.map(job => (
            <div
              key={job.job_id}
              className={`relative ${selectMode ? 'cursor-pointer' : ''} ${
                selectedIds.has(job.job_id) ? 'ring-2 ring-blue-500 ring-offset-2 rounded-xl' : ''
              }`}
              onClick={selectMode ? () => toggleSelect(job.job_id) : undefined}
            >
              {/* Checkbox overlay in select mode */}
              {selectMode && (
                <div className="absolute top-3 left-3 z-10">
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    selectedIds.has(job.job_id) ? 'bg-blue-500 border-blue-500' : 'border-gray-300 bg-white hover:border-blue-400'
                  }`}>
                    {selectedIds.has(job.job_id) && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
              )}
              <JobCard
                job={job}
                activeTab={activeTab}
                processing={processing}
                canConfirm={canConfirm && !selectMode}
                onConfirmParts={handleConfirmParts}
                onConfirmJob={handleConfirmJob}
                onSkipParts={handleSkipPartsConfirmation}
                onReject={openRejectModal}
                onNavigate={(jobId) => navigate(`/jobs/${jobId}`)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Rejection Modal */}
      <RejectionModal
        isOpen={showRejectModal}
        rejectionType={rejectionType}
        rejectionReason={rejectionReason}
        processing={processing}
        onReasonChange={setRejectionReason}
        onClose={closeRejectModal}
        onReject={handleReject}
      />
    </div>
  );
}
