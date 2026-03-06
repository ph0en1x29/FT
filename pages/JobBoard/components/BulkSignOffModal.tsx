import React, { useState } from 'react';
import { SignaturePad } from '../../../components/SignaturePad';
import { bulkSignJobs } from '../../../services/jobMediaService';
import { showToast } from '../../../services/toastService';
import type { Job } from '../../../types';
import type { User } from '../../../types/user.types';

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
  currentUser: User;
  onComplete: () => void;
  onClose: () => void;
}

type ModalStep = 'technician' | 'customer';

/**
 * Two-step modal for bulk signing jobs at a site
 * Step 1: Technician signature
 * Step 2: Customer signature
 */
export const BulkSignOffModal: React.FC<BulkSignOffModalProps> = ({
  siteGroup,
  currentUser,
  onComplete,
  onClose,
}) => {
  const [step, setStep] = useState<ModalStep>('technician');
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(
    new Set(
      siteGroup.jobs
        .filter((job) => !job.technician_signature)
        .map((job) => job.job_id)
    )
  );
  const [techSignature, setTechSignature] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState(
    siteGroup.jobs[0]?.customer?.name || ''
  );
  const [icNumber, setIcNumber] = useState('');
  const [customerSignature, setCustomerSignature] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleJobSelection = (jobId: string) => {
    const newSet = new Set(selectedJobIds);
    if (newSet.has(jobId)) {
      newSet.delete(jobId);
    } else {
      newSet.add(jobId);
    }
    setSelectedJobIds(newSet);
  };

  const handleTechSignatureSave = (dataUrl: string) => {
    setTechSignature(dataUrl);
  };

  const handleCustomerSignatureSave = (dataUrl: string) => {
    setCustomerSignature(dataUrl);
  };

  const handleTechNext = () => {
    if (!techSignature) {
      showToast.error('Please provide your signature');
      return;
    }
    if (selectedJobIds.size === 0) {
      showToast.error('Please select at least one job to sign');
      return;
    }
    setStep('customer');
  };

  const handleComplete = async () => {
    if (!customerSignature) {
      showToast.error('Please obtain customer signature');
      return;
    }
    if (!customerName.trim()) {
      showToast.error('Please enter customer name');
      return;
    }

    setIsSubmitting(true);
    try {
      const jobIdsArray = Array.from(selectedJobIds);

      // Step 1: Sign technician signature (only for jobs without existing tech signature)
      const jobsNeedingTechSig = siteGroup.jobs
        .filter((job) => selectedJobIds.has(job.job_id) && !job.technician_signature)
        .map((job) => job.job_id);

      if (jobsNeedingTechSig.length > 0 && techSignature) {
        await bulkSignJobs(
          jobsNeedingTechSig,
          'technician',
          currentUser.name,
          techSignature
        );
      }

      // Step 2: Sign customer signature for all selected jobs
      await bulkSignJobs(
        jobIdsArray,
        'customer',
        customerName.trim(),
        customerSignature,
        icNumber.trim() || undefined
      );

      showToast.success(
        `Successfully signed off ${jobIdsArray.length} job${jobIdsArray.length > 1 ? 's' : ''}`
      );
      onComplete();
    } catch (error) {
      console.error('Bulk sign-off error:', error);
      showToast.error(error instanceof Error ? error.message : 'Failed to complete sign-off');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-2xl shadow-premium-elevated my-8">
        {/* Step 1: Technician Sign */}
        {step === 'technician' && (
          <>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-[var(--text)] mb-1">
                Sign Off — {siteGroup.customerName}
              </h2>
              <p className="text-sm text-[var(--text-muted)]">
                Select jobs to sign and provide your signature
              </p>
            </div>

            {/* Job selection list */}
            <div className="space-y-2 mb-6 max-h-64 overflow-y-auto">
              {siteGroup.jobs.map((job) => {
                const alreadySigned = !!job.technician_signature;
                const isSelected = selectedJobIds.has(job.job_id);

                return (
                  <div
                    key={job.job_id}
                    className="border border-[var(--border)] rounded-lg p-3 flex items-start gap-3"
                  >
                    {alreadySigned ? (
                      <div className="flex items-center justify-center w-5 h-5 text-[var(--success)] mt-0.5">
                        ✅
                      </div>
                    ) : (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleJobSelection(job.job_id)}
                        className="w-5 h-5 mt-0.5 accent-[var(--accent)]"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-[var(--text)]">
                          {job.forklift?.serial_number || 'N/A'}
                        </span>
                        <span className="text-sm px-2 py-0.5 bg-[var(--surface)] border border-[var(--border)] rounded">
                          {job.job_type || 'Service'}
                        </span>
                        <span className="text-sm text-[var(--text-muted)]">
                          {job.status}
                        </span>
                      </div>
                      {alreadySigned && (
                        <p className="text-xs text-[var(--success)] mt-1">
                          Technician signature already recorded
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Technician signature pad */}
            <div className="mb-6">
              <SignaturePad onSave={handleTechSignatureSave} />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleTechNext}
                disabled={!techSignature || selectedJobIds.size === 0}
                className="flex-1 btn-premium px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                Next →
              </button>
            </div>
          </>
        )}

        {/* Step 2: Customer Sign */}
        {step === 'customer' && (
          <>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-[var(--text)] mb-1">
                Customer Verification
              </h2>
              <p className="text-sm text-[var(--text-muted)]">
                Signing off {selectedJobIds.size} job{selectedJobIds.size > 1 ? 's' : ''} at {siteGroup.customerName}
              </p>
            </div>

            {/* Job summary */}
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4 mb-6">
              <p className="text-sm font-semibold text-[var(--text)] mb-2">
                Jobs being signed:
              </p>
              <div className="space-y-1">
                {siteGroup.jobs
                  .filter((job) => selectedJobIds.has(job.job_id))
                  .map((job) => (
                    <p key={job.job_id} className="text-sm text-[var(--text-muted)]">
                      • {job.forklift?.serial_number || 'N/A'} — {job.job_type || 'Service'}
                    </p>
                  ))}
              </div>
            </div>

            {/* Customer details */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-2">
                  Customer Name
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter customer name"
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text)] placeholder:text-[var(--text-muted)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-2">
                  IC Number (Optional)
                </label>
                <input
                  type="text"
                  value={icNumber}
                  onChange={(e) => setIcNumber(e.target.value)}
                  placeholder="Enter IC number"
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text)] placeholder:text-[var(--text-muted)]"
                />
              </div>
            </div>

            {/* Customer signature pad */}
            <div className="mb-6">
              <SignaturePad onSave={handleCustomerSignatureSave} />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setStep('technician')}
                className="px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleComplete}
                disabled={!customerSignature || !customerName.trim() || isSubmitting}
                className="flex-1 btn-premium px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {isSubmitting ? 'Signing...' : 'Complete Sign Off'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
