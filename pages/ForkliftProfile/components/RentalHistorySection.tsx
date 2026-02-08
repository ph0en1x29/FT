import { Building2,Calendar,History } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ForkliftRental } from '../../../types';

interface RentalHistorySectionProps {
  rentals: ForkliftRental[];
}

export const RentalHistorySection: React.FC<RentalHistorySectionProps> = ({ rentals }) => {
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <History className="w-5 h-5 text-indigo-600" /> Rental History ({rentals.length})
        </h3>
      </div>
      
      <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
        {rentals.length > 0 ? (
          rentals.map(rental => (
            <div 
              key={rental.rental_id} 
              onClick={() => rental.customer && navigate(`/customers/${rental.customer_id}`)}
              className={`p-3 rounded-lg border cursor-pointer transition hover:shadow-sm ${
                rental.status === 'active' 
                  ? 'bg-green-50 border-green-200 hover:border-green-300' 
                  : 'bg-slate-50 border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Building2 className={`w-4 h-4 flex-shrink-0 ${rental.status === 'active' ? 'text-green-600' : 'text-slate-400'}`} />
                    <span className="font-medium text-slate-800 text-sm truncate">{rental.customer?.name}</span>
                    {rental.status === 'active' && (
                      <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 flex-shrink-0">Active</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(rental.start_date).toLocaleDateString()} → {rental.end_date ? new Date(rental.end_date).toLocaleDateString() : 'Ongoing'}
                  </div>
                </div>
                {rental.monthly_rental_rate && (
                  <span className="text-xs font-medium text-green-600 whitespace-nowrap">
                    RM{rental.monthly_rental_rate.toLocaleString()}/mo
                  </span>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-10 text-slate-400">
            <History className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm">No rental history</p>
          </div>
        )}
      </div>
    </div>
  );
};
