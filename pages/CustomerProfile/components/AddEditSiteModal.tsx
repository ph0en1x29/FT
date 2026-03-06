import { Building2, Save, X } from 'lucide-react';
import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { addCustomerSite, updateCustomerSite } from '../../../services/customerService';
import type { CustomerSite } from '../../../types';

interface AddEditSiteModalProps {
  customerId: string;
  site: CustomerSite | null;
  onClose: () => void;
}

const inputClassName = "w-full px-3 py-2.5 bg-[#f5f5f5] text-[#111827] border border-[#d1d5db] rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 placeholder-slate-400 transition-all duration-200";

const AddEditSiteModal: React.FC<AddEditSiteModalProps> = ({
  customerId,
  site,
  onClose
}) => {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    site_name: site?.site_name || '',
    address: site?.address || '',
    notes: site?.notes || '',
    is_active: site?.is_active ?? true,
  });

  const handleSubmit = async () => {
    if (!formData.site_name.trim()) {
      alert('Site name is required');
      return;
    }
    if (!formData.address.trim()) {
      alert('Address is required');
      return;
    }

    setSaving(true);
    try {
      if (site) {
        // Update existing site
        await updateCustomerSite(site.site_id, formData);
      } else {
        // Add new site
        await addCustomerSite({
          customer_id: customerId,
          ...formData,
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['customer-sites', customerId] });
      onClose();
    } catch (error) {
      alert('Failed to save site: ' + (error as Error).message);
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
              <div className="w-7 h-7 rounded-lg bg-green-600 flex items-center justify-center">
                <Building2 className="w-3.5 h-3.5 text-white" />
              </div>
              <h3 className="font-bold text-base text-slate-800">
                {site ? 'Edit Site' : 'Add Site'}
              </h3>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable form body */}
          <div className="overflow-y-auto flex-1 p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                Site Name *
              </label>
              <input
                type="text"
                className={inputClassName}
                placeholder="e.g. Main Warehouse, Factory A"
                value={formData.site_name}
                onChange={(e) => setFormData({ ...formData, site_name: e.target.value })}
                autoComplete="off"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                Address *
              </label>
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
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                Notes
              </label>
              <textarea
                className={`${inputClassName} h-20 resize-none`}
                placeholder="Additional information about this site..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-green-600 border-slate-300 rounded focus:ring-green-500"
                />
                <span className="text-sm text-slate-700">Active Site</span>
              </label>
              <p className="text-xs text-slate-500 mt-1 ml-6">
                Inactive sites are still visible but marked as not in use
              </p>
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
              className="px-5 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 font-medium shadow-sm flex items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : site ? 'Save Changes' : 'Add Site'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddEditSiteModal;
