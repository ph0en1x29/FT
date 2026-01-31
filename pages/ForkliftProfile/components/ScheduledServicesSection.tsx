import React from 'react';
import { CalendarClock, Calendar, Gauge } from 'lucide-react';
import { ScheduledService } from '../../../types';
import { getScheduledServiceStatusBadge } from '../utils';

interface ScheduledServicesSectionProps {
  services: ScheduledService[];
}

export const ScheduledServicesSection: React.FC<ScheduledServicesSectionProps> = ({ services }) => {
  if (services.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
        <CalendarClock className="w-5 h-5 text-amber-600" /> Upcoming Scheduled Services ({services.length})
      </h3>
      <div className="space-y-3">
        {services.map(service => (
          <div key={service.scheduled_id} className="p-4 bg-amber-50 rounded-lg border border-amber-100">
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800">{service.service_type}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getScheduledServiceStatusBadge(service.status)}`}>
                    {service.status}
                  </span>
                </div>
                <div className="flex gap-4 mt-2 text-sm text-slate-600">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Due: {new Date(service.due_date).toLocaleDateString()}
                  </span>
                  {service.due_hourmeter && (
                    <span className="flex items-center gap-1">
                      <Gauge className="w-3 h-3" />
                      At: {service.due_hourmeter} hrs
                    </span>
                  )}
                </div>
                {service.assigned_technician_name && (
                  <p className="text-xs text-slate-500 mt-1">Assigned to: {service.assigned_technician_name}</p>
                )}
              </div>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                service.priority === 'High' ? 'bg-red-100 text-red-700' :
                service.priority === 'Medium' ? 'bg-amber-100 text-amber-700' :
                'bg-slate-100 text-slate-600'
              }`}>
                {service.priority}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
