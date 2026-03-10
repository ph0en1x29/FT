import { Calendar, CheckCircle, CheckSquare, Clock, Square, User as UserIcon, Wrench, XCircle } from 'lucide-react';
import React from 'react';
import SlotInSLABadge from '../../../components/SlotInSLABadge';
import { JobStatus, JobType, User } from '../../../types';
import { getJobTypeColor, getStatusColor } from '../constants';
import { JobWithHelperFlag, ResponseTimeState } from '../types';

interface JobCardProps {
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

/** Returns a colored left-border class based on job status/priority */
const getStatusBorderColor = (job: JobWithHelperFlag): string => {
  if (job.priority === 'Emergency') return 'border-l-4 border-l-red-500';
  switch (job.status) {
    case JobStatus.IN_PROGRESS:
    case JobStatus.INCOMPLETE_CONTINUING:
      return 'border-l-4 border-l-green-500';
    case JobStatus.ASSIGNED:
      return 'border-l-4 border-l-amber-400';
    case JobStatus.NEW:
      return 'border-l-4 border-l-blue-500';
    default:
      return 'border-l-4 border-l-slate-300';
  }
};

/**
 * Individual job card displaying job details with technician actions (compact redesign)
 */
export const JobCard: React.FC<JobCardProps> = ({
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
  const handleCardClick = () => {
    if (selectionMode && onToggleSelect) {
      onToggleSelect(job.job_id);
    } else {
      onNavigate(job.job_id);
    }
  };

  return (
    <div 
      onClick={handleCardClick}
      className={`card-theme p-4 rounded-xl clickable-card group theme-transition ${getStatusBorderColor(job)} ${
        isSelected ? 'ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-900/20' : ''
      } relative`}
    >
      {/* Row 1: Job Number + Badges */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          {selectionMode && (
            <button onClick={(e) => { e.stopPropagation(); onToggleSelect && onToggleSelect(job.job_id); }}>
              {isSelected ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4 text-theme-muted" />}
            </button>
          )}
          {job.job_number && (
            <span className="text-xs font-mono font-semibold text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-700 whitespace-nowrap">
              #{job.job_number}
            </span>
          )}
          <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide ${getStatusColor(job.status)}`}>
            {job.status}
          </span>
          {job.job_type && (
            <span className={`px-2 py-0.5 rounded text-xs font-medium border ${getJobTypeColor(job.job_type as JobType)}`}>
              {job.job_type}
            </span>
          )}
          {job._isHelperAssignment && (
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 border border-purple-200">
              Helper
            </span>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          {job.priority === 'Emergency' && (
            <span className="text-xs font-bold text-red-600 animate-pulse">EMERGENCY</span>
          )}
          {job.job_type === JobType.SLOT_IN && (
            <SlotInSLABadge
              createdAt={job.created_at}
              acknowledgedAt={job.acknowledged_at}
              slaTargetMinutes={job.sla_target_minutes || 15}
              size="sm"
            />
          )}
        </div>
      </div>
      
      {/* Row 2: Title + Assigned Tech */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className="font-semibold text-base text-theme group-hover:text-blue-600 truncate flex-1">
          {job.title}
        </h3>
        {job.assigned_technician_name && (
          <span className="text-xs text-theme-muted whitespace-nowrap">{job.assigned_technician_name}</span>
        )}
      </div>
      
      {/* Row 3: Customer · Forklift · Date */}
      <div className="flex items-center gap-3 text-xs text-theme-muted">
        {job.customer && (
          <div className="flex items-center gap-1">
            <UserIcon className="w-3 h-3 opacity-60" />
            <span className="truncate">{job.customer.name}</span>
          </div>
        )}
        {job.forklift && (
          <div className="flex items-center gap-1">
            <Wrench className="w-3 h-3 opacity-60" />
            <span className="truncate">
              {job.forklift.forklift_no || job.forklift.serial_number}
              {job.forklift.customer_forklift_no && (
                <span className="text-theme-muted"> · {job.forklift.customer_forklift_no}</span>
              )}
            </span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <Calendar className="w-3 h-3 opacity-60" />
          <span>{new Date(job.scheduled_date || job.created_at).toLocaleDateString()}</span>
        </div>
      </div>

      {/* On-Call Accept/Reject Buttons for Technicians */}
      {isTechnician && jobNeedsAcceptance(job) && (
        <div className="mt-3 pt-3 border-t border-slate-200">
          {/* Response timer */}
          {job.technician_response_deadline && (
            <div className={`flex items-center gap-1 mb-2 text-xs ${
              getResponseTimeRemaining(job).urgency === 'critical' ? 'text-red-600' :
              getResponseTimeRemaining(job).urgency === 'warning' ? 'text-amber-600' :
              'text-slate-500'
            }`}>
              <Clock className="w-3 h-3" />
              <span>
                {getResponseTimeRemaining(job).isExpired 
                  ? 'Response time expired' 
                  : `Respond within: ${getResponseTimeRemaining(job).text}`}
              </span>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={(e) => onAccept(e, job.job_id)}
              disabled={processingJobId === job.job_id}
              className="flex-1 flex items-center justify-center gap-1 px-3 min-h-[48px] bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50 w-full"
            >
              <CheckCircle className="w-4 h-4" />
              {processingJobId === job.job_id ? 'Accepting...' : 'Accept'}
            </button>
            <button
              onClick={(e) => onReject(e, job.job_id)}
              disabled={processingJobId === job.job_id}
              className="flex-1 flex items-center justify-center gap-1 px-3 min-h-[48px] bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium disabled:opacity-50 w-full"
            >
              <XCircle className="w-4 h-4" />
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Show acceptance status for already accepted jobs */}
      {isTechnician && job.status === JobStatus.ASSIGNED && job.assigned_technician_id === currentUser.user_id && job.technician_accepted_at && (
        <div className="mt-2 pt-2 border-t border-green-200">
          <span className="text-xs text-green-600 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Accepted - Ready to start
          </span>
        </div>
      )}
    </div>
  );
};
