import { Loader2, PackageCheck, X } from 'lucide-react';
import React, { useState } from 'react';
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

const inputClassName = "w-full px-3 py-2.5 bg-[#f5f5f5] text-[#111827] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/25 placeholder-slate-400";

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
    // Validation
    const hourmeterValue = parseInt(hourmeter);
    if (isNaN(hourmeterValue) || hourmeterValue < 0) {
      setValidationError('Please enter a valid hourmeter reading');
      return;
    }
    if (hourmeterValue < forklift.hourmeter) {
      setValidationError(`Hourmeter reading cannot be less than current reading (${forklift.hourmeter})`);
      return;
    }

    setValidationError('');
    await onSubmit({
      returnDate,
      hourmeter: hourmeterValue,
      condition,
      notes,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-8 pb-8 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div className="bg-[var(--surface)] rounded-xl shadow-2xl w-full max-w-md my-auto">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-lg text-slate-800">Return Forklift</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" disabled={isProcessing}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Forklift info banner */}
          <div className="p-3 bg-amber-50 rounded-lg">
            <p className="text-sm font-medium text-amber-800">
              {forklift.make} {forklift.model}
            </p>
            <p className="text-xs text-amber-600">
              {forklift.serial_number}
            </p>
            {forklift.current_customer && (
              <p className="text-xs text-amber-600 mt-1">
                Current Customer: {forklift.current_customer.name}
              </p>
            )}
          </div>

          {/* Return Date */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              Return Date *
            </label>
            <input
              type="date"
              className={inputClassName}
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              disabled={isProcessing}
            />
          </div>

          {/* Final Hourmeter Reading */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              Final Hourmeter Reading *
            </label>
            <input
              type="number"
              className={inputClassName}
              value={hourmeter}
              onChange={(e) => {
                setHourmeter(e.target.value);
                setValidationError('');
              }}
              placeholder="e.g., 18750"
              disabled={isProcessing}
            />
            <p className="text-xs text-slate-400 mt-1">
              Current reading: {forklift.hourmeter} hours
            </p>
            {validationError && (
              <p className="text-xs text-red-600 mt-1">{validationError}</p>
            )}
          </div>

          {/* Condition on Return */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              Condition on Return *
            </label>
            <select
              className={inputClassName}
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              disabled={isProcessing}
            >
              <option value="Good">Good</option>
              <option value="Fair">Fair</option>
              <option value="Requires Service">Requires Service</option>
              <option value="Damaged">Damaged</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              Notes
            </label>
            <textarea
              className={`${inputClassName} h-20 resize-none`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes about the return..."
              disabled={isProcessing}
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
              disabled={isProcessing}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="flex-1 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
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
  );
};

export default ReturnForkliftModal;
