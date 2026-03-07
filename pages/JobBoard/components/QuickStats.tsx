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
  const stats = [
    {
      key: 'active',
      label: 'Active',
      value: statusCounts.total - statusCounts.completed,
      helper: 'Open work',
      isActive: statusFilter === 'all' && dateFilter === 'unfinished',
      inactiveClassName: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200',
      activeStyle: {
        backgroundColor: QUICK_STATS_ACTIVE_COLORS.active,
        '--tw-ring-color': '#86EFAC',
      } as React.CSSProperties,
      onClick: () => {
        onStatusFilterChange('all');
        onDateFilterChange('unfinished');
      },
    },
    {
      key: JobStatus.NEW,
      label: 'New',
      value: statusCounts.new,
      helper: 'Needs owner',
      isActive: statusFilter === JobStatus.NEW,
      inactiveClassName: 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200',
      activeStyle: { backgroundColor: QUICK_STATS_ACTIVE_COLORS.new },
      onClick: () => onStatusFilterChange(JobStatus.NEW),
    },
    {
      key: JobStatus.ASSIGNED,
      label: 'Assigned',
      value: statusCounts.assigned,
      helper: 'Queued work',
      isActive: statusFilter === JobStatus.ASSIGNED,
      inactiveClassName: 'bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200',
      activeStyle: { backgroundColor: QUICK_STATS_ACTIVE_COLORS.assigned },
      onClick: () => onStatusFilterChange(JobStatus.ASSIGNED),
    },
    {
      key: JobStatus.IN_PROGRESS,
      label: 'In Progress',
      value: statusCounts.inProgress,
      helper: 'On site now',
      isActive: statusFilter === JobStatus.IN_PROGRESS,
      inactiveClassName: 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200',
      activeStyle: { backgroundColor: QUICK_STATS_ACTIVE_COLORS.inProgress },
      onClick: () => onStatusFilterChange(JobStatus.IN_PROGRESS),
    },
    {
      key: JobStatus.AWAITING_FINALIZATION,
      label: 'Awaiting',
      value: statusCounts.awaiting,
      helper: 'Finance step',
      isActive: statusFilter === JobStatus.AWAITING_FINALIZATION,
      inactiveClassName: 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200',
      activeStyle: { backgroundColor: QUICK_STATS_ACTIVE_COLORS.awaiting },
      onClick: () => onStatusFilterChange(JobStatus.AWAITING_FINALIZATION),
    },
    {
      key: JobStatus.COMPLETED,
      label: 'Completed',
      value: statusCounts.completed,
      helper: 'Closed jobs',
      isActive: statusFilter === JobStatus.COMPLETED,
      inactiveClassName: 'bg-green-100 hover:bg-green-200 text-green-800 border border-green-300',
      activeStyle: { backgroundColor: QUICK_STATS_ACTIVE_COLORS.completed },
      onClick: () => {
        onStatusFilterChange(JobStatus.COMPLETED);
        onDateFilterChange('all');
      },
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
      {stats.map((stat) => (
        <button
          key={stat.key}
          onClick={stat.onClick}
          className={`rounded-xl border px-4 py-3 text-left transition-all ${
            stat.isActive
              ? 'scale-[1.01] text-white shadow-lg ring-2'
              : stat.inactiveClassName
          }`}
          style={stat.isActive ? stat.activeStyle : undefined}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-80">{stat.label}</div>
              <div className="mt-2 text-3xl font-bold leading-none">{stat.value}</div>
            </div>
          </div>
          <div className="mt-3 text-xs opacity-80">{stat.helper}</div>
        </button>
      ))}
    </div>
  );
};
