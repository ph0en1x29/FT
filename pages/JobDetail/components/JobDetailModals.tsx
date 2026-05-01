import {
  Camera,
  Clock,
  RefreshCw,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import React from 'react';
import { Combobox, ComboboxOption } from '../../../components/Combobox';
import { SignaturePad } from '../../../components/SignaturePad';
import { Job } from '../../../types';
import { calculateJobTotals } from '../utils';

// StartJobModal extracted to its own file (was 393 LOC, dominated this barrel).
export { StartJobModal } from './modals/StartJobModal';

interface SignatureModalProps {
  show: boolean;
  title: string;
  subtitle: string;
  onSave: (dataUrl: string) => void;
  onClose: () => void;
}

export const SignatureModal: React.FC<SignatureModalProps> = ({
  show,
  title,
  subtitle,
  onSave,
  onClose,
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] rounded-2xl p-4 w-full max-w-md shadow-premium-elevated">
        <h4 className="font-bold mb-4 text-[var(--text)]">{title}</h4>
        <p className="text-xs text-[var(--text-muted)] mb-2">{subtitle}</p>
        <SignaturePad onSave={onSave} />
        <button onClick={onClose} className="mt-4 text-sm text-[var(--error)] underline w-full text-center">Cancel</button>
      </div>
    </div>
  );
};


interface FinalizeModalProps {
  show: boolean;
  job: Job;
  currentUserName: string;
  onFinalize: () => void;
  onClose: () => void;
}

export const FinalizeModal: React.FC<FinalizeModalProps> = ({
  show,
  job,
  currentUserName,
  onFinalize,
  onClose,
}) => {
  if (!show) return null;

  const { totalCost } = calculateJobTotals(job);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-md shadow-premium-elevated">
        <h4 className="font-bold text-lg mb-4 text-[var(--text)]">Finalize Invoice</h4>
        <p className="text-sm text-[var(--text-muted)] mb-6">This action cannot be undone.</p>
        <div className="bg-[var(--bg-subtle)] rounded-xl p-3 mb-6">
          <div className="flex justify-between mb-1">
            <span className="text-[var(--text-muted)]">Total:</span>
            <span className="font-bold text-xl text-[var(--success)]">RM{totalCost.toFixed(2)}</span>
          </div>
          <div className="text-xs text-[var(--text-muted)]">Finalized by: {currentUserName}</div>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-premium btn-premium-secondary flex-1">Cancel</button>
          <button onClick={onFinalize} className="btn-premium btn-premium-primary flex-1">Finalize</button>
        </div>
      </div>
    </div>
  );
};

interface ReassignModalProps {
  show: boolean;
  job: Job;
  techOptions: ComboboxOption[];
  reassignTechId: string;
  onReassignTechIdChange: (id: string) => void;
  onReassign: () => void;
  onClose: () => void;
}

export const ReassignModal: React.FC<ReassignModalProps> = ({
  show,
  job,
  techOptions,
  reassignTechId,
  onReassignTechIdChange,
  onReassign,
  onClose,
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-md shadow-premium-elevated">
        <h4 className="font-bold text-lg mb-4 text-[var(--text)] flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-[var(--accent)]" /> Reassign Job
        </h4>
        <div className="bg-[var(--bg-subtle)] rounded-xl p-3 mb-4 text-sm">
          <div className="text-[var(--text-muted)]">Currently assigned:</div>
          <div className="font-medium text-[var(--text)]">{job?.assigned_technician_name || 'Unassigned'}</div>
        </div>
        <div className="mb-6">
          <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">New Technician</label>
          <Combobox 
            options={techOptions.filter(t => t.id !== job?.assigned_technician_id)} 
            value={reassignTechId} 
            onChange={onReassignTechIdChange} 
            placeholder="Select technician..." 
          />
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-premium btn-premium-secondary flex-1">Cancel</button>
          <button type="button" onClick={onReassign} disabled={!reassignTechId} className="btn-premium btn-premium-primary flex-1 disabled:opacity-50">
            <RefreshCw className="w-4 h-4" /> Reassign
          </button>
        </div>
      </div>
    </div>
  );
};

interface ContinueTomorrowModalProps {
  show: boolean;
  job: Job;
  reason: string;
  submitting: boolean;
  onReasonChange: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export const ContinueTomorrowModal: React.FC<ContinueTomorrowModalProps> = ({
  show,
  job,
  reason,
  submitting,
  onReasonChange,
  onConfirm,
  onClose,
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-md shadow-premium-elevated">
        <h4 className="font-bold text-lg mb-4 text-[var(--warning)] flex items-center gap-2">
          <Clock className="w-5 h-5" /> Continue Tomorrow
        </h4>
        <div className="bg-[var(--warning-bg)] rounded-xl p-3 mb-4">
          <p className="text-sm text-[var(--warning)] font-medium">{job?.title}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Job will be marked incomplete and can resume tomorrow.</p>
        </div>
        <div className="mb-6">
          <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">Reason *</label>
          <textarea 
            className="input-premium resize-none h-24" 
            value={reason} 
            onChange={(e) => onReasonChange(e.target.value)} 
            placeholder="e.g., Waiting for parts..." 
          />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-premium btn-premium-secondary flex-1">Cancel</button>
          <button 
            onClick={onConfirm} 
            disabled={!reason.trim() || submitting} 
            className="btn-premium bg-[var(--warning)] text-white hover:opacity-90 flex-1 disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface DeleteModalProps {
  show: boolean;
  job: Job;
  reason: string;
  onReasonChange: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export const DeleteModal: React.FC<DeleteModalProps> = ({
  show,
  job,
  reason,
  onReasonChange,
  onConfirm,
  onClose,
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-md shadow-premium-elevated">
        <h4 className="font-bold text-lg mb-4 text-[var(--error)] flex items-center gap-2">
          <Trash2 className="w-5 h-5" /> Delete Job
        </h4>
        <div className="bg-[var(--error-bg)] rounded-xl p-3 mb-4">
          <p className="text-sm text-[var(--error)] font-medium">{job?.title}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">This will mark the job as cancelled.</p>
        </div>
        <div className="mb-6">
          <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">Reason *</label>
          <textarea 
            className="input-premium resize-none h-24" 
            value={reason} 
            onChange={(e) => onReasonChange(e.target.value)} 
            placeholder="e.g., Customer cancelled..." 
          />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-premium btn-premium-secondary flex-1">Cancel</button>
          <button 
            onClick={onConfirm} 
            disabled={!reason.trim()} 
            className="btn-premium bg-[var(--error)] text-white hover:opacity-90 flex-1 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      </div>
    </div>
  );
};

interface RejectJobModalProps {
  show: boolean;
  job: Job;
  reason: string;
  onReasonChange: (value: string) => void;
  photoFile: File | null;
  photoPreviewUrl: string;
  onPhotoChange: (file: File | null) => void;
  uploading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const RejectJobModal: React.FC<RejectJobModalProps> = ({
  show,
  job,
  reason,
  onReasonChange,
  photoFile,
  photoPreviewUrl,
  onPhotoChange,
  uploading,
  onConfirm,
  onClose,
}) => {
  if (!show) return null;

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    onPhotoChange(f);
    e.target.value = '';
  };

  const canConfirm = reason.trim().length > 0 && photoFile !== null && !uploading;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-md shadow-premium-elevated max-h-[90vh] overflow-y-auto">
        <h4 className="font-bold text-lg mb-4 text-[var(--error)] flex items-center gap-2">
          <XCircle className="w-5 h-5" /> Reject Job Assignment
        </h4>
        <div className="bg-[var(--warning-bg)] rounded-xl p-3 mb-4">
          <p className="text-sm text-[var(--warning)] font-medium">{job?.title}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">This job will be returned to Admin for reassignment. On-site photo + reason are required.</p>
        </div>
        <div className="mb-4">
          <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">Reason for Rejection *</label>
          <textarea
            className="input-premium resize-none h-24"
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="e.g., Weather hazard at site, vehicle blocked, customer not on premises, etc."
          />
        </div>
        <div className="mb-6">
          <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">On-Site Photo Proof *</label>
          <p className="text-xs text-[var(--text-muted)] mb-2">Required so admin can verify you were on-site when rejecting. GPS location is captured automatically.</p>
          {photoPreviewUrl ? (
            <div className="relative mb-2">
              <img src={photoPreviewUrl} alt="Rejection proof preview" loading="lazy" decoding="async" className="w-full max-h-48 object-contain rounded-xl border border-[var(--border)]" />
              <button
                onClick={() => onPhotoChange(null)}
                disabled={uploading}
                className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80 disabled:opacity-50"
                aria-label="Remove photo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className="block w-full cursor-pointer">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileInput}
                className="hidden"
                disabled={uploading}
              />
              <div className="border-2 border-dashed border-[var(--border)] rounded-xl p-6 text-center hover:bg-[var(--bg-subtle)] transition-colors">
                <Camera className="w-8 h-8 mx-auto text-[var(--text-muted)] mb-2" />
                <p className="text-sm text-[var(--text-secondary)]">Tap to take photo</p>
              </div>
            </label>
          )}
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} disabled={uploading} className="btn-premium btn-premium-secondary flex-1 disabled:opacity-50">Cancel</button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            className="btn-premium bg-[var(--error)] text-white hover:opacity-90 flex-1 disabled:opacity-50"
          >
            <XCircle className="w-4 h-4" /> {uploading ? 'Uploading...' : 'Reject Job'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface ReportOptionsModalProps {
  show: boolean;
  onSelect: (showPrices: boolean) => void;
  onClose: () => void;
}

export const ReportOptionsModal: React.FC<ReportOptionsModalProps> = ({ show, onSelect, onClose }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-md shadow-premium-elevated">
        <div className="flex items-start justify-between mb-4">
          <h4 className="font-bold text-lg text-[var(--text)]">Service Report Options</h4>
          <button onClick={onClose} className="p-1 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-[var(--text-muted)] mb-5">
          Should this report include prices? Hide prices for customer-facing copies.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onSelect(false)}
            className="btn-premium btn-premium-primary w-full"
          >
            Hide Prices (Customer Copy)
          </button>
          <button
            onClick={() => onSelect(true)}
            className="btn-premium btn-premium-secondary w-full"
          >
            Show Prices (Internal Copy)
          </button>
        </div>
      </div>
    </div>
  );
};

// Re-export from JobDetailModalsSecondary
export {
  ChecklistWarningModal,
  HelperModal,
  DeferredCompletionModal,
} from './JobDetailModalsSecondary';
