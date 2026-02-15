import React from 'react';
import { STATUS_CONFIG, PRIMARY_STATUSES, SECONDARY_STATUSES } from '../constants';
import { OperationalStatus, StatusCounts } from '../types';

interface StatusCardV3Props {
  status: OperationalStatus;
  count: number;
  isActive: boolean;
  onClick: () => void;
}

/**
 * StatusCardV3 - Clean status cards with subtle hover and zero states
 * No progress bars, no percentages. Just count + label + icon.
 */
const StatusCardV3: React.FC<StatusCardV3Props> = ({
  status,
  count,
  isActive,
  onClick,
}) => {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <button
      onClick={onClick}
      className={`relative p-4 rounded-xl border-2 transition-all duration-150 text-left w-full
        ${isActive
          ? `${config.bgColor} ${config.borderColor} ring-2 ring-offset-2 ${config.borderColor.replace('border-', 'ring-')}`
          : 'card-theme border-theme hover:border-slate-300 hover:shadow-sm active:scale-[0.98]'
        }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-2xl font-bold ${isActive ? config.color : 'text-theme'}`}>
            {count}
          </p>
          <p className={`text-sm font-medium mt-1 ${isActive ? config.color : 'text-theme-muted'}`}>
            {config.label}
          </p>
          {/* Zero states for actionable statuses */}
          {count === 0 && status === 'service_due' && (
            <p className="text-xs text-green-600 mt-1.5 font-medium">✓ All clear</p>
          )}
          {count === 0 && status === 'out_of_service' && (
            <p className="text-xs text-green-600 mt-1.5 font-medium">✓ All operational</p>
          )}
          {count === 0 && status === 'in_service' && (
            <p className="text-xs text-green-600 mt-1.5 font-medium">✓ No active jobs</p>
          )}
        </div>
        <div className={`p-2 rounded-lg ${config.bgColor}`}>
          <Icon className={`w-5 h-5 ${config.color}`} />
        </div>
      </div>
    </button>
  );
};

interface StatusCardGridV3Props {
  statusCounts: StatusCounts;
  activeFilter: OperationalStatus | 'all';
  onCardClick: (status: OperationalStatus) => void;
}

export const StatusCardGridV3: React.FC<StatusCardGridV3Props> = ({
  statusCounts,
  activeFilter,
  onCardClick,
}) => {
  const hasSecondary = SECONDARY_STATUSES.some(s => statusCounts[s] > 0);

  return (
    <div className="space-y-3">
      {/* Primary */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {PRIMARY_STATUSES.map((status) => (
          <StatusCardV3
            key={status}
            status={status}
            count={statusCounts[status]}
            isActive={activeFilter === status}
            onClick={() => onCardClick(status)}
          />
        ))}
      </div>

      {/* Secondary — only when relevant */}
      {hasSecondary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {SECONDARY_STATUSES.map((status) => {
            if (statusCounts[status] === 0) return null;
            return (
              <StatusCardV3
                key={status}
                status={status}
                count={statusCounts[status]}
                isActive={activeFilter === status}
                onClick={() => onCardClick(status)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StatusCardV3;
