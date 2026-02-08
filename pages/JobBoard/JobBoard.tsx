import React,{ useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDevModeContext } from '../../contexts/DevModeContext';
import { UserRole } from '../../types';
import {
DeletedJobsSection,
EmptyJobsState,
JobCard,
LoadingState,
QuickStats,
RejectJobModal,
SearchFilterBar,SlotInAlertBanner,SpecialFilterBanner,
} from './components';
import { useJobAcceptance,useJobData,useJobFilters } from './hooks';
import { JobBoardProps } from './types';

/** Job Board - Main view for listing, filtering, and managing jobs */
const JobBoard: React.FC<JobBoardProps> = ({ currentUser, hideHeader = false }) => {
  const navigate = useNavigate();
  const { displayRole, hasPermission } = useDevModeContext();
  
  // State for deleted jobs section visibility
  const [showDeletedSection, setShowDeletedSection] = useState(false);

  // Derived state
  const isTechnician = displayRole === UserRole.TECHNICIAN;

  // Data fetching and real-time updates
  const {
    jobs,
    loading,
    deletedJobs,
    canViewDeleted,
    fetchJobs,
  } = useJobData({ currentUser, displayRole });

  // Filtering and search
  const {
    searchQuery,
    setSearchQuery,
    dateFilter,
    setDateFilter,
    statusFilter,
    setStatusFilter,
    specialFilter,
    setSpecialFilter: _setSpecialFilter,
    customDateFrom,
    setCustomDateFrom,
    customDateTo,
    setCustomDateTo,
    showFilters,
    setShowFilters,
    filteredJobs,
    statusCounts,
    hasActiveFilters,
    clearFilters,
  } = useJobFilters({ jobs });

  // Job acceptance/rejection for technicians
  const {
    processingJobId,
    showRejectModal,
    rejectReason,
    setRejectReason,
    handleAcceptJob,
    handleOpenRejectModal,
    handleRejectJob,
    closeRejectModal,
    jobNeedsAcceptance,
    getResponseTimeRemaining,
  } = useJobAcceptance({ currentUser, onJobUpdated: fetchJobs });

  // Handler for viewing all Slot-In jobs
  const handleViewAllSlotIn = () => {
    setSearchQuery('');
    setDateFilter('all');
    setStatusFilter('all');
  };

  return (
    <div className="space-y-6">
      {!hideHeader && (
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-theme">
            {displayRole === UserRole.TECHNICIAN ? 'My Jobs' : 'Job Board'}
          </h1>
          {hasPermission('canCreateJobs') && (
            <button onClick={() => navigate('/jobs/new')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition">
              + New Job
            </button>
          )}
        </div>
      )}

      <QuickStats
        statusCounts={statusCounts}
        statusFilter={statusFilter}
        dateFilter={dateFilter}
        onStatusFilterChange={setStatusFilter}
        onDateFilterChange={setDateFilter}
      />

      <SlotInAlertBanner
        count={statusCounts.slotInPendingAck}
        onViewAll={handleViewAllSlotIn}
      />

      <SearchFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        dateFilter={dateFilter}
        onDateFilterChange={setDateFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        customDateFrom={customDateFrom}
        onCustomDateFromChange={setCustomDateFrom}
        customDateTo={customDateTo}
        onCustomDateToChange={setCustomDateTo}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
        totalJobs={jobs.length}
        filteredCount={filteredJobs.length}
      />

      <SpecialFilterBanner
        specialFilter={specialFilter}
        filteredCount={filteredJobs.length}
        onClear={clearFilters}
      />

      {loading ? (
        <LoadingState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredJobs.map(job => (
            <JobCard
              key={job.job_id}
              job={job}
              currentUser={currentUser}
              isTechnician={isTechnician}
              processingJobId={processingJobId}
              jobNeedsAcceptance={jobNeedsAcceptance}
              getResponseTimeRemaining={getResponseTimeRemaining}
              onNavigate={(jobId) => navigate(`/jobs/${jobId}`)}
              onAccept={handleAcceptJob}
              onReject={handleOpenRejectModal}
            />
          ))}

          {filteredJobs.length === 0 && (
            <EmptyJobsState
              hasActiveFilters={hasActiveFilters}
              onClearFilters={clearFilters}
            />
          )}
        </div>
      )}

      {canViewDeleted && (
        <DeletedJobsSection
          deletedJobs={deletedJobs}
          showSection={showDeletedSection}
          onToggle={() => setShowDeletedSection(!showDeletedSection)}
        />
      )}

      <RejectJobModal
        show={showRejectModal}
        rejectReason={rejectReason}
        onReasonChange={setRejectReason}
        onConfirm={handleRejectJob}
        onCancel={closeRejectModal}
        isProcessing={!!processingJobId}
      />
    </div>
  );
};

export default JobBoard;
