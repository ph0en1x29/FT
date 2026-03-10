import React from 'react';
import { JobStatus } from '../../../types';
import { QUICK_STATS_ACTIVE_COLORS } from '../constants';
import { DateFilter, StatusCounts } from '../types';

interface QuickStatsProps {
  statusCounts: StatusCounts;
  statusFilter: string;
  dateFilter: DateFilter;
  onStatusFilterChange: (status: string) => void;
  onDateFilterChange: (filter: DateFilter) => void;
}

interface StatCardConfig {
  id: string;
  label: string;
  value: number;
  hint: string;
  isActive: boolean;
  inactiveClassName: string;
  activeColor?: string;
  onClick: () => void;
}

export const QuickStats: React.FC<QuickStatsProps> = ({
  statusCounts,
  statusFilter,
  dateFilter,
  onStatusFilterChange,
  onDateFilterChange,
}) => {
  const cards: StatCardConfig[] = [
    {
      id: 'active',
      label: 'Active',
      value: statusCounts.total - statusCounts.completed,
      hint: 'Open work pipeline',
      isActive: statusFilter === 'all' && dateFilter === 'unfinished',
      inactiveClassName: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-100',
      activeColor: QUICK_STATS_ACTIVE_COLORS.active,
      onClick: () => {
        onStatusFilterChange('all');
        onDateFilterChange('unfinished');
      },
    },
    {
      id: 'new',
      label: 'New',
      value: statusCounts.new,
      hint: 'Needs assignment',
      isActive: statusFilter === JobStatus.NEW,
      inactiveClassName: 'border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-100',
      activeColor: QUICK_STATS_ACTIVE_COLORS.new,
      onClick: () => onStatusFilterChange(JobStatus.NEW),
    },
    {
      id: 'assigned',
      label: 'Assigned',
      value: statusCounts.assigned,
      hint: 'Queued for dispatch',
      isActive: statusFilter === JobStatus.ASSIGNED,
      inactiveClassName: 'border-cyan-200 bg-cyan-50 text-cyan-900 dark:border-cyan-800 dark:bg-cyan-900/20 dark:text-cyan-100',
      activeColor: QUICK_STATS_ACTIVE_COLORS.assigned,
      onClick: () => onStatusFilterChange(JobStatus.ASSIGNED),
    },
    {
      id: 'progress',
      label: 'In Progress',
      value: statusCounts.inProgress,
      hint: 'Technicians on site',
      isActive: statusFilter === JobStatus.IN_PROGRESS,
      inactiveClassName: 'border-teal-200 bg-teal-50 text-teal-900 dark:border-teal-800 dark:bg-teal-900/20 dark:text-teal-100',
      activeColor: QUICK_STATS_ACTIVE_COLORS.inProgress,
      onClick: () => onStatusFilterChange(JobStatus.IN_PROGRESS),
    },
    {
      id: 'awaiting',
      label: 'Awaiting',
      value: statusCounts.awaiting,
      hint: 'Needs office follow-up',
      isActive: statusFilter === JobStatus.AWAITING_FINALIZATION,
      inactiveClassName: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100',
      activeColor: QUICK_STATS_ACTIVE_COLORS.awaiting,
      onClick: () => onStatusFilterChange(JobStatus.AWAITING_FINALIZATION),
    },
    {
      id: 'completed',
      label: 'Completed',
      value: statusCounts.completed,
      hint: 'Closed and signed off',
      isActive: statusFilter === JobStatus.COMPLETED,
      inactiveClassName: 'border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-900/20 dark:text-green-100',
      activeColor: QUICK_STATS_ACTIVE_COLORS.completed,
      onClick: () => {
        onStatusFilterChange(JobStatus.COMPLETED);
        onDateFilterChange('all');
      },
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {cards.map((card) => (
        <button
          key={card.id}
          onClick={card.onClick}
          className={`rounded-2xl border px-4 py-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
            card.isActive ? 'text-white shadow-lg ring-2 ring-white/20' : card.inactiveClassName
          }`}
          style={card.isActive ? { backgroundColor: card.activeColor } : undefined}
        >
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-80">
            {card.label}
          </div>
          <div className="mt-2 text-3xl font-semibold">{card.value}</div>
          <div className="mt-1 text-xs opacity-80">{card.hint}</div>
        </button>
      ))}
    </div>
  );
};
