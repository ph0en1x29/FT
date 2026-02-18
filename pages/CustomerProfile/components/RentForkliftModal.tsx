import { CheckSquare,Loader2,Plus,Search,Square,Truck,X } from 'lucide-react';
import React,{ useMemo } from 'react';
import { RentForkliftModalProps } from '../types';

const RentForkliftModal: React.FC<RentForkliftModalProps> = ({
  customerName,
  availableForklifts,
  selectedForkliftIds,
  rentStartDate,
  rentEndDate,
  rentNotes,
  rentMonthlyRate,
  forkliftSearchQuery,
  rentProcessing,
  isAdmin,
  onClose,
  onToggleForklift,
  onSetStartDate,
  onSetEndDate,
  onSetNotes,
  onSetMonthlyRate,
  onSetSearchQuery,
  onConfirm,
}) => {
  const filteredForklifts = useMemo(() => {
    if (!forkliftSearchQuery) return availableForklifts;
    const query = forkliftSearchQuery.toLowerCase();
    return availableForklifts.filter(f => 
      f.serial_number.toLowerCase().includes(query) ||
      f.make.toLowerCase().includes(query) ||
      f.model.toLowerCase().includes(query)
    );
  }, [availableForklifts, forkliftSearchQuery]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-[var(--surface)] rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-green-50 flex-shrink-0">
          <h3 className="font-bold text-lg text-green-800 flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Rent to {customerName}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search forklifts..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              value={forkliftSearchQuery}
              onChange={(e) => onSetSearchQuery(e.target.value)}
            />
          </div>

          <div className="bg-slate-50 rounded-lg p-3 max-h-56 overflow-y-auto">
            <p className="text-xs font-bold text-slate-500 uppercase mb-2">
              Available ({filteredForklifts.length})
              {selectedForkliftIds.size > 0 && (
                <span className="ml-2 text-green-600">• {selectedForkliftIds.size} selected</span>
              )}
            </p>
            {filteredForklifts.length === 0 ? (
              <div className="text-center py-6 text-slate-400">
                <Truck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No available forklifts</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredForklifts.map(forklift => {
                  const isSelected = selectedForkliftIds.has(forklift.forklift_id);
                  return (
                    <div 
                      key={forklift.forklift_id}
                      onClick={() => onToggleForklift(forklift.forklift_id)}
                      className={`p-3 rounded-lg cursor-pointer transition-all ${
                        isSelected 
                          ? 'bg-green-100 border-2 border-green-400' 
                          : 'bg-[var(--surface)] border border-slate-200 hover:border-green-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-green-600 flex-shrink-0" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-400 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800 text-sm">
                              {forklift.make} {forklift.model}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                              forklift.type === 'Electric' ? 'bg-blue-100 text-blue-700' :
                              forklift.type === 'Diesel' ? 'bg-slate-100 text-slate-700' :
                              'bg-purple-100 text-purple-700'
                            }`}>
                              {forklift.type}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 font-mono">{forklift.serial_number}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Date *</label>
              <input
                type="date"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-green-500"
                value={rentStartDate}
                onChange={(e) => onSetStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">End Date</label>
              <input
                type="date"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-green-500"
                value={rentEndDate}
                onChange={(e) => onSetEndDate(e.target.value)}
              />
            </div>
          </div>

          {isAdmin && (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monthly Rate (RM)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">RM</span>
                <input
                  type="number"
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-green-500"
                  value={rentMonthlyRate}
                  onChange={(e) => onSetMonthlyRate(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes</label>
            <textarea
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-green-500 h-16 resize-none"
              value={rentNotes}
              onChange={(e) => onSetNotes(e.target.value)}
              placeholder="Optional notes..."
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t flex gap-3 flex-shrink-0 bg-slate-50">
          <button
            onClick={onClose}
            disabled={rentProcessing}
            className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={rentProcessing || selectedForkliftIds.size === 0}
            className="flex-1 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {rentProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {rentProcessing ? 'Processing...' : `Rent ${selectedForkliftIds.size || ''} Forklift${selectedForkliftIds.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RentForkliftModal;
