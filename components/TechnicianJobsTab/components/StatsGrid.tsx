import React from 'react';
import { Briefcase, CheckCircle, Calendar } from 'lucide-react';

interface StatsGridProps {
  currentJobsCount: number;
  completedTotal: number;
  completedThisMonth: number;
}

const StatsGrid: React.FC<StatsGridProps> = ({
  currentJobsCount,
  completedTotal,
  completedThisMonth,
}) => {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="card-theme rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[var(--info-bg)] rounded-lg flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-[var(--info)]" />
          </div>
          <div>
            <p className="text-2xl font-bold text-[var(--info)]">{currentJobsCount}</p>
            <p className="text-xs text-theme-muted">Current Jobs</p>
          </div>
        </div>
      </div>

      <div className="card-theme rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[var(--success-bg)] rounded-lg flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-[var(--success)]" />
          </div>
          <div>
            <p className="text-2xl font-bold text-[var(--success)]">{completedTotal}</p>
            <p className="text-xs text-theme-muted">Completed Total</p>
          </div>
        </div>
      </div>

      <div className="card-theme rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-theme-accent-subtle rounded-lg flex items-center justify-center">
            <Calendar className="w-5 h-5 text-theme-accent" />
          </div>
          <div>
            <p className="text-2xl font-bold text-theme-accent">{completedThisMonth}</p>
            <p className="text-xs text-theme-muted">This Month</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsGrid;
