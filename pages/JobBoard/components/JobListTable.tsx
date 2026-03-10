import React from 'react';
import { User } from '../../../types';
import { JobWithHelperFlag, ResponseTimeState } from '../types';
import { JobListRow } from './JobListRow';

interface JobListTableProps {
  jobs: JobWithHelperFlag[];
  currentUser: User;
  isTechnician: boolean;
  processingJobId: string | null;
  jobNeedsAcceptance: (job: JobWithHelperFlag) => boolean;
  getResponseTimeRemaining: (job: JobWithHelperFlag) => ResponseTimeState;
  onNavigate: (jobId: string) => void;
  onAccept: (e: React.MouseEvent, jobId: string) => void;
  onReject: (e: React.MouseEvent, jobId: string) => void;
  selectionMode?: boolean;
  selectedJobs?: Set<string>;
  onToggleSelect?: (jobId: string) => void;
}

export const JobListTable: React.FC<JobListTableProps> = ({
  jobs,
  currentUser,
  isTechnician,
  processingJobId,
  jobNeedsAcceptance,
  getResponseTimeRemaining,
  onNavigate,
  onAccept,
  onReject,
  selectionMode = false,
  selectedJobs = new Set(),
  onToggleSelect,
}) => {
  return (
    <div className="space-y-3">
      <div className="space-y-3 md:hidden">
        {jobs.map((job) => (
          <JobListRow
            key={job.job_id}
            job={job}
            currentUser={currentUser}
            isTechnician={isTechnician}
            processingJobId={processingJobId}
            jobNeedsAcceptance={jobNeedsAcceptance}
            getResponseTimeRemaining={getResponseTimeRemaining}
            onNavigate={onNavigate}
            onAccept={onAccept}
            onReject={onReject}
            selectionMode={selectionMode}
            isSelected={selectedJobs.has(job.job_id)}
            onToggleSelect={onToggleSelect}
            layout="mobile"
          />
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm md:block">
        <div className="flex items-center gap-4 border-b border-[var(--border)] bg-[var(--bg-subtle)]/70 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-theme-muted">
          <div className="shrink-0 w-6">{selectionMode ? '☐' : ''}</div>
          <span className="shrink-0 w-[52px]">#</span>
          <span className="shrink-0 w-[160px]">Status</span>
          <span className="flex-1 min-w-0">Title</span>
          <span className="shrink-0 w-[140px]">Customer</span>
          <span className="shrink-0 w-[120px]">Equipment</span>
          <span className="shrink-0 w-[110px]">Assignee</span>
          <span className="shrink-0 w-[85px]">Scheduled</span>
          <span className="shrink-0 w-[100px] text-right">Action</span>
        </div>

        <div className="divide-y divide-[var(--border)]">
          {jobs.map((job) => (
            <JobListRow
              key={job.job_id}
              job={job}
              currentUser={currentUser}
              isTechnician={isTechnician}
              processingJobId={processingJobId}
              jobNeedsAcceptance={jobNeedsAcceptance}
              getResponseTimeRemaining={getResponseTimeRemaining}
              onNavigate={onNavigate}
              onAccept={onAccept}
              onReject={onReject}
              selectionMode={selectionMode}
              isSelected={selectedJobs.has(job.job_id)}
              onToggleSelect={onToggleSelect}
              layout="desktop"
            />
          ))}
        </div>
      </div>
    </div>
  );
};
