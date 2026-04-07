import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  CheckSquare,
  Clock,
  MapPin,
  Square,
  Star,
  User as UserIcon,
  Wrench,
  XCircle,
} from 'lucide-react';
import React from 'react';
import SlotInSLABadge from '../../../components/SlotInSLABadge';
import { JobStatus, JobType, User } from '../../../types';
import { getJobTypeColor, getStatusColor } from '../constants';
import { JobWithHelperFlag, ResponseTimeState } from '../types';

interface JobCardProps {
  job: JobWithHelperFlag;
  currentUser: User;
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
  isSelected?: boolean;
  onToggleSelect?: (jobId: string) => void;
}

const getStatusBorderColor = (job: JobWithHelperFlag): string => {
  if (job.priority === 'Emergency') return 'border-l-[3px] border-l-red-500';
  switch (job.status) {
    case JobStatus.IN_PROGRESS:
    case JobStatus.INCOMPLETE_CONTINUING:
      return 'border-l-[3px] border-l-emerald-500';
    case JobStatus.ASSIGNED:
      return 'border-l-[3px] border-l-amber-400';
    case JobStatus.NEW:
      return 'border-l-[3px] border-l-blue-500';
    default:
      return 'border-l-[3px] border-l-slate-300';
  }
};

const formatDate = (value?: string) =>
  new Date(value || '').toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

const getEquipmentLabel = (job: JobWithHelperFlag) => {
  const forkliftNo = job.forklift?.forklift_no || job.forklift?.serial_number;
  const customerForkliftNo = job.forklift?.customer_forklift_no;

  return [forkliftNo, customerForkliftNo ? `CustFL# ${customerForkliftNo}` : ''].filter(Boolean).join(' · ');
};

export const JobCard: React.FC<JobCardProps> = React.memo(({
  job,
  currentUser,
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
  isSelected = false,
  onToggleSelect,
}) => {
  const responseState = getResponseTimeRemaining(job);
  const scheduledLabel = formatDate(job.scheduled_date || job.created_at);
  const equipmentLabel = getEquipmentLabel(job);
  const needsAcceptance = isTechnician && jobNeedsAcceptance(job);
  const isStarred = job.is_starred ?? false;
  const footerTone =
    responseState.urgency === 'critical'
      ? 'text-red-600'
      : responseState.urgency === 'warning'
        ? 'text-amber-600'
        : 'text-[var(--text-muted)]';

  const handleCardClick = () => {
    if (selectionMode && onToggleSelect) {
      onToggleSelect(job.job_id);
      return;
    }

    onNavigate(job.job_id);
  };

  return (
    <article
      onClick={handleCardClick}
      className={`relative flex h-full min-w-0 flex-col rounded-xl border bg-[var(--surface)] p-4 shadow-sm cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98] active:shadow-sm ${getStatusBorderColor(job)} ${
        isStarred
          ? 'border-amber-400 dark:border-amber-500 ring-1 ring-amber-400/30 dark:ring-amber-500/30'
          : 'border-[var(--border)] hover:border-blue-300 dark:hover:border-blue-700'
      } ${isSelected ? 'ring-2 ring-blue-500/70 bg-blue-50/40 dark:bg-blue-900/15' : ''}`}
    >
      {/* Row 1: Badges */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {selectionMode && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect?.(job.job_id);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] transition hover:text-[var(--text)]"
              aria-label={isSelected ? 'Deselect job' : 'Select job'}
            >
              {isSelected ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4" />}
            </button>
          )}

          {/* Star + Job number side by side */}
          <div className="flex items-center gap-1.5 shrink-0">
            {canStar && (
              <button
                onClick={(e) => onStar(e, job.job_id)}
                aria-label={isStarred ? 'Unstar job' : 'Star job — needs attention'}
                className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors ${
                  isStarred
                    ? 'text-amber-500 dark:text-amber-400'
                    : 'text-slate-300 hover:text-amber-400 dark:text-slate-600 dark:hover:text-amber-400'
                }`}
              >
                <Star className={`h-4 w-4 ${isStarred ? 'fill-amber-400' : ''}`} />
              </button>
            )}
            {!canStar && isStarred && (
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            )}
            {job.job_number && (
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold tracking-[0.12em] text-blue-700 whitespace-nowrap dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                {job.job_number}
              </span>
            )}
          </div>

          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${getStatusColor(job.status)}`}>
            {job.status}
          </span>

          {job.job_type && (
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${getJobTypeColor(job.job_type as JobType)}`}>
              {job.job_type}
            </span>
          )}

          {job._isHelperAssignment && (
            <span className="rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 text-[11px] font-medium text-purple-700 dark:border-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
              Helper
            </span>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {job.priority === 'Emergency' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-300">
              <AlertTriangle className="h-3.5 w-3.5" />
              Emergency
            </span>
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

      {/* Row 2: Title + Tech */}
      <div className="mt-2 min-w-0">
        <h3 className="truncate text-base font-semibold text-theme">{job.title}</h3>
        {job.assigned_technician_name && (
          <p className="mt-0.5 text-xs text-theme-muted">{job.assigned_technician_name}</p>
        )}
        {job.description && (
          <p className="mt-0.5 text-xs text-theme-muted line-clamp-1">{job.description}</p>
        )}
      </div>

      {/* Row 3: Inline details */}
      <div className="mt-2 flex flex-wrap gap-x-3 border-t border-[var(--border)] pt-2 text-xs text-theme-muted">
        {job.customer?.name && (
          <span className="flex items-center gap-1">
            <UserIcon className="h-3.5 w-3.5" />
            {job.customer.name}
          </span>
        )}
        {(job as any).customer_site?.site_name && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            {(job as any).customer_site.site_name}
          </span>
        )}
        {equipmentLabel && (
          <span className="flex items-center gap-1">
            <Wrench className="h-3.5 w-3.5" />
            {equipmentLabel}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          {scheduledLabel}
        </span>
      </div>

      {/* Technician action footer */}
      {needsAcceptance && (
        <div className="mt-4 space-y-2 border-t border-[var(--border)] pt-3">
          <div className={`flex items-center gap-2 text-xs ${footerTone}`}>
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 break-words">
              {responseState.isExpired ? 'Response time expired' : `Respond within ${responseState.text}`}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={(e) => onAccept(e, job.job_id)}
              disabled={processingJobId === job.job_id}
              className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-sm font-medium text-white active:scale-95 transition-all hover:bg-emerald-700 hover:shadow-md disabled:opacity-50"
            >
              <CheckCircle className="h-4 w-4" />
              {processingJobId === job.job_id ? 'Accepting...' : 'Accept'}
            </button>
            <button
              onClick={(e) => onReject(e, job.job_id)}
              disabled={processingJobId === job.job_id}
              className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl bg-red-50 px-3 text-sm font-medium text-red-700 active:scale-95 transition-all hover:bg-red-100 hover:shadow-md disabled:opacity-50 dark:bg-red-900/20 dark:text-red-300"
            >
              <XCircle className="h-4 w-4" />
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Accepted state */}
      {!needsAcceptance &&
        isTechnician &&
        job.status === JobStatus.ASSIGNED &&
        job.assigned_technician_id === currentUser.user_id &&
        job.technician_accepted_at && (
          <div className="mt-3 flex items-center gap-2 border-t border-[var(--border)] pt-3 text-xs text-emerald-600">
            <CheckCircle className="h-3.5 w-3.5 shrink-0" />
            Accepted
          </div>
        )}
    </article>
  );
});
JobCard.displayName = 'JobCard';
