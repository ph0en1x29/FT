/**
 * Secondary Job Detail Modals
 * Split from JobDetailModals.tsx for maintainability
 */
import { AlertTriangle, CheckCircle, Clock, Play, XCircle } from 'lucide-react';
import React from 'react';
import HourmeterAmendmentModal from '../../../components/HourmeterAmendmentModal';

interface ChecklistWarningModalProps {
  show: boolean;
  missingItems: string[];
  onGoBack: () => void;
  onProceedAnyway?: () => void;
}

export const ChecklistWarningModal: React.FC<ChecklistWarningModalProps> = ({
  show,
  missingItems,
  onGoBack,
  onProceedAnyway,
}) => {
  if (!show) return null;

  // Convert checklist keys to readable labels
  const formatItemName = (key: string): string => {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-md shadow-premium-elevated">
        <h4 className="font-bold text-lg mb-4 text-[var(--warning)] flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" /> Incomplete Checklist
        </h4>
        
        <div className="bg-[var(--warning-bg)] rounded-xl p-4 mb-4">
          <p className="text-sm text-[var(--text)] mb-3">
            The following mandatory checklist items have not been marked:
          </p>
          <ul className="space-y-2">
            {missingItems.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-[var(--warning)]">
                <XCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formatItemName(item)}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-sm text-[var(--text-muted)] mb-6">
          Please go back and complete the condition checklist before marking the job as complete.
        </p>

        <div className="flex gap-3">
          <button 
            onClick={onGoBack} 
            className="btn-premium btn-premium-primary flex-1"
          >
            <CheckCircle className="w-4 h-4" /> Go Back & Complete
          </button>
          {onProceedAnyway && (
            <button 
              onClick={onProceedAnyway} 
              className="btn-premium btn-premium-secondary text-[var(--warning)] flex-1"
            >
              Proceed Anyway
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

interface HelperModalProps {
  show: boolean;
  techOptions: { id: string; label: string; subLabel?: string }[];
  selectedHelperId: string;
  helperNotes: string;
  assignedTechnicianId?: string;
  onSelectedHelperIdChange: (id: string) => void;
  onHelperNotesChange: (notes: string) => void;
  onAssign: () => void;
  onClose: () => void;
}

export const HelperModal: React.FC<HelperModalProps> = ({
  show,
  techOptions,
  selectedHelperId,
  helperNotes,
  assignedTechnicianId,
  onSelectedHelperIdChange,
  onHelperNotesChange,
  onAssign,
  onClose,
}) => {
  if (!show) return null;

  // Import Combobox dynamically to avoid circular deps
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Combobox = require('../../../components/Combobox').Combobox;

  const handleClose = () => {
    onSelectedHelperIdChange('');
    onHelperNotesChange('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-md shadow-premium-elevated">
        <h4 className="font-bold text-lg mb-4 text-[var(--warning)] flex items-center gap-2">
          <Play className="w-5 h-5" /> Assign Helper
        </h4>
        <p className="text-sm text-[var(--text-muted)] mb-4">Helper can upload photos only.</p>
        <div className="mb-4">
          <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">Helper</label>
          <Combobox 
            options={techOptions.filter(t => t.id !== assignedTechnicianId)} 
            value={selectedHelperId} 
            onChange={onSelectedHelperIdChange} 
            placeholder="Select helper..." 
          />
        </div>
        <div className="mb-6">
          <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">Notes (optional)</label>
          <input 
            type="text" 
            value={helperNotes} 
            onChange={(e) => onHelperNotesChange(e.target.value)} 
            placeholder="e.g., Assist with heavy lifting" 
            className="input-premium w-full" 
          />
        </div>
        <div className="flex gap-3">
          <button onClick={handleClose} className="btn-premium btn-premium-secondary flex-1">Cancel</button>
          <button 
            onClick={onAssign} 
            disabled={!selectedHelperId} 
            className="btn-premium bg-[var(--warning)] text-white hover:opacity-90 flex-1 disabled:opacity-50"
          >
            <Play className="w-4 h-4" /> Assign
          </button>
        </div>
      </div>
    </div>
  );
};

interface DeferredCompletionModalProps {
  show: boolean;
  jobTitle: string;
  jobMedia: { media_id: string; url: string }[];
  deferredReason: string;
  deferredHourmeter: string;
  selectedEvidenceIds: string[];
  submitting: boolean;
  onDeferredReasonChange: (reason: string) => void;
  onDeferredHourmeterChange: (hourmeter: string) => void;
  onToggleEvidence: (mediaId: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}

export const DeferredCompletionModal: React.FC<DeferredCompletionModalProps> = ({
  show,
  jobTitle,
  jobMedia,
  deferredReason,
  deferredHourmeter,
  selectedEvidenceIds,
  submitting,
  onDeferredReasonChange,
  onDeferredHourmeterChange,
  onToggleEvidence,
  onConfirm,
  onClose,
}) => {
  if (!show) return null;

  const handleClose = () => {
    onDeferredReasonChange('');
    onDeferredHourmeterChange('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-premium-elevated">
        <h4 className="font-bold text-lg mb-4 text-[var(--warning)] flex items-center gap-2">
          <Clock className="w-5 h-5" /> Complete Without Customer Signature
        </h4>
        <div className="bg-[var(--warning-bg)] rounded-xl p-3 mb-4">
          <p className="text-sm text-[var(--warning)] font-medium">{jobTitle}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Customer has 5 business days to acknowledge.</p>
        </div>
        <div className="mb-4">
          <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">Reason *</label>
          <textarea 
            className="input-premium resize-none h-20 w-full" 
            value={deferredReason} 
            onChange={(e) => onDeferredReasonChange(e.target.value)} 
            placeholder="e.g., Customer not on-site..." 
          />
        </div>
        <div className="mb-4">
          <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">End Hourmeter *</label>
          <input 
            type="number" 
            className="input-premium w-full" 
            value={deferredHourmeter} 
            onChange={(e) => onDeferredHourmeterChange(e.target.value)} 
            placeholder="Enter reading" 
          />
        </div>
        <div className="mb-4">
          <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">Evidence Photos * (min 1)</label>
          {jobMedia.length > 0 ? (
            <div className="grid grid-cols-4 gap-2 max-h-32 overflow-y-auto p-2 bg-[var(--bg-subtle)] rounded-xl">
              {jobMedia.map((media) => (
                <div 
                  key={media.media_id} 
                  onClick={() => onToggleEvidence(media.media_id)}
                  className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                    selectedEvidenceIds.includes(media.media_id) 
                      ? 'border-[var(--warning)] ring-2 ring-[var(--warning)]/30' 
                      : 'border-transparent hover:border-[var(--warning)]/50'
                  }`}
                >
                  <img src={media.url} loading="lazy" decoding="async" alt="Evidence" className="w-full h-14 object-cover" />
                  {selectedEvidenceIds.includes(media.media_id) && (
                    <div className="absolute inset-0 bg-[var(--warning)]/30 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)] italic">No photos. Upload evidence first.</p>
          )}
        </div>
        <div className="flex gap-3">
          <button onClick={handleClose} className="btn-premium btn-premium-secondary flex-1">Cancel</button>
          <button 
            onClick={onConfirm} 
            disabled={!deferredReason.trim() || selectedEvidenceIds.length === 0 || submitting} 
            className="btn-premium bg-[var(--warning)] text-white hover:opacity-90 flex-1 disabled:opacity-50"
          >
            {submitting ? 'Processing...' : 'Complete & Notify'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Re-export the HourmeterAmendmentModal for convenience
export { HourmeterAmendmentModal };
