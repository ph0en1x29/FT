import { CheckCircle,Clock,DollarSign,Gauge,Target,Users,Zap } from 'lucide-react';
import React from 'react';
import { BENCHMARKS } from '../constants';
import { TeamTotals } from '../types';
import { getBenchmarkStatus } from '../utils';

interface TeamSummaryCardsProps {
  teamTotals: TeamTotals;
}

export const TeamSummaryCards: React.FC<TeamSummaryCardsProps> = ({ teamTotals }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-3">
      <div className="card-theme rounded-xl p-4 overflow-hidden theme-transition">
        <div className="flex items-center gap-2 text-theme-muted text-xs mb-1">
          <Users className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">Total Jobs</span>
        </div>
        <p className="text-2xl font-bold text-theme">{teamTotals.totalJobs}</p>
      </div>
      <div className="card-theme rounded-xl p-4 overflow-hidden theme-transition">
        <div className="flex items-center gap-2 text-theme-muted text-xs mb-1">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">Completed</span>
        </div>
        <p className="text-2xl font-bold text-green-600">{teamTotals.totalCompleted}</p>
      </div>
      <div className="card-theme rounded-xl p-4 overflow-hidden theme-transition">
        <div className="flex items-center gap-2 text-theme-muted text-xs mb-1">
          <DollarSign className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">Revenue</span>
        </div>
        <p className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-600 truncate" title={`RM${teamTotals.totalRevenue.toLocaleString()}`}>
          RM{teamTotals.totalRevenue.toLocaleString()}
        </p>
      </div>
      <div className="card-theme rounded-xl p-4 overflow-hidden theme-transition">
        <div className="flex items-center gap-2 text-theme-muted text-xs mb-1">
          <Target className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">Avg FTFR</span>
        </div>
        <p className={`text-2xl font-bold ${getBenchmarkStatus(teamTotals.avgFTFR, BENCHMARKS.first_time_fix_rate).color}`}>
          {teamTotals.avgFTFR.toFixed(1)}%
        </p>
      </div>
      <div className="card-theme rounded-xl p-4 overflow-hidden theme-transition">
        <div className="flex items-center gap-2 text-theme-muted text-xs mb-1">
          <Clock className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">Avg Response</span>
        </div>
        <p className={`text-2xl font-bold ${getBenchmarkStatus(teamTotals.avgResponseTime, BENCHMARKS.avg_response_time, true).color}`}>
          {teamTotals.avgResponseTime.toFixed(1)}h
        </p>
      </div>
      <div className="card-theme rounded-xl p-4 overflow-hidden theme-transition">
        <div className="flex items-center gap-2 text-theme-muted text-xs mb-1">
          <Gauge className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">Utilization</span>
        </div>
        <p className={`text-2xl font-bold ${getBenchmarkStatus(teamTotals.avgUtilization, BENCHMARKS.technician_utilization).color}`}>
          {teamTotals.avgUtilization.toFixed(1)}%
        </p>
      </div>
      <div className="card-theme rounded-xl p-4 overflow-hidden theme-transition">
        <div className="flex items-center gap-2 text-theme-muted text-xs mb-1">
          <Zap className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">Jobs/Day</span>
        </div>
        <p className={`text-2xl font-bold ${getBenchmarkStatus(teamTotals.avgJobsPerDay, BENCHMARKS.jobs_per_day).color}`}>
          {teamTotals.avgJobsPerDay.toFixed(1)}
        </p>
      </div>
    </div>
  );
};
