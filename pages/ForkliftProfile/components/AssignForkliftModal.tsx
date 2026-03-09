import { Save,X } from 'lucide-react';
import { Combobox,ComboboxOption } from '../../../components/Combobox';
import React,{ useCallback,useState } from 'react';
import { supabase } from '../../../services/supabaseClient';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';
import { Forklift,User } from '../../../types';

interface AssignForkliftModalProps {
  forklift: Forklift;
  /** @deprecated — no longer needed; search is handled server-side inside the modal */
  customers?: never[];
  currentUser: User;
  onClose: () => void;
  onSuccess: () => void;
}

export const AssignForkliftModal: React.FC<AssignForkliftModalProps> = ({
  forklift,
  currentUser,
  onClose,
  onSuccess,
}) => {
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerOptions, setCustomerOptions] = useState<ComboboxOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleCustomerSearch = useCallback(async (query: string) => {
    setIsSearching(true);
    try {
      const results = await MockDb.searchCustomers(query, 20);
      setCustomerOptions(results.map(c => ({ id: c.customer_id, label: c.name })));
    } catch {
      setCustomerOptions([]);
    } finally {
      setIsSearching(false);
    }
  }, []);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [rentalNotes, setRentalNotes] = useState('');
  const [rentalSite, setRentalSite] = useState('');
  const [monthlyRentalRate, setMonthlyRentalRate] = useState('');
  const [lastServiceHourmeter, setLastServiceHourmeter] = useState('');

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
        monthlyRentalRate ? parseFloat(monthlyRentalRate) : undefined,
        rentalSite || undefined
      );
      // If last service hourmeter provided, reset service interval
      if (lastServiceHourmeter) {
        const newHm = parseInt(lastServiceHourmeter);
        if (!isNaN(newHm) && newHm > 0) {
          const interval = forklift.service_interval_hours || 500;
          await supabase
            .from('forklifts')
            .update({
              last_service_hourmeter: newHm,
              last_serviced_hourmeter: newHm,
              next_target_service_hour: newHm + interval,
              last_service_date: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('forklift_id', forklift.forklift_id);
        }
      }
      onSuccess();
    } catch (error) {
      alert((error as Error).message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] rounded-xl shadow-2xl w-full max-w-md md:max-w-2xl">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
          <h3 className="font-bold text-lg text-slate-800">Rent Forklift to Customer</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 md:p-6 space-y-4">
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-sm font-medium text-blue-800">{forklift.make} {forklift.model}</p>
            <p className="text-xs text-blue-600">{forklift.serial_number}</p>
          </div>

          <Combobox
            label="Select Customer *"
            options={customerOptions}
            value={selectedCustomerId}
            onChange={setSelectedCustomerId}
            placeholder="Type to search customers..."
            onSearch={handleCustomerSearch}
            isSearching={isSearching}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monthly Rental Rate (RM)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-medium">RM</span>
                <input
                  type="text"
                  inputMode="decimal"
                  className="w-full pl-10 pr-3 py-2.5 bg-[#f5f5f5] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-blue-500"
                  value={monthlyRentalRate}
                  onChange={(e) => { const v = e.target.value; if (v === '' || /^\d*\.?\d{0,2}$/.test(v)) setMonthlyRentalRate(v); }}
                  placeholder="e.g., 2500.00"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Last Service Hourmeter</label>
              <input
                type="number"
                className="w-full px-3 py-2.5 bg-[#f5f5f5] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-blue-500"
                value={lastServiceHourmeter}
                onChange={(e) => setLastServiceHourmeter(e.target.value)}
                placeholder="e.g., 17503"
                min="0"
              />
              <p className="text-xs text-slate-400 mt-1">Optional — resets service interval</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <p className="text-xs text-slate-400 mt-1">Leave empty for ongoing rental</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Site</label>
              <input
                type="text"
                className="w-full px-3 py-2.5 bg-[#f5f5f5] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-blue-500"
                value={rentalSite}
                onChange={(e) => setRentalSite(e.target.value)}
                placeholder="e.g., Port Klang Warehouse 4"
              />
              <p className="text-xs text-slate-400 mt-1">Physical location where forklift will be used</p>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes</label>
              <textarea
                className="w-full px-3 py-2.5 bg-[#f5f5f5] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-blue-500 h-[42px] resize-none"
                value={rentalNotes}
                onChange={(e) => setRentalNotes(e.target.value)}
                placeholder="Optional notes..."
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium">Cancel</button>
            <button type="button" onClick={handleSubmit} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm flex items-center justify-center gap-2">
              <Save className="w-4 h-4" /> Rent Forklift
            </button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};
