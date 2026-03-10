import { Calendar, CheckCircle, CheckSquare, ChevronRight, Clock, Square, User as UserIcon, Wrench, XCircle } from 'lucide-react';
import React from 'react';
import { JobStatus, JobType, User } from '../../../types';
import { getStatusColor } from '../constants';
import { JobWithHelperFlag, ResponseTimeState } from '../types';

interface JobListRowProps {
  job: JobWithHelperFlag;
  currentUser: User;
  isTechnician: boolean;
  processingJobId: string | null;
  jobNeedsAcceptance: (job: JobWithHelperFlag) => boolean;
  getResponseTimeRemaining: (job: JobWithHelperFlag) => ResponseTimeState;
  onNavigate: (jobId: string) => void;
  onAccept: (e: React.MouseEvent, jobId: string) => void;
  onReject: (e: React.MouseEvent, jobId: string) => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (jobId: string) => void;
}

/** Returns a status dot color class */
const getStatusDotColor = (status: JobStatus, priority?: string): string => {
  if (priority === 'Emergency') return 'bg-red-500';
  switch (status) {
    case JobStatus.IN_PROGRESS:
    case JobStatus.INCOMPLETE_CONTINUING:
      return 'bg-green-500';
    case JobStatus.ASSIGNED:
      return 'bg-amber-400';
    case JobStatus.NEW:
      return 'bg-blue-500';
    case JobStatus.COMPLETED:
      return 'bg-green-600';
    default:
      return 'bg-slate-300';
  }
};

/**
 * Job list row for list view (horizontal layout)
 */
export const JobListRow: React.FC<JobListRowProps> = ({
  job,
  currentUser,
  isTechnician,
  processingJobId,
  jobNeedsAcceptance,
  getResponseTimeRemaining,
  onNavigate,
  onAccept,
  onReject,
  selectionMode = false,
  isSelected = false,
  onToggleSelect,
}) => {
  const handleRowClick = () => {
    if (selectionMode && onToggleSelect) {
      onToggleSelect(job.job_id);
    } else {
      onNavigate(job.job_id);
    }
  };

  return (
    <div 
      onClick={handleRowClick}
      className={`flex items-center gap-3 py-2.5 px-3 hover:bg-[var(--surface-hover)] cursor-pointer transition-colors border-b border-[var(--border)] ${
        isSelected ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''
      }`}
    >
      {/* Selection checkbox */}
      {selectionMode && (
        <button 
          onClick={(e) => { e.stopPropagation(); onToggleSelect && onToggleSelect(job.job_id); }}
          className="flex-shrink-0"
        >
          {isSelected ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4 text-theme-muted" />}
        </button>
      )}

      {/* Status dot */}
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getStatusDotColor(job.status, job.priority)}`} />

      {/* Job number */}
      <span className="font-mono text-xs text-theme-muted flex-shrink-0 min-w-[50px]">
        #{job.job_number || '---'}
      </span>

      {/* Title */}
      <span className="flex-1 truncate font-medium text-sm text-theme">
        {job.title}
      </span>

      {/* Customer name */}
      <span className="text-xs text-theme-muted truncate max-w-[150px] flex-shrink-0">
        {job.customer?.name || 'No customer'}
      </span>

      {/* Forklift number */}
      <span className="text-xs font-mono text-theme-muted flex-shrink-0 min-w-[60px]">
        {job.forklift ? (job.forklift.forklift_no || job.forklift.serial_number) : '—'}
      </span>

      {/* Assigned tech */}
      <span className="text-xs text-theme-muted truncate max-w-[120px] flex-shrink-0">
        {job.assigned_technician_name || '—'}
      </span>

      {/* Date */}
      <span className="text-xs text-theme-muted flex-shrink-0 min-w-[80px]">
        {new Date(job.scheduled_date || job.created_at).toLocaleDateString()}
      </span>

      {/* Accept/Reject buttons for technicians if needed */}
      {isTechnician && jobNeedsAcceptance(job) && (
        <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => onAccept(e, job.job_id)}
            disabled={processingJobId === job.job_id}
            className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            <CheckCircle className="w-3 h-3" />
            Accept
          </button>
          <button
            onClick={(e) => onReject(e, job.job_id)}
            disabled={processingJobId === job.job_id}
            className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium hover:bg-red-200 transition-colors disabled:opacity-50"
          >
            <XCircle className="w-3 h-3" />
            Reject
          </button>
        </div>
      )}

      {/* Chevron right */}
      <ChevronRight className="w-4 h-4 text-theme-muted flex-shrink-0" />
    </div>
  );
};
