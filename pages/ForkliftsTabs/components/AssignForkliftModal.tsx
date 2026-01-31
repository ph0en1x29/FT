import React from 'react';
import { Forklift, Customer } from '../../../types';
import { X, Building2, Loader2 } from 'lucide-react';

interface AssignForkliftModalProps {
  isOpen: boolean;
  onClose: () => void;
  forklift: Forklift | null;
  bulkCount?: number;
  customers: Customer[];
  selectedCustomerId: string;
  setSelectedCustomerId: (id: string) => void;
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  rentalNotes: string;
  setRentalNotes: (notes: string) => void;
  monthlyRentalRate: string;
  setMonthlyRentalRate: (rate: string) => void;
  onSubmit: () => void;
  isProcessing?: boolean;
}

const inputClassName = "w-full px-3 py-2.5 bg-[#f5f5f5] text-[#111827] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/25 placeholder-slate-400";

const AssignForkliftModal: React.FC<AssignForkliftModalProps> = ({
  isOpen,
  onClose,
  forklift,
  bulkCount,
  customers,
  selectedCustomerId,
  setSelectedCustomerId,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  rentalNotes,
  setRentalNotes,
  monthlyRentalRate,
  setMonthlyRentalRate,
  onSubmit,
  isProcessing = false,
}) => {
  if (!isOpen) return null;

  const isBulk = !forklift && bulkCount;
  const title = isBulk ? `Bulk Rent Out (${bulkCount} forklifts)` : 'Rent Forklift to Customer';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-lg text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {forklift && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-sm font-medium text-blue-800">{forklift.make} {forklift.model}</p>
              <p className="text-xs text-blue-600">{forklift.serial_number}</p>
            </div>
          )}

          {isBulk && (
            <div className="p-3 bg-green-50 rounded-lg">
              <p className="text-sm font-medium text-green-800">Renting {bulkCount} forklifts</p>
              <p className="text-xs text-green-600">All selected available forklifts will be rented to the same customer</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Customer *</label>
            <select 
              className={inputClassName} 
              value={selectedCustomerId} 
              onChange={(e) => setSelectedCustomerId(e.target.value)}
            >
              <option value="">-- Select Customer --</option>
              {customers.map(c => <option key={c.customer_id} value={c.customer_id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monthly Rental Rate (RM)</label>
            <input 
              type="number" 
              step="0.01" 
              className={inputClassName} 
              value={monthlyRentalRate} 
              onChange={(e) => setMonthlyRentalRate(e.target.value)} 
              placeholder="e.g., 2500.00" 
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Rental Start Date *</label>
            <input 
              type="date" 
              className={inputClassName} 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Rental End Date (Optional)</label>
            <input 
              type="date" 
              className={inputClassName} 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
            />
            <p className="text-xs text-slate-400 mt-1">Leave empty for ongoing rental</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes</label>
            <textarea 
              className={`${inputClassName} h-20 resize-none`} 
              value={rentalNotes} 
              onChange={(e) => setRentalNotes(e.target.value)} 
              placeholder="Optional notes..." 
            />
          </div>

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
              onClick={onSubmit} 
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
              disabled={isProcessing}
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Building2 className="w-4 h-4" />
              )}
              {isBulk ? 'Rent All' : 'Rent Forklift'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssignForkliftModal;
