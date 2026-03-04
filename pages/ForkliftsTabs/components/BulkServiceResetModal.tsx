import { Save, SkipForward, X } from 'lucide-react';
import React, { useState } from 'react';
import { supabase } from '../../../services/supabaseClient';
import { showToast } from '../../../services/toastService';

interface BulkServiceResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  forklifts: Array<{
    forklift_id: string;
    serial_number: string;
    make: string;
    model: string;
    hourmeter: number;
    service_interval_hours?: number;
  }>;
}

const inputClassName = "w-full px-3 py-2.5 bg-[#f5f5f5] text-[#111827] border border-[#d1d5db] rounded-lg focus:outline-none focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/25 placeholder-slate-400";

const BulkServiceResetModal: React.FC<BulkServiceResetModalProps> = ({
  isOpen,
  onClose,
  forklifts,
}) => {
  const [serviceValues, setServiceValues] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleInputChange = (forkliftId: string, value: string) => {
    setServiceValues(prev => ({ ...prev, [forkliftId]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates = forklifts
        .filter(f => {
          const value = serviceValues[f.forklift_id];
          return value && value.trim() !== '' && !isNaN(parseFloat(value)) && parseFloat(value) > 0;
        })
        .map(f => {
          const newHm = parseFloat(serviceValues[f.forklift_id]);
          const interval = f.service_interval_hours || 500;
          return supabase
            .from('forklifts')
            .update({
              last_service_hourmeter: newHm,
              last_serviced_hourmeter: newHm,
              next_target_service_hour: newHm + interval,
              last_service_date: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('forklift_id', f.forklift_id);
        });

      if (updates.length > 0) {
        await Promise.all(updates);
        showToast.success(`Service reset applied to ${updates.length} forklift(s)`);
      }

      onClose();
    } catch (error) {
      showToast.error('Error updating service records: ' + (error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-[var(--surface)] rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-lg text-slate-800">Service Reset (Optional)</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-slate-600 mb-4">
            Optionally set the Last Service Hourmeter for each forklift to reset their service intervals.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 text-slate-600 font-medium">Serial Number</th>
                  <th className="text-left py-2 px-3 text-slate-600 font-medium">Make/Model</th>
                  <th className="text-right py-2 px-3 text-slate-600 font-medium">Current HRS</th>
                  <th className="text-left py-2 px-3 text-slate-600 font-medium">Last Service HRS</th>
                </tr>
              </thead>
              <tbody>
                {forklifts.map(forklift => (
                  <tr key={forklift.forklift_id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="py-2 px-3 text-slate-700">{forklift.serial_number}</td>
                    <td className="py-2 px-3 text-slate-700">{forklift.make} {forklift.model}</td>
                    <td className="py-2 px-3 text-right text-slate-700 font-mono">{forklift.hourmeter.toLocaleString()}</td>
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        className={inputClassName}
                        value={serviceValues[forklift.forklift_id] || ''}
                        onChange={(e) => handleInputChange(forklift.forklift_id, e.target.value)}
                        placeholder="e.g., 17503"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium flex items-center justify-center gap-2"
              disabled={isSaving}
            >
              <SkipForward className="w-4 h-4" />
              Skip
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
              disabled={isSaving}
            >
              <Save className="w-4 h-4" />
              Save & Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkServiceResetModal;
