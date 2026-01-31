import React from 'react';
import { Clock, User as UserIcon, AlertTriangle } from 'lucide-react';
import { SpecialFilter } from '../types';

interface SpecialFilterBannerProps {
  specialFilter: SpecialFilter;
  filteredCount: number;
  onClear: () => void;
}

const FILTER_CONFIG = {
  overdue: {
    bgClass: 'bg-red-50 border-red-200',
    iconBgClass: 'bg-red-100',
    textClass: 'text-red-800',
    subtextClass: 'text-red-600',
    buttonClass: 'bg-red-600 hover:bg-red-700',
    Icon: Clock,
    iconColorClass: 'text-red-600',
    getTitle: (count: number) => `${count} Overdue Jobs`,
    subtitle: 'Past scheduled date, not yet completed',
  },
  unassigned: {
    bgClass: 'bg-orange-50 border-orange-200',
    iconBgClass: 'bg-orange-100',
    textClass: 'text-orange-800',
    subtextClass: 'text-orange-600',
    buttonClass: 'bg-orange-600 hover:bg-orange-700',
    Icon: UserIcon,
    iconColorClass: 'text-orange-600',
    getTitle: (count: number) => `${count} Unassigned Jobs`,
    subtitle: 'No technician assigned yet',
  },
  escalated: {
    bgClass: 'bg-red-50 border-red-200',
    iconBgClass: 'bg-red-100',
    textClass: 'text-red-800',
    subtextClass: 'text-red-600',
    buttonClass: 'bg-red-600 hover:bg-red-700',
    Icon: AlertTriangle,
    iconColorClass: 'text-red-600',
    getTitle: (count: number) => `${count} Escalated Jobs`,
    subtitle: 'Requires immediate attention',
  },
  'awaiting-ack': {
    bgClass: 'bg-purple-50 border-purple-200',
    iconBgClass: 'bg-purple-100',
    textClass: 'text-purple-800',
    subtextClass: 'text-purple-600',
    buttonClass: 'bg-purple-600 hover:bg-purple-700',
    Icon: Clock,
    iconColorClass: 'text-purple-600',
    getTitle: (count: number) => `${count} Awaiting Customer Acknowledgement`,
    subtitle: 'Completed, pending customer sign-off',
  },
};

/**
 * Banner showing active special filter with count and clear button
 */
export const SpecialFilterBanner: React.FC<SpecialFilterBannerProps> = ({
  specialFilter,
  filteredCount,
  onClear,
}) => {
  if (!specialFilter) return null;

  const config = FILTER_CONFIG[specialFilter];
  const { Icon } = config;

  return (
    <div className={`flex items-center justify-between p-4 rounded-xl border ${config.bgClass}`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-full ${config.iconBgClass}`}>
          <Icon className={`w-5 h-5 ${config.iconColorClass}`} />
        </div>
        <div>
          <div className={`font-semibold ${config.textClass}`}>
            {config.getTitle(filteredCount)}
          </div>
          <div className={`text-sm ${config.subtextClass}`}>
            {config.subtitle}
          </div>
        </div>
      </div>
      <button
        onClick={onClear}
        className={`px-4 py-2 rounded-lg font-medium text-sm transition text-white ${config.buttonClass}`}
      >
        Clear Filter
      </button>
    </div>
  );
};
