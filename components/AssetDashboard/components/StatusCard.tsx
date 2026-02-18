import React from 'react';
import { STATUS_CONFIG } from '../constants';
import { OperationalStatus,StatusCounts } from '../types';

interface StatusCardProps {
  status: OperationalStatus;
  count: number;
  isActive: boolean;
  onClick: () => void;
  compact?: boolean;
}

export const StatusCard: React.FC<StatusCardProps> = ({
  status,
  count,
  isActive,
  onClick,
  compact = false
}) => {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  if (compact) {
    return (
      <button
        onClick={onClick}
        className={`relative p-3 rounded-xl border transition-all text-left ${
          isActive
            ? `${config.bgColor} ${config.borderColor} ring-2 ring-offset-2 ${config.borderColor.replace('border-', 'ring-')}`
            : 'bg-[var(--surface)] border-slate-200 hover:border-slate-300 hover:shadow-sm'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${config.bgColor}`}>
            <Icon className={`w-4 h-4 ${config.color}`} />
          </div>
          <div>
            <p className={`text-2xl font-bold ${isActive ? config.color : 'text-slate-800'}`}>
              {count}
            </p>
            <p className={`text-xs font-medium ${isActive ? config.color : 'text-slate-600'}`}>
              {config.label}
            </p>
          </div>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`relative p-4 rounded-xl border transition-all text-left ${
        isActive
          ? `${config.bgColor} ${config.borderColor} ring-2 ring-offset-2 ${config.borderColor.replace('border-', 'ring-')}`
          : 'bg-[var(--surface)] border-slate-200 hover:border-slate-300 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-3xl font-bold ${isActive ? config.color : 'text-slate-800'}`}>
            {count}
          </p>
          <p className={`text-sm font-medium mt-1 ${isActive ? config.color : 'text-slate-600'}`}>
            {config.label}
          </p>
        </div>
        <div className={`p-2 rounded-lg ${config.bgColor}`}>
          <Icon className={`w-5 h-5 ${config.color}`} />
        </div>
      </div>
      {status === 'service_due' && count > 0 && (
        <p className="text-xs text-slate-500 mt-2">7 days / 50 hrs</p>
      )}
      {count === 0 && status === 'service_due' && (
        <p className="text-xs text-green-600 mt-2 font-medium">✓ All clear</p>
      )}
      {count === 0 && status === 'out_of_service' && (
        <p className="text-xs text-green-600 mt-2 font-medium">✓ All operational</p>
      )}
      {count === 0 && status === 'in_service' && (
        <p className="text-xs text-green-600 mt-2 font-medium">✓ No active jobs</p>
      )}
    </button>
  );
};

interface StatusCardGridProps {
  statusCounts: StatusCounts;
  activeFilter: OperationalStatus | 'all';
  onCardClick: (status: OperationalStatus) => void;
}

export const StatusCardGrid: React.FC<StatusCardGridProps> = ({
  statusCounts,
  activeFilter,
  onCardClick
}) => {
  const primaryStatuses: OperationalStatus[] = [
    'rented_out', 'in_service', 'service_due', 'available', 'out_of_service'
  ];
  const secondaryStatuses: OperationalStatus[] = ['awaiting_parts', 'reserved'];
  const hasSecondary = secondaryStatuses.some(s => statusCounts[s] > 0);

  return (
    <>
      {/* Primary Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {primaryStatuses.map((status) => (
          <StatusCard
            key={status}
            status={status}
            count={statusCounts[status]}
            isActive={activeFilter === status}
            onClick={() => onCardClick(status)}
          />
        ))}
      </div>

      {/* Secondary Status Cards */}
      {hasSecondary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {secondaryStatuses.map((status) => {
            if (statusCounts[status] === 0) return null;
            return (
              <StatusCard
                key={status}
                status={status}
                count={statusCounts[status]}
                isActive={activeFilter === status}
                onClick={() => onCardClick(status)}
                compact
              />
            );
          })}
        </div>
      )}
    </>
  );
};
