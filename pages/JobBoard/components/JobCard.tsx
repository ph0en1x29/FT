import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  CheckSquare,
  Clock,
  MapPin,
  Square,
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
  const model = [job.forklift?.make, job.forklift?.model].filter(Boolean).join(' ');

  return [forkliftNo, customerForkliftNo ? `Cust ${customerForkliftNo}` : '', model]
    .filter(Boolean)
    .join(' · ');
};

const getSiteLabel = (job: JobWithHelperFlag) =>
  job.forklift?.site || job.forklift?.location || job.customer?.address || 'No site address';

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
  const responseState = getResponseTimeRemaining(job);
  const scheduledLabel = formatDate(job.scheduled_date || job.created_at);
  const equipmentLabel = getEquipmentLabel(job);
  const siteLabel = getSiteLabel(job);
  const footerTone = responseState.urgency === 'critical'
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
      className={`relative flex h-full min-w-0 flex-col overflow-visible rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${getStatusBorderColor(job)} ${
        isSelected ? 'ring-2 ring-blue-500/70 bg-blue-50/40 dark:bg-blue-900/15' : ''
      }`}
    >
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

          {job.job_number && (
            <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold tracking-[0.12em] text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
              {job.job_number}
            </span>
          )}

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

      <div className="mt-4 min-w-0 space-y-3">
        <div className="space-y-2">
          <h3 className="line-clamp-2 break-words text-lg font-semibold leading-tight text-theme">
            {job.title}
          </h3>
          {job.description && (
            <p className="line-clamp-2 text-sm leading-5 text-theme-muted">
              {job.description}
            </p>
          )}
        </div>

        <div className="grid gap-3 rounded-2xl bg-[var(--bg-subtle)]/60 p-3 sm:grid-cols-2">
          <div className="min-w-0 space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
              Customer
            </div>
            <div className="flex items-start gap-2 text-sm text-theme">
              <UserIcon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-muted)]" />
              <div className="min-w-0">
                <div className="break-words font-medium">
                  {job.customer?.name || 'Unassigned customer'}
                </div>
                {(job.customer?.account_number || job.customer?.contact_person) && (
                  <div className="mt-1 break-words text-xs text-theme-muted">
                    {[job.customer?.account_number, job.customer?.contact_person].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="min-w-0 space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
              Site
            </div>
            <div className="flex items-start gap-2 text-sm text-theme">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-muted)]" />
              <div className="min-w-0 break-words text-sm text-theme-muted">
                {siteLabel}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1.2fr)_auto]">
          <div className="min-w-0 rounded-2xl border border-[var(--border)]/80 bg-[var(--surface)] px-3 py-2.5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
              Equipment
            </div>
            <div className="mt-1 flex min-w-0 items-start gap-2">
              <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-muted)]" />
              <div className="min-w-0">
                <div className="break-words text-sm font-medium text-theme">
                  {equipmentLabel || 'Equipment not linked'}
                </div>
                {job.forklift?.type && (
                  <div className="mt-1 text-xs text-theme-muted">{job.forklift.type}</div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:min-w-[190px] sm:grid-cols-1">
            <div className="rounded-2xl border border-[var(--border)]/80 bg-[var(--surface)] px-3 py-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                Scheduled
              </div>
              <div className="mt-1 flex items-center gap-2 text-sm font-medium text-theme">
                <Calendar className="h-4 w-4 text-[var(--text-muted)]" />
                {scheduledLabel}
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)]/80 bg-[var(--surface)] px-3 py-2.5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                Assignee
              </div>
              <div className="mt-1 break-words text-sm font-medium text-theme">
                {job.assigned_technician_name || 'Unassigned'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-3">
        {isTechnician && jobNeedsAcceptance(job) && (
          <div className={`flex items-center gap-2 text-xs ${footerTone}`}>
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 break-words">
              {responseState.isExpired ? 'Response time expired' : `Respond within ${responseState.text}`}
            </span>
          </div>
        )}

        {!jobNeedsAcceptance(job) && isTechnician && job.status === JobStatus.ASSIGNED && job.assigned_technician_id === currentUser.user_id && job.technician_accepted_at && (
          <div className="flex items-center gap-2 text-xs text-emerald-600">
            <CheckCircle className="h-3.5 w-3.5 shrink-0" />
            Accepted and ready to start
          </div>
        )}

        {isTechnician && jobNeedsAcceptance(job) ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={(e) => onAccept(e, job.job_id)}
              disabled={processingJobId === job.job_id}
              className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              <CheckCircle className="h-4 w-4" />
              {processingJobId === job.job_id ? 'Accepting...' : 'Accept'}
            </button>
            <button
              onClick={(e) => onReject(e, job.job_id)}
              disabled={processingJobId === job.job_id}
              className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-xl bg-red-50 px-3 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50 dark:bg-red-900/20 dark:text-red-300"
            >
              <XCircle className="h-4 w-4" />
              Reject
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-theme-muted">
            <span className="break-words">
              {job.parts_used.length} part{job.parts_used.length === 1 ? '' : 's'} · {job.media.length} media
            </span>
            <span className="font-medium text-[var(--text-muted)]">Open details</span>
          </div>
        )}
      </div>
    </article>
  );
};
