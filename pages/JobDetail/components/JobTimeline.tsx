import { Clock } from 'lucide-react';
import React from 'react';
import { Job } from '../../../types';

interface JobTimelineProps {
  job: Job;
}

export const JobTimeline: React.FC<JobTimelineProps> = ({ job }) => {
  return (
    <div className="card-premium p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center">
          <Clock className="w-5 h-5 text-[var(--text-muted)]" />
        </div>
        <h3 className="font-semibold text-[var(--text)]">Timeline</h3>
      </div>
      
      <div className="space-y-3">
        {job.created_at && (
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-[var(--accent)] mt-1.5 flex-shrink-0"></div>
            <div>
              <p className="text-sm font-medium text-[var(--text)]">Created</p>
              <p className="text-xs text-[var(--text-muted)]">{new Date(job.created_at).toLocaleString()}</p>
              {job.created_by_name && <p className="text-xs text-[var(--text-muted)]">By {job.created_by_name}</p>}
            </div>
          </div>
        )}
        
        {job.assigned_at && (
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-[var(--warning)] mt-1.5 flex-shrink-0"></div>
            <div>
              <p className="text-sm font-medium text-[var(--text)]">Assigned</p>
              <p className="text-xs text-[var(--text-muted)]">{new Date(job.assigned_at).toLocaleString()}</p>
              {job.assigned_technician_name && <p className="text-xs text-[var(--text-muted)]">To {job.assigned_technician_name}</p>}
            </div>
          </div>
        )}
        
        {job.started_at && (
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-[var(--success)] mt-1.5 flex-shrink-0"></div>
            <div>
              <p className="text-sm font-medium text-[var(--text)]">Started</p>
              <p className="text-xs text-[var(--text-muted)]">{new Date(job.started_at).toLocaleString()}</p>
            </div>
          </div>
        )}
        
        {job.completed_at && (
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-[var(--success)] mt-1.5 flex-shrink-0"></div>
            <div>
              <p className="text-sm font-medium text-[var(--text)]">Completed</p>
              <p className="text-xs text-[var(--text-muted)]">{new Date(job.completed_at).toLocaleString()}</p>
              {job.completed_by_name && <p className="text-xs text-[var(--text-muted)]">By {job.completed_by_name}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
