import { Loader2, Pencil, X } from 'lucide-react';
import React, { useState } from 'react';
import { editOwnershipDetails } from '../../../services/forkliftService';
import { showToast } from '../../../services/toastService';
import { Forklift, User } from '../../../types';

interface Props {
  forklift: Forklift;
  currentUser: User;
  onClose: () => void;
  onSuccess: () => void;
}

const dateForInput = (iso?: string | null) =>
  iso ? new Date(iso).toISOString().slice(0, 10) : '';

/**
 * Admin-only correction form for customer-owned forklifts. Edits sale_date,
 * sale_price, and customer's asset number. Empty fields leave the column
 * unchanged; ticking "clear" wipes a column to NULL.
 *
 * Mirrors TransitionToCustomerModal's two-step form → confirm wizard so the
 * UX feels consistent with the original sale flow.
 */
export const EditOwnershipDetailsModal: React.FC<Props> = ({
  forklift,
  currentUser,
  onClose,
  onSuccess,
}) => {
  const [saleDate, setSaleDate] = useState(dateForInput(forklift.sold_to_customer_at));
  const [salePrice, setSalePrice] = useState(
    forklift.sold_price != null ? String(forklift.sold_price) : ''
  );
  const [customerAssetNo, setCustomerAssetNo] = useState(forklift.customer_forklift_no || '');
  const [clearSalePrice, setClearSalePrice] = useState(false);
  const [clearAssetNo, setClearAssetNo] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<'form' | 'confirm'>('form');

  const originalDate = dateForInput(forklift.sold_to_customer_at);
  const originalPrice = forklift.sold_price != null ? String(forklift.sold_price) : '';
  const originalAsset = forklift.customer_forklift_no || '';

  const dateChanged = saleDate !== originalDate;
  const priceChanged = clearSalePrice
    ? forklift.sold_price != null
    : salePrice !== originalPrice;
  const assetChanged = clearAssetNo
    ? !!forklift.customer_forklift_no
    : customerAssetNo !== originalAsset;

  const anyChange = dateChanged || priceChanged || assetChanged;
  const reasonRequired = anyChange;
  const canProceed = anyChange && (!reasonRequired || reason.trim().length > 0);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await editOwnershipDetails(forklift.forklift_id, {
        saleDate: dateChanged && saleDate ? saleDate : undefined,
        salePrice: !clearSalePrice && priceChanged && salePrice
          ? Number(salePrice)
          : undefined,
        clearSalePrice: clearSalePrice && forklift.sold_price != null,
        customerAssetNo: !clearAssetNo && assetChanged ? customerAssetNo.trim() : undefined,
        clearAssetNo: clearAssetNo && !!forklift.customer_forklift_no,
        actorId: currentUser.user_id,
        actorName: currentUser.name,
        correctionReason: reason.trim() || undefined,
      });
      showToast.success('Ownership details updated');
      onSuccess();
    } catch (e) {
      showToast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Pencil className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-semibold text-slate-900">
              {step === 'form' ? 'Edit ownership details' : 'Confirm changes'}
            </h2>
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
          {step === 'form' ? (
            <>
              <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600">
                <div className="font-medium text-slate-800">
                  {forklift.make} {forklift.model} · {forklift.serial_number}
                </div>
                <div className="text-xs">
                  Empty a field and leave it as-is to keep the current value.
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Sale date
                  </label>
                  <input
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                  {originalDate && saleDate !== originalDate && (
                    <div className="text-xs text-amber-600 mt-1">
                      was {originalDate}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Sale price (RM)
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={clearSalePrice ? '' : salePrice}
                    onChange={(e) => { setSalePrice(e.target.value); setClearSalePrice(false); }}
                    disabled={clearSalePrice}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm disabled:bg-slate-100 disabled:text-slate-400"
                  />
                  <label className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                    <input
                      type="checkbox"
                      checked={clearSalePrice}
                      onChange={(e) => setClearSalePrice(e.target.checked)}
                      disabled={forklift.sold_price == null}
                    />
                    Clear (set to no price)
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Customer's asset number
                </label>
                <input
                  type="text"
                  value={clearAssetNo ? '' : customerAssetNo}
                  onChange={(e) => { setCustomerAssetNo(e.target.value); setClearAssetNo(false); }}
                  disabled={clearAssetNo}
                  placeholder="e.g. CUST-FLT-12"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm disabled:bg-slate-100 disabled:text-slate-400"
                />
                <label className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                  <input
                    type="checkbox"
                    checked={clearAssetNo}
                    onChange={(e) => setClearAssetNo(e.target.checked)}
                    disabled={!forklift.customer_forklift_no}
                  />
                  Clear (set to none)
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Reason for correction <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="e.g. typo in original sale price, customer renamed asset code"
                />
                <div className="text-xs text-slate-400 mt-1">
                  Recorded in the lifecycle audit log.
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-3 text-sm text-slate-700">
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-xs text-slate-500">Forklift</div>
                <div className="font-medium">
                  {forklift.make} {forklift.model} · {forklift.serial_number}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3 space-y-2">
                <div className="text-xs font-semibold text-slate-700 mb-1">Changes</div>
                {dateChanged && (
                  <DiffRow label="Sale date" before={originalDate || '—'} after={saleDate || '—'} />
                )}
                {priceChanged && (
                  <DiffRow
                    label="Sale price"
                    before={forklift.sold_price != null ? `RM ${Number(forklift.sold_price).toLocaleString()}` : '—'}
                    after={clearSalePrice ? '—' : (salePrice ? `RM ${Number(salePrice).toLocaleString()}` : '—')}
                  />
                )}
                {assetChanged && (
                  <DiffRow
                    label="Customer asset no."
                    before={originalAsset || '—'}
                    after={clearAssetNo ? '—' : (customerAssetNo || '—')}
                  />
                )}
                {!anyChange && (
                  <div className="text-xs text-slate-400 italic">No changes</div>
                )}
              </div>
              {reason && (
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-xs text-slate-500">Reason</div>
                  <div className="text-sm">{reason}</div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 flex gap-2">
          {step === 'form' ? (
            <>
              <button
                onClick={onClose}
                disabled={submitting}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => setStep('confirm')}
                disabled={!canProceed || submitting}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Review
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setStep('form')}
                disabled={submitting}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Back
              </button>
              <button
                onClick={handleConfirm}
                disabled={submitting || !anyChange}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center justify-center gap-1"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply changes'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const DiffRow: React.FC<{ label: string; before: string; after: string }> = ({ label, before, after }) => (
  <div className="text-xs">
    <div className="text-slate-500">{label}</div>
    <div className="flex items-center gap-2">
      <span className="line-through text-slate-400">{before}</span>
      <span className="text-slate-400">→</span>
      <span className="font-semibold text-slate-800">{after}</span>
    </div>
  </div>
);

export default EditOwnershipDetailsModal;
