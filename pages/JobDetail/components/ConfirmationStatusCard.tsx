import React from 'react';
import { Job } from '../../../types';
import { RoleFlags, StatusFlags } from '../types';
import { ShieldCheck, Box, Wrench, Clock, CheckCircle } from 'lucide-react';

interface ConfirmationStatusCardProps {
  job: Job;
  roleFlags: RoleFlags;
  statusFlags: StatusFlags;
  onConfirmParts: () => void;
}

export const ConfirmationStatusCard: React.FC<ConfirmationStatusCardProps> = ({
  job,
  roleFlags,
  statusFlags,
  onConfirmParts,
}) => {
  const { isAdmin, isAdminStore, isAccountant } = roleFlags;
  const { isAwaitingFinalization, isCompleted } = statusFlags;

  // Only show for awaiting finalization or completed jobs
  if (!isAwaitingFinalization && !isCompleted) return null;

  return (
    <div className="card-premium p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-[var(--text-muted)]" />
        </div>
        <h3 className="font-semibold text-[var(--text)]">Confirmation Status</h3>
      </div>

      <div className="space-y-3">
        {/* Parts Confirmation (Admin 2 - Store) */}
        <div className="flex items-center justify-between p-3 bg-[var(--bg-subtle)] rounded-lg">
          <div className="flex items-center gap-2">
            <Box className="w-4 h-4 text-[var(--text-muted)]" />
            <span className="text-sm text-[var(--text-secondary)]">Parts Confirmation</span>
            <span className="text-xs text-[var(--text-muted)]">(Admin 2)</span>
          </div>
          {job.parts_confirmed_at ? (
            <div className="flex items-center gap-2 text-[var(--success)]">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm">{job.parts_confirmed_by_name}</span>
              <span className="text-xs text-[var(--text-muted)]">
                {new Date(job.parts_confirmed_at).toLocaleDateString()}
              </span>
            </div>
          ) : job.parts_confirmation_skipped ? (
            <span className="text-sm text-[var(--text-muted)] italic">Skipped (no parts)</span>
          ) : job.parts_used.length === 0 ? (
            <span className="text-sm text-[var(--text-muted)] italic">N/A (no parts used)</span>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-amber-600">
                <Clock className="w-4 h-4" />
                <span className="text-sm">Pending</span>
              </div>
              {(isAdminStore || isAdmin || isAccountant) && (
                <button 
                  onClick={onConfirmParts}
                  className="ml-2 px-3 py-1 text-xs bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-opacity"
                >
                  Verify Parts
                </button>
              )}
            </div>
          )}
        </div>

        {/* Job Confirmation (Admin 1 - Service) */}
        <div className="flex items-center justify-between p-3 bg-[var(--bg-subtle)] rounded-lg">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-[var(--text-muted)]" />
            <span className="text-sm text-[var(--text-secondary)]">Job Confirmation</span>
            <span className="text-xs text-[var(--text-muted)]">(Admin 1)</span>
          </div>
          {job.job_confirmed_at ? (
            <div className="flex items-center gap-2 text-[var(--success)]">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm">{job.job_confirmed_by_name}</span>
              <span className="text-xs text-[var(--text-muted)]">
                {new Date(job.job_confirmed_at).toLocaleDateString()}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-amber-600">
              <Clock className="w-4 h-4" />
              <span className="text-sm">Pending</span>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Notes */}
      {(job.parts_confirmation_notes || job.job_confirmation_notes) && (
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          {job.parts_confirmation_notes && (
            <p className="text-sm text-amber-800">
              <span className="font-medium">Parts:</span> {job.parts_confirmation_notes}
            </p>
          )}
          {job.job_confirmation_notes && (
            <p className="text-sm text-amber-800 mt-1">
              <span className="font-medium">Job:</span> {job.job_confirmation_notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
