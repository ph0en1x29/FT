import { Calendar } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Job } from '../types';
import { ScheduleCard } from './ScheduleCard';

interface TodayScheduleSectionProps {
  todayJobs: Job[];
}

/**
 * Today's Schedule section with horizontal carousel
 */
export const TodayScheduleSection: React.FC<TodayScheduleSectionProps> = ({ todayJobs }) => {
  const navigate = useNavigate();

  return (
    <div className="card-premium overflow-hidden">
      <div className="p-4 border-b border-[var(--border)] bg-[var(--bg-subtle)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-subtle)] flex items-center justify-center">
              <Calendar className="w-5 h-5 text-[var(--accent)]" />
            </div>
            <div>
              <h2 className="font-semibold text-lg text-[var(--text)]">Today's Schedule</h2>
              <p className="text-xs text-[var(--text-muted)]">
                {todayJobs.length} job{todayJobs.length !== 1 ? 's' : ''} scheduled • Swipe to see more
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

      {todayJobs.length === 0 ? (
        <div className="p-8 text-center">
          <Calendar className="w-12 h-12 mx-auto mb-3 text-[var(--text-muted)] opacity-50" />
          <p className="font-medium text-[var(--text)]">No jobs scheduled for today</p>
          <p className="text-sm text-[var(--text-muted)] mt-1">Check back later or view all jobs</p>
        </div>
      ) : (
        <div className="p-4">
          <div className="schedule-carousel">
            {todayJobs.map((job) => (
              <ScheduleCard key={job.job_id} job={job} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
