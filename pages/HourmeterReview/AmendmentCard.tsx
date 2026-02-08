import { AlertTriangle,ArrowRight,ChevronRight,Gauge } from 'lucide-react';
import { HourmeterAmendment } from '../../types';
import { FLAG_REASON_LABELS } from './constants';
import { getTimeSince } from './utils';

interface AmendmentCardProps {
  amendment: HourmeterAmendment;
  onClick: () => void;
}

export default function AmendmentCard({ amendment, onClick }: AmendmentCardProps) {
  const statusColors = {
    pending: { bg: 'bg-amber-100', icon: 'text-amber-600' },
    approved: { bg: 'bg-green-100', icon: 'text-green-600' },
    rejected: { bg: 'bg-red-100', icon: 'text-red-600' },
  };

  const colors = statusColors[amendment.status];
  const change = amendment.amended_reading - amendment.original_reading;

  return (
    <div
      className="card-theme rounded-xl overflow-hidden theme-transition hover:shadow-md cursor-pointer"
      onClick={onClick}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors.bg}`}>
              <Gauge className={`w-5 h-5 ${colors.icon}`} />
            </div>
            <div>
              <h4 className="font-medium text-theme">
                Job: {amendment.job_id.slice(0, 8)}...
              </h4>
              <p className="text-xs text-theme-muted">
                Requested by {amendment.requested_by_name} • {getTimeSince(amendment.requested_at)}
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-theme-muted" />
        </div>

        {/* Reading comparison */}
        <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg mb-3">
          <div className="text-center">
            <div className="text-xs text-slate-500">Original</div>
            <div className="text-lg font-bold text-slate-700">
              {amendment.original_reading.toLocaleString()}
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400" />
          <div className="text-center">
            <div className="text-xs text-slate-500">Amended</div>
            <div className="text-lg font-bold text-blue-600">
              {amendment.amended_reading.toLocaleString()}
            </div>
          </div>
          <div className="flex-1 text-right">
            <div className="text-xs text-slate-500">Change</div>
            <div className={`text-sm font-medium ${change > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {change > 0 ? '+' : ''}{change.toLocaleString()} hrs
            </div>
          </div>
        </div>

        {/* Flag reasons */}
        {amendment.flag_reasons && amendment.flag_reasons.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {amendment.flag_reasons.map((flag) => (
              <span
                key={flag}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full"
              >
                <AlertTriangle className="w-3 h-3" />
                {FLAG_REASON_LABELS[flag] || flag}
              </span>
            ))}
          </div>
        )}

        {/* Reason preview */}
        <p className="text-sm text-theme-muted line-clamp-2">{amendment.reason}</p>
      </div>
    </div>
  );
}
