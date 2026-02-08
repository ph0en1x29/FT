import { CheckCircle,Clock,LucideIcon,XCircle } from 'lucide-react';
import { TabType } from './constants';

interface StatCardProps {
  type: TabType;
  count: number;
  isActive: boolean;
  onClick: () => void;
}

const CARD_CONFIG: Record<TabType, {
  icon: LucideIcon;
  label: string;
  activeColor: string;
  activeBg: string;
  activeBorder: string;
  activeRing: string;
  hasHighlight: boolean;
}> = {
  pending: {
    icon: Clock,
    label: 'Pending Review',
    activeColor: 'text-amber-600',
    activeBg: 'bg-amber-50',
    activeBorder: 'border-amber-300',
    activeRing: 'ring-amber-200',
    hasHighlight: true,
  },
  approved: {
    icon: CheckCircle,
    label: 'Approved',
    activeColor: 'text-green-600',
    activeBg: 'bg-green-50',
    activeBorder: 'border-green-300',
    activeRing: 'ring-green-200',
    hasHighlight: false,
  },
  rejected: {
    icon: XCircle,
    label: 'Rejected',
    activeColor: 'text-red-600',
    activeBg: 'bg-red-50',
    activeBorder: 'border-red-300',
    activeRing: 'ring-red-200',
    hasHighlight: false,
  },
};

export default function StatCard({ type, count, isActive, onClick }: StatCardProps) {
  const config = CARD_CONFIG[type];
  const Icon = config.icon;

  // For pending, highlight when count > 0 even if not active
  const shouldHighlight = isActive || (config.hasHighlight && count > 0);
  const colorClass = shouldHighlight ? config.activeColor : 'text-slate-400';
  const labelColorClass = shouldHighlight
    ? config.activeColor.replace('text-', 'text-').replace('600', '700')
    : 'text-slate-500';

  const bgClass = isActive
    ? `${config.activeBg} ${config.activeBorder} ring-2 ${config.activeRing}`
    : config.hasHighlight && count > 0
    ? `${config.activeBg} border-${type === 'pending' ? 'amber' : 'slate'}-200`
    : 'bg-slate-50 border-slate-200';

  return (
    <div
      className={`rounded-xl p-4 border cursor-pointer transition-all hover:scale-105 ${bgClass}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-5 h-5 ${colorClass}`} />
      </div>
      <div className={`text-2xl font-bold ${colorClass}`}>
        {count}
      </div>
      <div className={`text-xs ${labelColorClass}`}>
        {config.label}
      </div>
    </div>
  );
}
