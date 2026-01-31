/**
 * Alert banner showing jobs needing attention
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, FileText } from 'lucide-react';

interface FinalizationAlertBannerProps {
  jobCount: number;
  urgentCount: number;
  totalValue: number;
}

export const FinalizationAlertBanner: React.FC<FinalizationAlertBannerProps> = ({
  jobCount,
  urgentCount,
  totalValue,
}) => {
  const navigate = useNavigate();

  if (jobCount === 0) return null;

  const isUrgent = urgentCount > 0;

  return (
    <div
      className={`border rounded-xl p-4 flex items-center justify-between ${
        isUrgent ? 'bg-red-50 border-red-200' : 'bg-purple-50 border-purple-200'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`p-2 rounded-full ${
            isUrgent ? 'bg-red-100 animate-pulse' : 'bg-purple-100'
          }`}
        >
          {isUrgent ? (
            <AlertCircle className="w-5 h-5 text-red-600" />
          ) : (
            <FileText className="w-5 h-5 text-purple-600" />
          )}
        </div>
        <div>
          <div className={`font-semibold ${isUrgent ? 'text-red-800' : 'text-purple-800'}`}>
            {jobCount} Job{jobCount > 1 ? 's' : ''} Awaiting Finalization
            {urgentCount > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-red-200 text-red-800 rounded-full">
                {urgentCount} urgent
              </span>
            )}
          </div>
          <div className={`text-sm ${isUrgent ? 'text-red-600' : 'text-purple-600'}`}>
            Total value: RM{totalValue.toLocaleString()} pending
          </div>
        </div>
      </div>
      <button
        onClick={() => navigate('/invoices')}
        className={`px-4 py-2 text-white rounded-lg transition font-medium text-sm ${
          isUrgent ? 'bg-red-600 hover:bg-red-700' : 'bg-purple-600 hover:bg-purple-700'
        }`}
      >
        Process Now
      </button>
    </div>
  );
};
