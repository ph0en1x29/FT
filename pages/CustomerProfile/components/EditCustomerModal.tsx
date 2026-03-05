import { X } from 'lucide-react';
import React, { useState } from 'react';
import { Customer } from '../../../types';

interface EditCustomerModalProps {
  customer: Customer;
  onClose: () => void;
  onSave: (data: Partial<Customer>) => Promise<void>;
  saving: boolean;
}

const inputClassName = "w-full px-3 py-2.5 bg-[#f5f5f5] text-[#111827] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/25 placeholder-slate-400 transition-all duration-200";

const EditCustomerModal: React.FC<EditCustomerModalProps> = ({
  customer,
  onClose,
  onSave,
  saving
}) => {
  const [formData, setFormData] = useState({
    name: customer.name || '',
    address: customer.address || '',
    phone: customer.phone || '',
    email: customer.email || '',
    notes: customer.notes || '',
    contact_person: customer.contact_person || '',
    account_number: customer.account_number || ''
  });

  const handleSubmit = async () => {
    await onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-bold text-lg text-slate-900">Edit Customer</h4>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 rounded"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Name *</label>
            <input
              type="text"
              className={inputClassName}
              placeholder="Customer name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              autoComplete="off"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Address *</label>
            <input
              type="text"
              className={inputClassName}
              placeholder="Full address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              autoComplete="off"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Phone</label>
            <input
              type="tel"
              className={inputClassName}
              placeholder="Phone number"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              autoComplete="off"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Email</label>
            <input
              type="email"
              className={inputClassName}
              placeholder="Email address"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              autoComplete="off"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Contact Person</label>
            <input
              type="text"
              className={inputClassName}
              placeholder="Contact person name"
              value={formData.contact_person}
              onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
              autoComplete="off"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Account Number</label>
            <input
              type="text"
              className={inputClassName}
              placeholder="Account number"
              value={formData.account_number}
              onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
              autoComplete="off"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Notes</label>
            <textarea
              className={`${inputClassName} resize-none`}
              placeholder="Any additional notes..."
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>
        </div>
        
        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditCustomerModal;
