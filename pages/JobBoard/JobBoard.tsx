/* eslint-disable max-lines */
import { CheckSquare, LayoutGrid, List, Square } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteJob } from '../../services/jobCrudService';
import { showToast } from '../../services/toastService';
import { useDevModeContext } from '../../contexts/DevModeContext';
import { UserRole } from '../../types';
import {
  ConfirmBatchDeleteModal,
  DeletedJobsSection,
  EmptyJobsState,
  JobCard,
  JobListTable,
  LoadingState,
  QuickStats,
  RejectJobModal,
  SearchFilterBar,
  SiteSignOffBanner,
  SlotInAlertBanner,
  SpecialFilterBanner,
} from './components';
import { useJobAcceptance, useJobData, useJobFilters } from './hooks';
import { JobBoardProps, JobWithHelperFlag, ViewMode } from './types';


const SectionHeader: React.FC<{ title: string; count: number }> = ({ title, count }) => (
  <div className="flex items-center gap-2">
    <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-theme-muted">{title}</h2>
    <span className="rounded-full bg-[var(--bg-subtle)] px-2 py-0.5 text-xs font-medium text-theme-muted">{count}</span>
  </div>
);

const JobBoard: React.FC<JobBoardProps> = ({ currentUser, hideHeader = false }) => {
  const navigate = useNavigate();
  const { displayRole, hasPermission } = useDevModeContext();

  const [showDeletedSection, setShowDeletedSection] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);
  const [deletionReason, setDeletionReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const activeRole = displayRole || currentUser.role;
  const isTechnician = activeRole === UserRole.TECHNICIAN;
  const defaultViewMode: ViewMode = isTechnician ? 'card' : 'list';
  const [viewMode, setViewMode] = useState<ViewMode>(defaultViewMode);

  const { jobs, loading, deletedJobs, canViewDeleted, fetchJobs } = useJobData({ currentUser, displayRole: activeRole });
  const {
    searchQuery,
    setSearchQuery,
    dateFilter,
    setDateFilter,
    statusFilter,
    setStatusFilter,
    specialFilter,
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

  

  const handleViewAllSlotIn = () => {
    setSearchQuery('');
    setDateFilter('all');
    setStatusFilter('all');
  };

  const handleToggleSelectionMode = () => {
    setSelectionMode((prev) => !prev);
    setSelectedJobs(new Set());
  };

  const handleToggleSelect = (jobId: string) => {
    setSelectedJobs((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
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

  const myJobs = useMemo(
    () => filteredJobs.filter((job) => job.assigned_technician_id === currentUser.user_id || job._isHelperAssignment),
    [currentUser.user_id, filteredJobs]
  );
  const otherJobs = useMemo(
    () => filteredJobs.filter((job) => job.assigned_technician_id !== currentUser.user_id && !job._isHelperAssignment),
    [currentUser.user_id, filteredJobs]
  );

  const renderCards = (items: JobWithHelperFlag[]) => (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {items.map((job) => (
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
    </div>
  );

  const renderList = (items: JobWithHelperFlag[]) => (
    <JobListTable
      jobs={items}
      currentUser={currentUser}
      isTechnician={isTechnician}
      processingJobId={processingJobId}
      jobNeedsAcceptance={jobNeedsAcceptance}
      getResponseTimeRemaining={getResponseTimeRemaining}
      onNavigate={(jobId) => navigate(`/jobs/${jobId}`)}
      onAccept={handleAcceptJob}
      onReject={handleOpenRejectModal}
      selectionMode={selectionMode}
      selectedJobs={selectedJobs}
      onToggleSelect={handleToggleSelect}
    />
  );

  return (
    <div className="space-y-6">
      {!hideHeader && (
        <div className="flex flex-col gap-4 rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-theme-muted">Operations board</div>
            <div>
              <h1 className="text-2xl font-semibold text-theme md:text-3xl">
                {isTechnician ? 'My Jobs' : 'Jobs'}
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-theme-muted">
                {isTechnician
                  ? 'Track assigned work, respond quickly, and move between field calls without losing context.'
                  : 'Scan dispatch load, triage urgent work, and switch between dense list and operational cards without leaving the board.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-subtle)]/70 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-theme-muted">Showing</div>
              <div className="mt-1 text-lg font-semibold text-theme">{filteredJobs.length} jobs</div>
            </div>

            {hasPermission('canCreateJobs') && (
              <button
                onClick={() => navigate('/jobs/new')}
                className="inline-flex h-12 items-center rounded-2xl bg-blue-600 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
              >
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

      <SlotInAlertBanner count={statusCounts.slotInPendingAck} onViewAll={handleViewAllSlotIn} />

      <div className="space-y-4 rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-theme-muted">Workspace</div>
            <div className="mt-1 text-lg font-semibold text-theme">Browse by card or list</div>
            <div className="mt-1 text-sm text-theme-muted">
              View mode stays in the URL so refresh and shared links keep the same layout.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-full bg-[var(--bg-subtle)] p-1">
              <button
                onClick={() => setViewMode('card')}
                className={`inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm transition ${
                  viewMode === 'card'
                    ? 'bg-[var(--surface)] text-theme font-medium shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-theme'
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
                Card
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm transition ${
                  viewMode === 'list'
                    ? 'bg-[var(--surface)] text-theme font-medium shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-theme'
                }`}
              >
                <List className="h-4 w-4" />
                List
              </button>
            </div>

            {hasPermission('canDeleteJobs') && !isTechnician && (
              <div className="flex items-center gap-2">
                {selectionMode && selectedJobs.size > 0 && (
                  <button
                    onClick={() => setShowBatchDeleteModal(true)}
                    className="text-sm font-medium text-red-600 transition hover:text-red-700"
                  >
                    Delete {selectedJobs.size}
                  </button>
                )}
                <button
                  onClick={handleToggleSelectionMode}
                  className={`inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm transition ${
                    selectionMode
                      ? 'bg-blue-50 text-blue-700 font-medium dark:bg-blue-900/20 dark:text-blue-300'
                      : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-theme'
                  }`}
                >
                  {selectionMode ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                  {selectionMode ? `${selectedJobs.size} selected` : 'Select'}
                </button>
              </div>
            )}
          </div>
        </div>

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
      </div>

      {loading ? (
        <LoadingState />
      ) : isTechnician ? (
        <div className="space-y-8">
          {myJobs.length > 0 && (
            <section className="space-y-4">
              <SectionHeader
                title="My Jobs"
                count={myJobs.length}
              />
              <SiteSignOffBanner jobs={myJobs} currentUser={currentUser} onComplete={fetchJobs} />
              {viewMode === 'list' ? renderList(myJobs) : renderCards(myJobs)}
            </section>
          )}

          {otherJobs.length > 0 && (
            <section className="space-y-4">
              <SectionHeader
                title="Other Jobs"
                count={otherJobs.length}
              />
              {viewMode === 'list' ? renderList(otherJobs) : renderCards(otherJobs)}
            </section>
          )}

          {filteredJobs.length === 0 && (
            <EmptyJobsState hasActiveFilters={hasActiveFilters} onClearFilters={clearFilters} />
          )}
        </div>
      ) : (
        <section className="space-y-4">
          <SectionHeader
            title="Live Queue"
            count={filteredJobs.length}
          />
          {viewMode === 'list' ? renderList(filteredJobs) : renderCards(filteredJobs)}
          {filteredJobs.length === 0 && (
            <EmptyJobsState hasActiveFilters={hasActiveFilters} onClearFilters={clearFilters} />
          )}
        </section>
      )}

      {selectionMode && selectedJobs.size > 0 && (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2">
          <div className="flex items-center gap-4 rounded-2xl bg-slate-900 px-5 py-3 text-white shadow-2xl">
            <span className="text-sm font-medium">
              {selectedJobs.size} job{selectedJobs.size > 1 ? 's' : ''} selected
            </span>
            <button
              onClick={() => setShowBatchDeleteModal(true)}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium transition hover:bg-red-700"
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
