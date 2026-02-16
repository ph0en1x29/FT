import {
CheckCircle,
ChevronDown,
ChevronUp,
Clock,
FileText,
Package,
Wrench,
XCircle,
} from 'lucide-react';
import { Job } from '../../../types';
import { JobCardProps } from '../types';

type PendingConfirmationsJobCardProps = JobCardProps & {
  isExpanded: boolean;
  isExpandable?: boolean;
  onToggleExpand: () => void;
};

// Calculate hours pending since completion
export function getHoursPending(job: Job): number {
  const completedAt = job.completed_at ? new Date(job.completed_at) : new Date();
  const now = new Date();
  return Math.floor((now.getTime() - completedAt.getTime()) / (1000 * 60 * 60));
}

// Get urgency class based on hours pending
export function getUrgencyClass(hours: number): string {
  if (hours >= 24) return 'bg-red-100 text-red-700 border-red-200';
  if (hours >= 12) return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-green-100 text-green-700 border-green-200';
}

export function JobCard({
  job,
  activeTab,
  isExpanded,
  isExpandable = true,
  processing,
  canConfirm,
  onToggleExpand,
  onConfirmParts,
  onConfirmJob,
  onSkipParts,
  onReject,
  onNavigate,
}: PendingConfirmationsJobCardProps) {
  const hoursPending = getHoursPending(job);
  const urgencyClass = getUrgencyClass(hoursPending);
  const rejectType = activeTab === 'parts' ? 'parts' : 'job';
  const completedDate = job.completed_at
    ? new Date(job.completed_at).toLocaleString()
    : 'N/A';

  const handleToggleExpand = () => {
    if (!isExpandable) return;
    onToggleExpand();
  };

  return (
    <div className="card-theme p-4 rounded-xl hover:shadow-theme transition-shadow">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <button
          type="button"
          onClick={handleToggleExpand}
          className={`flex-1 text-left ${isExpandable ? 'cursor-pointer' : 'cursor-default'}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-theme">{job.title}</span>
                <span className={`px-2 py-0.5 text-xs rounded-full border ${urgencyClass}`}>
                  {hoursPending}h pending
                </span>
                <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600">
                  {job.parts_used.length} parts
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="text-theme-muted">
                  Customer: <span className="text-theme">{job.customer?.name || 'N/A'}</span>
                </span>
                <span className="text-theme-muted">
                  Technician: <span className="text-theme">{job.assigned_technician_name || 'N/A'}</span>
                </span>
              </div>
            </div>
            <span className={`mt-0.5 shrink-0 text-theme-muted transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </span>
          </div>
        </button>

        <div className="flex items-center gap-2 lg:items-start lg:pt-0.5">
          {activeTab === 'parts' ? (
            <button
              onClick={() => onConfirmParts(job.job_id)}
              disabled={processing || !canConfirm}
              className="btn-premium btn-premium-primary text-sm"
            >
              <CheckCircle className="w-4 h-4" />
              Confirm Parts
            </button>
          ) : (
            <button
              onClick={() => onConfirmJob(job.job_id)}
              disabled={processing || !canConfirm}
              className="btn-premium btn-premium-primary text-sm"
            >
              <CheckCircle className="w-4 h-4" />
              Confirm Job
            </button>
          )}
          <button
            onClick={() => onReject(job.job_id, rejectType)}
            disabled={processing}
            className="btn-premium btn-premium-secondary text-sm text-red-600 border-red-200 hover:bg-red-50"
          >
            <XCircle className="w-4 h-4" />
            Reject
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-theme space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-theme-muted">SRN:</span>
              <span className="ml-1 text-theme">{job.service_report_number || 'N/A'}</span>
            </div>
            <div>
              <span className="text-theme-muted">Completed:</span>
              <span className="ml-1 text-theme">{completedDate}</span>
            </div>
          </div>

          <div className="p-3 bg-[var(--bg-subtle)] rounded-lg">
            <div className="text-xs font-medium text-theme-muted mb-2">
              Parts Used ({job.parts_used.length})
            </div>
            {job.parts_used.length > 0 ? (
              <div className="space-y-1">
                {job.parts_used.map((part, idx) => (
                  <div key={idx} className="flex justify-between text-sm gap-3">
                    <span className="text-theme">{part.part_name}</span>
                    <span className="text-theme-muted text-right">
                      x{part.quantity} @ RM{part.sell_price_at_time}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-theme-muted">No parts used</div>
            )}
            {activeTab === 'parts' && job.parts_used.length === 0 && (
              <button
                onClick={() => onSkipParts(job.job_id)}
                disabled={processing}
                className="mt-3 btn-premium btn-premium-secondary text-sm"
              >
                Skip (No Parts)
              </button>
            )}
          </div>

          <div className="pt-3 border-t border-theme flex flex-col gap-2 text-xs sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
            <div className="flex items-center gap-1">
              <Package className="w-3 h-3" />
              <span className="text-theme-muted">Parts:</span>
              {job.parts_confirmed_at ? (
                <span className="text-green-600 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Confirmed by {job.parts_confirmed_by_name}
                </span>
              ) : job.parts_confirmation_skipped ? (
                <span className="text-slate-500">Skipped (no parts)</span>
              ) : job.parts_used.length === 0 ? (
                <span className="text-slate-500">No parts used</span>
              ) : (
                <span className="text-amber-600 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Pending
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Wrench className="w-3 h-3" />
              <span className="text-theme-muted">Job:</span>
              {job.job_confirmed_at ? (
                <span className="text-green-600 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Confirmed by {job.job_confirmed_by_name}
                </span>
              ) : (
                <span className="text-amber-600 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Pending
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => onNavigate(job.job_id)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--accent)] hover:opacity-80 transition-opacity"
          >
            <FileText className="w-4 h-4" />
            View Details
          </button>
        </div>
      )}
    </div>
  );
}
