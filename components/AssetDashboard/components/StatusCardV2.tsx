import React from 'react';
import { STATUS_CONFIG, PRIMARY_STATUSES, SECONDARY_STATUSES } from '../constants';
import { OperationalStatus, StatusCounts } from '../types';

interface StatusCardV2Props {
  status: OperationalStatus;
  count: number;
  total: number;
  isActive: boolean;
  onClick: () => void;
}

/**
 * StatusCardV2 - Refined status cards with percentage bar and hover effects
 */
export const StatusCardV2: React.FC<StatusCardV2Props> = ({
  status,
  count,
  total,
  isActive,
  onClick,
}) => {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <button
      onClick={onClick}
      className={`relative p-4 rounded-xl border-2 transition-all duration-200 text-left w-full group
        ${isActive
          ? `${config.bgColor} ${config.borderColor} ring-2 ring-offset-2 ${config.borderColor.replace('border-', 'ring-')} scale-[1.02]`
          : 'card-theme border-theme hover:border-slate-300 hover:shadow-md hover:scale-[1.01]'
        }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-lg ${config.bgColor} transition-transform group-hover:scale-110`}>
          <Icon className={`w-4 h-4 ${config.color}`} />
        </div>
        <span className={`text-xs font-medium ${isActive ? config.color : 'text-theme-muted'}`}>
          {percentage}%
        </span>
      </div>

      <p className={`text-2xl font-bold mb-0.5 ${isActive ? config.color : 'text-theme'}`}>
        {count}
      </p>
      <p className={`text-xs font-medium ${isActive ? config.color : 'text-theme-muted'}`}>
        {config.label}
      </p>

      {/* Mini progress bar */}
      <div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out`}
          style={{
            width: `${percentage}%`,
            backgroundColor: config.color.includes('green') ? '#16a34a'
              : config.color.includes('blue') ? '#2563eb'
              : config.color.includes('amber') ? '#d97706'
              : config.color.includes('red') ? '#dc2626'
              : config.color.includes('purple') ? '#7c3aed'
              : config.color.includes('cyan') ? '#0891b2'
              : '#64748b',
          }}
        />
      </div>

      {/* Zero state */}
      {count === 0 && status === 'service_due' && (
        <p className="text-xs text-green-600 mt-2 font-medium">✓ All clear</p>
      )}
      {count === 0 && status === 'out_of_service' && (
        <p className="text-xs text-green-600 mt-2 font-medium">✓ All operational</p>
      )}
    </button>
  );
};

interface StatusCardGridV2Props {
  statusCounts: StatusCounts;
  activeFilter: OperationalStatus | 'all';
  onCardClick: (status: OperationalStatus) => void;
}

export const StatusCardGridV2: React.FC<StatusCardGridV2Props> = ({
  statusCounts,
  activeFilter,
  onCardClick,
}) => {
  const hasSecondary = SECONDARY_STATUSES.some(s => statusCounts[s] > 0);

  return (
    <div className="space-y-4">
      {/* Primary */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {PRIMARY_STATUSES.map((status) => (
          <StatusCardV2
            key={status}
            status={status}
            count={statusCounts[status]}
            total={statusCounts.total}
            isActive={activeFilter === status}
            onClick={() => onCardClick(status)}
          />
        ))}
      </div>

      {/* Secondary */}
      {hasSecondary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {SECONDARY_STATUSES.map((status) => {
            if (statusCounts[status] === 0) return null;
            return (
              <StatusCardV2
                key={status}
                status={status}
                count={statusCounts[status]}
                total={statusCounts.total}
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
