import { Camera, CheckCircle2, ClipboardList, PenTool, Play, XCircle } from 'lucide-react';
import React from 'react';
import { Job } from '../../../types';
import { StatusFlags } from '../types';
import { isHourmeterExemptJob } from '../utils';

interface MobileTechnicianWorkflowCardProps {
  job: Job;
  statusFlags: StatusFlags;
  partsDeclared: boolean;
  onAcceptJob: () => void;
  onRejectJob: () => void;
  onStartJob: () => void;
  onCompleteJob: () => void;
  onScrollToChecklist: () => void;
  onScrollToPhotos: () => void;
  onScrollToSignatures: () => void;
  /**
   * Scrolls the page to the Parts section. Lets the "Parts declaration"
   * blocker chip become tappable so a tech who returned the only part on a
   * job has a clear path back to either add a real part or tick "No parts
   * used".
   */
  onScrollToParts?: () => void;
}

export const MobileTechnicianWorkflowCard: React.FC<MobileTechnicianWorkflowCardProps> = ({
  job,
  statusFlags,
  partsDeclared,
  onAcceptJob,
  onRejectJob,
  onStartJob,
  onCompleteJob,
  onScrollToChecklist,
  onScrollToPhotos,
  onScrollToSignatures,
  onScrollToParts,
}) => {
  // HOURMETER_EXEMPT_JOB_TYPES — FTS + Repair drop the "Hourmeter" blocker chip
  // so the Complete button isn't perma-disabled for jobs without a meaningful reading.
  const isHourmeterExempt = isHourmeterExemptJob(job.job_type);
  const blockers = [
    !statusFlags.hasAfterPhoto ? 'After photo' : null,
    !isHourmeterExempt && !statusFlags.hasHourmeter ? 'Hourmeter' : null,
    !job.technician_signature ? 'Technician sign' : null,
    !job.customer_signature ? 'Customer sign' : null,
    !partsDeclared ? 'Parts declaration' : null,
  ].filter(Boolean) as string[];

  const canComplete = blockers.length === 0;

  if (!(statusFlags.isAssigned || statusFlags.isInProgress || statusFlags.isAwaitingFinalization)) {
    return null;
  }

  return (
    <section
      className="rounded-[24px] border p-4 md:hidden"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--text-muted)' }}>
            Field Workflow
          </p>
          <h2 className="mt-1 text-base font-semibold" style={{ color: 'var(--text)' }}>
            {statusFlags.needsAcceptance
              ? 'Accept this job to begin'
              : statusFlags.hasAccepted
              ? (job.job_type === 'Repair' ? 'Start with photos' : 'Start with checklist and photos')
              : canComplete
              ? 'Ready to complete'
              : 'Finish the remaining requirements'}
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            {statusFlags.needsAcceptance
              ? 'Once accepted, you can start the job and record the condition check.'
              : statusFlags.hasAccepted
              ? 'The next step is to start the job, capture the condition, and begin work.'
              : canComplete
              ? 'All required items are in place. You can complete the job now.'
              : `${blockers.length} item${blockers.length === 1 ? '' : 's'} still blocking completion.`}
          </p>
        </div>
        <div
          className="rounded-full px-3 py-1 text-xs font-semibold"
          style={{
            background: canComplete ? 'rgba(52, 199, 89, 0.12)' : 'rgba(255, 149, 0, 0.12)',
            color: canComplete ? '#34C759' : '#FF9500',
          }}
        >
          {statusFlags.isAssigned ? 'Assigned' : statusFlags.isAwaitingFinalization ? 'Finalize' : 'In Progress'}
        </div>
      </div>

      {!statusFlags.needsAcceptance && !statusFlags.hasAccepted && blockers.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {blockers.map(blocker => {
            const action =
              blocker === 'After photo' ? onScrollToPhotos
              : blocker === 'Technician sign' ? onScrollToSignatures
              : blocker === 'Customer sign' ? onScrollToSignatures
              : blocker === 'Parts declaration' ? onScrollToParts
              : undefined;
            const className = "rounded-full px-3 py-1 text-xs font-medium";
            const style = { background: 'rgba(255, 149, 0, 0.12)', color: '#B45309' };
            return action
              ? <button key={blocker} onClick={action} className={className} style={style}>{blocker} →</button>
              : <span key={blocker} className={className} style={style}>{blocker}</span>;
          })}
        </div>
      )}

      {statusFlags.needsAcceptance && (
        <div className="mt-4 flex gap-2">
          <button onClick={onAcceptJob} className="btn-premium btn-premium-primary flex-1">
            <CheckCircle2 className="w-4 h-4" /> Accept
          </button>
          <button onClick={onRejectJob} className="btn-premium flex-1 bg-[var(--error-bg)] text-[var(--error)] hover:opacity-90">
            <XCircle className="w-4 h-4" /> Reject
          </button>
        </div>
      )}

      {statusFlags.hasAccepted && (
        <div className="mt-4">
          <button onClick={onStartJob} className="btn-premium btn-premium-primary w-full">
            <Play className="w-4 h-4" /> Start Job
          </button>
        </div>
      )}

      {(statusFlags.isInProgress || statusFlags.isAwaitingFinalization) && (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <button
              onClick={onScrollToChecklist}
              className="rounded-2xl border px-3 py-3 text-left"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
            >
              <ClipboardList className="w-4 h-4 mb-2" style={{ color: 'var(--accent)' }} />
              <span className="block text-xs font-medium" style={{ color: 'var(--text)' }}>Checklist</span>
            </button>
            <button
              onClick={onScrollToPhotos}
              className="rounded-2xl border px-3 py-3 text-left"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
            >
              <Camera className="w-4 h-4 mb-2" style={{ color: 'var(--accent)' }} />
              <span className="block text-xs font-medium" style={{ color: 'var(--text)' }}>Photos</span>
            </button>
            <button
              onClick={onScrollToSignatures}
              className="rounded-2xl border px-3 py-3 text-left"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
            >
              <PenTool className="w-4 h-4 mb-2" style={{ color: 'var(--accent)' }} />
              <span className="block text-xs font-medium" style={{ color: 'var(--text)' }}>Signatures</span>
            </button>
          </div>

          <div className="mt-4">
            <button
              onClick={onCompleteJob}
              disabled={!canComplete}
              className={`btn-premium w-full ${canComplete ? 'btn-premium-primary' : 'btn-premium-secondary opacity-60 cursor-not-allowed'}`}
            >
              <CheckCircle2 className="w-4 h-4" /> {canComplete ? 'Complete Job' : 'Complete After Requirements'}
            </button>
          </div>
        </>
      )}
    </section>
  );
};
