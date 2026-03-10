import { Gauge } from 'lucide-react';
import React from 'react';
import { Combobox,ComboboxOption } from '../../../components/Combobox';
import { ForkliftSelectionSectionProps } from '../types';

const ForkliftSelectionSection: React.FC<ForkliftSelectionSectionProps> = ({
  formData,
  setFormData,
  forklifts,
  selectedForklift,
  inputClassName
}) => {
  const forkliftOptions: ComboboxOption[] = forklifts
    .filter(f => f.status !== 'Out of Service' && f.status !== 'Inactive')
    .map(f => ({
      id: f.forklift_id,
      label: `${f.forklift_no ? `${f.forklift_no} · ` : ''}${f.serial_number} — ${f.make} ${f.model}`,
      subLabel: `${f.type} · ${f.hourmeter.toLocaleString()} hrs`
    }));

  return (
    <>
      <Combobox 
        label="Select Forklift"
        options={forkliftOptions}
        value={formData.forklift_id}
        onChange={(val) => setFormData(prev => ({...prev, forklift_id: val}))}
        placeholder="Search by S/N, make, model..."
      />

      {selectedForklift && (
        <div className="lg:col-span-2 flex flex-col sm:flex-row gap-4">
          <div className="flex-1 bg-amber-50 rounded-lg p-3 border border-amber-200 text-sm grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div><span className="text-amber-500 text-xs">S/N</span> <span className="font-mono font-medium block text-slate-800">{selectedForklift.serial_number}</span></div>
            <div><span className="text-amber-500 text-xs">Type</span> <span className="font-medium block text-slate-800">{selectedForklift.type}</span></div>
            <div><span className="text-amber-500 text-xs">Make/Model</span> <span className="font-medium block text-slate-800">{selectedForklift.make} {selectedForklift.model}</span></div>
            <div><span className="text-amber-500 text-xs">Hourmeter</span> <span className="font-medium block text-slate-800">{selectedForklift.hourmeter.toLocaleString()} hrs</span></div>
          </div>
          <div className="sm:w-48 shrink-0">
            <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5" /> Current Reading
            </label>
            <input 
              type="number"
              className={inputClassName}
              value={formData.hourmeter_reading}
              onChange={e => setFormData(prev => ({...prev, hourmeter_reading: e.target.value}))}
              placeholder="Hourmeter"
              min={selectedForklift?.hourmeter || 0}
            />
            {formData.hourmeter_reading && parseInt(formData.hourmeter_reading) < selectedForklift.hourmeter && (
              <p className="text-xs text-red-500 mt-1">⚠️ Below recorded ({selectedForklift.hourmeter})</p>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default ForkliftSelectionSection;
