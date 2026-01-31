import React from 'react';
import { DashboardMetrics } from '../types';

interface MetricsBarProps {
  metrics: DashboardMetrics;
}

export const MetricsBar: React.FC<MetricsBarProps> = ({ metrics }) => {
  return (
    <div className="flex flex-wrap gap-6 px-4 py-3 bg-slate-50 rounded-lg">
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500">Jobs (30d):</span>
        <span className="text-sm font-semibold text-slate-800">
          {metrics.jobs_completed_30d}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500">Avg Duration:</span>
        <span className="text-sm font-semibold text-slate-800">
          {metrics.avg_job_duration_hours > 0 
            ? `${metrics.avg_job_duration_hours.toFixed(1)} hrs` 
            : '-'}
        </span>
      </div>
    </div>
  );
};
