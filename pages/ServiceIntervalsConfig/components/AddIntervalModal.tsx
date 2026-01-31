import React from 'react';
import { X } from 'lucide-react';
import { ServiceIntervalFormData } from '../types';
import { FORKLIFT_TYPES, PRIORITIES } from '../constants';

interface AddIntervalModalProps {
  isOpen: boolean;
  formData: ServiceIntervalFormData;
  onFormChange: (data: ServiceIntervalFormData) => void;
  onClose: () => void;
  onAdd: () => void;
}

const AddIntervalModal: React.FC<AddIntervalModalProps> = ({
  isOpen,
  formData,
  onFormChange,
  onClose,
  onAdd,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-theme-card rounded-xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-theme-border">
          <h2 className="text-lg font-semibold text-theme-primary">Add Service Interval</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-theme-hover rounded transition"
          >
            <X className="w-5 h-5 text-theme-secondary" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-theme-secondary mb-1">Forklift Type</label>
            <select
              value={formData.forklift_type}
              onChange={(e) => onFormChange({ ...formData, forklift_type: e.target.value })}
              className="w-full bg-theme-input border border-theme-border rounded-lg px-3 py-2 text-theme-primary"
            >
              {FORKLIFT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-theme-secondary mb-1">Service Type *</label>
            <input
              type="text"
              value={formData.service_type}
              onChange={(e) => onFormChange({ ...formData, service_type: e.target.value })}
              placeholder="e.g., PM Service, Oil Change"
              className="w-full bg-theme-input border border-theme-border rounded-lg px-3 py-2 text-theme-primary"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-theme-secondary mb-1">Hourmeter Interval *</label>
              <div className="relative">
                <input
                  type="number"
                  value={formData.hourmeter_interval}
                  onChange={(e) => onFormChange({ ...formData, hourmeter_interval: parseInt(e.target.value) || 0 })}
                  className="w-full bg-theme-input border border-theme-border rounded-lg px-3 py-2 text-theme-primary pr-12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-secondary text-sm">hrs</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-theme-secondary mb-1">Calendar Interval</label>
              <div className="relative">
                <input
                  type="number"
                  value={formData.calendar_interval_days || ''}
                  onChange={(e) => onFormChange({ ...formData, calendar_interval_days: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="Optional"
                  className="w-full bg-theme-input border border-theme-border rounded-lg px-3 py-2 text-theme-primary pr-14"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-secondary text-sm">days</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-theme-secondary mb-1">Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => onFormChange({ ...formData, priority: e.target.value })}
                className="w-full bg-theme-input border border-theme-border rounded-lg px-3 py-2 text-theme-primary"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-theme-secondary mb-1">Est. Duration</label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  value={formData.estimated_duration_hours || ''}
                  onChange={(e) => onFormChange({ ...formData, estimated_duration_hours: e.target.value ? parseFloat(e.target.value) : null })}
                  placeholder="Optional"
                  className="w-full bg-theme-input border border-theme-border rounded-lg px-3 py-2 text-theme-primary pr-12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-secondary text-sm">hrs</span>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-theme-secondary mb-1">Display Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => onFormChange({ ...formData, name: e.target.value })}
              placeholder="Optional (defaults to service type)"
              className="w-full bg-theme-input border border-theme-border rounded-lg px-3 py-2 text-theme-primary"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-theme-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-theme-secondary hover:bg-theme-hover rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={onAdd}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition font-medium"
          >
            Add Interval
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddIntervalModal;
