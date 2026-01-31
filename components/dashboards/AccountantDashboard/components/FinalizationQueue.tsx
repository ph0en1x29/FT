/**
 * Finalization queue section showing jobs awaiting finalization
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle, FileText } from 'lucide-react';
import { Job } from '../../../../types';
import { UrgencyLevel, UrgencyStyle } from '../types';
import { FinalizationQueueItem } from './FinalizationQueueItem';

interface FinalizationQueueProps {
  jobs: Job[];
  urgentCount: number;
  totalValue: number;
  calculateJobRevenue: (job: Job) => number;
  calculateDaysWaiting: (job: Job) => number;
  getUrgencyLevel: (days: number) => UrgencyLevel;
  getUrgencyStyle: (urgency: UrgencyLevel) => UrgencyStyle;
}

export const FinalizationQueue: React.FC<FinalizationQueueProps> = ({
  jobs,
  urgentCount,
  totalValue,
  calculateJobRevenue,
  calculateDaysWaiting,
  getUrgencyLevel,
  getUrgencyStyle,
}) => {
  const navigate = useNavigate();

  return (
    <div className="card-premium overflow-hidden">
      <div className="p-4 border-b border-[var(--border)] bg-[var(--bg-subtle)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                urgentCount > 0 ? 'bg-red-100' : 'bg-purple-100'
              }`}
            >
              {urgentCount > 0 ? (
                <AlertCircle className="w-5 h-5 text-red-600" />
              ) : (
                <FileText className="w-5 h-5 text-purple-600" />
              )}
            </div>
            <div>
              <h2 className="font-semibold text-lg text-[var(--text)]">Finalization Queue</h2>
              <p className="text-xs text-[var(--text-muted)]">
                Oldest jobs first • {jobs.length} pending • RM{totalValue.toLocaleString()} total
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/invoices')}
            className="text-sm font-medium text-[var(--accent)] hover:underline"
          >
            View All →
          </button>
        </div>
      </div>

      <div className="divide-y divide-[var(--border-subtle)]">
        {jobs.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500 opacity-50" />
            <p className="font-medium text-[var(--text)]">All caught up!</p>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              No jobs awaiting finalization
            </p>
          </div>
        ) : (
          jobs.slice(0, 10).map((job) => {
            const revenue = calculateJobRevenue(job);
            const daysWaiting = calculateDaysWaiting(job);
            const urgency = getUrgencyLevel(daysWaiting);
            const urgencyStyle = getUrgencyStyle(urgency);

            return (
              <FinalizationQueueItem
                key={job.job_id}
                job={job}
                revenue={revenue}
                daysWaiting={daysWaiting}
                urgency={urgency}
                urgencyStyle={urgencyStyle}
              />
            );
          })
        )}
      </div>

      {jobs.length > 10 && (
        <div className="p-3 border-t border-[var(--border-subtle)] text-center">
          <button
            onClick={() => navigate('/invoices')}
            className="text-sm text-[var(--accent)] hover:underline"
          >
            View all {jobs.length} jobs →
          </button>
        </div>
      )}
    </div>
  );
};
