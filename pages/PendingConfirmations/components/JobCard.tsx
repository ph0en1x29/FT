import {
CheckCircle,
Clock,
FileText,
Package,
Wrench,
XCircle,
} from 'lucide-react';
import { Job } from '../../../types';
import { JobCardProps } from '../types';

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
  processing,
  canConfirm,
  onConfirmParts,
  onConfirmJob,
  onSkipParts,
  onReject,
  onNavigate,
}: JobCardProps) {
  const hoursPending = getHoursPending(job);
  const urgencyClass = getUrgencyClass(hoursPending);

  return (
    <div className="card-theme p-4 rounded-xl hover:shadow-theme transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {/* Job Header */}
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => onNavigate(job.job_id)}
              className="font-semibold text-theme hover:text-[var(--accent)] transition-colors"
            >
              {job.title}
            </button>
            <span className={`px-2 py-0.5 text-xs rounded-full border ${urgencyClass}`}>
              {hoursPending}h pending
            </span>
            {job.job_type && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600">
                {job.job_type}
              </span>
            )}
          </div>

          {/* Job Details */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-theme-muted">Customer:</span>
              <span className="ml-1 text-theme">{job.customer?.name || 'N/A'}</span>
            </div>
            <div>
              <span className="text-theme-muted">Technician:</span>
              <span className="ml-1 text-theme">{job.assigned_technician_name || 'N/A'}</span>
            </div>
            <div>
              <span className="text-theme-muted">Completed:</span>
              <span className="ml-1 text-theme">
                {job.completed_at
                  ? new Date(job.completed_at).toLocaleDateString()
                  : 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-theme-muted">SRN:</span>
              <span className="ml-1 text-theme">{job.service_report_number || 'N/A'}</span>
            </div>
          </div>

          {/* Parts Used (for parts tab) */}
          {activeTab === 'parts' && job.parts_used.length > 0 && (
            <div className="mt-3 p-3 bg-[var(--bg-subtle)] rounded-lg">
              <div className="text-xs font-medium text-theme-muted mb-2">
                Parts Used ({job.parts_used.length})
              </div>
              <div className="space-y-1">
                {job.parts_used.slice(0, 3).map((part, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-theme">{part.part_name}</span>
                    <span className="text-theme-muted">
                      x{part.quantity} @ RM{part.sell_price_at_time}
                    </span>
                  </div>
                ))}
                {job.parts_used.length > 3 && (
                  <div className="text-xs text-theme-muted">
                    +{job.parts_used.length - 3} more items
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2">
          {activeTab === 'parts' ? (
            <>
              <button
                onClick={() => onConfirmParts(job.job_id)}
                disabled={processing || !canConfirm}
                className="btn-premium btn-premium-primary text-sm"
              >
                <CheckCircle className="w-4 h-4" />
                Confirm Parts
              </button>
              {job.parts_used.length === 0 && (
                <button
                  onClick={() => onSkipParts(job.job_id)}
                  disabled={processing}
                  className="btn-premium btn-premium-secondary text-sm"
                >
                  Skip (No Parts)
                </button>
              )}
              <button
                onClick={() => onReject(job.job_id, 'parts')}
                disabled={processing}
                className="btn-premium btn-premium-secondary text-sm text-red-600 border-red-200 hover:bg-red-50"
              >
                <XCircle className="w-4 h-4" />
                Reject
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onConfirmJob(job.job_id)}
                disabled={processing || !canConfirm}
                className="btn-premium btn-premium-primary text-sm"
              >
                <CheckCircle className="w-4 h-4" />
                Confirm Job
              </button>
              <button
                onClick={() => onReject(job.job_id, 'job')}
                disabled={processing}
                className="btn-premium btn-premium-secondary text-sm text-red-600 border-red-200 hover:bg-red-50"
              >
                <XCircle className="w-4 h-4" />
                Reject
              </button>
            </>
          )}
          <button
            onClick={() => onNavigate(job.job_id)}
            className="btn-premium btn-premium-secondary text-sm"
          >
            <FileText className="w-4 h-4" />
            View Details
          </button>
        </div>
      </div>

      {/* Confirmation Status */}
      <div className="mt-3 pt-3 border-t border-theme flex items-center gap-4 text-xs">
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
    </div>
  );
}
