import { Building2,Calendar,DollarSign,Edit2 } from 'lucide-react';
import React from 'react';
import { ForkliftRental } from '../../../types';

interface CurrentAssignmentCardProps {
  rental: ForkliftRental;
  canEditRentalRates: boolean;
  onEditRate: (rental: ForkliftRental) => void;
  onEndRental: (rentalId: string) => void;
}

export const CurrentAssignmentCard: React.FC<CurrentAssignmentCardProps> = ({
  rental,
  canEditRentalRates,
  onEditRate,
  onEndRental,
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-green-200">
      <div className="flex justify-between items-start flex-wrap gap-4">
        <div className="flex-1">
          <h3 className="font-bold text-green-800 flex items-center gap-2 mb-2">
            <Building2 className="w-5 h-5" /> Currently Rented To
          </h3>
          <p className="text-lg font-semibold text-slate-800">{rental.customer?.name}</p>
          <p className="text-sm text-slate-600">{rental.customer?.address}</p>
          <div className="flex flex-wrap gap-4 mt-3 text-sm text-slate-600">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              Since: {new Date(rental.start_date).toLocaleDateString()}
            </span>
            {rental.end_date && (
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Until: {new Date(rental.end_date).toLocaleDateString()}
              </span>
            )}
          </div>
          {rental.notes && (
            <p className="mt-2 text-sm text-slate-500 italic">{rental.notes}</p>
          )}
        </div>
        
        {/* Rental Rate */}
        <div className="bg-green-50 rounded-lg p-4 min-w-[180px]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500 uppercase font-medium">Monthly Rate</span>
            {canEditRentalRates && (
              <button 
                onClick={() => onEditRate(rental)}
                className="p-1 text-blue-600 hover:bg-blue-50 rounded"
              >
                <Edit2 className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            <DollarSign className="w-5 h-5 text-green-600" />
            <span className="text-2xl font-bold text-green-600">
              {rental.monthly_rental_rate?.toLocaleString() || '0'}
            </span>
          </div>
          <span className="text-xs text-slate-400">{rental.currency || 'RM'}/month</span>
        </div>

        <button
          onClick={() => onEndRental(rental.rental_id)}
          className="bg-red-100 text-red-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-200 self-start"
        >
          End Rental
        </button>
      </div>
    </div>
  );
};
