import React from 'react';
import { Job, ForkliftConditionChecklist } from '../../../types';
import { SignaturePad } from '../../../components/SignaturePad';
import { Combobox, ComboboxOption } from '../../../components/Combobox';
import HourmeterAmendmentModal from '../../../components/HourmeterAmendmentModal';
import { CHECKLIST_CATEGORIES } from '../constants';
import { calculateJobTotals } from '../utils';
import { 
  Play, Clock, Trash2, RefreshCw, Gauge, ClipboardList, XCircle 
} from 'lucide-react';

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

interface StartJobModalProps {
  show: boolean;
  startJobHourmeter: string;
  conditionChecklist: ForkliftConditionChecklist;
  onHourmeterChange: (value: string) => void;
  onChecklistToggle: (key: string) => void;
  onStartJob: () => void;
  onClose: () => void;
}

export const StartJobModal: React.FC<StartJobModalProps> = ({
  show,
  startJobHourmeter,
  conditionChecklist,
  onHourmeterChange,
  onChecklistToggle,
  onStartJob,
  onClose,
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-premium-elevated">
        <h4 className="font-bold text-xl mb-4 text-[var(--text)] flex items-center gap-2">
          <Play className="w-5 h-5 text-[var(--accent)]" /> Start Job - Condition Check
        </h4>
        <div className="bg-[var(--warning-bg)] p-4 rounded-xl border border-[var(--warning)] border-opacity-20 mb-6">
          <label className="text-sm font-bold text-[var(--warning)] mb-2 block flex items-center gap-2">
            <Gauge className="w-4 h-4" /> Current Hourmeter *
          </label>
          <div className="flex items-center gap-2">
            <input 
              type="number" 
              className="input-premium w-40" 
              value={startJobHourmeter} 
              onChange={(e) => onHourmeterChange(e.target.value)} 
              placeholder="e.g., 5230" 
            />
            <span className="text-[var(--text-muted)]">hours</span>
          </div>
        </div>
        <div className="mb-6">
          <h5 className="font-bold text-[var(--text)] mb-3 flex items-center gap-2">
            <ClipboardList className="w-5 h-5" /> Condition Checklist
          </h5>
          <p className="text-sm text-[var(--text-muted)] mb-4">Check items in good condition:</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {CHECKLIST_CATEGORIES.map(category => (
              <div key={category.name} className="bg-[var(--bg-subtle)] p-3 rounded-xl border border-[var(--border)]">
                <h6 className="font-semibold text-[var(--text-secondary)] text-xs mb-2 border-b border-[var(--border-subtle)] pb-1">{category.name}</h6>
                <div className="space-y-1">
                  {category.items.map(item => (
                    <label key={item.key} className="flex items-center gap-2 cursor-pointer hover:bg-[var(--surface-2)] p-1 rounded text-xs">
                      <input 
                        type="checkbox" 
                        checked={!!conditionChecklist[item.key as keyof ForkliftConditionChecklist]} 
                        onChange={() => onChecklistToggle(item.key)} 
                        className="w-3.5 h-3.5 rounded border-[var(--border)] text-[var(--accent)]" 
                      />
                      <span className="text-[var(--text-secondary)]">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-3 justify-end border-t border-[var(--border)] pt-4">
          <button onClick={onClose} className="btn-premium btn-premium-secondary">Cancel</button>
          <button onClick={onStartJob} className="btn-premium btn-premium-primary">
            <Play className="w-4 h-4" /> Start Job
          </button>
        </div>
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
          <button onClick={onClose} className="btn-premium btn-premium-secondary flex-1">Cancel</button>
          <button onClick={onReassign} disabled={!reassignTechId} className="btn-premium btn-premium-primary flex-1 disabled:opacity-50">
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
  onConfirm: () => void;
  onClose: () => void;
}

export const RejectJobModal: React.FC<RejectJobModalProps> = ({
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
          <XCircle className="w-5 h-5" /> Reject Job Assignment
        </h4>
        <div className="bg-[var(--warning-bg)] rounded-xl p-3 mb-4">
          <p className="text-sm text-[var(--warning)] font-medium">{job?.title}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">This job will be returned to Admin for reassignment.</p>
        </div>
        <div className="mb-6">
          <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">Reason for Rejection *</label>
          <textarea 
            className="input-premium resize-none h-24" 
            value={reason} 
            onChange={(e) => onReasonChange(e.target.value)} 
            placeholder="e.g., Already have too many jobs, Not available on scheduled date, etc." 
          />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-premium btn-premium-secondary flex-1">Cancel</button>
          <button 
            onClick={onConfirm} 
            disabled={!reason.trim()} 
            className="btn-premium bg-[var(--error)] text-white hover:opacity-90 flex-1 disabled:opacity-50"
          >
            <XCircle className="w-4 h-4" /> Reject Job
          </button>
        </div>
      </div>
    </div>
  );
};

// Re-export the HourmeterAmendmentModal for convenience
export { HourmeterAmendmentModal };
