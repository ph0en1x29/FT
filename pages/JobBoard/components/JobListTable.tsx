import React from 'react';
import { JobWithHelperFlag, ResponseTimeState } from '../types';
import { JobListRow } from './JobListRow';

const EMPTY_SET = new Set<string>();

interface JobListTableProps {
  jobs: JobWithHelperFlag[];
  isTechnician: boolean;
  canStar: boolean;
  processingJobId: string | null;
  jobNeedsAcceptance: (job: JobWithHelperFlag) => boolean;
  getResponseTimeRemaining: (job: JobWithHelperFlag) => ResponseTimeState;
  onNavigate: (jobId: string) => void;
  onAccept: (e: React.MouseEvent, jobId: string) => void;
  onReject: (e: React.MouseEvent, jobId: string) => void;
  onStar: (e: React.MouseEvent, jobId: string) => void;
  selectionMode?: boolean;
  selectedJobs?: Set<string>;
  onToggleSelect?: (jobId: string) => void;
}

export const JobListTable: React.FC<JobListTableProps> = ({
  jobs,
  isTechnician,
  canStar,
  processingJobId,
  jobNeedsAcceptance,
  getResponseTimeRemaining,
  onNavigate,
  onAccept,
  onReject,
  onStar,
  selectionMode = false,
  selectedJobs = EMPTY_SET,
  onToggleSelect,
}) => {
  return (
    <div className="space-y-3">
      <div className="space-y-3 md:hidden">
        {jobs.map((job) => (
          <JobListRow
            key={job.job_id}
            job={job}
            isTechnician={isTechnician}
            processingJobId={processingJobId}
            jobNeedsAcceptance={jobNeedsAcceptance}
            getResponseTimeRemaining={getResponseTimeRemaining}
            onNavigate={onNavigate}
            onAccept={onAccept}
            onReject={onReject}
            onStar={onStar}
            canStar={canStar}
            selectionMode={selectionMode}
            isSelected={selectedJobs.has(job.job_id)}
            onToggleSelect={onToggleSelect}
            layout="mobile"
          />
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm md:block">
        <div className="flex items-center gap-4 border-b border-[var(--border)] bg-[var(--bg-subtle)]/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-theme-muted">
          <div className="shrink-0 w-6"></div>
          <span className="shrink-0 w-[180px]">#</span>
          <span className="shrink-0 w-[150px]">Status</span>
          <span className="flex-[2] min-w-0">Title</span>
          <span className="flex-[2] min-w-0">Customer</span>
          <span className="flex-1 min-w-0">Equipment</span>
          <span className="flex-[1.5] min-w-0">Assignee</span>
          <span className="shrink-0 w-[85px]">Scheduled</span>
          <span className="shrink-0 w-10"></span>
        </div>

        <div className="divide-y divide-[var(--border)]">
          {jobs.map((job) => (
            <JobListRow
              key={job.job_id}
              job={job}
              isTechnician={isTechnician}
                processingJobId={processingJobId}
              jobNeedsAcceptance={jobNeedsAcceptance}
              getResponseTimeRemaining={getResponseTimeRemaining}
              onNavigate={onNavigate}
              onAccept={onAccept}
              onReject={onReject}
              onStar={onStar}
              canStar={canStar}
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
