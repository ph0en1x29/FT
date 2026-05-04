import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  CheckSquare,
  ChevronRight,
  Clock,
  MapPin,
  Square,
  Star,
  User as UserIcon,
  Wrench,
  XCircle,
} from 'lucide-react';
import React from 'react';
import BillingPathBadge from '../../../components/BillingPathBadge';
import SlotInSLABadge from '../../../components/SlotInSLABadge';
import { JobStatus, JobType } from '../../../types';
import { jobTypeLabel } from '../../../types/job-core.types';
import { getJobTypeColor, getStatusColor } from '../constants';
import { JobWithHelperFlag, ResponseTimeState } from '../types';

interface JobListRowProps {
  job: JobWithHelperFlag;
  isTechnician: boolean;
  canViewCustomerName?: boolean;
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
  layout?: 'mobile' | 'desktop';
}

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
      return 'bg-green-700';
    default:
      return 'bg-slate-300';
  }
};

const formatDate = (value?: string) =>
  new Date(value || '').toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

const getSiteLabel = (job: JobWithHelperFlag) =>
  job.forklift?.site || job.forklift?.location || job.customer?.address || '—';

const getEquipmentLabel = (job: JobWithHelperFlag) => {
  const forkliftNo = job.forklift?.forklift_no || job.forklift?.serial_number;
  const customerForkliftNo = job.forklift?.customer_forklift_no;
  const model = [job.forklift?.make, job.forklift?.model].filter(Boolean).join(' ');

  return [forkliftNo, customerForkliftNo ? `Cust ${customerForkliftNo}` : '', model]
    .filter(Boolean)
    .join(' · ') || '—';
};

const getPriorityLabel = (job: JobWithHelperFlag) => {
  if (job.priority === 'Emergency') return 'Emergency';
  if (job.job_type === JobType.SLOT_IN && !job.acknowledged_at) return 'Slot-In';
  return job.priority || 'Standard';
};

export const JobListRow: React.FC<JobListRowProps> = React.memo(({
  job,
  isTechnician,
  canViewCustomerName = true,
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
  layout = 'desktop',
}) => {
  const responseState = getResponseTimeRemaining(job);
  const siteLabel = getSiteLabel(job);
  const equipmentLabel = getEquipmentLabel(job);
  const scheduledLabel = formatDate(job.scheduled_date || job.created_at);
  const needsAcceptance = isTechnician && jobNeedsAcceptance(job);
  const priorityLabel = getPriorityLabel(job);
  const isStarred = job.is_starred ?? false;

  const handleClick = () => {
    if (selectionMode && onToggleSelect) {
      onToggleSelect(job.job_id);
      return;
    }

    onNavigate(job.job_id);
  };

  const SelectionToggle = selectionMode ? (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggleSelect?.(job.job_id);
      }}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)]"
      aria-label={isSelected ? 'Deselect job' : 'Select job'}
    >
      {isSelected ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4 text-theme-muted" />}
    </button>
  ) : null;

  if (layout === 'mobile') {
    return (
      <article
        onClick={handleClick}
        className={`rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm cursor-pointer transition-all hover:bg-[var(--surface-2)] active:scale-[0.98] active:shadow-sm ${
          isSelected ? 'ring-2 ring-blue-500/70 bg-blue-50/40 dark:bg-blue-900/15' : ''
        }`}
      >
        <div className="flex items-start gap-3">
          {SelectionToggle}
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Star + Job number */}
              <div className="flex items-center gap-1">
                {canStar ? (
                  <button
                    onClick={(e) => onStar(e, job.job_id)}
                    aria-label={isStarred ? 'Unstar job' : 'Star job — needs attention'}
                    className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors ${
                      isStarred ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'
                    }`}
                  >
                    <Star className={`h-4 w-4 ${isStarred ? 'fill-amber-400' : ''}`} />
                  </button>
                ) : isStarred ? (
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                ) : null}
                {job.job_number && (
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold tracking-[0.12em] text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                    {job.job_number}
                  </span>
                )}
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.12em] ${getStatusColor(job.status)}`}>
                {job.status}
              </span>
              {job.job_type && (
                <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${getJobTypeColor(job.job_type as JobType)}`}>
                  {jobTypeLabel(job.job_type)}
                </span>
              )}
              {/* ACWER Phase 1 — compact billing path chip */}
              {job.billing_path && job.billing_path !== 'unset' && (
                <BillingPathBadge path={job.billing_path} reason={job.billing_path_reason} compact />
              )}
            </div>

            <div className="space-y-1">
              <div className="break-words text-base font-semibold text-theme">{job.title}</div>
              <div className="break-words text-sm text-theme-muted">{canViewCustomerName ? (job.customer?.name || '—') : '—'}</div>
            </div>

            <div className="grid gap-2 text-sm text-theme-muted">
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="break-words">{siteLabel}</span>
              </div>
              <div className="flex items-start gap-2">
                <Wrench className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="break-words">{equipmentLabel}</span>
              </div>
              {!isTechnician && (
                <div className="flex items-center gap-2">
                  <UserIcon className="h-4 w-4 shrink-0" />
                  <span className="break-words">{job.assigned_technician_name || '—'}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 shrink-0" />
                <span>{scheduledLabel}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              {job.priority === 'Emergency' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
                  <AlertTriangle className="h-4 w-4" />
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
              {job._isHelperAssignment && (
                <span className="rounded-full bg-purple-50 px-2 py-1 font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                  Helper
                </span>
              )}
            </div>

            {needsAcceptance ? (
              <div className="space-y-2 border-t border-[var(--border)] pt-3">
                <div className={`flex items-center gap-2 text-xs ${
                  responseState.urgency === 'critical'
                    ? 'text-red-600'
                    : responseState.urgency === 'warning'
                      ? 'text-amber-600'
                      : 'text-theme-muted'
                }`}>
                  <Clock className="h-4 w-4" />
                  {responseState.isExpired ? 'Response time expired' : `Respond within ${responseState.text}`}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={(e) => onAccept(e, job.job_id)}
                    disabled={processingJobId === job.job_id}
                    className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-sm font-medium text-white active:scale-95 transition-all hover:bg-emerald-700 hover:shadow-md disabled:opacity-50"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Accept
                  </button>
                  <button
                    onClick={(e) => onReject(e, job.job_id)}
                    disabled={processingJobId === job.job_id}
                    className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-red-50 px-3 text-sm font-medium text-red-700 active:scale-95 transition-all hover:bg-red-100 hover:shadow-md disabled:opacity-50 dark:bg-red-900/20 dark:text-red-300"
                  >
                    <XCircle className="h-4 w-4" />
                    Reject
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between border-t border-[var(--border)] pt-3 text-sm text-theme-muted">
                <span>{priorityLabel}</span>
                <ChevronRight className="h-4 w-4" />
              </div>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <div
      onClick={handleClick}
      className={`flex items-center gap-4 border-l-2 border-l-transparent px-4 py-4 cursor-pointer transition-all hover:bg-[var(--surface-2)] hover:border-l-blue-400 active:bg-[var(--bg-subtle)] ${
        isSelected ? 'bg-blue-50/40 dark:bg-blue-900/15' : ''
      }`}
    >
      {/* Selection / Status dot */}
      <div className="flex items-center gap-2 shrink-0">
        {SelectionToggle}
        {!selectionMode && (
          <div className={`w-2 h-2 rounded-full shrink-0 ${getStatusDotColor(job.status, job.priority)}`} />
        )}
      </div>

      {/* Star + Job # — w-[180px] sized to fit BOTH the new JOB-YYMMDD-NNN format (14 chars) AND the legacy
          JOB-YYYYMMDD-NNNN format (17 chars) that pre-2026-04-07 jobs still carry. overflow-hidden guards
          against any future longer format. Mono text-sm + # prefix + star icon. */}
      <div className="flex items-center gap-1.5 shrink-0 w-[180px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {canStar ? (
          <button
            onClick={(e) => onStar(e, job.job_id)}
            aria-label={isStarred ? 'Unstar job' : 'Star job — needs attention'}
            className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors shrink-0 ${
              isStarred ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'
            }`}
          >
            <Star className={`h-3.5 w-3.5 ${isStarred ? 'fill-amber-400' : ''}`} />
          </button>
        ) : isStarred ? (
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400 shrink-0" />
        ) : (
          <span className="w-6 shrink-0" />
        )}
        <span className="text-sm font-mono text-theme-muted whitespace-nowrap">
          {job.job_number ? `#${job.job_number}` : '—'}
        </span>
      </div>

      {/* Status + Type pills */}
      <div className="flex items-center gap-1.5 shrink-0 w-[150px]">
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${getStatusColor(job.status)}`}>
          {job.status}
        </span>
        {job.job_type && (
          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${getJobTypeColor(job.job_type as JobType)}`}>
            {jobTypeLabel(job.job_type)}
          </span>
        )}
      </div>

      {/* Title */}
      <span className="flex-[2] min-w-0 truncate text-base font-medium text-theme">
        {job.title}
      </span>

      {/* Customer */}
      {canViewCustomerName && (
        <span className="flex-[2] min-w-0 truncate text-sm text-theme-muted">
          {job.customer?.name || '—'}
        </span>
      )}

      {/* Equipment */}
      <span className="flex-1 min-w-0 truncate text-sm font-mono text-theme-muted">
        {job.forklift?.forklift_no || job.forklift?.serial_number || '—'}
      </span>

      {/* Technician — hidden in technician's own view (always themselves) */}
      {!isTechnician && (
        <span className="flex-[1.5] min-w-0 truncate text-sm text-theme-muted">
          {job.assigned_technician_name || '—'}
        </span>
      )}

      {/* Date */}
      <span className="shrink-0 w-[85px] text-sm text-theme-muted">
        {scheduledLabel}
      </span>

      {/* Action / Pin / Chevron */}
      <div className="shrink-0 w-10 flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        {needsAcceptance ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => onAccept(e, job.job_id)}
              disabled={processingJobId === job.job_id}
              className="flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-xs font-medium text-white active:scale-95 transition-all hover:bg-emerald-700 hover:shadow-md disabled:opacity-50"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Accept
            </button>
            <button
              onClick={(e) => onReject(e, job.job_id)}
              disabled={processingJobId === job.job_id}
              className="flex h-8 items-center gap-1 rounded-lg bg-red-50 px-2.5 text-xs font-medium text-red-700 active:scale-95 transition-all hover:bg-red-100 hover:shadow-md disabled:opacity-50 dark:bg-red-900/20 dark:text-red-300"
            >
              <XCircle className="h-3.5 w-3.5" />
              Reject
            </button>
          </div>
        ) : (
          <ChevronRight className="h-4 w-4 text-theme-muted" />
        )}
      </div>
    </div>
  );
});
JobListRow.displayName = 'JobListRow';
