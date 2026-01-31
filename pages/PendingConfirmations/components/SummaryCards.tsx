import React from 'react';
import { Clock, Wrench, AlertTriangle, CheckCircle } from 'lucide-react';
import { SummaryCardsProps } from '../types';

export function SummaryCards({ partsPending, jobsPending, overdueCount, confirmedToday }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="card-theme p-4 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-theme">{partsPending}</div>
            <div className="text-xs text-theme-muted">Parts Pending</div>
          </div>
        </div>
      </div>
      <div className="card-theme p-4 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Wrench className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-theme">{jobsPending}</div>
            <div className="text-xs text-theme-muted">Jobs Pending</div>
          </div>
        </div>
      </div>
      <div className="card-theme p-4 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-100 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-theme">{overdueCount}</div>
            <div className="text-xs text-theme-muted">Overdue (&gt;24h)</div>
          </div>
        </div>
      </div>
      <div className="card-theme p-4 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-theme">{confirmedToday}</div>
            <div className="text-xs text-theme-muted">Confirmed Today</div>
          </div>
        </div>
      </div>
    </div>
  );
}
