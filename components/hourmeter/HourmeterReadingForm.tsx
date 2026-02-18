/**
 * Hourmeter Reading Form Component
 * Allows technicians to record hourmeter readings for forklifts
 */

import { AlertCircle,Gauge,Save,X } from 'lucide-react';
import React,{ useState } from 'react';
import { recordHourmeterReading } from '../../services/hourmeterService';
import type { Forklift } from '../../types';

interface HourmeterReadingFormProps {
  forklift: Forklift;
  jobId?: string;
  userId?: string;
  userName?: string;
  onSuccess?: (newReading: number) => void;
  onCancel?: () => void;
  compact?: boolean;
}

export function HourmeterReadingForm({
  forklift,
  jobId,
  userId,
  userName,
  onSuccess,
  onCancel,
  compact = false,
}: HourmeterReadingFormProps) {
  const [hourmeterValue, setHourmeterValue] = useState<string>(
    forklift.hourmeter?.toString() || ''
  );
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentHourmeter = forklift.hourmeter || 0;
  const enteredValue = parseFloat(hourmeterValue) || 0;
  const isValid = enteredValue >= currentHourmeter;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValid) {
      setError('Hourmeter reading cannot be less than current value');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    const { data: _data, error: submitError } = await recordHourmeterReading({
      forklift_id: forklift.forklift_id,
      hourmeter_value: enteredValue,
      recorded_by_id: userId,
      recorded_by_name: userName,
      job_id: jobId,
      notes: notes || undefined,
    });
    
    setIsSubmitting(false);
    
    if (submitError) {
      setError(submitError.message);
      return;
    }
    
    onSuccess?.(enteredValue);
  };

  if (compact) {
    return (
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="relative">
          <Gauge className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="number"
            value={hourmeterValue}
            onChange={(e) => setHourmeterValue(e.target.value)}
            placeholder="Hours"
            className={`pl-8 pr-3 py-1.5 w-28 text-sm border rounded-md focus:ring-2 focus:ring-blue-500 ${
              !isValid && hourmeterValue ? 'border-red-500' : 'border-gray-300'
            }`}
            min={currentHourmeter}
            step="0.1"
            required
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting || !isValid}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
        >
          <Save className="h-3.5 w-3.5" />
          Save
        </button>
        {error && (
          <span className="text-xs text-red-600">{error}</span>
        )}
      </form>
    );
  }

  return (
    <div className="bg-[var(--surface)] rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-gray-900 flex items-center gap-2">
          <Gauge className="h-5 w-5 text-blue-600" />
          Record Hourmeter Reading
        </h3>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Forklift Info */}
        <div className="bg-gray-50 rounded-md p-3">
          <p className="text-sm text-gray-600">
            <span className="font-medium">{forklift.serial_number}</span>
            {forklift.make && forklift.model && (
              <span className="text-gray-400 ml-2">
                {forklift.make} {forklift.model}
              </span>
            )}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Current: {currentHourmeter.toLocaleString()} hrs
          </p>
        </div>

        {/* Hourmeter Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            New Hourmeter Reading
          </label>
          <div className="relative">
            <Gauge className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="number"
              value={hourmeterValue}
              onChange={(e) => setHourmeterValue(e.target.value)}
              placeholder="Enter current hours"
              className={`pl-10 pr-4 py-2 w-full border rounded-md focus:ring-2 focus:ring-blue-500 ${
                !isValid && hourmeterValue ? 'border-red-500' : 'border-gray-300'
              }`}
              min={currentHourmeter}
              step="0.1"
              required
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
              hrs
            </span>
          </div>
          {!isValid && hourmeterValue && (
            <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Cannot be less than current reading ({currentHourmeter} hrs)
            </p>
          )}
          {isValid && enteredValue > currentHourmeter && (
            <p className="mt-1 text-xs text-green-600">
              +{(enteredValue - currentHourmeter).toFixed(1)} hrs since last reading
            </p>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any observations or comments..."
            rows={2}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting || !isValid}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Record Reading
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default HourmeterReadingForm;
