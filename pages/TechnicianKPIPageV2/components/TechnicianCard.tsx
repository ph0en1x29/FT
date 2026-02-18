import { Award,ChevronDown,ChevronUp } from 'lucide-react';
import React from 'react';
import { EnhancedTechnicianKPI } from '../../../types';
import { getScoreBg,getScoreColor } from '../utils';
import { TechnicianExpandedDetails } from './TechnicianExpandedDetails';

interface TechnicianCardProps {
  kpi: EnhancedTechnicianKPI;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
}

export const TechnicianCard: React.FC<TechnicianCardProps> = ({
  kpi,
  index,
  isExpanded,
  onToggle,
}) => {
  return (
    <div className="bg-[var(--surface)] rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header Row */}
      <div
        className="p-4 cursor-pointer hover:bg-slate-50 transition"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {index === 0 && <Award className="w-5 h-5 text-amber-500" />}
              <span className="font-bold text-slate-900">{kpi.technician_name}</span>
            </div>
            <div className="flex gap-2">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getScoreBg(kpi.efficiency_score)} ${getScoreColor(kpi.efficiency_score)}`}>
                Efficiency: {kpi.efficiency_score.toFixed(0)}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getScoreBg(kpi.productivity_score)} ${getScoreColor(kpi.productivity_score)}`}>
                Productivity: {kpi.productivity_score.toFixed(0)}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getScoreBg(kpi.quality_score)} ${getScoreColor(kpi.quality_score)}`}>
                Quality: {kpi.quality_score.toFixed(0)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-xs text-slate-500">Jobs</p>
              <p className="font-bold text-slate-900">{kpi.total_jobs_completed}/{kpi.total_jobs_assigned}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Revenue</p>
              <p className="font-bold text-green-600">RM{kpi.total_revenue_generated.toLocaleString()}</p>
            </div>
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && <TechnicianExpandedDetails kpi={kpi} />}
    </div>
  );
};
