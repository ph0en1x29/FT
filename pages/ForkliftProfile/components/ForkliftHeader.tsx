import { ArrowLeft,Building2,CalendarClock } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';

interface ForkliftHeaderProps {
  hasActiveRental: boolean;
  canScheduleMaintenance: boolean;
  canManageRentals: boolean;
  onScheduleService: () => void;
  onRentToCustomer: () => void;
}

export const ForkliftHeader: React.FC<ForkliftHeaderProps> = ({
  hasActiveRental,
  canScheduleMaintenance,
  canManageRentals,
  onScheduleService,
  onRentToCustomer,
}) => {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <h1 className="text-2xl font-bold text-slate-900">Forklift Profile</h1>
      </div>
      <div className="flex gap-2">
        {canScheduleMaintenance && (
          <button 
            onClick={onScheduleService}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow hover:bg-purple-700 flex items-center gap-2"
          >
            <CalendarClock className="w-4 h-4" /> Schedule Service
          </button>
        )}
        {!hasActiveRental && canManageRentals && (
          <button 
            onClick={onRentToCustomer}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow hover:bg-blue-700 flex items-center gap-2"
          >
            <Building2 className="w-4 h-4" /> Rent to Customer
          </button>
        )}
      </div>
    </div>
  );
};
