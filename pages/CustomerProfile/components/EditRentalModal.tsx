import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { EditRentalModalProps } from '../types';

const EditRentalModal: React.FC<EditRentalModalProps> = ({
  rental,
  isAdmin,
  onClose,
  onSave,
}) => {
  const [startDate, setStartDate] = useState(rental.start_date);
  const [endDate, setEndDate] = useState(rental.end_date || '');
  const [notes, setNotes] = useState(rental.notes || '');
  const [monthlyRate, setMonthlyRate] = useState(rental.monthly_rental_rate?.toString() || '0');

  useEffect(() => {
    setStartDate(rental.start_date);
    setEndDate(rental.end_date || '');
    setNotes(rental.notes || '');
    setMonthlyRate(rental.monthly_rental_rate?.toString() || '0');
  }, [rental]);

  const handleSave = () => {
    onSave({ startDate, endDate, notes, monthlyRate });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-lg text-slate-800">Edit Rental</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-sm font-medium text-blue-800">
              {rental.forklift?.make} {rental.forklift?.model}
            </p>
            <p className="text-xs text-blue-600">{rental.forklift?.serial_number}</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Date</label>
            <input
              type="date"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">End Date (Optional)</label>
            <input
              type="date"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          {isAdmin && (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monthly Rate (RM)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">RM</span>
                <input
                  type="number"
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                  value={monthlyRate}
                  onChange={(e) => setMonthlyRate(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes</label>
            <textarea
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 h-20 resize-none"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
            />
          </div>

          <div className="pt-4 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditRentalModal;
