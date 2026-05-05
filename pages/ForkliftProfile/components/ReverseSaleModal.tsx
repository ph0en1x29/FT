import { AlertTriangle, Loader2, Undo2, X } from 'lucide-react';
import React, { useState } from 'react';
import { reverseSaleToFleet } from '../../../services/forkliftService';
import { showToast } from '../../../services/toastService';
import { Forklift, User } from '../../../types';

interface Props {
  forklift: Forklift;
  currentUser: User;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Admin-only "undo a sold_from_fleet sale" wizard. Eligibility is gated by
 * the caller (ForkliftOwnershipCard) to acquisition_source='sold_from_fleet'
 * — the RPC will also refuse anything else, but the UI hides the button so
 * the admin doesn't see a dead-end.
 *
 * Reason is required because this is a high-blast-radius admin op
 * (financial records flip back). The reason ends up in the sale_reversed
 * audit row.
 */
export const ReverseSaleModal: React.FC<Props> = ({
  forklift,
  currentUser,
  onClose,
  onSuccess,
}) => {
  const [reason, setReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reasonOk = reason.trim().length >= 4;
  const confirmOk = confirmText.trim().toLowerCase() === 'reverse';
  const canSubmit = reasonOk && confirmOk;

  const formattedSaleDate = forklift.sold_to_customer_at
    ? new Date(forklift.sold_to_customer_at).toLocaleDateString()
    : '—';
  const formattedSalePrice = forklift.sold_price != null
    ? `RM ${Number(forklift.sold_price).toLocaleString()}`
    : '—';

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await reverseSaleToFleet(forklift.forklift_id, {
        actorId: currentUser.user_id,
        actorName: currentUser.name,
        reason: reason.trim(),
      });
      showToast.success('Sale reversed — forklift returned to fleet');
      onSuccess();
    } catch (e) {
      showToast.error(e instanceof Error ? e.message : 'Reversal failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Undo2 className="w-5 h-5 text-amber-600" />
            <h2 className="text-base font-semibold text-slate-900">Reverse sale to fleet</h2>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 hover:bg-slate-100 rounded-lg disabled:opacity-50"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600">
            <div className="font-medium text-slate-800">
              {forklift.make} {forklift.model} · {forklift.serial_number}
            </div>
            <div className="text-xs mt-1">
              Sold {formattedSaleDate} · {formattedSalePrice}
            </div>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold mb-1">What happens on confirm:</div>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Ownership flips back to <strong>company</strong> (Acwer fleet).</li>
                  <li>Sale date and sale price are <strong>cleared</strong>.</li>
                  <li>Customer link is <strong>removed</strong>; status set to Available.</li>
                  <li>The forklift moves back to the Fleet tab.</li>
                  <li>This is recorded as <strong>sale_reversed</strong> in the audit log — it's not a silent edit.</li>
                </ul>
                <div className="mt-2 text-amber-900">
                  Use this for cancelled sales. Don't use it to "transfer" — there's a separate flow for owner-to-owner transfers.
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              placeholder="e.g. Customer cancelled the purchase, returned unit on 2026-05-07; financing fell through; sale was entered against the wrong forklift"
            />
            <div className="text-xs text-slate-400 mt-1">
              Recorded in the lifecycle audit log. Min. 4 characters.
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Type <code className="text-xs bg-slate-100 px-1 rounded">reverse</code> to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 flex gap-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canSubmit || submitting}
            className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 inline-flex items-center justify-center gap-1"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reverse sale'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReverseSaleModal;
