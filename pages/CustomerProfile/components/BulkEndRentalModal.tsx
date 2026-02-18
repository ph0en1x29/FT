import { CircleOff,Loader2,Truck,X } from 'lucide-react';
import React from 'react';
import { BulkEndRentalModalProps } from '../types';

const BulkEndRentalModal: React.FC<BulkEndRentalModalProps> = ({
  selectedRentals,
  bulkEndDate,
  setBulkEndDate,
  bulkProcessing,
  onClose,
  onConfirm,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-[var(--surface)] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-red-50">
          <h3 className="font-bold text-lg text-red-800">
            End {selectedRentals.length} Rental(s)
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-slate-50 rounded-lg p-3 max-h-40 overflow-y-auto">
            <p className="text-xs font-bold text-slate-500 uppercase mb-2">Rentals to End:</p>
            <div className="space-y-1">
              {selectedRentals.map(rental => (
                <div key={rental.rental_id} className="text-sm p-2 bg-[var(--surface)] rounded border border-slate-200 flex items-center gap-2">
                  <Truck className="w-3 h-3 text-slate-400" />
                  <span className="font-medium">{rental.forklift?.serial_number}</span>
                  <span className="text-slate-400">—</span>
                  <span className="text-slate-500">{rental.forklift?.make} {rental.forklift?.model}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-800">
              <strong>⚠️</strong> These forklifts will become available for new rentals.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">End Date</label>
            <input
              type="date"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
              value={bulkEndDate}
              onChange={(e) => setBulkEndDate(e.target.value)}
            />
          </div>

          <div className="pt-4 flex gap-3">
            <button
              onClick={onClose}
              disabled={bulkProcessing}
              className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={bulkProcessing}
              className="flex-1 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {bulkProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CircleOff className="w-4 h-4" />}
              {bulkProcessing ? 'Processing...' : 'End Rentals'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkEndRentalModal;
