import { Gauge,Truck } from 'lucide-react';
import React from 'react';
import { Combobox,ComboboxOption } from '../../../components/Combobox';
import { ForkliftSelectionSectionProps } from '../types';

/**
 * Equipment selection section for job creation.
 * Includes forklift search dropdown, selected forklift info card, and hourmeter input.
 */
const ForkliftSelectionSection: React.FC<ForkliftSelectionSectionProps> = ({
  formData,
  setFormData,
  forklifts,
  selectedForklift,
  inputClassName
}) => {
  // Forklift options with detailed info for easy search
  // Include all forklifts except those that are out of service
  const forkliftOptions: ComboboxOption[] = forklifts
    .filter(f => f.status !== 'Out of Service' && f.status !== 'Inactive')
    .map(f => ({
      id: f.forklift_id,
      label: `${f.serial_number} - ${f.make} ${f.model}`,
      subLabel: `${f.type} | ${f.hourmeter.toLocaleString()} hrs${f.location ? ` | ${f.location}` : ''}`
    }));

  return (
    <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 space-y-4">
      {/* Section Header */}
      <div className="flex items-center gap-2 text-amber-800">
        <Truck className="w-5 h-5" />
        <span className="font-semibold">Equipment Selection</span>
      </div>
      
      {/* Forklift Search */}
      <Combobox 
        label="Select Forklift"
        options={forkliftOptions}
        value={formData.forklift_id}
        onChange={(val) => setFormData(prev => ({...prev, forklift_id: val}))}
        placeholder="Search by S/N, make, model..."
      />

      {/* Selected Forklift Info Card */}
      {selectedForklift && (
        <div className="bg-[var(--surface)] rounded-lg p-3 border border-amber-200">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-slate-500">Serial Number:</span>
              <div className="font-mono font-medium">{selectedForklift.serial_number}</div>
            </div>
            <div>
              <span className="text-slate-500">Type:</span>
              <div className="font-medium">{selectedForklift.type}</div>
            </div>
            <div>
              <span className="text-slate-500">Make/Model:</span>
              <div className="font-medium">{selectedForklift.make} {selectedForklift.model}</div>
            </div>
            <div>
              <span className="text-slate-500">Current Hourmeter:</span>
              <div className="font-medium">{selectedForklift.hourmeter.toLocaleString()} hrs</div>
            </div>
          </div>
        </div>
      )}

      {/* Hourmeter Reading Input */}
      {formData.forklift_id && (
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
            <Gauge className="w-4 h-4" /> Current Hourmeter Reading
          </label>
          <input 
            type="number"
            className={inputClassName}
            value={formData.hourmeter_reading}
            onChange={e => setFormData(prev => ({...prev, hourmeter_reading: e.target.value}))}
            placeholder="Enter current hourmeter reading"
            min={selectedForklift?.hourmeter || 0}
          />
          {selectedForklift && formData.hourmeter_reading && parseInt(formData.hourmeter_reading) < selectedForklift.hourmeter && (
            <p className="text-xs text-red-500 mt-1">
              ⚠️ Reading is less than current recorded ({selectedForklift.hourmeter} hrs)
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ForkliftSelectionSection;
