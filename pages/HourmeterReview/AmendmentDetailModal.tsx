import React from 'react';
import {
  Gauge,
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  XCircle,
  X,
} from 'lucide-react';
import { HourmeterAmendment } from '../../types';
import { FLAG_REASON_LABELS } from './constants';

interface AmendmentDetailModalProps {
  amendment: HourmeterAmendment;
  isAdmin: boolean;
  reviewNotes: string;
  onReviewNotesChange: (notes: string) => void;
  processing: boolean;
  onApprove: () => void;
  onReject: () => void;
  onClose: () => void;
}

export default function AmendmentDetailModal({
  amendment,
  isAdmin,
  reviewNotes,
  onReviewNotesChange,
  processing,
  onApprove,
  onReject,
  onClose,
}: AmendmentDetailModalProps) {
  const statusColors = {
    pending: { bg: 'bg-amber-50', icon: 'text-amber-600' },
    approved: { bg: 'bg-green-50', icon: 'text-green-600' },
    rejected: { bg: 'bg-red-50', icon: 'text-red-600' },
  };

  const colors = statusColors[amendment.status];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className={`p-4 border-b ${colors.bg}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Gauge className={`w-6 h-6 ${colors.icon}`} />
              <div>
                <h2 className="font-semibold text-lg">Hourmeter Amendment</h2>
                <p className="text-sm text-slate-600">
                  Job: {amendment.job_id.slice(0, 8)}...
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/50 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Reading comparison */}
          <div className="bg-slate-50 rounded-xl p-4">
            <h3 className="text-sm font-medium text-slate-700 mb-3">Reading Comparison</h3>
            <div className="flex items-center justify-between gap-4">
              <div className="text-center flex-1">
                <div className="text-xs text-slate-500 mb-1">Original</div>
                <div className="text-2xl font-bold text-slate-700">
                  {amendment.original_reading.toLocaleString()}
                </div>
                <div className="text-xs text-slate-400">hrs</div>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-400" />
              <div className="text-center flex-1">
                <div className="text-xs text-slate-500 mb-1">Amended</div>
                <div className="text-2xl font-bold text-blue-600">
                  {amendment.amended_reading.toLocaleString()}
                </div>
                <div className="text-xs text-slate-400">hrs</div>
              </div>
            </div>
          </div>

          {/* Flag reasons */}
          {amendment.flag_reasons && amendment.flag_reasons.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <h3 className="text-sm font-medium text-red-800 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Flags Detected
              </h3>
              <ul className="space-y-1">
                {amendment.flag_reasons.map((flag) => (
                  <li key={flag} className="flex items-center gap-2 text-sm text-red-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    {FLAG_REASON_LABELS[flag] || flag}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Request details */}
          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-2">Reason for Amendment</h3>
            <p className="text-sm text-slate-600 p-3 bg-slate-50 rounded-lg">
              {amendment.reason}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-500">Requested by:</span>
              <p className="font-medium">{amendment.requested_by_name}</p>
            </div>
            <div>
              <span className="text-slate-500">Requested at:</span>
              <p className="font-medium">
                {new Date(amendment.requested_at).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Review notes (for approved/rejected) */}
          {amendment.status !== 'pending' && amendment.review_notes && (
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-2">Review Notes</h3>
              <p className="text-sm text-slate-600 p-3 bg-slate-50 rounded-lg">
                {amendment.review_notes}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Reviewed by {amendment.reviewed_by_name} on{' '}
                {new Date(amendment.reviewed_at!).toLocaleString()}
              </p>
            </div>
          )}

          {/* Review notes input (for pending) */}
          {amendment.status === 'pending' && isAdmin && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Review Notes (required for rejection)
              </label>
              <textarea
                value={reviewNotes}
                onChange={(e) => onReviewNotesChange(e.target.value)}
                placeholder="Add notes about your decision..."
                rows={3}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t bg-slate-50">
          {amendment.status === 'pending' && isAdmin ? (
            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-white text-sm"
              >
                Cancel
              </button>
              <button
                onClick={onReject}
                disabled={processing}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
              >
                <XCircle className="w-4 h-4" />
                Reject
              </button>
              <button
                onClick={onApprove}
                disabled={processing}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
              >
                <CheckCircle className="w-4 h-4" />
                Approve
              </button>
            </div>
          ) : (
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-white text-sm"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
