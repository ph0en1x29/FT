import { Loader2, PlusCircle, X } from 'lucide-react';
import React, { useState } from 'react';
import { createForklift } from '../../../services/forkliftService';
import { showToast } from '../../../services/toastService';
import { ForkliftStatus, ForkliftType } from '../../../types';

interface AddCustomerOwnedForkliftModalProps {
  customerId: string;
  customerName: string;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Standalone "register a customer-owned forklift" modal accessible from
 * CustomerProfile. Pre-sets ownership='customer', ownership_type='external',
 * acquisition_source='new_byo' and links to the customer. Use this for BYO
 * units; for "sold from Acwer's fleet" use TransitionToCustomerModal on the
 * forklift profile instead.
 */
const AddCustomerOwnedForkliftModal: React.FC<AddCustomerOwnedForkliftModalProps> = ({
  customerId,
  customerName,
  onClose,
  onSuccess,
}) => {
  const [serial, setSerial] = useState('');
  const [customerAssetNo, setCustomerAssetNo] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [type, setType] = useState<ForkliftType>(ForkliftType.DIESEL);
  const [hourmeter, setHourmeter] = useState('0');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = serial.trim() && make.trim() && model.trim();

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await createForklift({
        serial_number: serial.trim(),
        customer_forklift_no: customerAssetNo.trim() || undefined,
        make: make.trim(),
        model: model.trim(),
        type,
        hourmeter: Number(hourmeter) || 0,
        ownership: 'customer' as any,
        ownership_type: 'external',
        acquisition_source: 'new_byo',
        service_management_status: 'active',
        current_customer_id: customerId,
        customer_id: customerId,
        status: ForkliftStatus.ACTIVE,
      } as any);
      showToast.success(`Forklift registered to ${customerName}`);
      onSuccess();
    } catch (e) {
      showToast.error(e instanceof Error ? e.message : 'Failed to register forklift');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-semibold text-slate-900">
              Register customer-owned forklift
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

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <div className="text-xs text-slate-500">
            For: <span className="font-medium text-slate-700">{customerName}</span>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Serial number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              placeholder="e.g. CUST-FLT-12345"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Customer's own asset number
            </label>
            <input
              type="text"
              value={customerAssetNo}
              onChange={(e) => setCustomerAssetNo(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              placeholder="optional — their internal code"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Make <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={make}
                onChange={(e) => setMake(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                placeholder="e.g. Toyota"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Model <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                placeholder="e.g. 8FD25"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Type <span className="text-red-500">*</span>
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ForkliftType)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              >
                {Object.values(ForkliftType).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Current hourmeter
              </label>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={hourmeter}
                onChange={(e) => setHourmeter(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">
            This forklift will be marked as customer-owned (BYO) and added to the
            <strong> Serviced Externals</strong> tab. You can attach it to an AMC contract
            from the Contracts section after creation.
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
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Register forklift'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddCustomerOwnedForkliftModal;
