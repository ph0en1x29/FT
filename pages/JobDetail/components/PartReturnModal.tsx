import { Loader2, PackageX, X } from 'lucide-react';
import React, { useState } from 'react';
import { showToast } from '../../../services/toastService';
import {
  PART_RETURN_REASON_LABELS,
  PartReturnReason,
  requestPartReturn,
} from '../../../services/jobPartReturnService';
import type { JobPartUsed } from '../../../types';

interface PartReturnModalProps {
  show: boolean;
  part: JobPartUsed | null;
  onClose: () => void;
  /** Called with the updated job_parts row after a successful return request */
  onRequested: (updated: JobPartUsed) => void;
}

const REASONS: PartReturnReason[] = ['wrong_model', 'damaged', 'not_compatible', 'other'];

/**
 * Modal where the technician picks a return reason for a Used Parts row and
 * submits. Wraps `requestPartReturn` from jobPartReturnService. Free-text is
 * required when the reason is "Other"; optional otherwise.
 *
 * Keeping its own form state (instead of pushing into useJobDetailState) so
 * the page state surface doesn't grow another 4 fields for a contained flow.
 */
export const PartReturnModal: React.FC<PartReturnModalProps> = ({
  show,
  part,
  onClose,
  onRequested,
}) => {
  const [reason, setReason] = useState<PartReturnReason>('wrong_model');
  const [freeText, setFreeText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!show || !part) return null;

  const otherSelectedWithoutText = reason === 'other' && freeText.trim() === '';

  const handleClose = () => {
    if (submitting) return;
    setReason('wrong_model');
    setFreeText('');
    onClose();
  };

  const handleSubmit = async () => {
    if (submitting || otherSelectedWithoutText) return;
    setSubmitting(true);
    try {
      const updated = await requestPartReturn(part.job_part_id, reason, freeText);
      showToast.success('Return requested', 'Admin will confirm on physical receipt.');
      onRequested(updated);
      setReason('wrong_model');
      setFreeText('');
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to request return';
      showToast.error('Could not request return', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4" onClick={handleClose}>
      <div
        className="bg-[var(--surface)] rounded-2xl p-5 w-full max-w-md shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-[var(--text)] flex items-center gap-2">
            <PackageX className="w-5 h-5 text-[var(--warning)]" />
            Return Part
          </h4>
          <button
            onClick={handleClose}
            disabled={submitting}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-subtle)] disabled:opacity-50"
          >
            <X className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
        </div>

        <div className="bg-[var(--bg-subtle)] rounded-xl p-3 mb-4">
          <div className="text-xs text-[var(--text-muted)] mb-0.5">Part</div>
          <div className="text-sm font-medium text-[var(--text)]">
            {Number.isInteger(part.quantity) ? part.quantity : part.quantity.toFixed(2)}× {part.part_name}
          </div>
        </div>

        <div className="mb-4">
          <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">
            Reason *
          </label>
          <div className="grid grid-cols-2 gap-2">
            {REASONS.map(r => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                disabled={submitting}
                className={`px-3 py-2 rounded-lg text-sm border transition ${
                  reason === r
                    ? 'border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)] font-medium'
                    : 'border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg-subtle)]'
                }`}
              >
                {PART_RETURN_REASON_LABELS[r]}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">
            {reason === 'other' ? 'Describe the issue *' : 'Notes (optional)'}
          </label>
          <textarea
            value={freeText}
            onChange={e => setFreeText(e.target.value.slice(0, 500))}
            disabled={submitting}
            maxLength={500}
            placeholder={reason === 'other'
              ? 'Explain why this part needs to be returned…'
              : 'Any extra context for the admin…'}
            className="input-premium w-full h-20 resize-none"
          />
          <div className="flex items-center justify-between mt-1">
            {otherSelectedWithoutText
              ? <p className="text-xs text-[var(--error)]">A description is required when selecting "Other".</p>
              : <span />}
            <span className={`text-xs ${freeText.length >= 500 ? 'text-[var(--warning)]' : 'text-[var(--text-muted)]'}`}>
              {freeText.length}/500
            </span>
          </div>
        </div>

        <div className="bg-[var(--info-bg)] rounded-lg p-3 mb-4 text-xs text-[var(--info)]">
          The part will stay visible but greyed out as "Pending Return". You can complete the job
          without it, and an admin will confirm the return when the part is back at the warehouse.
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleClose}
            disabled={submitting}
            className="btn-premium btn-premium-ghost flex-1"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || otherSelectedWithoutText}
            className="btn-premium btn-premium-primary flex-1 disabled:opacity-50"
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Requesting…</>
            ) : (
              <><PackageX className="w-4 h-4" /> Request Return</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
