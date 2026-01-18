import React, { useState } from 'react';
import {
  Job,
  HourmeterFlagReason,
} from '../types';
import {
  X,
  Gauge,
  AlertTriangle,
  ArrowRight,
  Send,
  Info,
} from 'lucide-react';

interface HourmeterAmendmentModalProps {
  job: Job;
  previousReading: number;
  flagReasons: HourmeterFlagReason[];
  onClose: () => void;
  onSubmit: (amendedReading: number, reason: string) => Promise<void>;
}

const FLAG_REASON_LABELS: Record<HourmeterFlagReason, { label: string; description: string }> = {
  lower_than_previous: {
    label: 'Lower than previous',
    description: 'Reading is lower than the last recorded hourmeter value',
  },
  excessive_jump: {
    label: 'Excessive jump',
    description: 'Reading shows an unusually large increase from previous value',
  },
  pattern_mismatch: {
    label: 'Pattern mismatch',
    description: 'Reading doesn\'t match expected usage pattern for this forklift',
  },
  manual_flag: {
    label: 'Manually flagged',
    description: 'This reading was manually flagged for review',
  },
  timestamp_mismatch: {
    label: 'Timestamp issue',
    description: 'Timestamp validation issue detected',
  },
};

export default function HourmeterAmendmentModal({
  job,
  previousReading,
  flagReasons,
  onClose,
  onSubmit,
}: HourmeterAmendmentModalProps) {
  const [amendedReading, setAmendedReading] = useState<string>(
    job.hourmeter_reading?.toString() || ''
  );
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const originalReading = job.hourmeter_reading || 0;
  const difference = originalReading - previousReading;

  const handleSubmit = async () => {
    setError('');

    const parsedReading = parseFloat(amendedReading);
    if (isNaN(parsedReading) || parsedReading < 0) {
      setError('Please enter a valid hourmeter reading');
      return;
    }

    if (!reason.trim()) {
      setError('Please provide a reason for the amendment');
      return;
    }

    if (reason.trim().length < 10) {
      setError('Please provide a more detailed reason (at least 10 characters)');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(parsedReading, reason.trim());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between bg-amber-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <Gauge className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="font-semibold text-lg text-amber-900">Request Hourmeter Amendment</h2>
              <p className="text-sm text-amber-700">Admin 1 (Service) approval required</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-amber-100 rounded-lg text-amber-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Current readings comparison */}
          <div className="bg-slate-50 rounded-xl p-4">
            <h3 className="text-sm font-medium text-slate-700 mb-3">Reading Comparison</h3>
            <div className="flex items-center justify-between gap-4">
              <div className="text-center flex-1">
                <div className="text-xs text-slate-500 mb-1">Previous</div>
                <div className="text-2xl font-bold text-slate-700">{previousReading.toLocaleString()}</div>
                <div className="text-xs text-slate-400">hrs</div>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-400" />
              <div className="text-center flex-1">
                <div className="text-xs text-slate-500 mb-1">Entered</div>
                <div className={`text-2xl font-bold ${
                  originalReading < previousReading ? 'text-red-600' : 'text-slate-700'
                }`}>
                  {originalReading.toLocaleString()}
                </div>
                <div className="text-xs text-slate-400">hrs</div>
              </div>
              <div className="text-center px-3 py-2 bg-white rounded-lg border">
                <div className="text-xs text-slate-500 mb-1">Difference</div>
                <div className={`text-lg font-bold ${
                  difference < 0 ? 'text-red-600' : difference > 1000 ? 'text-amber-600' : 'text-green-600'
                }`}>
                  {difference >= 0 ? '+' : ''}{difference.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Flag reasons */}
          {flagReasons.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <h3 className="text-sm font-medium text-red-800 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Flags Detected
              </h3>
              <ul className="space-y-2">
                {flagReasons.map((flagReason) => (
                  <li key={flagReason} className="flex items-start gap-2 text-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium text-red-800">
                        {FLAG_REASON_LABELS[flagReason]?.label || flagReason}
                      </span>
                      <p className="text-red-600 text-xs">
                        {FLAG_REASON_LABELS[flagReason]?.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Amended reading input */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Correct Hourmeter Reading
            </label>
            <div className="relative">
              <input
                type="number"
                value={amendedReading}
                onChange={(e) => setAmendedReading(e.target.value)}
                placeholder="Enter correct reading"
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg font-medium"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                hours
              </span>
            </div>
          </div>

          {/* Reason input */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Reason for Amendment <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why the reading needs to be amended..."
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
            <p className="text-xs text-slate-400 mt-1">
              Provide a detailed explanation for the Admin to review
            </p>
          </div>

          {/* Info notice */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg text-sm">
            <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-blue-700">
              This request will be sent to Admin 1 (Service) for approval. The job cannot be
              finalized until the hourmeter reading is validated.
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-slate-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-white text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            <Send className="w-4 h-4" />
            {submitting ? 'Submitting...' : 'Submit Amendment Request'}
          </button>
        </div>
      </div>
    </div>
  );
}
