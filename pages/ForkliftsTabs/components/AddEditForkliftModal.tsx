import { Save,X } from 'lucide-react';
import React from 'react';
import { ForkliftStatus,ForkliftType } from '../../../types';

interface FormData {
  serial_number: string;
  make: string;
  model: string;
  type: ForkliftType;
  hourmeter: number;
  last_service_hourmeter: number;
  year: number;
  capacity_kg: number;
  location: string;
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

const inputClassName = "w-full px-3 py-2.5 bg-[#f5f5f5] text-[#111827] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/25 placeholder-slate-400 transition-all duration-200";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50 sticky top-0">
          <h3 className="font-bold text-lg text-slate-800">{isEditing ? 'Edit Forklift' : 'Add New Forklift'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Serial Number *</label>
            <input 
              type="text" 
              className={inputClassName} 
              value={formData.serial_number} 
              onChange={e => setFormData({...formData, serial_number: e.target.value})} 
              placeholder="e.g., FL-001234" 
              required 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Make *</label>
              <input 
                type="text" 
                className={inputClassName} 
                value={formData.make} 
                onChange={e => setFormData({...formData, make: e.target.value})} 
                placeholder="e.g., Toyota" 
                required 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Model *</label>
              <input 
                type="text" 
                className={inputClassName} 
                value={formData.model} 
                onChange={e => setFormData({...formData, model: e.target.value})} 
                placeholder="e.g., 8FGU25" 
                required 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Type *</label>
              <select 
                className={inputClassName} 
                value={formData.type} 
                onChange={e => setFormData({...formData, type: e.target.value as ForkliftType})}
              >
                {Object.values(ForkliftType).map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
              <select 
                className={inputClassName} 
                value={formData.status} 
                onChange={e => setFormData({...formData, status: e.target.value as ForkliftStatus})}
              >
                {Object.values(ForkliftStatus).map(status => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Current Hourmeter (hrs)</label>
              <input 
                type="number" 
                className={inputClassName} 
                value={formData.hourmeter} 
                onChange={e => setFormData({...formData, hourmeter: parseInt(e.target.value) || 0})} 
                min="0" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Last Service Hourmeter (hrs)</label>
              <input 
                type="number" 
                className={inputClassName} 
                value={formData.last_service_hourmeter} 
                onChange={e => setFormData({...formData, last_service_hourmeter: parseInt(e.target.value) || 0})} 
                min="0" 
                placeholder="Set to current if unknown"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Year</label>
              <input 
                type="number" 
                className={inputClassName} 
                value={formData.year} 
                onChange={e => setFormData({...formData, year: parseInt(e.target.value) || new Date().getFullYear()})} 
                min="1980" 
                max={new Date().getFullYear() + 1} 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Capacity (kg)</label>
              <input 
                type="number" 
                className={inputClassName} 
                value={formData.capacity_kg} 
                onChange={e => setFormData({...formData, capacity_kg: parseInt(e.target.value) || 0})} 
                min="0" 
                placeholder="e.g., 2500" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Location</label>
              <input 
                type="text" 
                className={inputClassName} 
                value={formData.location} 
                onChange={e => setFormData({...formData, location: e.target.value})} 
                placeholder="e.g., Warehouse A" 
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes</label>
            <textarea 
              className={`${inputClassName} h-20 resize-none`} 
              value={formData.notes} 
              onChange={e => setFormData({...formData, notes: e.target.value})} 
              placeholder="Additional notes..." 
            />
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" /> {isEditing ? 'Update' : 'Add Forklift'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddEditForkliftModal;
