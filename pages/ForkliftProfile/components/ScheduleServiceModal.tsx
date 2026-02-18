import { CalendarClock,X } from 'lucide-react';
import React,{ useState } from 'react';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';
import { Forklift,User } from '../../../types';

interface ScheduleServiceModalProps {
  forklift: Forklift;
  technicians: User[];
  currentUser: User;
  onClose: () => void;
  onSuccess: () => void;
}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-[var(--surface)] rounded-xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0">
          <h3 className="font-bold text-lg text-slate-800">Schedule Service</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-3 bg-purple-50 rounded-lg mb-4">
            <p className="text-sm font-medium text-purple-800">{forklift.make} {forklift.model}</p>
            <p className="text-xs text-purple-600">{forklift.serial_number}</p>
            <p className="text-xs text-purple-500 mt-1">Current: {forklift.hourmeter.toLocaleString()} hrs</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Service Type *</label>
            <select
              className="w-full px-3 py-2.5 bg-[#f5f5f5] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-blue-500"
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
            >
              <option value="PM Service">PM Service (250 hrs)</option>
              <option value="PM Service 500">PM Service (500 hrs)</option>
              <option value="Full Inspection">Full Inspection (1000 hrs)</option>
              <option value="Oil Change">Oil Change</option>
              <option value="Safety Inspection">Annual Safety Inspection</option>
              <option value="Routine Check">Routine Check</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Due Date *</label>
            <input
              type="date"
              className="w-full px-3 py-2.5 bg-[#f5f5f5] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-blue-500"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Due at Hourmeter (Optional)</label>
            <input
              type="number"
              className="w-full px-3 py-2.5 bg-[#f5f5f5] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-blue-500"
              value={dueHourmeter}
              onChange={(e) => setDueHourmeter(e.target.value)}
              placeholder={`e.g., ${forklift.hourmeter + 250}`}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Assign Technician (Optional)</label>
            <select
              className="w-full px-3 py-2.5 bg-[#f5f5f5] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-blue-500"
              value={assignedTechId}
              onChange={(e) => setAssignedTechId(e.target.value)}
            >
              <option value="">-- Auto-assign later --</option>
              {technicians.map(t => (
                <option key={t.user_id} value={t.user_id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes</label>
            <textarea
              className="w-full px-3 py-2.5 bg-[#f5f5f5] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-blue-500 h-20 resize-none"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special instructions..."
            />
          </div>

          <div className="pt-4 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium">Cancel</button>
            <button type="button" onClick={handleSubmit} className="flex-1 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium shadow-sm flex items-center justify-center gap-2">
              <CalendarClock className="w-4 h-4" /> Schedule
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
