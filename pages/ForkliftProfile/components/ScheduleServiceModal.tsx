import { CalendarClock,Gauge,X } from 'lucide-react';
import React,{ useState } from 'react';
import { Combobox,ComboboxOption } from '../../../components/Combobox';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';
import { Forklift,User } from '../../../types';

interface ScheduleServiceModalProps {
  forklift: Forklift;
  technicians: User[];
  currentUser: User;
  onClose: () => void;
  onSuccess: () => void;
}

const serviceTypeOptions: ComboboxOption[] = [
  { id: 'PM Service', label: 'PM Service (250 hrs)' },
  { id: 'PM Service 500', label: 'PM Service (500 hrs)' },
  { id: 'Full Inspection', label: 'Full Inspection (1000 hrs)' },
  { id: 'Oil Change', label: 'Oil Change' },
  { id: 'Safety Inspection', label: 'Annual Safety Inspection' },
  { id: 'Routine Check', label: 'Routine Check' },
  { id: 'Other', label: 'Other' },
];

export const ScheduleServiceModal: React.FC<ScheduleServiceModalProps> = ({
  forklift,
  technicians,
  currentUser,
  onClose,
  onSuccess,
}) => {
  const [serviceType, setServiceType] = useState('PM Service');
  const [dueDate, setDueDate] = useState('');
  const [dueHourmeter, setDueHourmeter] = useState('');
  const [notes, setNotes] = useState('');
  const [assignedTechId, setAssignedTechId] = useState('');

  const inputClassName = "w-full px-3 py-2.5 bg-[#f5f5f5] text-[#111827] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/25 placeholder-slate-400";

  const techOptions: ComboboxOption[] = technicians.map(t => ({
    id: t.user_id,
    label: t.name,
    subLabel: t.email
  }));

  const handleSubmit = async () => {
    if (!dueDate) {
      alert('Please enter a due date');
      return;
    }

    try {
      const tech = technicians.find(t => t.user_id === assignedTechId);
      await MockDb.createScheduledService({
        forklift_id: forklift.forklift_id,
        service_type: serviceType,
        due_date: dueDate,
        due_hourmeter: dueHourmeter ? parseInt(dueHourmeter) : undefined,
        notes: notes || undefined,
        assigned_technician_id: assignedTechId || undefined,
        assigned_technician_name: tech?.name,
        auto_create_job: true,
      }, currentUser.user_id, currentUser.name);
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
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-purple-600 flex items-center justify-center">
              <CalendarClock className="w-3.5 h-3.5 text-white" />
            </div>
            <h3 className="font-bold text-lg text-slate-800">Schedule Service</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 md:p-6 space-y-4">
          {/* Forklift info bar */}
          <div className="p-3 bg-purple-50 rounded-lg border border-purple-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-800">{forklift.make} {forklift.model}</p>
              <p className="text-xs text-purple-600">{forklift.serial_number}</p>
            </div>
            <div className="flex items-center gap-1.5 text-purple-600">
              <Gauge className="w-3.5 h-3.5" />
              <span className="text-sm font-medium">{forklift.hourmeter.toLocaleString()} hrs</span>
            </div>
          </div>

          {/* Row 1: Service Type + Due Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Combobox
              label="Service Type *"
              options={serviceTypeOptions}
              value={serviceType}
              onChange={setServiceType}
              placeholder="Select service type..."
            />
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Due Date *</label>
              <input
                type="date"
                className={inputClassName}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          {/* Row 2: Hourmeter + Technician */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Due at Hourmeter (Optional)</label>
              <input
                type="number"
                className={inputClassName}
                value={dueHourmeter}
                onChange={(e) => setDueHourmeter(e.target.value)}
                placeholder={`e.g., ${forklift.hourmeter + 250}`}
              />
            </div>
            <Combobox
              label="Assign Technician (Optional)"
              options={techOptions}
              value={assignedTechId}
              onChange={setAssignedTechId}
              placeholder="Search technician..."
            />
          </div>

          {/* Notes — full width */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes</label>
            <textarea
              className={`${inputClassName} h-20 resize-none`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special instructions..."
            />
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-100 flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium">Cancel</button>
            <button type="button" onClick={handleSubmit} className="px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium shadow-sm flex items-center justify-center gap-2">
              <CalendarClock className="w-4 h-4" /> Schedule
            </button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};
