import { Gauge,Save,Settings,Truck,X } from 'lucide-react';
import React from 'react';
import { ForkliftStatus,ForkliftType } from '../../../types';

let FORKLIFT_BRANDS: readonly string[];
try {
  const imported = require('../../../types/forklift.types');
  FORKLIFT_BRANDS = imported.FORKLIFT_BRANDS;
} catch {
  FORKLIFT_BRANDS = ['Toyota', 'Nichiyu', 'Hangcha', 'BT', 'EP', 'Noblelift', 'TCM', 'Unicarries', 'Yale', 'Nissan', 'Others'];
}

interface FormData {
  serial_number: string;
  forklift_no: string;
  customer_forklift_no: string;
  make: string;
  model: string;
  type: ForkliftType;
  hourmeter: number;
  last_hourmeter_update: string;
  last_service_hourmeter: number;
  last_service_date: string;
  year: number | null;
  capacity_kg: number;
  site: string;
  status: ForkliftStatus;
  notes: string;
}

interface AddEditForkliftModalProps {
  isOpen: boolean;
  onClose: () => void;
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  onSubmit: (e: React.FormEvent) => void;
  isEditing: boolean;
}

const inputClassName = "w-full px-3 py-2.5 bg-[#f5f5f5] text-[#111827] border border-[#d1d5db] rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 placeholder-slate-400 transition-all duration-200";

const AddEditForkliftModal: React.FC<AddEditForkliftModalProps> = ({
  isOpen,
  onClose,
  formData,
  setFormData,
  onSubmit,
  isEditing,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] rounded-2xl shadow-2xl w-full max-w-lg md:max-w-3xl">
        {/* Header */}
        <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <Truck className="w-3.5 h-3.5 text-white" />
            </div>
            <h3 className="font-bold text-lg text-slate-800">{isEditing ? 'Edit Forklift' : 'Add New Forklift'}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit}>
          {/* Section 1: Identity */}
          <div className="border-b border-slate-100">
            <div className="px-4 md:px-6 py-2.5 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
              <Truck className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-xs font-semibold text-blue-800 uppercase tracking-wide">Identity</span>
            </div>
            <div className="p-4 md:p-6 space-y-4">
              {/* Row: Serial + Forklift No + Customer No */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Serial Number *</label>
                  <input type="text" className={inputClassName} value={formData.serial_number} onChange={e => setFormData({...formData, serial_number: e.target.value})} placeholder="e.g., FL-001234" required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Forklift No</label>
                  <input type="text" className={inputClassName} value={formData.forklift_no} onChange={e => setFormData({...formData, forklift_no: e.target.value})} placeholder="e.g., A123" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Customer Forklift No</label>
                  <input type="text" className={inputClassName} value={formData.customer_forklift_no} onChange={e => setFormData({...formData, customer_forklift_no: e.target.value})} placeholder="e.g., WH-FL-003" />
                </div>
              </div>

              {/* Row: Brand + Model + Type + Status */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Brand *</label>
                  <select className={inputClassName} value={formData.make} onChange={e => setFormData({...formData, make: e.target.value})} required>
                    <option value="">Select</option>
                    {FORKLIFT_BRANDS.map(brand => <option key={brand} value={brand}>{brand}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Model</label>
                  <input type="text" className={inputClassName} value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} placeholder="e.g., 8FGU25" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Type *</label>
                  <select className={inputClassName} value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as ForkliftType})}>
                    {Object.values(ForkliftType).map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                  <select className={inputClassName} value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as ForkliftStatus})}>
                    {Object.values(ForkliftStatus).map(status => <option key={status} value={status}>{status}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Hourmeter & Service */}
          <div className="border-b border-slate-100">
            <div className="px-4 md:px-6 py-2.5 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
              <Gauge className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Hourmeter & Service</span>
            </div>
            <div className="p-4 md:p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Current HRS</label>
                  <input type="number" className={inputClassName} value={formData.hourmeter} onChange={e => setFormData({...formData, hourmeter: parseInt(e.target.value) || 0})} min="0" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Reading Date</label>
                  <input type="date" className={inputClassName} value={formData.last_hourmeter_update} onChange={e => setFormData({...formData, last_hourmeter_update: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Last Service HRS</label>
                  <input type="number" className={inputClassName} value={formData.last_service_hourmeter} onChange={e => setFormData({...formData, last_service_hourmeter: parseInt(e.target.value) || 0})} min="0" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Last Service Date</label>
                  <input type="date" className={inputClassName} value={formData.last_service_date} onChange={e => setFormData({...formData, last_service_date: e.target.value})} />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Specs & Notes */}
          <div className="border-b border-slate-100">
            <div className="px-4 md:px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
              <Settings className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Specs & Notes</span>
            </div>
            <div className="p-4 md:p-6 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Year</label>
                  <input type="number" className={inputClassName} value={formData.year ?? ''} onChange={e => setFormData({...formData, year: e.target.value ? parseInt(e.target.value) : null})} min="1980" max={new Date().getFullYear() + 1} placeholder="e.g., 2020" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Capacity (KG)</label>
                  <input type="number" className={inputClassName} value={formData.capacity_kg} onChange={e => setFormData({...formData, capacity_kg: parseInt(e.target.value) || 0})} min="0" placeholder="e.g., 2500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Location</label>
                  <input type="text" className={inputClassName} value={formData.site} onChange={e => setFormData({...formData, site: e.target.value})} placeholder="e.g., North Gate Warehouse" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes</label>
                <textarea className={`${inputClassName} h-16 resize-none`} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Additional notes..." />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 md:p-6 flex gap-3 justify-end bg-slate-50/50 rounded-b-2xl">
            <button type="button" onClick={onClose} className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 font-medium">
              Cancel
            </button>
            <button type="submit" className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium shadow-sm flex items-center justify-center gap-2">
              <Save className="w-4 h-4" /> {isEditing ? 'Update' : 'Add Forklift'}
            </button>
          </div>
        </form>
      </div>
      </div>
    </div>
  );
};

export default AddEditForkliftModal;
