import { Building2,Save,User,X } from 'lucide-react';
import React, { useState } from 'react';
import { Customer } from '../../../types';

interface EditCustomerModalProps {
  customer: Customer;
  onClose: () => void;
  onSave: (data: Partial<Customer>) => Promise<void>;
  saving: boolean;
}

const inputClassName = "w-full px-3 py-2.5 bg-[#f5f5f5] text-[#111827] border border-[#d1d5db] rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 placeholder-slate-400 transition-all duration-200";

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
    account_number: customer.account_number || '',
    registration_no: customer.registration_no || '',
    tax_entity_id: customer.tax_entity_id || '',
    credit_term: customer.credit_term || '',
    agent: customer.agent || '',
    phone_secondary: customer.phone_secondary || ''
  });

  const handleSubmit = async () => {
    await onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] rounded-2xl shadow-2xl w-full max-w-md md:max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3 border-b flex justify-between items-center bg-slate-50 rounded-t-2xl shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <Building2 className="w-3.5 h-3.5 text-white" />
            </div>
            <h3 className="font-bold text-base text-slate-800">Edit Customer</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable form body */}
        <div className="overflow-y-auto flex-1">
          {/* Company Info */}
          <div className="border-b border-slate-100">
            <div className="px-4 md:px-5 py-2 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
              <Building2 className="w-3 h-3 text-blue-600" />
              <span className="text-xs font-semibold text-blue-800 uppercase tracking-wide">Company</span>
            </div>
            <div className="p-4 md:p-5 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Name *</label>
                  <input type="text" className={inputClassName} placeholder="Customer name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} autoComplete="off" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Account Number</label>
                  <input type="text" className={inputClassName} placeholder="Account number" value={formData.account_number} onChange={(e) => setFormData({ ...formData, account_number: e.target.value })} autoComplete="off" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Reg. No.</label>
                  <input type="text" className={inputClassName} placeholder="SSM registration number" value={formData.registration_no} onChange={(e) => setFormData({ ...formData, registration_no: e.target.value })} autoComplete="off" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tax ID</label>
                  <input type="text" className={inputClassName} placeholder="Tax entity ID" value={formData.tax_entity_id} onChange={(e) => setFormData({ ...formData, tax_entity_id: e.target.value })} autoComplete="off" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Credit Term</label>
                  <input type="text" className={inputClassName} placeholder="e.g. 30 DAYS, C.O.D." value={formData.credit_term} onChange={(e) => setFormData({ ...formData, credit_term: e.target.value })} autoComplete="off" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Agent</label>
                  <input type="text" className={inputClassName} placeholder="Sales agent code" value={formData.agent} onChange={(e) => setFormData({ ...formData, agent: e.target.value })} autoComplete="off" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Address *</label>
                <input type="text" className={inputClassName} placeholder="Full address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} autoComplete="off" />
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="border-b border-slate-100">
            <div className="px-4 md:px-5 py-2 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
              <User className="w-3 h-3 text-amber-600" />
              <span className="text-xs font-semibold text-amber-800 uppercase tracking-wide">Contact</span>
            </div>
            <div className="p-4 md:p-5 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contact Person</label>
                <input type="text" className={inputClassName} placeholder="Contact person" value={formData.contact_person} onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })} autoComplete="off" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone</label>
                  <input type="tel" className={inputClassName} placeholder="Phone number" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} autoComplete="off" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Phone 2</label>
                  <input type="tel" className={inputClassName} placeholder="Secondary phone" value={formData.phone_secondary} onChange={(e) => setFormData({ ...formData, phone_secondary: e.target.value })} autoComplete="off" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email</label>
                <input type="email" className={inputClassName} placeholder="Email address" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} autoComplete="off" />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <div className="p-4 md:p-5">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes</label>
              <textarea className={`${inputClassName} h-16 resize-none`} placeholder="Additional notes..." value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
            </div>
          </div>
        </div>

        {/* Footer — sticky */}
        <div className="px-4 md:px-5 py-3 flex gap-3 justify-end border-t border-slate-200 bg-slate-50/80 rounded-b-2xl shrink-0">
          <button type="button" onClick={onClose} className="px-5 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 font-medium text-sm">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={saving} className="px-5 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium shadow-sm flex items-center justify-center gap-2 text-sm disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
};

export default EditCustomerModal;
