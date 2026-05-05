import { AlertTriangle, ArrowRightLeft, Building2, Loader2, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { getCustomersForList } from '../../../services/customerService';
import {
  countOrphanedObligations,
  transferBetweenCustomers,
} from '../../../services/forkliftService';
import { showToast } from '../../../services/toastService';
import { Customer, Forklift, User } from '../../../types';

interface Props {
  forklift: Forklift;
  currentUser: User;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Customer-to-customer ownership change. Acwer continues to service.
 * Two-step wizard: pick new owner → see preflight warning about active
 * contracts/schedules pinned to the old owner → confirm.
 */
export const TransferOwnershipModal: React.FC<Props> = ({
  forklift,
  currentUser,
  onClose,
  onSuccess,
}) => {
  const [customers, setCustomers] = useState<Pick<Customer, 'customer_id' | 'name' | 'address'>[]>([]);
  const [newCustomerId, setNewCustomerId] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [newAssetNo, setNewAssetNo] = useState('');
  const [clearAssetNo, setClearAssetNo] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [orphans, setOrphans] = useState<{ activeContracts: number; activeSchedules: number } | null>(null);
  const [orphanLoading, setOrphanLoading] = useState(false);

  useEffect(() => {
    getCustomersForList()
      .then(setCustomers)
      .catch(() => showToast.error('Failed to load customer list'));
  }, []);

  const oldCustomerId = forklift.current_customer_id;
  const oldOwner = customers.find(c => c.customer_id === oldCustomerId);
  const newOwner = customers.find(c => c.customer_id === newCustomerId);

  // Preflight: when admin moves to confirm step, count what will be left
  // pinned to the old customer.
  useEffect(() => {
    if (step !== 'confirm' || !oldCustomerId) return;
    setOrphanLoading(true);
    countOrphanedObligations(forklift.forklift_id, oldCustomerId)
      .then(setOrphans)
      .catch(() => setOrphans(null))
      .finally(() => setOrphanLoading(false));
  }, [step, forklift.forklift_id, oldCustomerId]);

  const sameCustomer = newCustomerId && newCustomerId === oldCustomerId;
  const canProceed =
    newCustomerId &&
    !sameCustomer &&
    transferDate &&
    reason.trim().length >= 4;

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await transferBetweenCustomers(
        forklift.forklift_id,
        newCustomerId,
        transferDate,
        {
          newCustomerAssetNo: !clearAssetNo && newAssetNo.trim() ? newAssetNo.trim() : undefined,
          clearAssetNo: clearAssetNo,
          actorId: currentUser.user_id,
          actorName: currentUser.name,
          reason: reason.trim(),
        }
      );
      showToast.success(`Forklift transferred to ${newOwner?.name || 'new owner'}`);
      onSuccess();
    } catch (e) {
      showToast.error(e instanceof Error ? e.message : 'Transfer failed');
    } finally {
      setSubmitting(false);
    }
  };

  const totalOrphans = (orphans?.activeContracts ?? 0) + (orphans?.activeSchedules ?? 0);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-semibold text-slate-900">
              {step === 'form' ? 'Transfer to new owner' : 'Confirm transfer'}
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
                  Currently owned by{' '}
                  <span className="font-semibold">{oldOwner?.name || 'unknown customer'}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  New owner <span className="text-red-500">*</span>
                </label>
                <select
                  value={newCustomerId}
                  onChange={(e) => setNewCustomerId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  <option value="">Select customer…</option>
                  {customers
                    .slice()
                    .filter(c => c.customer_id !== oldCustomerId)
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(c => (
                      <option key={c.customer_id} value={c.customer_id}>{c.name}</option>
                    ))}
                </select>
                {sameCustomer && (
                  <div className="text-xs text-red-600 mt-1">
                    New owner cannot be the same as the current owner.
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Transfer date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  New customer's asset number
                </label>
                <input
                  type="text"
                  value={clearAssetNo ? '' : newAssetNo}
                  onChange={(e) => { setNewAssetNo(e.target.value); setClearAssetNo(false); }}
                  disabled={clearAssetNo}
                  placeholder={forklift.customer_forklift_no
                    ? `Leave blank to keep "${forklift.customer_forklift_no}"`
                    : 'Optional — their internal code'}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm disabled:bg-slate-100 disabled:text-slate-400"
                />
                <label className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                  <input
                    type="checkbox"
                    checked={clearAssetNo}
                    onChange={(e) => setClearAssetNo(e.target.checked)}
                    disabled={!forklift.customer_forklift_no}
                  />
                  Clear (new owner has not assigned a number)
                </label>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  placeholder="e.g. Customer A resold this unit to Customer B; Acwer continues to service"
                />
                <div className="text-xs text-slate-400 mt-1">
                  Recorded in the lifecycle audit log. Min. 4 characters.
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-lg p-3">
                  <div className="text-xs text-slate-500">Current owner</div>
                  <div className="font-medium flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    {oldOwner?.name || '—'}
                  </div>
                </div>
                <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
                  <div className="text-xs text-indigo-700">New owner</div>
                  <div className="font-medium flex items-center gap-1.5 text-indigo-900">
                    <Building2 className="w-4 h-4 text-indigo-500" />
                    {newOwner?.name || '—'}
                  </div>
                  {newOwner?.address && (
                    <div className="text-xs text-indigo-700/70 mt-0.5">{newOwner.address}</div>
                  )}
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-xs text-slate-500">Transfer date</div>
                <div className="font-medium">{new Date(transferDate).toLocaleDateString()}</div>
              </div>

              {orphanLoading && (
                <div className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Checking for active contracts pinned to current owner…
                </div>
              )}

              {!orphanLoading && totalOrphans > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <div>
                      <div className="font-semibold mb-1">Manual reassignment needed</div>
                      <div className="space-y-0.5">
                        {orphans!.activeContracts > 0 && (
                          <div>
                            <strong>{orphans!.activeContracts}</strong> active service contract{orphans!.activeContracts === 1 ? '' : 's'} covering this forklift {orphans!.activeContracts === 1 ? 'is' : 'are'} pinned to <strong>{oldOwner?.name}</strong>.
                          </div>
                        )}
                        {orphans!.activeSchedules > 0 && (
                          <div>
                            <strong>{orphans!.activeSchedules}</strong> active recurring schedule{orphans!.activeSchedules === 1 ? '' : 's'} {orphans!.activeSchedules === 1 ? 'is' : 'are'} pinned to <strong>{oldOwner?.name}</strong>.
                          </div>
                        )}
                      </div>
                      <div className="mt-2">
                        After this transfer, edit those contracts/schedules to remove this forklift from {oldOwner?.name}'s coverage and add it under {newOwner?.name || 'the new owner'}'s. We don't auto-move them — invoicing assumptions could break silently.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {!orphanLoading && orphans && totalOrphans === 0 && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                  No active contracts or recurring schedules pinned to the current owner — clean transfer.
                </div>
              )}

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

export default TransferOwnershipModal;
