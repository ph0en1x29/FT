import React from 'react';
import { Wrench } from 'lucide-react';
import { ServiceInterval, ServiceIntervalFormData } from '../types';
import IntervalTableRow from './IntervalTableRow';

interface IntervalsTableProps {
  intervals: ServiceInterval[];
  loading: boolean;
  editingId: string | null;
  formData: ServiceIntervalFormData;
  onFormChange: (data: ServiceIntervalFormData) => void;
  onEdit: (interval: ServiceInterval) => void;
  onSaveEdit: (intervalId: string) => void;
  onCancelEdit: () => void;
  onDelete: (intervalId: string, serviceName: string) => void;
  onAddClick: () => void;
}

const IntervalsTable: React.FC<IntervalsTableProps> = ({
  intervals,
  loading,
  editingId,
  formData,
  onFormChange,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onAddClick,
}) => {
  if (loading) {
    return (
      <div className="bg-theme-card rounded-xl p-8 text-center">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto" />
        <p className="text-theme-secondary mt-3">Loading intervals...</p>
      </div>
    );
  }

  if (intervals.length === 0) {
    return (
      <div className="bg-theme-card rounded-xl p-8 text-center">
        <Wrench className="w-12 h-12 text-slate-500 mx-auto mb-3" />
        <p className="text-theme-secondary">No service intervals configured.</p>
        <button
          onClick={onAddClick}
          className="mt-3 text-indigo-400 hover:text-indigo-300 text-sm font-medium"
        >
          + Add your first interval
        </button>
      </div>
    );
  }

  const activeIntervals = intervals.filter(i => i.is_active);

  return (
    <div className="bg-theme-card rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-theme-hover">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-theme-secondary uppercase">Type</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-theme-secondary uppercase">Service</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-theme-secondary uppercase">Hourmeter</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-theme-secondary uppercase">Calendar</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-theme-secondary uppercase">Priority</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-theme-secondary uppercase">Duration</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-theme-secondary uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-theme-border">
            {activeIntervals.map((interval) => (
              <IntervalTableRow
                key={interval.interval_id}
                interval={interval}
                isEditing={editingId === interval.interval_id}
                formData={formData}
                onFormChange={onFormChange}
                onEdit={() => onEdit(interval)}
                onSave={() => onSaveEdit(interval.interval_id)}
                onCancel={onCancelEdit}
                onDelete={() => onDelete(interval.interval_id, interval.service_type)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default IntervalsTable;
