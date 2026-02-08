import { DollarSign,Save,X } from 'lucide-react';
import React,{ useState } from 'react';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';
import { Customer,Forklift,User } from '../../../types';

interface AssignForkliftModalProps {
  forklift: Forklift;
  customers: Customer[];
  currentUser: User;
  onClose: () => void;
  onSuccess: () => void;
}

export const AssignForkliftModal: React.FC<AssignForkliftModalProps> = ({
  forklift,
  customers,
  currentUser,
  onClose,
  onSuccess,
}) => {
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [rentalNotes, setRentalNotes] = useState('');
  const [monthlyRentalRate, setMonthlyRentalRate] = useState('');

  const handleSubmit = async () => {
    if (!selectedCustomerId || !startDate) {
      alert('Please select a customer and start date');
      return;
    }

    try {
      await MockDb.assignForkliftToCustomer(
        forklift.forklift_id,
        selectedCustomerId,
        startDate,
        endDate || undefined,
        rentalNotes || undefined,
        currentUser.user_id,
        currentUser.name,
        monthlyRentalRate ? parseFloat(monthlyRentalRate) : undefined
      );
      onSuccess();
    } catch (error) {
      alert((error as Error).message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0">
          <h3 className="font-bold text-lg text-slate-800">Rent Forklift to Customer</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-3 bg-blue-50 rounded-lg mb-4">
            <p className="text-sm font-medium text-blue-800">{forklift.make} {forklift.model}</p>
            <p className="text-xs text-blue-600">{forklift.serial_number}</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Customer *</label>
            <select
              className="w-full px-3 py-2.5 bg-[#f5f5f5] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-blue-500"
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
            >
              <option value="">-- Select Customer --</option>
              {customers.map(c => (
                <option key={c.customer_id} value={c.customer_id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monthly Rental Rate (RM)</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="number"
                step="0.01"
                className="w-full pl-9 pr-3 py-2.5 bg-[#f5f5f5] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-blue-500"
                value={monthlyRentalRate}
                onChange={(e) => setMonthlyRentalRate(e.target.value)}
                placeholder="e.g., 2500.00"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Rental Start Date *</label>
            <input
              type="date"
              className="w-full px-3 py-2.5 bg-[#f5f5f5] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-blue-500"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Rental End Date (Optional)</label>
            <input
              type="date"
              className="w-full px-3 py-2.5 bg-[#f5f5f5] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-blue-500"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
            <p className="text-xs text-slate-400 mt-1">Leave empty for ongoing/indefinite rental</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes</label>
            <textarea
              className="w-full px-3 py-2.5 bg-[#f5f5f5] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-blue-500 h-20 resize-none"
              value={rentalNotes}
              onChange={(e) => setRentalNotes(e.target.value)}
              placeholder="Optional notes about this rental..."
            />
          </div>

          <div className="pt-4 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium">Cancel</button>
            <button type="button" onClick={handleSubmit} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm flex items-center justify-center gap-2">
              <Save className="w-4 h-4" /> Rent Forklift
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
