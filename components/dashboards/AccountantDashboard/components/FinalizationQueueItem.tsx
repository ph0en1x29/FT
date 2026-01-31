/**
 * Individual item in the finalization queue
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Calendar, ChevronRight, Receipt } from 'lucide-react';
import { Job } from '../../../../types';
import { UrgencyLevel, UrgencyStyle } from '../types';

interface FinalizationQueueItemProps {
  job: Job;
  revenue: number;
  daysWaiting: number;
  urgency: UrgencyLevel;
  urgencyStyle: UrgencyStyle;
}

export const FinalizationQueueItem: React.FC<FinalizationQueueItemProps> = ({
  job,
  revenue,
  daysWaiting,
  urgency,
  urgencyStyle,
}) => {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/jobs/${job.job_id}`)}
      className={`p-4 cursor-pointer transition-all hover:bg-[var(--bg-subtle)] ${urgencyStyle.border}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              urgency === 'critical' ? 'bg-red-100' : 'bg-purple-100'
            }`}
          >
            {urgencyStyle.icon ? (
              <AlertCircle className="w-5 h-5 text-red-600" />
            ) : (
              <Receipt className="w-5 h-5 text-purple-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-[var(--text)] truncate">{job.title}</p>
              {job.job_type && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600 flex-shrink-0">
                  {job.job_type}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-muted)]">
              <span>{job.customer?.name || 'No customer'}</span>
              {job.completed_at && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(job.completed_at).toLocaleDateString('en-MY', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${urgencyStyle.badge}`}>
            {daysWaiting} day{daysWaiting !== 1 ? 's' : ''}
          </span>
          <div className="text-right">
            <p className="font-semibold text-green-600">RM{revenue.toLocaleString()}</p>
            <p className="text-xs text-[var(--text-muted)]">Est. value</p>
          </div>
          <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
        </div>
      </div>
    </div>
  );
};
