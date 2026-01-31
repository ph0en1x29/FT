import React, { useState } from 'react';
import { X, DollarSign } from 'lucide-react';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';

interface EditRentalRateModalProps {
  rentalId: string;
  currentRate: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditRentalRateModal: React.FC<EditRentalRateModalProps> = ({
  rentalId,
  currentRate,
  onClose,
  onSuccess,
}) => {
  const [rate, setRate] = useState(currentRate.toString());

  const handleSave = async () => {
    try {
      await MockDb.updateRentalRate(rentalId, parseFloat(rate) || 0);
      onSuccess();
    } catch (error) {
      alert((error as Error).message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-lg text-slate-800">Edit Rental Rate</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monthly Rate (RM)</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="number"
                step="0.01"
                className="w-full pl-9 pr-3 py-2.5 bg-[#f5f5f5] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-blue-500"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
            </div>
          </div>
          <div className="pt-4 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium">Cancel</button>
            <button type="button" onClick={handleSave} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm">Save</button>
          </div>
        </div>
      </div>
    </div>
  );
};
