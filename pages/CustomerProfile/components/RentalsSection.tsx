import React from 'react';
import { Truck, Calendar, ChevronRight, Square, CheckSquare, CircleOff } from 'lucide-react';
import { RentalsSectionProps } from '../types';

const RentalsSection: React.FC<RentalsSectionProps> = ({
  activeRentals,
  pastRentals,
  rentalTab,
  setRentalTab,
  isSelectionMode,
  selectedRentalIds,
  isAdmin,
  onToggleSelectionMode,
  onToggleRentalSelection,
  onSelectAllActiveRentals,
  onDeselectAll,
  onOpenBulkEndModal,
  onEditRental,
  onEndRental,
  onNavigateToForklift,
}) => {
  const displayedRentals = rentalTab === 'active' ? activeRentals : pastRentals;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => { setRentalTab('active'); }}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            rentalTab === 'active' 
              ? 'text-green-600 border-b-2 border-green-600 bg-green-50/50' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Active ({activeRentals.length})
        </button>
        <button
          onClick={() => { setRentalTab('past'); }}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            rentalTab === 'past' 
              ? 'text-slate-600 border-b-2 border-slate-600 bg-slate-50' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Past ({pastRentals.length})
        </button>
      </div>

      {rentalTab === 'active' && activeRentals.length > 1 && (
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <button
            onClick={onToggleSelectionMode}
            className={`text-xs font-medium flex items-center gap-1.5 ${
              isSelectionMode ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {isSelectionMode ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
            {isSelectionMode ? 'Exit Select' : 'Multi-Select'}
          </button>
          {isSelectionMode && selectedRentalIds.size > 0 && (
            <button
              onClick={onOpenBulkEndModal}
              className="text-xs font-medium text-red-600 hover:text-red-700 flex items-center gap-1"
            >
              <CircleOff className="w-3.5 h-3.5" />
              End {selectedRentalIds.size}
            </button>
          )}
        </div>
      )}

      {isSelectionMode && rentalTab === 'active' && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100 flex gap-3 text-xs">
          <button onClick={onSelectAllActiveRentals} className="text-blue-600 hover:underline">Select All</button>
          <button onClick={onDeselectAll} className="text-slate-500 hover:underline">Clear</button>
        </div>
      )}

      <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
        {displayedRentals.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <Truck className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No {rentalTab} rentals</p>
          </div>
        ) : (
          displayedRentals.map(rental => {
            const isSelected = selectedRentalIds.has(rental.rental_id);
            const isActive = rental.status === 'active';
            
            return (
              <div 
                key={rental.rental_id}
                onClick={() => {
                  if (isSelectionMode && isActive) {
                    const event = { stopPropagation: () => {} } as React.MouseEvent;
                    onToggleRentalSelection(rental.rental_id, event);
                  } else if (rental.forklift) {
                    onNavigateToForklift(rental.forklift_id);
                  }
                }}
                className={`p-3 rounded-lg cursor-pointer transition-all ${
                  isSelected 
                    ? 'bg-blue-50 border-2 border-blue-400' 
                    : isActive 
                      ? 'bg-green-50 border border-green-200 hover:border-green-300' 
                      : 'bg-slate-50 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-start gap-2">
                  {isSelectionMode && isActive && (
                    <div className="mt-0.5">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800 text-sm truncate">
                        {rental.forklift?.make} {rental.forklift?.model}
                      </span>
                      {!isSelectionMode && <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />}
                    </div>
                    <p className="text-xs text-slate-500 font-mono">{rental.forklift?.serial_number}</p>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(rental.start_date).toLocaleDateString()}</span>
                      {!isActive && rental.end_date && (
                        <span className="text-slate-400">→ {new Date(rental.end_date).toLocaleDateString()}</span>
                      )}
                    </div>
                    {isActive && (rental.monthly_rental_rate || 0) > 0 && (
                      <div className="mt-1.5 text-xs font-medium text-green-700">
                        RM{(rental.monthly_rental_rate || 0).toLocaleString()}/mo
                      </div>
                    )}
                  </div>
                </div>
                
                {isActive && !isSelectionMode && (
                  <div className="flex gap-2 mt-3 pt-2 border-t border-green-100">
                    {isAdmin && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onEditRental(rental); }}
                        className="flex-1 text-xs py-1.5 text-blue-600 hover:bg-blue-50 rounded font-medium"
                      >
                        Edit
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); onEndRental(rental.rental_id); }}
                      className="flex-1 text-xs py-1.5 text-red-600 hover:bg-red-50 rounded font-medium"
                    >
                      End
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default RentalsSection;
