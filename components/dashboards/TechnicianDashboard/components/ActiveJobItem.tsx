import { AlertTriangle,ChevronRight,Clock,MapPin,Wrench } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import SlotInSLABadge from '../../../SlotInSLABadge';
import { formatShortDate,getJobTypeColor,getStatusColor } from '../helpers';
import { Job,JobType } from '../types';

interface ActiveJobItemProps {
  job: Job;
}

/**
 * Individual job item in the Active Jobs list
 */
export const ActiveJobItem: React.FC<ActiveJobItemProps> = ({ job }) => {
  const navigate = useNavigate();

  const statusColor = getStatusColor(job.status);
  const typeColor = getJobTypeColor(job.job_type);
  const isSlotIn = job.job_type === JobType.SLOT_IN;

  return (
    <div
      onClick={() => navigate(`/jobs/${job.job_id}`)}
      className={`p-4 cursor-pointer transition-all hover:bg-[var(--bg-subtle)] ${
        isSlotIn && !job.acknowledged_at ? 'bg-red-50/50' : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Status/Type indicator */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: isSlotIn ? typeColor.bg : statusColor.bg }}
          >
            {isSlotIn ? (
              <AlertTriangle className="w-5 h-5" style={{ color: typeColor.text }} />
            ) : (
              <Wrench className="w-5 h-5" style={{ color: statusColor.text }} />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-[var(--text)] truncate">{job.title}</p>
              {isSlotIn && !job.acknowledged_at && (
                <SlotInSLABadge
                  createdAt={job.created_at}
                  acknowledgedAt={job.acknowledged_at}
                  slaTargetMinutes={job.sla_target_minutes || 15}
                  size="sm"
                />
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-muted)]">
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {job.customer?.name || 'No customer'}
              </span>
              {job.scheduled_date && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatShortDate(job.scheduled_date)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status badge */}
          <span
            className="px-2 py-1 rounded-lg text-xs font-medium"
            style={{ background: statusColor.bg, color: statusColor.text }}
          >
            {job.status.replace(/_/g, ' ')}
          </span>
          {/* Job type badge */}
          {job.job_type && (
            <span
              className="px-2 py-1 rounded-lg text-xs font-medium"
              style={{ background: typeColor.bg, color: typeColor.text }}
            >
              {job.job_type}
            </span>
          )}
          <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
        </div>
      </div>
    </div>
  );
};
