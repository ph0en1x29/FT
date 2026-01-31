import React from 'react';
import { BENCHMARKS } from '../constants';

export const BenchmarksLegend: React.FC = () => {
  return (
    <div className="bg-theme-surface-2 rounded-lg p-3 flex flex-wrap gap-4 text-xs theme-transition">
      <span className="font-medium text-theme">Industry Benchmarks:</span>
      <span className="text-theme-muted">FTFR: {BENCHMARKS.first_time_fix_rate}%</span>
      <span className="text-slate-500">Response: {BENCHMARKS.avg_response_time}h</span>
      <span className="text-slate-500">Utilization: {BENCHMARKS.technician_utilization}%</span>
      <span className="text-slate-500">Jobs/Day: {BENCHMARKS.jobs_per_day}</span>
    </div>
  );
};
