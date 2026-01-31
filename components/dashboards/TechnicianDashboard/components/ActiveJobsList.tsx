import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, CheckCircle } from 'lucide-react';
import { Job } from '../types';
import { ActiveJobItem } from './ActiveJobItem';

interface ActiveJobsListProps {
  activeJobs: Job[];
  maxItems?: number;
}

/**
 * List of all active jobs section
 */
export const ActiveJobsList: React.FC<ActiveJobsListProps> = ({ activeJobs, maxItems = 8 }) => {
  const navigate = useNavigate();

  return (
    <div className="card-premium overflow-hidden">
      <div className="p-4 border-b border-[var(--border)] bg-[var(--bg-subtle)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-subtle)] flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-[var(--accent)]" />
            </div>
            <div>
              <h2 className="font-semibold text-lg text-[var(--text)]">All Active Jobs</h2>
              <p className="text-xs text-[var(--text-muted)]">
                {activeJobs.length} active jobs assigned to you
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/jobs')}
            className="text-sm font-medium text-[var(--accent)] hover:underline"
          >
            View All →
          </button>
        </div>
      </div>

      <div className="divide-y divide-[var(--border-subtle)]">
        {activeJobs.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500 opacity-50" />
            <p className="font-medium text-[var(--text)]">All caught up!</p>
            <p className="text-sm text-[var(--text-muted)] mt-1">No active jobs assigned to you</p>
          </div>
        ) : (
          activeJobs.slice(0, maxItems).map((job) => (
            <ActiveJobItem key={job.job_id} job={job} />
          ))
        )}
      </div>

      {activeJobs.length > maxItems && (
        <div className="p-3 border-t border-[var(--border-subtle)] text-center">
          <button
            onClick={() => navigate('/jobs')}
            className="text-sm text-[var(--accent)] hover:underline"
          >
            View all {activeJobs.length} jobs →
          </button>
        </div>
      )}
    </div>
  );
};
