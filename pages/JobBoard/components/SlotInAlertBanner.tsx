import { Zap } from 'lucide-react';
import React from 'react';

interface SlotInAlertBannerProps {
  count: number;
  onViewAll: () => void;
}

/**
 * Alert banner for pending Slot-In jobs with SLA countdown
 */
export const SlotInAlertBanner: React.FC<SlotInAlertBannerProps> = ({ count, onViewAll }) => {
  if (count === 0) return null;

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-red-100 rounded-full">
          <Zap className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <div className="font-semibold text-red-800">
            {count} Slot-In {count === 1 ? 'Job' : 'Jobs'} Pending Acknowledgement
          </div>
          <div className="text-sm text-red-600">15-minute SLA countdown active</div>
        </div>
      </div>
      <button
        onClick={onViewAll}
        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium text-sm"
      >
        View All Slot-In Jobs
      </button>
    </div>
  );
};
