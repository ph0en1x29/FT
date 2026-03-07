import React, { useState } from 'react';
import { SwipeToSign } from '../../../components/SwipeToSign';
import { bulkSwipeSignJobs } from '../../../services/jobMediaService';
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
 * Step 1: Technician swipe signature
 * Step 2: Customer swipe signature
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
  const [techSigned, setTechSigned] = useState(false);
  const [customerName, setCustomerName] = useState(
    siteGroup.jobs[0]?.customer?.name || ''
  );
  const [icNumber, setIcNumber] = useState('');
  const [customerSigned, setCustomerSigned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleJobSelection = (jobId: string) => {
    setSelectedJobIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(jobId)) {
        newSet.delete(jobId);
      } else {
        newSet.add(jobId);
      }
      return newSet;
    });
  };

  const handleTechSwipe = () => {
    setTechSigned(true);
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

  const handleCustomerSwipe = () => {
    setCustomerSigned(true);
  };

  const handleCustomerSubmit = async () => {
    if (!customerSigned) {
      showToast.error('Please complete customer signature');
      return;
    }
    if (!customerName.trim()) {
      showToast.error('Please enter customer name');
      return;
    }

    setIsSubmitting(true);
    try {
      const jobIdsArray = Array.from(selectedJobIds) as string[];

      // Sign as technician
      await bulkSwipeSignJobs(
        jobIdsArray,
        'technician',
        currentUser.name
      );

      // Sign as customer
      await bulkSwipeSignJobs(
        jobIdsArray,
        'customer',
        customerName.trim(),
        icNumber.trim() || undefined
      );

      showToast.success(
        `Successfully signed ${jobIdsArray.length} job${jobIdsArray.length > 1 ? 's' : ''}`
      );
      onComplete();
    } catch (error) {
      console.error('Failed to bulk sign jobs:', error);
      showToast.error(error instanceof Error ? error.message : 'Failed to sign jobs');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    setStep('technician');
    setCustomerSigned(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--surface)] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-[var(--border)]">
          <h2 className="text-xl font-semibold text-[var(--text)] mb-1">
            Bulk Sign Off - {siteGroup.customerName}
          </h2>
          <p className="text-sm text-[var(--text-muted)]">
            {siteGroup.siteAddress}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <div
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                step === 'technician'
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--success)] text-white'
              }`}
            >
              1. Technician
            </div>
            <div className="flex-1 h-px bg-[var(--border)]" />
            <div
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                step === 'customer'
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--bg-subtle)] text-[var(--text-muted)]'
              }`}
            >
              2. Customer
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'technician' ? (
            <div className="space-y-6">
              {/* Job Selection */}
              <div>
                <h3 className="text-sm font-medium text-[var(--text)] mb-3">
                  Select Jobs to Sign ({selectedJobIds.size} selected)
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {siteGroup.jobs
                    .filter((job) => !job.technician_signature)
                    .map((job) => (
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
                            {job.forklift?.model || 'N/A'} • {job.forklift?.serial || 'N/A'}
                          </div>
                        </div>
                      </label>
                    ))}
                </div>
              </div>

              {/* Technician Signature */}
              <div>
                <h3 className="text-sm font-medium text-[var(--text)] mb-3">
                  Technician Signature
                </h3>
                <p className="text-xs text-[var(--text-muted)] mb-4">
                  I certify that the selected jobs have been completed according to standards.
                </p>
                <SwipeToSign
                  onSign={handleTechSwipe}
                  signed={techSigned}
                  label="Swipe to Sign"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Selected Jobs Summary */}
              <div className="p-4 bg-[var(--bg)] border border-[var(--border)] rounded-lg">
                <p className="text-sm text-[var(--text-muted)] mb-2">
                  Signing {selectedJobIds.size} job{selectedJobIds.size > 1 ? 's' : ''}:
                </p>
                <div className="flex flex-wrap gap-2">
                  {Array.from(selectedJobIds).map((jobId) => {
                    const job = siteGroup.jobs.find((j) => j.job_id === jobId);
                    return job ? (
                      <span
                        key={jobId}
                        className="px-2 py-1 bg-[var(--accent)] text-white text-xs rounded"
                      >
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
                <h3 className="text-sm font-medium text-[var(--text)] mb-3">
                  Customer Signature
                </h3>
                <p className="text-xs text-[var(--text-muted)] mb-4">
                  I acknowledge that the work has been completed to my satisfaction.
                </p>
                {(!customerName.trim() || !icNumber.trim()) && (
                  <p className="text-xs text-[var(--warning)] mb-2">Fill in name and IC number to sign</p>
                )}
                <SwipeToSign
                  onSign={handleCustomerSwipe}
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
                Back
              </button>
              <button
                onClick={handleCustomerSubmit}
                disabled={isSubmitting || !customerSigned || !customerName.trim()}
                className="flex-1 px-4 py-2.5 bg-[var(--success)] text-white rounded-lg text-sm font-medium hover:bg-[var(--success)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Signing...' : 'Complete Sign Off'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
