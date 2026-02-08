import { Bell } from 'lucide-react';
import React from 'react';
import { Forklift } from '../../../types';

interface NextServiceAlertProps {
  forklift: Forklift;
}

export const NextServiceAlert: React.FC<NextServiceAlertProps> = ({ forklift }) => {
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
};
