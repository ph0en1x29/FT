import { Send } from 'lucide-react';
import React from 'react';
import { Combobox, ComboboxOption } from '../../../components/Combobox';
import { Job } from '../../../types';

/**
 * TransferJobModal — KPI Engine Phase 2 (KPI_SPEC.md §3.2).
 *
 * Admin-initiated reassignment that CLONES the job to a new -B/-C suffix
 * (vs ReassignModal which swaps the tech in-place on the same row). The
 * outgoing tech's KPI award is set to 0 pts by default; admin can approve
 * a 5-pt partial credit via the toggle.
 *
 * Use Transfer when the receiving tech should start a fresh timer (typically
 * when the original tech is unavailable: MC, Emergency Leave, resignation).
 * Use Reassign when in-place reassignment is preferred (e.g. quick swap
 * before any work has begun).
 */
interface TransferJobModalProps {
  show: boolean;
  job: Job;
  techOptions: ComboboxOption[];
  transferTechId: string;
  transferReason: string;
  transferOverridePts: 0 | 5;
  submitting: boolean;
  onTransferTechIdChange: (id: string) => void;
  onTransferReasonChange: (reason: string) => void;
  onTransferOverridePtsChange: (pts: 0 | 5) => void;
  onTransfer: () => void;
  onClose: () => void;
}

export const TransferJobModal: React.FC<TransferJobModalProps> = ({
  show,
  job,
  techOptions,
  transferTechId,
  transferReason,
  transferOverridePts,
  submitting,
  onTransferTechIdChange,
  onTransferReasonChange,
  onTransferOverridePtsChange,
  onTransfer,
  onClose,
}) => {
  if (!show) return null;
  const reasonOk = transferReason.trim().length > 0;
  const targetOk = !!transferTechId;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-md shadow-premium-elevated">
        <h4 className="font-bold text-lg mb-4 text-[var(--text)] flex items-center gap-2">
          <Send className="w-5 h-5 text-[var(--accent)]" /> Transfer Job (Clone)
        </h4>

        <div className="bg-[var(--bg-subtle)] rounded-xl p-3 mb-4 text-sm">
          <div className="text-[var(--text-muted)]">Currently assigned:</div>
          <div className="font-medium text-[var(--text)]">{job?.assigned_technician_name || 'Unassigned'}</div>
          <div className="text-xs text-[var(--text-muted)] mt-2">
            A new job ({job?.job_number}-B/-C) will be created for the receiving tech with a fresh timer.
            The original job stays visible-but-frozen, marked Incomplete - Reassigned.
          </div>
        </div>

        <div className="mb-4">
          <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">Receiving Technician</label>
          <Combobox
            options={techOptions.filter(t => t.id !== job?.assigned_technician_id)}
            value={transferTechId}
            onChange={onTransferTechIdChange}
            placeholder="Select technician..."
          />
        </div>

        <div className="mb-4">
          <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">
            Reason for Transfer <span className="text-[var(--danger)]">*</span>
          </label>
          <textarea
            value={transferReason}
            onChange={(e) => onTransferReasonChange(e.target.value)}
            placeholder="e.g. Original tech on Emergency Leave; skill mismatch; ..."
            rows={3}
            className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg)] p-2 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
          />
        </div>

        <div className="mb-6">
          <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">Outgoing Tech KPI Award</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onTransferOverridePtsChange(0)}
              className={`flex-1 rounded-xl border px-3 py-2 text-sm transition ${
                transferOverridePts === 0
                  ? 'border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent)] font-medium'
                  : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--border)]'
              }`}
            >
              0 pts (default)
            </button>
            <button
              type="button"
              onClick={() => onTransferOverridePtsChange(5)}
              className={`flex-1 rounded-xl border px-3 py-2 text-sm transition ${
                transferOverridePts === 5
                  ? 'border-[var(--accent)] bg-[var(--accent-bg)] text-[var(--accent)] font-medium'
                  : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--border)]'
              }`}
            >
              5 pts (admin override)
            </button>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-2">
            Per KPI_SPEC §3.2: outgoing tech defaults to 0 pts; 5 pts available for partial credit on initial labor.
          </p>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={onClose} disabled={submitting} className="btn-premium btn-premium-secondary flex-1 disabled:opacity-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={onTransfer}
            disabled={!reasonOk || !targetOk || submitting}
            className="btn-premium btn-premium-primary flex-1 disabled:opacity-50"
          >
            <Send className="w-4 h-4" /> {submitting ? 'Transferring...' : 'Transfer'}
          </button>
        </div>
      </div>
    </div>
  );
};
