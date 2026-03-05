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
      label: `${f.serial_number} — ${f.make} ${f.model}`,
      subLabel: `${f.type} · ${f.hourmeter.toLocaleString()} hrs`
    }));

  return (
    <div className="space-y-3">
      <Combobox 
        label="Select Forklift"
        options={forkliftOptions}
        value={formData.forklift_id}
        onChange={(val) => setFormData(prev => ({...prev, forklift_id: val}))}
        placeholder="Search by S/N, make, model..."
      />

      {selectedForklift && (
        <div className="bg-amber-50 rounded-lg p-3 border border-amber-200 text-sm grid grid-cols-2 gap-2">
          <div><span className="text-amber-500 text-xs">S/N</span> <span className="font-mono font-medium block text-slate-800">{selectedForklift.serial_number}</span></div>
          <div><span className="text-amber-500 text-xs">Type</span> <span className="font-medium block text-slate-800">{selectedForklift.type}</span></div>
          <div><span className="text-amber-500 text-xs">Make/Model</span> <span className="font-medium block text-slate-800">{selectedForklift.make} {selectedForklift.model}</span></div>
          <div><span className="text-amber-500 text-xs">Hourmeter</span> <span className="font-medium block text-slate-800">{selectedForklift.hourmeter.toLocaleString()} hrs</span></div>
        </div>
      )}

      {formData.forklift_id && (
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5" /> Current Hourmeter
          </label>
          <input 
            type="number"
            className={inputClassName}
            value={formData.hourmeter_reading}
            onChange={e => setFormData(prev => ({...prev, hourmeter_reading: e.target.value}))}
            placeholder="Enter current reading"
            min={selectedForklift?.hourmeter || 0}
          />
          {selectedForklift && formData.hourmeter_reading && parseInt(formData.hourmeter_reading) < selectedForklift.hourmeter && (
            <p className="text-xs text-red-500 mt-1">⚠️ Less than recorded ({selectedForklift.hourmeter} hrs)</p>
          )}
        </div>
      )}
    </div>
  );
};

export default ForkliftSelectionSection;
