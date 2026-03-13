import { AlertTriangle } from 'lucide-react';
import React from 'react';
import { DuplicateJobWarning } from '../types';

interface DuplicateJobWarningModalProps {
  warning: DuplicateJobWarning;
  onConfirm: () => void;
  onDismiss: () => void;
}

const DuplicateJobWarningModal: React.FC<DuplicateJobWarningModalProps> = ({
  warning,
  onConfirm,
  onDismiss,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-[var(--surface)] rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 text-center">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
          </div>
          <h3 className="font-bold text-lg text-slate-900">This forklift already has an active job</h3>
        </div>

        {/* Existing job details */}
        <div className="mx-6 mb-5 bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-800">{warning.title}</span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-200 text-amber-800">
              {warning.status}
            </span>
          </div>
          {warning.customer_name && (
            <p className="text-sm text-slate-600">Customer: {warning.customer_name}</p>
          )}
          {warning.site_name && (
            <p className="text-sm text-slate-600">Site: {warning.site_name}</p>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            type="button"
            onClick={onDismiss}
            className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium shadow-sm transition-colors"
          >
            Continue Anyway
          </button>
        </div>
      </div>
    </div>
  );
};

export default DuplicateJobWarningModal;
