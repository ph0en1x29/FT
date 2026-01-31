import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Job } from '../types';

interface SlotInAlertBannerProps {
  slotInPending: Job[];
}

/**
 * Alert banner for urgent Slot-In jobs requiring acknowledgement
 */
export const SlotInAlertBanner: React.FC<SlotInAlertBannerProps> = ({ slotInPending }) => {
  const navigate = useNavigate();

  if (slotInPending.length === 0) return null;

  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-red-100 rounded-full animate-pulse">
          <AlertTriangle className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <div className="font-semibold text-red-800">
            {slotInPending.length} Slot-In Job{slotInPending.length > 1 ? 's' : ''} - Acknowledge Now!
          </div>
          <div className="text-sm text-red-600">15-minute SLA active</div>
        </div>
      </div>
      <button
        onClick={() => navigate(`/jobs/${slotInPending[0].job_id}`)}
        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium text-sm"
      >
        View Now
      </button>
    </div>
  );
};
