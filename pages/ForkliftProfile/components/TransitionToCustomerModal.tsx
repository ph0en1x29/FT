import { Building2, Loader2, UserCheck, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { getCustomersForList } from '../../../services/customerService';
import { transitionFleetToCustomer } from '../../../services/forkliftService';
import { showToast } from '../../../services/toastService';
import { Customer, Forklift, User } from '../../../types';

interface TransitionToCustomerModalProps {
  forklift: Forklift;
  currentUser: User;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Two-step wizard: gather sale details, confirm, call RPC. Forklift moves
 * from Fleet tab to Serviced Externals tab in one transaction.
 */
export const TransitionToCustomerModal: React.FC<TransitionToCustomerModalProps> = ({
  forklift,
  currentUser,
  onClose,
  onSuccess,
}) => {
  const [customers, setCustomers] = useState<Pick<Customer, 'customer_id' | 'name' | 'address'>[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10));
  const [salePrice, setSalePrice] = useState('');
  const [customerAssetNo, setCustomerAssetNo] = useState(forklift.customer_forklift_no || '');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<'form' | 'confirm'>('form');

  useEffect(() => {
    getCustomersForList()
      .then(setCustomers)
      .catch(() => showToast.error('Failed to load customer list'));
  }, []);

  const selectedCustomer = customers.find(c => c.customer_id === customerId);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await transitionFleetToCustomer(forklift.forklift_id, customerId, saleDate, {
        salePrice: salePrice ? Number(salePrice) : undefined,
        customerAssetNo: customerAssetNo.trim() || undefined,
        actorId: currentUser.user_id,
        actorName: currentUser.name,
        reason: reason.trim() || undefined,
      });
      showToast.success(`Forklift transferred to ${selectedCustomer?.name || 'customer'}`);
      onSuccess();
    } catch (e) {
      showToast.error(e instanceof Error ? e.message : 'Transfer failed');
    } finally {
      setSubmitting(false);
    }
  };

  const canProceed = customerId && saleDate;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-semibold text-slate-900">
              {step === 'form' ? 'Sell forklift to customer' : 'Confirm transfer'}
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
                  Hourmeter: {forklift.hourmeter?.toLocaleString() || 0} h
                  {forklift.forklift_no && ` · Acwer no. ${forklift.forklift_no}`}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Customer <span className="text-red-500">*</span>
                </label>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  <option value="">Select customer…</option>
                  {customers
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(c => (
                      <option key={c.customer_id} value={c.customer_id}>{c.name}</option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Sale date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Sale price (RM)
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    placeholder="optional"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Customer's asset number (their internal code)
                </label>
                <input
                  type="text"
                  value={customerAssetNo}
                  onChange={(e) => setCustomerAssetNo(e.target.value)}
                  placeholder="e.g. CUST-FLT-12 (optional)"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
                <div className="text-xs text-slate-400 mt-1">
                  If the customer assigns their own number, use that for display. Acwer's internal serial stays in the system.
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Notes / reason (optional)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="e.g. End of long-term rental, customer chose to buy"
                />
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <div className="font-semibold mb-1">What happens on confirm:</div>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>This forklift's ownership flips to <strong>customer</strong>.</li>
                  <li>It moves from the <strong>Fleet</strong> tab to the new <strong>Serviced Externals</strong> tab.</li>
                  <li>Any active rental on this unit is automatically ended.</li>
                  <li>All service history & hourmeter readings are preserved.</li>
                </ul>
              </div>
            </>
          ) : (
            <div className="space-y-3 text-sm text-slate-700">
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-xs text-slate-500">Forklift</div>
                <div className="font-medium">{forklift.make} {forklift.model} · {forklift.serial_number}</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-xs text-slate-500">New owner</div>
                <div className="font-medium flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  {selectedCustomer?.name || '—'}
                </div>
                {selectedCustomer?.address && (
                  <div className="text-xs text-slate-500 mt-0.5">{selectedCustomer.address}</div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-xs text-slate-500">Sale date</div>
                  <div className="font-medium">{new Date(saleDate).toLocaleDateString()}</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-xs text-slate-500">Sale price</div>
                  <div className="font-medium">{salePrice ? `RM ${Number(salePrice).toLocaleString()}` : '—'}</div>
                </div>
              </div>
              {customerAssetNo && (
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-xs text-slate-500">Customer asset no.</div>
                  <div className="font-medium">{customerAssetNo}</div>
                </div>
              )}
              {reason && (
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-xs text-slate-500">Reason / notes</div>
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
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center justify-center gap-1"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm transfer'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
