import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import React, { useState } from 'react';
import { SwipeToSign } from '../../../components/SwipeToSign';
import { bulkCompleteJobs } from '../../../services/jobCompletionService';
import { showToast } from '../../../services/toastService';
import type { Job } from '../../../types';
import type { User } from '../../../types/user.types';
import type { ReadinessMap } from './SiteSignOffBanner';

interface SiteGroup {
  customerId: string;
  customerName: string;
  siteId: string;
  siteAddress: string;
  jobs: Job[];
  unsignedCount: number;
}

interface BulkSignOffModalProps {
  siteGroup: SiteGroup;
  /**
   * Pre-flight readiness map (lazy-fetched by the banner). For each job,
   * `canComplete=true` means the trigger would accept the AWAITING_FINALIZATION
   * transition right now; otherwise `blocker` carries the specific reason
   * (missing checklist, missing service notes, parts not recorded, etc.).
   */
  readiness: ReadinessMap;
  currentUser: User;
  onComplete: () => void;
  onClose: () => void;
}

type ModalStep = 'technician' | 'customer';

interface PerJobResult {
  job_id: string;
  ok: boolean;
  blocker: string | null;
}

const isReady = (readiness: ReadinessMap, jobId: string) =>
  readiness.get(jobId)?.canComplete === true;

/**
 * Bulk sign-off modal driven by an atomic completion RPC.
 *
 * Step 1 (technician): tech selects jobs to sign and completes a swipe-to-sign
 * gesture. Skipped automatically when every job in the working set already
 * has a tech signature (recovery case).
 *
 * Step 2 (customer): customer name + IC + swipe.
 *
 * Submit: single call to `rpc_bulk_complete_jobs` which per job locks the
 * row, pre-validates via the shared trigger helper, and atomically writes
 * both signatures and the AWAITING_FINALIZATION status. Failed jobs do NOT
 * leave behind partial signature writes. Partial failures keep the modal
 * open with the per-job blocker visible so the tech knows what to fix.
 */
export const BulkSignOffModal: React.FC<BulkSignOffModalProps> = ({
  siteGroup,
  readiness,
  currentUser,
  onComplete,
  onClose,
}) => {
  // Working set: jobs missing a customer signature. Three sub-buckets:
  //   - eligibleJobs:           ready (per readiness) AND tech sig pending → step 1 candidates
  //   - techAlreadySignedJobs:  ready AND tech sig already present → recovery cohort
  //   - blockedJobs:            NOT ready (per readiness) → render with specific blocker text
  const customerUnsignedJobs = siteGroup.jobs.filter((job) => !job.customer_signature);
  const eligibleJobs = customerUnsignedJobs.filter(
    (job) => !job.technician_signature && isReady(readiness, job.job_id)
  );
  const techAlreadySignedJobs = customerUnsignedJobs.filter(
    (job) => job.technician_signature && isReady(readiness, job.job_id)
  );
  const blockedJobs = customerUnsignedJobs.filter(
    (job) => !isReady(readiness, job.job_id)
  );

  // Skip step 1 entirely if every signable job in the batch is already tech-signed.
  const skipTechStep = eligibleJobs.length === 0 && techAlreadySignedJobs.length > 0;

  const [step, setStep] = useState<ModalStep>(skipTechStep ? 'customer' : 'technician');
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(
    new Set([
      ...eligibleJobs.map((j) => j.job_id),
      ...techAlreadySignedJobs.map((j) => j.job_id),
    ])
  );
  const [techSigned, setTechSigned] = useState(skipTechStep);
  const [techSignedAt, setTechSignedAt] = useState<string | null>(
    skipTechStep ? new Date().toISOString() : null
  );
  const [customerName, setCustomerName] = useState('');
  const [icNumber, setIcNumber] = useState('');
  const [customerSigned, setCustomerSigned] = useState(false);
  const [customerSignedAt, setCustomerSignedAt] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Populated after submit. When non-null, modal renders the per-job result
  // panel and stays open. Successes get filtered out of the working set on
  // the next render via the parent's refresh; failures show the blocker text
  // so the tech can go fix the underlying issue and retry.
  const [submitResults, setSubmitResults] = useState<PerJobResult[] | null>(null);

  const toggleJobSelection = (jobId: string) => {
    setSelectedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  const onTechSwipe = () => {
    setTechSigned(true);
    setTechSignedAt(new Date().toISOString());
  };

  const onCustomerSwipe = () => {
    setCustomerSigned(true);
    setCustomerSignedAt(new Date().toISOString());
  };

  const handleTechNext = () => {
    if (!techSigned) {
      showToast.error('Please complete technician signature');
      return;
    }
    if (selectedJobIds.size === 0) {
      showToast.error('Please select at least one job to sign');
      return;
    }
    setStep('customer');
  };

  const handleBack = () => {
    if (skipTechStep) {
      onClose();
      return;
    }
    setStep('technician');
    setCustomerSigned(false);
    setCustomerSignedAt(null);
  };

  const handleSubmit = async () => {
    if (!customerSigned) {
      showToast.error('Please complete customer signature');
      return;
    }
    if (!customerName.trim()) {
      showToast.error('Please enter customer name');
      return;
    }
    if (!icNumber.trim()) {
      showToast.error('Please enter IC number');
      return;
    }

    setIsSubmitting(true);
    setSubmitResults(null);
    try {
      const results = await bulkCompleteJobs({
        jobIds: Array.from(selectedJobIds),
        techName: currentUser.name,
        techSignedAt: techSignedAt ?? new Date().toISOString(),
        customerName: customerName.trim(),
        customerIc: icNumber.trim(),
        customerSignedAt: customerSignedAt ?? new Date().toISOString(),
      });

      const successes = results.filter((r) => r.ok);
      const failures = results.filter((r) => !r.ok);

      if (failures.length === 0) {
        showToast.success(
          `${successes.length} job${successes.length > 1 ? 's' : ''} signed & completed`
        );
        onComplete();
        return;
      }

      // Partial — keep modal open so the tech can read the per-job blockers.
      // The successful jobs already transitioned, so the parent will refresh
      // them out of the working set on next banner re-fetch.
      setSubmitResults(results);
      if (successes.length > 0) {
        showToast.warning(
          `${successes.length} signed, ${failures.length} blocked`,
          'See per-job reasons below — fix on the job page, then retry.'
        );
      } else {
        showToast.error(
          'No jobs signed',
          'See per-job reasons below — fix on the job page, then retry.'
        );
      }
    } catch (error) {
      showToast.error(
        error instanceof Error ? error.message : 'Failed to sign jobs'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render the per-job result panel once we have submitResults.
  if (submitResults) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-[var(--surface)] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
          <div className="p-6 border-b border-[var(--border)]">
            <h2 className="text-xl font-semibold text-[var(--text)] mb-1">
              Bulk Sign Off — Result
            </h2>
            <p className="text-sm text-[var(--text-muted)]">
              {submitResults.filter((r) => r.ok).length} of {submitResults.length} job{submitResults.length > 1 ? 's' : ''} completed.
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-2">
            {submitResults.map((r) => {
              const job = siteGroup.jobs.find((j) => j.job_id === r.job_id);
              const label = job ? `Job #${job.job_number}` : `Job ${r.job_id.slice(0, 8)}`;
              return (
                <div
                  key={r.job_id}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    r.ok
                      ? 'bg-[var(--success-bg)] border-[var(--success)]/30'
                      : 'bg-[var(--warning-bg)] border-[var(--warning)]/30'
                  }`}
                >
                  {r.ok ? (
                    <CheckCircle2 className="w-5 h-5 mt-0.5 text-[var(--success)] shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 mt-0.5 text-[var(--warning)] shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[var(--text)]">{label}</div>
                    <div className="text-xs text-[var(--text-muted)] mt-0.5">
                      {r.ok ? 'Signed and moved to Awaiting Finalization.' : r.blocker}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="p-6 border-t border-[var(--border)] flex gap-3">
            <button
              onClick={onComplete}
              className="flex-1 px-4 py-2.5 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:bg-[var(--accent)]/90 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--surface)] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="p-6 border-b border-[var(--border)]">
          <h2 className="text-xl font-semibold text-[var(--text)] mb-1">
            Bulk Sign Off — {siteGroup.customerName}
          </h2>
          <p className="text-sm text-[var(--text-muted)]">{siteGroup.siteAddress}</p>
          <div className="mt-3 flex items-center gap-2">
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${step === 'technician' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--success)] text-white'}`}>
              {skipTechStep ? '✓ Technician' : '1. Technician'}
            </div>
            <div className="flex-1 h-px bg-[var(--border)]" />
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${step === 'customer' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-subtle)] text-[var(--text-muted)]'}`}>
              2. Customer
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">

          {step === 'technician' ? (
            <div className="space-y-6">

              {/* Eligible jobs */}
              <div>
                <h3 className="text-sm font-medium text-[var(--text)] mb-3">
                  Select Jobs to Sign ({selectedJobIds.size} of {eligibleJobs.length + techAlreadySignedJobs.length} selected)
                </h3>
                {eligibleJobs.length === 0 && blockedJobs.length === 0 && techAlreadySignedJobs.length === 0 && (
                  <p className="text-sm text-[var(--text-muted)]">No unsigned jobs to show.</p>
                )}
                {techAlreadySignedJobs.length > 0 && (
                  <p className="text-xs text-[var(--text-muted)] mb-2">
                    {techAlreadySignedJobs.length} job{techAlreadySignedJobs.length > 1 ? 's' : ''} already signed by you — customer signature will be applied.
                  </p>
                )}
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {eligibleJobs.map((job) => (
                    <label
                      key={job.job_id}
                      className="flex items-center gap-3 p-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg cursor-pointer hover:border-[var(--accent)] transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedJobIds.has(job.job_id)}
                        onChange={() => toggleJobSelection(job.job_id)}
                        className="w-4 h-4 text-[var(--accent)] rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-[var(--text)]">
                          Job #{job.job_number}
                        </div>
                        <div className="text-xs text-[var(--text-muted)] truncate">
                          {job.forklift?.model || 'N/A'} · {job.forklift?.serial_number || job.forklift?.forklift_no || 'N/A'}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Blocked jobs — render the SPECIFIC blocker reason from readiness */}
              {blockedJobs.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-[var(--warning)]" />
                    <h3 className="text-sm font-medium text-[var(--warning)]">
                      Cannot sign yet — fix on job page first
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {blockedJobs.map((job) => {
                      const blocker = readiness.get(job.job_id)?.blocker
                        ?? 'Job not ready for completion.';
                      // Trigger messages start with "Cannot complete job: " — strip
                      // for cleaner inline display.
                      const reason = blocker.replace(/^Cannot complete job:\s*/, '');
                      return (
                        <div
                          key={job.job_id}
                          className="flex items-start gap-3 p-3 bg-[var(--warning-bg)] border border-[var(--warning)]/30 rounded-lg opacity-90"
                        >
                          <input type="checkbox" disabled className="w-4 h-4 rounded opacity-40 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-[var(--text)]">
                              Job #{job.job_number}
                            </div>
                            <div className="text-xs text-[var(--text-muted)] truncate">
                              {job.forklift?.model || 'N/A'} · {job.forklift?.serial_number || job.forklift?.forklift_no || 'N/A'}
                            </div>
                            <div className="text-xs text-[var(--warning)] mt-1">{reason}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Technician Signature */}
              <div>
                <h3 className="text-sm font-medium text-[var(--text)] mb-2">Technician Signature</h3>
                <p className="text-xs text-[var(--text-muted)] mb-4">
                  I certify that the selected jobs have been completed according to standards.
                </p>
                <SwipeToSign
                  onSign={onTechSwipe}
                  signed={techSigned}
                  label="Swipe to Sign"
                />
              </div>
            </div>

          ) : (
            <div className="space-y-6">

              {/* Summary */}
              <div className="p-4 bg-[var(--bg)] border border-[var(--border)] rounded-lg">
                <p className="text-sm text-[var(--text-muted)] mb-2">
                  Signing {selectedJobIds.size} job{selectedJobIds.size > 1 ? 's' : ''}:
                </p>
                <div className="flex flex-wrap gap-2">
                  {Array.from(selectedJobIds).map((jobId) => {
                    const job = siteGroup.jobs.find((j) => j.job_id === jobId);
                    return job ? (
                      <span key={jobId} className="px-2 py-1 bg-[var(--accent)] text-white text-xs rounded">
                        #{job.job_number}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>

              {/* Customer Details */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
                    Customer Name <span className="text-[var(--error)]">*</span>
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter customer name"
                    className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
                    IC Number <span className="text-[var(--error)]">*</span>
                  </label>
                  <input
                    type="text"
                    value={icNumber}
                    onChange={(e) => setIcNumber(e.target.value)}
                    placeholder="e.g. 901234-10-5678"
                    className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>
              </div>

              {/* Customer Signature */}
              <div>
                <h3 className="text-sm font-medium text-[var(--text)] mb-2">Customer Signature</h3>
                <p className="text-xs text-[var(--text-muted)] mb-4">
                  I acknowledge that the work has been completed to my satisfaction.
                </p>
                {(!customerName.trim() || !icNumber.trim()) && (
                  <p className="text-xs text-[var(--warning)] mb-2">Fill in name and IC number to sign</p>
                )}
                <SwipeToSign
                  onSign={onCustomerSwipe}
                  signed={customerSigned}
                  label="Swipe to Confirm"
                  disabled={!customerName.trim() || !icNumber.trim()}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[var(--border)] flex gap-3">
          {step === 'technician' ? (
            <>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 border border-[var(--border)] rounded-lg text-sm font-medium text-[var(--text)] hover:bg-[var(--bg)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleTechNext}
                disabled={!techSigned || selectedJobIds.size === 0}
                className="flex-1 px-4 py-2.5 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:bg-[var(--accent)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleBack}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2.5 border border-[var(--border)] rounded-lg text-sm font-medium text-[var(--text)] hover:bg-[var(--bg)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {skipTechStep ? 'Cancel' : 'Back'}
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !customerSigned || !customerName.trim() || !icNumber.trim()}
                className="flex-1 px-4 py-2.5 bg-[var(--success)] text-white rounded-lg text-sm font-medium hover:bg-[var(--success)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Signing & completing...' : 'Complete Sign Off'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
