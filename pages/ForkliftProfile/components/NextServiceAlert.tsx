import { Bell } from 'lucide-react';
import React from 'react';
import { isCalendarServiced } from '../../../services/servicePredictionService';
import { Forklift } from '../../../types';

interface NextServiceAlertProps {
  forklift: Forklift;
}

export const NextServiceAlert: React.FC<NextServiceAlertProps> = ({ forklift }) => {
  const calendar = isCalendarServiced(forklift.type, forklift.fuel_type);

  if (calendar) {
    if (!forklift.next_service_due) return null;
    return (
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
        <div className="flex items-center gap-2 text-amber-800">
          <Bell className="w-5 h-5" />
          <span className="font-medium">Next Service Due:</span>
          <span>{new Date(forklift.next_service_due).toLocaleDateString()}</span>
          {forklift.next_service_type && (
            <span className="text-xs bg-amber-200 px-2 py-0.5 rounded ml-2">{forklift.next_service_type}</span>
          )}
        </div>
      </div>
    );
  }

  // Hourmeter-tracked: show "X hrs remaining" rather than a date.
  const next = forklift.next_service_hourmeter ?? forklift.next_target_service_hour;
  if (next == null) return null;
  const remaining = next - (forklift.hourmeter ?? 0);
  const overdue = remaining <= 0;
  return (
    <div className={`p-4 ${overdue ? 'bg-red-50 border-red-200 text-red-800' : 'bg-amber-50 border-amber-200 text-amber-800'} border rounded-xl`}>
      <div className="flex items-center gap-2">
        <Bell className="w-5 h-5" />
        <span className="font-medium">Next Service:</span>
        <span>at {next.toLocaleString()} hrs ({overdue ? `${Math.abs(remaining)} hrs overdue` : `${remaining} hrs remaining`})</span>
        {forklift.next_service_type && (
          <span className="text-xs bg-amber-200 px-2 py-0.5 rounded ml-2">{forklift.next_service_type}</span>
        )}
      </div>
    </div>
  );
};
