import React from 'react';
import { DateRange } from '../types';

interface FilterPanelProps {
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  customStartDate: string;
  setCustomStartDate: (date: string) => void;
  customEndDate: string;
  setCustomEndDate: (date: string) => void;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  dateRange,
  setDateRange,
  customStartDate,
  setCustomStartDate,
  customEndDate,
  setCustomEndDate,
}) => {
  return (
    <div className="card-theme rounded-xl p-4 theme-transition">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-theme">Period:</span>
          <div className="flex rounded-lg border border-theme overflow-hidden">
            {(['7d', '30d', '90d', '365d', 'custom'] as const).map(range => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1.5 text-sm ${
                  dateRange === range
                    ? 'bg-blue-600 text-white'
                    : 'bg-theme-surface text-theme-muted hover:bg-theme-surface-2'
                }`}
              >
                {range === 'custom' ? 'Custom' : range}
              </button>
            ))}
          </div>
        </div>
        {dateRange === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-3 py-1.5 bg-theme-surface border border-theme rounded-lg text-sm text-theme theme-transition"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm"
            />
          </div>
        )}
      </div>
    </div>
  );
};
