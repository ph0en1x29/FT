import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import React, { useState } from 'react';
import { ForkliftType } from '../../../types';

interface ExternalForkliftSectionProps {
  customerId: string;
  customerForklifts: any[];
  onCreateExternal: (data: {
    serial_number: string;
    make: string;
    model: string;
    type: string;
    hourmeter: number;
  }) => Promise<any>;
  inputClassName: string;
}

const ExternalForkliftSection: React.FC<ExternalForkliftSectionProps> = ({
  customerId,
  customerForklifts: _customerForklifts,
  onCreateExternal,
  inputClassName,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [externalData, setExternalData] = useState({
    serial_number: '',
    make: '',
    model: '',
    type: ForkliftType.DIESEL,
    hourmeter: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAdd = async () => {
    if (!externalData.serial_number) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreateExternal(externalData);
      // Reset form
      setExternalData({
        serial_number: '',
        make: '',
        model: '',
        type: ForkliftType.DIESEL,
        hourmeter: 0,
      });
      setIsExpanded(false);
    } catch (error) {
      // Error already handled in parent
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!customerId) return null;

  return (
    <div className="lg:col-span-2 border border-slate-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center justify-between text-sm font-medium text-slate-700"
      >
        <span className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Can't find the forklift? Add external forklift
        </span>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
      </button>

      {isExpanded && (
        <div className="p-4 bg-white border-t border-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Serial Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className={inputClassName}
                value={externalData.serial_number}
                onChange={(e) => setExternalData({ ...externalData, serial_number: e.target.value })}
                placeholder="e.g., FD30-123456"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Make</label>
              <input
                type="text"
                className={inputClassName}
                value={externalData.make}
                onChange={(e) => setExternalData({ ...externalData, make: e.target.value })}
                placeholder="e.g., Toyota"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Model</label>
              <input
                type="text"
                className={inputClassName}
                value={externalData.model}
                onChange={(e) => setExternalData({ ...externalData, model: e.target.value })}
                placeholder="e.g., 8FD30"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Type</label>
              <select
                className={inputClassName}
                value={externalData.type}
                onChange={(e) => setExternalData({ ...externalData, type: e.target.value as ForkliftType })}
              >
                {Object.values(ForkliftType).map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Hourmeter</label>
              <input
                type="number"
                className={inputClassName}
                value={externalData.hourmeter}
                onChange={(e) => setExternalData({ ...externalData, hourmeter: parseInt(e.target.value) || 0 })}
                placeholder="0"
                min="0"
              />
            </div>
          </div>

          <div className="mt-4 flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting || !externalData.serial_number}
            >
              <Plus className="w-4 h-4" />
              {isSubmitting ? 'Adding...' : 'Add & Select'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExternalForkliftSection;
