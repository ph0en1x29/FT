import React from 'react';
import { Clock, CheckCircle, XCircle } from 'lucide-react';
import { TabType, ExportStats } from '../types';

interface StatCardsProps {
  stats: ExportStats;
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export function StatCards({ stats, activeTab, onTabChange }: StatCardsProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div
        className={`rounded-xl p-4 border cursor-pointer transition-all hover:scale-105 ${
          activeTab === 'pending'
            ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-200'
            : stats.pending > 0
            ? 'bg-amber-50 border-amber-200'
            : 'bg-slate-50 border-slate-200'
        }`}
        onClick={() => onTabChange('pending')}
      >
        <div className="flex items-center gap-2 mb-1">
          <Clock className={`w-5 h-5 ${stats.pending > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
        </div>
        <div className={`text-2xl font-bold ${stats.pending > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
          {stats.pending}
        </div>
        <div className={`text-xs ${stats.pending > 0 ? 'text-amber-700' : 'text-slate-500'}`}>
          Pending Export
        </div>
      </div>

      <div
        className={`rounded-xl p-4 border cursor-pointer transition-all hover:scale-105 ${
          activeTab === 'exported'
            ? 'bg-green-50 border-green-300 ring-2 ring-green-200'
            : 'bg-slate-50 border-slate-200'
        }`}
        onClick={() => onTabChange('exported')}
      >
        <div className="flex items-center gap-2 mb-1">
          <CheckCircle className={`w-5 h-5 ${activeTab === 'exported' ? 'text-green-600' : 'text-slate-400'}`} />
        </div>
        <div className={`text-2xl font-bold ${activeTab === 'exported' ? 'text-green-600' : 'text-slate-400'}`}>
          {stats.exported}
        </div>
        <div className={`text-xs ${activeTab === 'exported' ? 'text-green-700' : 'text-slate-500'}`}>
          Exported
        </div>
      </div>

      <div
        className={`rounded-xl p-4 border cursor-pointer transition-all hover:scale-105 ${
          activeTab === 'failed'
            ? 'bg-red-50 border-red-300 ring-2 ring-red-200'
            : stats.failed > 0
            ? 'bg-red-50 border-red-200'
            : 'bg-slate-50 border-slate-200'
        }`}
        onClick={() => onTabChange('failed')}
      >
        <div className="flex items-center gap-2 mb-1">
          <XCircle className={`w-5 h-5 ${stats.failed > 0 ? 'text-red-600' : 'text-slate-400'}`} />
        </div>
        <div className={`text-2xl font-bold ${stats.failed > 0 ? 'text-red-600' : 'text-slate-400'}`}>
          {stats.failed}
        </div>
        <div className={`text-xs ${stats.failed > 0 ? 'text-red-700' : 'text-slate-500'}`}>
          Failed
        </div>
      </div>
    </div>
  );
}
