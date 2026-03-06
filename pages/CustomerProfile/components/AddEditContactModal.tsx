import { Save, User, X } from 'lucide-react';
import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { addCustomerContact, updateCustomerContact } from '../../../services/customerService';
import type { CustomerContact } from '../../../types';

interface AddEditContactModalProps {
  customerId: string;
  contact: CustomerContact | null;
  onClose: () => void;
}

const inputClassName = "w-full px-3 py-2.5 bg-[#f5f5f5] text-[#111827] border border-[#d1d5db] rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 placeholder-slate-400 transition-all duration-200";

const AddEditContactModal: React.FC<AddEditContactModalProps> = ({
  customerId,
  contact,
  onClose
}) => {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: contact?.name || '',
    phone: contact?.phone || '',
    email: contact?.email || '',
    role: contact?.role || '',
    is_primary: contact?.is_primary || false,
  });

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      alert('Name is required');
      return;
    }

    setSaving(true);
    try {
      if (contact) {
        // Update existing contact
        await updateCustomerContact(contact.contact_id, formData);
      } else {
        // Add new contact
        await addCustomerContact({
          customer_id: customerId,
          ...formData,
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['customer-contacts', customerId] });
      onClose();
    } catch (error) {
      alert('Failed to save contact: ' + (error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="bg-[var(--surface)] rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="px-5 py-3 border-b flex justify-between items-center bg-slate-50 rounded-t-2xl shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-white" />
              </div>
              <h3 className="font-bold text-base text-slate-800">
                {contact ? 'Edit Contact' : 'Add Contact'}
              </h3>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable form body */}
          <div className="overflow-y-auto flex-1 p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  className={inputClassName}
                  placeholder="Contact name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  autoComplete="off"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Phone
                </label>
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
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Email
                </label>
                <input
                  type="email"
                  className={inputClassName}
                  placeholder="Email address"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  autoComplete="off"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  Role / Title
                </label>
                <input
                  type="text"
                  className={inputClassName}
                  placeholder="e.g. Manager, Engineer"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  autoComplete="off"
                />
              </div>

              <div className="md:col-span-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_primary}
                    onChange={(e) => setFormData({ ...formData, is_primary: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700">Primary Contact</span>
                </label>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 flex gap-3 justify-end border-t border-slate-200 bg-slate-50/80 rounded-b-2xl shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 font-medium text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="px-5 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium shadow-sm flex items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : contact ? 'Save Changes' : 'Add Contact'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddEditContactModal;
