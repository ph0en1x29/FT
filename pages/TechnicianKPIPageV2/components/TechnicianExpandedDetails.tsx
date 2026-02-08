import { AlertTriangle,DollarSign,Target,Wrench } from 'lucide-react';
import React from 'react';
import { EnhancedTechnicianKPI } from '../../../types';
import { BENCHMARKS } from '../constants';
import { getBenchmarkStatus } from '../utils';

interface TechnicianExpandedDetailsProps {
  kpi: EnhancedTechnicianKPI;
}

export const TechnicianExpandedDetails: React.FC<TechnicianExpandedDetailsProps> = ({ kpi }) => {
  return (
    <div className="border-t border-slate-200 p-4 bg-slate-50">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* KPI Metrics */}
        <div className="space-y-3">
          <h4 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
            <Target className="w-4 h-4" /> Key Metrics
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">First Time Fix Rate</span>
              <span className={`font-medium ${getBenchmarkStatus(kpi.first_time_fix_rate, BENCHMARKS.first_time_fix_rate).color}`}>
                {kpi.first_time_fix_rate.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Avg Response Time</span>
              <span className={`font-medium ${getBenchmarkStatus(kpi.avg_response_time, BENCHMARKS.avg_response_time, true).color}`}>
                {kpi.avg_response_time.toFixed(1)}h
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Mean Time to Repair</span>
              <span className="font-medium text-slate-700">{kpi.mean_time_to_repair.toFixed(1)}h</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Utilization</span>
              <span className={`font-medium ${getBenchmarkStatus(kpi.technician_utilization, BENCHMARKS.technician_utilization).color}`}>
                {kpi.technician_utilization.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Jobs/Day</span>
              <span className={`font-medium ${getBenchmarkStatus(kpi.jobs_per_day, BENCHMARKS.jobs_per_day).color}`}>
                {kpi.jobs_per_day.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Job Types */}
        <div className="space-y-3">
          <h4 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
            <Wrench className="w-4 h-4" /> Job Types
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Service</span>
              <span className="font-medium text-blue-600">{kpi.service_jobs}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Repair</span>
              <span className="font-medium text-orange-600">{kpi.repair_jobs}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Checking</span>
              <span className="font-medium text-purple-600">{kpi.checking_jobs}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Slot-In</span>
              <span className="font-medium text-red-600">{kpi.slot_in_jobs}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Courier</span>
              <span className="font-medium text-cyan-600">{kpi.courier_jobs}</span>
            </div>
          </div>
        </div>

        {/* Priority Breakdown */}
        <div className="space-y-3">
          <h4 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Priority
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Emergency</span>
              <span className="font-medium text-red-600">{kpi.emergency_jobs}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">High</span>
              <span className="font-medium text-orange-600">{kpi.high_priority_jobs}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Medium</span>
              <span className="font-medium text-amber-600">{kpi.medium_priority_jobs}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Low</span>
              <span className="font-medium text-slate-600">{kpi.low_priority_jobs}</span>
            </div>
          </div>
        </div>

        {/* Financial */}
        <div className="space-y-3">
          <h4 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
            <DollarSign className="w-4 h-4" /> Financial
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Total Revenue</span>
              <span className="font-medium text-green-600">RM{kpi.total_revenue_generated.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Avg Job Value</span>
              <span className="font-medium text-slate-700">RM{kpi.avg_job_value.toFixed(0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Parts Used</span>
              <span className="font-medium text-slate-700">{kpi.total_parts_used}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Hours Worked</span>
              <span className="font-medium text-slate-700">{kpi.total_hours_worked.toFixed(1)}h</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Repeat Visits</span>
              <span className={`font-medium ${kpi.repeat_visit_count > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {kpi.repeat_visit_count}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
