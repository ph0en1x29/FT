import React from 'react';
import { JobStatus } from '../../../types';
import { QUICK_STATS_ACTIVE_COLORS } from '../constants';
import { DateFilter,StatusCounts } from '../types';

interface QuickStatsProps {
  statusCounts: StatusCounts;
  statusFilter: string;
  dateFilter: DateFilter;
  onStatusFilterChange: (status: string) => void;
  onDateFilterChange: (filter: DateFilter) => void;
}

/**
 * Quick stats grid showing job counts by status with clickable filters
 */
export const QuickStats: React.FC<QuickStatsProps> = ({
  statusCounts,
  statusFilter,
  dateFilter,
  onStatusFilterChange,
  onDateFilterChange,
}) => {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
      {/* Active - Green (work happening) */}
      <button
        onClick={() => { onStatusFilterChange('all'); onDateFilterChange('unfinished'); }}
        className={`p-3 rounded-lg text-center transition-all ${
          statusFilter === 'all' && dateFilter === 'unfinished' 
            ? 'text-white shadow-lg scale-[1.02] ring-2' 
            : 'bg-green-50 hover:bg-green-100 text-green-700 border border-green-200'
        }`}
        style={statusFilter === 'all' && dateFilter === 'unfinished' ? {
          backgroundColor: QUICK_STATS_ACTIVE_COLORS.active,
          '--tw-ring-color': '#86EFAC'
        } as React.CSSProperties : {}}
      >
        <div className="text-2xl font-bold">{statusCounts.total - statusCounts.completed}</div>
        <div className="text-xs opacity-80">Active</div>
      </button>
      
      {/* New - Slate/Gray (unassigned) */}
      <button
        onClick={() => onStatusFilterChange(JobStatus.NEW)}
        className={`p-3 rounded-lg text-center transition-all ${
          statusFilter === JobStatus.NEW 
            ? 'text-white shadow-lg scale-[1.02]' 
            : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200'
        }`}
        style={statusFilter === JobStatus.NEW ? {
          backgroundColor: QUICK_STATS_ACTIVE_COLORS.new
        } : {}}
      >
        <div className="text-2xl font-bold">{statusCounts.new}</div>
        <div className="text-xs opacity-80">New</div>
      </button>
      
      {/* Assigned - Cyan (queued/allocated) */}
      <button
        onClick={() => onStatusFilterChange(JobStatus.ASSIGNED)}
        className={`p-3 rounded-lg text-center transition-all ${
          statusFilter === JobStatus.ASSIGNED 
            ? 'text-white shadow-lg scale-[1.02]' 
            : 'bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200'
        }`}
        style={statusFilter === JobStatus.ASSIGNED ? {
          backgroundColor: QUICK_STATS_ACTIVE_COLORS.assigned
        } : {}}
      >
        <div className="text-2xl font-bold">{statusCounts.assigned}</div>
        <div className="text-xs opacity-80">Assigned</div>
      </button>
      
      {/* In Progress - Bright Green (work happening now) */}
      <button
        onClick={() => onStatusFilterChange(JobStatus.IN_PROGRESS)}
        className={`p-3 rounded-lg text-center transition-all ${
          statusFilter === JobStatus.IN_PROGRESS 
            ? 'text-white shadow-lg scale-[1.02]' 
            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
        }`}
        style={statusFilter === JobStatus.IN_PROGRESS ? {
          backgroundColor: QUICK_STATS_ACTIVE_COLORS.inProgress
        } : {}}
      >
        <div className="text-2xl font-bold">{statusCounts.inProgress}</div>
        <div className="text-xs opacity-80">In Progress</div>
      </button>
      
      {/* Awaiting - Amber (needs attention) */}
      <button
        onClick={() => onStatusFilterChange(JobStatus.AWAITING_FINALIZATION)}
        className={`p-3 rounded-lg text-center transition-all ${
          statusFilter === JobStatus.AWAITING_FINALIZATION 
            ? 'text-white shadow-lg scale-[1.02]' 
            : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200'
        }`}
        style={statusFilter === JobStatus.AWAITING_FINALIZATION ? {
          backgroundColor: QUICK_STATS_ACTIVE_COLORS.awaiting
        } : {}}
      >
        <div className="text-2xl font-bold">{statusCounts.awaiting}</div>
        <div className="text-xs opacity-80">Awaiting</div>
      </button>
      
      {/* Completed - Dark Green (finished/settled) */}
      <button
        onClick={() => { onStatusFilterChange(JobStatus.COMPLETED); onDateFilterChange('all'); }}
        className={`p-3 rounded-lg text-center transition-all ${
          statusFilter === JobStatus.COMPLETED
            ? 'text-white shadow-lg scale-[1.02]'
            : 'bg-green-100 hover:bg-green-200 text-green-800 border border-green-300'
        }`}
        style={statusFilter === JobStatus.COMPLETED ? {
          backgroundColor: QUICK_STATS_ACTIVE_COLORS.completed
        } : {}}
      >
        <div className="text-2xl font-bold">{statusCounts.completed}</div>
        <div className="text-xs opacity-80">Completed</div>
      </button>
    </div>
  );
};
