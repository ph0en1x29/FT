import { CheckSquare,Square } from 'lucide-react';
import React,{ useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDevModeContext } from '../../contexts/DevModeContext';
import { UserRole } from '../../types';
import { deleteJob } from '../../services/jobCrudService';
import { showToast } from '../../services/toastService';
import {
ConfirmBatchDeleteModal,
DeletedJobsSection,
EmptyJobsState,
JobCard,
LoadingState,
QuickStats,
RejectJobModal,
SearchFilterBar,
SiteSignOffBanner,
SlotInAlertBanner,
SpecialFilterBanner,
} from './components';
import { useJobAcceptance,useJobData,useJobFilters } from './hooks';
import { JobBoardProps } from './types';

/** Job Board - Main view for listing, filtering, and managing jobs */
const JobBoard: React.FC<JobBoardProps> = ({ currentUser, hideHeader = false }) => {
  const navigate = useNavigate();
  const { displayRole, hasPermission } = useDevModeContext();
  
  // State for deleted jobs section visibility
  const [showDeletedSection, setShowDeletedSection] = useState(false);

  // Multi-select batch delete state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);
  const [deletionReason, setDeletionReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

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

  // Batch delete handlers
  const handleToggleSelectionMode = () => {
    setSelectionMode(prev => !prev);
    setSelectedJobs(new Set());
  };

  const handleToggleSelect = (jobId: string) => {
    setSelectedJobs(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  const handleBatchDelete = async () => {
    if (selectedJobs.size === 0) return;
    setIsDeleting(true);
    try {
      for (const jobId of selectedJobs) {
        await deleteJob(jobId, currentUser.user_id, currentUser.name, deletionReason || undefined);
      }
      showToast.success(`Deleted ${selectedJobs.size} job${selectedJobs.size > 1 ? 's' : ''}`);
      setSelectedJobs(new Set());
      setSelectionMode(false);
      setShowBatchDeleteModal(false);
      setDeletionReason('');
      await fetchJobs();
    } catch (error) {
      showToast.error('Failed to delete some jobs', (error as Error).message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {!hideHeader && (
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-theme">
            {isTechnician ? 'My Jobs' : 'Job Board'}
          </h1>
          <div className="flex gap-2">
            {hasPermission('canCreateJobs') && (
              <button onClick={() => navigate('/jobs/new')}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition">
                + New Job
              </button>
            )}
          </div>
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

      {/* Selection mode bar — below search bar, right-aligned */}
      {hasPermission('canDeleteJobs') && !isTechnician && (
        <div className="flex items-center justify-end gap-3">
          {selectionMode && selectedJobs.size > 0 && (
            <button
              onClick={() => setShowBatchDeleteModal(true)}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              Delete {selectedJobs.size} Job{selectedJobs.size > 1 ? 's' : ''}
            </button>
          )}
          {selectionMode && selectedJobs.size > 0 && (
            <span className="text-sm text-blue-600 font-medium">
              • {selectedJobs.size} selected
            </span>
          )}
          <button 
            onClick={handleToggleSelectionMode}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              selectionMode 
                ? 'bg-blue-100 text-blue-700 border border-blue-300' 
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            {selectionMode ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            {selectionMode ? 'Exit Selection' : 'Multi-Select'}
          </button>
        </div>
      )}

      <SpecialFilterBanner
        specialFilter={specialFilter}
        filteredCount={filteredJobs.length}
        onClear={clearFilters}
      />

      {loading ? (
        <LoadingState />
      ) : isTechnician ? (
        // Technician view: My Jobs at top, Other Jobs below
        (() => {
          const myJobs = filteredJobs.filter(j => j.assigned_technician_id === currentUser.user_id || j._isHelperAssignment);
          const otherJobs = filteredJobs.filter(j => j.assigned_technician_id !== currentUser.user_id && !j._isHelperAssignment);
          const renderCard = (job: typeof filteredJobs[0]) => (
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
              selectionMode={selectionMode}
              isSelected={selectedJobs.has(job.job_id)}
              onToggleSelect={handleToggleSelect}
            />
          );
          return (
            <div className="space-y-6">
              {myJobs.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-theme-muted uppercase tracking-wide mb-3">My Jobs ({myJobs.length})</h2>
                  <SiteSignOffBanner 
                    jobs={myJobs} 
                    currentUser={currentUser} 
                    onComplete={fetchJobs} 
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {myJobs.map(renderCard)}
                  </div>
                </div>
              )}
              {otherJobs.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold text-theme-muted uppercase tracking-wide mb-3">Other Jobs ({otherJobs.length})</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {otherJobs.map(renderCard)}
                  </div>
                </div>
              )}
              {filteredJobs.length === 0 && (
                <EmptyJobsState hasActiveFilters={hasActiveFilters} onClearFilters={clearFilters} />
              )}
            </div>
          );
        })()
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
              selectionMode={selectionMode}
              isSelected={selectedJobs.has(job.job_id)}
              onToggleSelect={handleToggleSelect}
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

      {/* Floating action bar for batch delete */}
      {selectionMode && selectedJobs.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
          <div className="bg-slate-800 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-4">
            <span className="font-medium text-sm">
              {selectedJobs.size} job{selectedJobs.size > 1 ? 's' : ''} selected
            </span>
            <button
              onClick={() => setShowBatchDeleteModal(true)}
              className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-medium transition"
            >
              Delete Selected
            </button>
          </div>
        </div>
      )}

      {canViewDeleted && (
        <DeletedJobsSection
          deletedJobs={deletedJobs}
          showSection={showDeletedSection}
          onToggle={() => setShowDeletedSection(!showDeletedSection)}
        />
      )}

      <ConfirmBatchDeleteModal
        show={showBatchDeleteModal}
        jobCount={selectedJobs.size}
        deletionReason={deletionReason}
        onReasonChange={setDeletionReason}
        onConfirm={handleBatchDelete}
        onCancel={() => {
          setShowBatchDeleteModal(false);
          setDeletionReason('');
        }}
        isProcessing={isDeleting}
      />

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
