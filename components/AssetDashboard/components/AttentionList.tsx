import { AlertTriangle, Calendar, Clock, Wrench, XCircle } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';

export interface AttentionItem {
  id: string;
  forkliftId: string;
  serialNumber: string;
  makeModel: string;
  type: 'service_overdue' | 'service_due_soon' | 'rental_expiring' | 'out_of_service_long' | 'awaiting_parts_long';
  message: string;
  urgency: number; // lower = more urgent
}

interface AttentionListProps {
  items: AttentionItem[];
}

const ATTENTION_CONFIG = {
  service_overdue: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
  service_due_soon: { icon: Wrench, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
  rental_expiring: { icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
  out_of_service_long: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
  awaiting_parts_long: { icon: Clock, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
};

/**
 * AttentionList - Shows forklifts that need action, sorted by urgency.
 * Only renders when there are items. Zero items = no section at all.
 */
export const AttentionList: React.FC<AttentionListProps> = ({ items }) => {
  const navigate = useNavigate();

  if (items.length === 0) return null;

  // Show max 5, sorted by urgency
  const displayItems = items.slice(0, 5);
  const remaining = items.length - 5;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-theme-muted flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-500" />
        Needs Attention ({items.length})
      </h3>
      <div className="space-y-2">
        {displayItems.map((item) => {
          const config = ATTENTION_CONFIG[item.type];
          const Icon = config.icon;
          return (
            <button
              key={item.id}
              onClick={() => navigate(`/forklifts/${item.forkliftId}`)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border ${config.border} ${config.bg} hover:shadow-sm transition-all text-left`}
            >
              <Icon className={`w-4 h-4 ${config.color} flex-shrink-0`} />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-theme">
                  {item.serialNumber}
                </span>
                <span className="text-sm text-theme-muted ml-2">
                  ({item.makeModel})
                </span>
              </div>
              <span className={`text-sm font-medium ${config.color} flex-shrink-0`}>
                {item.message}
              </span>
            </button>
          );
        })}
        {remaining > 0 && (
          <p className="text-xs text-theme-muted text-center py-1">
            +{remaining} more items
          </p>
        )}
      </div>
    </div>
  );
};
