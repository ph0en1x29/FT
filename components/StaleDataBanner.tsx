/**
 * Stale Data Banner
 * 
 * Displays a warning banner when there are forklifts with stale hourmeter data.
 * Shown on Fleet dashboard for admin/supervisor users.
 * 
 * Created: 2026-02-05
 */

import { AlertOctagon,ChevronRight,X } from 'lucide-react';
import React,{ useEffect,useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStaleDataSummary } from '../services/serviceTrackingService';

interface StaleDataBannerProps {
  onDismiss?: () => void;
}

const StaleDataBanner: React.FC<StaleDataBannerProps> = ({ onDismiss }) => {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<{
    hasStaleData: boolean;
    count: number;
    forklifts: Array<{ serial_number: string; days_since_update: number }>;
  } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const data = await getStaleDataSummary();
        setSummary(data);
      } catch (error) {
        console.error('Failed to load stale data summary:', error);
      }
    };
    loadSummary();
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  if (dismissed || !summary?.hasStaleData) {
    return null;
  }

  const displayForklifts = summary.forklifts.slice(0, 3);
  const remainingCount = summary.count - displayForklifts.length;

  return (
    <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-purple-100 flex-shrink-0">
          <AlertOctagon className="w-5 h-5 text-purple-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-purple-900">
                Stale Hourmeter Data
              </h3>
              <p className="text-sm text-purple-700 mt-1">
                {summary.count} unit{summary.count !== 1 ? 's have' : ' has'} not had hourmeter readings updated in 60+ days.
              </p>
            </div>
            <button
              onClick={handleDismiss}
              className="text-purple-400 hover:text-purple-600 transition-colors flex-shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* List affected units */}
          <div className="mt-3 flex flex-wrap gap-2">
            {displayForklifts.map((f, idx) => (
              <span
                key={idx}
                className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full"
              >
                {f.serial_number} ({f.days_since_update}d)
              </span>
            ))}
            {remainingCount > 0 && (
              <span className="px-2 py-1 bg-purple-200 text-purple-800 text-xs font-medium rounded-full">
                +{remainingCount} more
              </span>
            )}
          </div>
          
          <button
            onClick={() => navigate('/forklifts?tab=service-due&filter=stale')}
            className="mt-3 text-sm font-medium text-purple-700 hover:text-purple-900 flex items-center gap-1"
          >
            View all stale units <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default StaleDataBanner;
