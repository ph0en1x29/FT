import { Gauge, Loader2, PackageCheck, X } from 'lucide-react';
import React, { useState } from 'react';
import { Combobox, ComboboxOption } from '../../../components/Combobox';
import { Forklift } from '../../../types';

interface ReturnForkliftModalProps {
  isOpen: boolean;
  onClose: () => void;
  forklift: Forklift;
  onSubmit: (data: {
    returnDate: string;
    hourmeter: number;
    condition: string;
    notes: string;
  }) => Promise<void>;
  isProcessing?: boolean;
}

const inputClassName = "w-full px-3 py-2.5 bg-[#f5f5f5] text-[#111827] border border-[#d1d5db] rounded-xl focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/25 placeholder-slate-400";

const conditionOptions: ComboboxOption[] = [
  { id: 'Good', label: 'Good' },
  { id: 'Fair', label: 'Fair' },
  { id: 'Requires Service', label: 'Requires Service' },
  { id: 'Damaged', label: 'Damaged' },
];

const ReturnForkliftModal: React.FC<ReturnForkliftModalProps> = ({
  isOpen,
  onClose,
  forklift,
  onSubmit,
  isProcessing = false,
}) => {
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [hourmeter, setHourmeter] = useState(forklift.hourmeter?.toString() || '0');
  const [condition, setCondition] = useState('Good');
  const [notes, setNotes] = useState('');
  const [validationError, setValidationError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async () => {
    const hourmeterValue = parseInt(hourmeter);
    if (isNaN(hourmeterValue) || hourmeterValue < 0) {
      setValidationError('Please enter a valid hourmeter reading');
      return;
    }
    if (hourmeterValue < forklift.hourmeter) {
      setValidationError(`Cannot be less than current reading (${forklift.hourmeter})`);
      return;
    }
    setValidationError('');
    await onSubmit({ returnDate, hourmeter: hourmeterValue, condition, notes });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] rounded-2xl shadow-2xl w-full max-w-md md:max-w-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center">
              <PackageCheck className="w-3.5 h-3.5 text-white" />
            </div>
            <h3 className="font-bold text-lg text-slate-800">Return Forklift</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" disabled={isProcessing}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 md:p-6 space-y-4">
          {/* Forklift info bar */}
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-amber-800">{forklift.make} {forklift.model}</p>
              <p className="text-xs text-amber-600">{forklift.serial_number}</p>
              {forklift.current_customer && (
                <p className="text-xs text-amber-500 mt-0.5">Customer: {forklift.current_customer.name}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-amber-600">
              <Gauge className="w-3.5 h-3.5" />
              <span className="text-sm font-medium">{forklift.hourmeter.toLocaleString()} hrs</span>
            </div>
          </div>

          {/* Row 1: Return Date + Final Hourmeter */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Return Date *</label>
              <input
                type="date"
                className={inputClassName}
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                disabled={isProcessing}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Final Hourmeter *</label>
              <input
                type="number"
                className={inputClassName}
                value={hourmeter}
                onChange={(e) => { setHourmeter(e.target.value); setValidationError(''); }}
                placeholder="e.g., 18750"
                disabled={isProcessing}
              />
              {validationError ? (
                <p className="text-xs text-red-600 mt-1">{validationError}</p>
              ) : (
                <p className="text-xs text-slate-400 mt-1">Current: {forklift.hourmeter.toLocaleString()} hrs</p>
              )}
            </div>
          </div>

          {/* Row 2: Condition + Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Combobox
              label="Condition on Return *"
              options={conditionOptions}
              value={condition}
              onChange={setCondition}
              placeholder="Select condition..."
            />
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes</label>
              <textarea
                className={`${inputClassName} h-[42px] resize-none`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes..."
                disabled={isProcessing}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-100 flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 font-medium"
              disabled={isProcessing}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="px-6 py-2.5 bg-amber-500 text-white rounded-xl hover:bg-amber-600 font-medium shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <PackageCheck className="w-4 h-4" />
              )}
              Return Forklift
            </button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default ReturnForkliftModal;
