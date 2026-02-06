import React from 'react';
import { useNavigate } from 'react-router-dom';
import { JobStatus } from '../../types';
import { usePendingConfirmations } from './hooks/usePendingConfirmations';
import {
  Header,
  Tabs,
  SummaryCards,
  JobCard,
  EmptyState,
  RejectionModal,
  getHoursPending,
} from './components';
import { PendingConfirmationsProps } from './types';
import { SkeletonJobList, SkeletonStats } from '../../components/Skeleton';

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

  // Calculate overdue count
  const overdueCount = [...jobsPendingPartsConfirmation, ...jobsPendingJobConfirmation]
    .filter(j => getHoursPending(j) >= 24).length;

  // Count confirmed today
  const confirmedToday = jobs.filter(j => j.status === JobStatus.COMPLETED).length;

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
        onTabChange={setActiveTab}
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

      {/* Job List */}
      {currentJobs.length === 0 ? (
        <EmptyState activeTab={activeTab} />
      ) : (
        <div className="space-y-4">
          {currentJobs.map(job => (
            <JobCard
              key={job.job_id}
              job={job}
              activeTab={activeTab}
              processing={processing}
              canConfirm={canConfirm}
              onConfirmParts={handleConfirmParts}
              onConfirmJob={handleConfirmJob}
              onSkipParts={handleSkipPartsConfirmation}
              onReject={openRejectModal}
              onNavigate={(jobId) => navigate(`/jobs/${jobId}`)}
            />
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
