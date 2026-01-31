import React from 'react';
import { Job } from '../../../types';
import { getRepairDuration } from '../utils';
import { Clock } from 'lucide-react';

interface JobTimerCardProps {
  job: Job;
}

export const JobTimerCard: React.FC<JobTimerCardProps> = ({ job }) => {
  const repairDuration = getRepairDuration(job);
  
  if (!job.repair_start_time) return null;

  return (
    <div className="card-premium card-tint-info p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-[var(--info-bg)] flex items-center justify-center">
          <Clock className="w-5 h-5 text-[var(--info)]" />
        </div>
        <div>
          <h3 className="font-semibold text-[var(--text)]">Repair Time</h3>
          {repairDuration && (
            <p className="text-xs text-[var(--accent)] font-medium">{repairDuration.hours}h {repairDuration.minutes}m</p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="label-premium mb-1">Started</p>
          <p className="font-mono text-sm text-[var(--text)]">{new Date(job.repair_start_time).toLocaleTimeString()}</p>
          <p className="text-xs text-[var(--text-muted)]">{new Date(job.repair_start_time).toLocaleDateString()}</p>
        </div>
        <div>
          <p className="label-premium mb-1">Ended</p>
          {job.repair_end_time ? (
            <>
              <p className="font-mono text-sm text-[var(--text)]">{new Date(job.repair_end_time).toLocaleTimeString()}</p>
              <p className="text-xs text-[var(--text-muted)]">{new Date(job.repair_end_time).toLocaleDateString()}</p>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-[var(--success)] rounded-full animate-pulse" />
              <p className="text-[var(--success)] font-medium text-sm">Running</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
