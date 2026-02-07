import React from 'react';
import { Wrench, TrendingUp } from 'lucide-react';

interface InsightsSidebarProps {
  completedJobsCount: number;
  avgResponseTime: number;
  avgJobValue: number;
  topIssues: [string, number][];
}

const InsightsSidebar: React.FC<InsightsSidebarProps> = ({
  completedJobsCount,
  avgResponseTime,
  avgJobValue,
  topIssues,
}) => {
  return (
    <div className="space-y-4">
      {/* Service Stats */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-800 text-sm mb-3 flex items-center gap-2">
          <Wrench className="w-4 h-4 text-blue-600" /> Service Stats
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center p-2 bg-green-50 rounded">
            <span className="text-xs text-slate-600">Completed</span>
            <span className="font-bold text-green-600 text-sm">{completedJobsCount}</span>
          </div>
          <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
            <span className="text-xs text-slate-600">Avg Response</span>
            <span className="font-bold text-blue-600 text-sm">{avgResponseTime.toFixed(1)}h</span>
          </div>
          <div className="flex justify-between items-center p-2 bg-purple-50 rounded">
            <span className="text-xs text-slate-600">Avg Job Value</span>
            <span className="font-bold text-purple-600 text-sm">
              RM{avgJobValue}
            </span>
          </div>
        </div>
      </div>

      {/* Common Issues */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-800 text-sm mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-orange-600" /> Common Issues
        </h3>
        {topIssues.length > 0 ? (
          <div className="space-y-2">
            {topIssues.map(([issue, count], idx) => (
              <div key={issue} className="flex justify-between items-center p-2 bg-slate-50 rounded">
                <span className="text-xs text-slate-600">#{idx + 1} {issue}</span>
                <span className="text-xs font-bold text-slate-500">{count}x</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">No service history yet</p>
        )}
      </div>
    </div>
  );
};

export default InsightsSidebar;
