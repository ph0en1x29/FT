import { Calendar,Clock,Edit2,Save,Trash2,X } from 'lucide-react';
import React from 'react';
import { FORKLIFT_TYPES,PRIORITIES } from '../constants';
import { ServiceInterval,ServiceIntervalFormData } from '../types';
import { getPriorityColor,getTypeIcon } from '../utils';

interface IntervalTableRowProps {
  interval: ServiceInterval;
  isEditing: boolean;
  formData: ServiceIntervalFormData;
  onFormChange: (data: ServiceIntervalFormData) => void;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
}

const IntervalTableRow: React.FC<IntervalTableRowProps> = ({
  interval,
  isEditing,
  formData,
  onFormChange,
  onEdit,
  onSave,
  onCancel,
  onDelete,
}) => {
  if (isEditing) {
    return (
      <tr className="hover:bg-theme-hover transition">
        <td className="px-4 py-3">
          <select
            value={formData.forklift_type}
            onChange={(e) => onFormChange({ ...formData, forklift_type: e.target.value })}
            className="bg-theme-input border border-theme-border rounded px-2 py-1 text-sm text-theme-primary w-24"
          >
            {FORKLIFT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </td>
        <td className="px-4 py-3">
          <input
            type="text"
            value={formData.service_type}
            onChange={(e) => onFormChange({ ...formData, service_type: e.target.value })}
            className="bg-theme-input border border-theme-border rounded px-2 py-1 text-sm text-theme-primary w-32"
          />
        </td>
        <td className="px-4 py-3">
          <input
            type="number"
            value={formData.hourmeter_interval}
            onChange={(e) => onFormChange({ ...formData, hourmeter_interval: parseInt(e.target.value) || 0 })}
            className="bg-theme-input border border-theme-border rounded px-2 py-1 text-sm text-theme-primary w-20"
          />
        </td>
        <td className="px-4 py-3">
          <input
            type="number"
            value={formData.calendar_interval_days || ''}
            onChange={(e) => onFormChange({ ...formData, calendar_interval_days: e.target.value ? parseInt(e.target.value) : null })}
            placeholder="days"
            className="bg-theme-input border border-theme-border rounded px-2 py-1 text-sm text-theme-primary w-20"
          />
        </td>
        <td className="px-4 py-3">
          <select
            value={formData.priority}
            onChange={(e) => onFormChange({ ...formData, priority: e.target.value })}
            className="bg-theme-input border border-theme-border rounded px-2 py-1 text-sm text-theme-primary w-24"
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </td>
        <td className="px-4 py-3">
          <input
            type="number"
            step="0.5"
            value={formData.estimated_duration_hours || ''}
            onChange={(e) => onFormChange({ ...formData, estimated_duration_hours: e.target.value ? parseFloat(e.target.value) : null })}
            placeholder="hrs"
            className="bg-theme-input border border-theme-border rounded px-2 py-1 text-sm text-theme-primary w-16"
          />
        </td>
        <td className="px-4 py-3">
          <div className="flex gap-1">
            <button
              onClick={onSave}
              className="p-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded transition"
              title="Save"
            >
              <Save className="w-4 h-4" />
            </button>
            <button
              onClick={onCancel}
              className="p-1.5 bg-slate-500/20 hover:bg-slate-500/30 text-slate-400 rounded transition"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-theme-hover transition">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {getTypeIcon(interval.forklift_type)}
          <span className="text-sm font-medium text-theme-primary">{interval.forklift_type}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm text-theme-primary">{interval.service_type}</span>
        {interval.name && interval.name !== interval.service_type && (
          <span className="text-xs text-theme-secondary block">{interval.name}</span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 text-sm text-theme-primary">
          <Clock className="w-3.5 h-3.5 text-theme-secondary" />
          {interval.hourmeter_interval} hrs
        </div>
      </td>
      <td className="px-4 py-3">
        {interval.calendar_interval_days ? (
          <div className="flex items-center gap-1 text-sm text-theme-primary">
            <Calendar className="w-3.5 h-3.5 text-theme-secondary" />
            {interval.calendar_interval_days} days
          </div>
        ) : (
          <span className="text-xs text-theme-secondary">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <span className={`text-xs px-2 py-1 rounded-full border ${getPriorityColor(interval.priority)}`}>
          {interval.priority}
        </span>
      </td>
      <td className="px-4 py-3">
        {interval.estimated_duration_hours ? (
          <span className="text-sm text-theme-secondary">{interval.estimated_duration_hours}h</span>
        ) : (
          <span className="text-xs text-theme-secondary">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1">
          <button
            onClick={onEdit}
            className="p-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 rounded transition"
            title="Edit"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
};

export default IntervalTableRow;
