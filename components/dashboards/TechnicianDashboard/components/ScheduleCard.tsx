import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, MapPin, ChevronRight, Truck } from 'lucide-react';
import { Job, JobType } from '../types';
import { getStatusColor, getJobTypeColor, isJobOverdue, formatScheduledTime } from '../helpers';
import SlotInSLABadge from '../../../SlotInSLABadge';

interface ScheduleCardProps {
  job: Job;
}

/**
 * Individual job card in Today's Schedule carousel
 */
export const ScheduleCard: React.FC<ScheduleCardProps> = ({ job }) => {
  const navigate = useNavigate();

  const isSlotIn = job.job_type === JobType.SLOT_IN;
  const isUnacknowledged = isSlotIn && !job.acknowledged_at;
  const overdue = isJobOverdue(job);
  const typeColor = getJobTypeColor(job.job_type);
  const statusColor = getStatusColor(job.status);

  return (
    <div
      onClick={() => navigate(`/jobs/${job.job_id}`)}
      className={`schedule-card ${isUnacknowledged ? 'urgent' : ''} ${overdue ? 'overdue' : ''}`}
    >
      {/* Job Type Badge */}
      <div className="flex items-center justify-between mb-3">
        <span
          className="px-2 py-1 rounded-lg text-xs font-medium"
          style={{ background: typeColor.bg, color: typeColor.text }}
        >
          {job.job_type || 'Job'}
        </span>
        {isUnacknowledged && (
          <SlotInSLABadge
            createdAt={job.created_at}
            acknowledgedAt={job.acknowledged_at}
            slaTargetMinutes={job.sla_target_minutes || 15}
            size="sm"
          />
        )}
      </div>

      {/* Job Title */}
      <h3 className="font-medium text-[var(--text)] truncate mb-1">{job.title}</h3>

      {/* Customer & Location */}
      <div className="flex items-center gap-1 text-xs text-[var(--text-muted)] mb-2">
        <MapPin className="w-3 h-3 flex-shrink-0" />
        <span className="truncate">{job.customer?.name || 'No customer'}</span>
      </div>

      {/* Scheduled Time */}
      {job.scheduled_date && (
        <div className="flex items-center gap-1 text-xs text-[var(--text-muted)] mb-2">
          <Clock className="w-3 h-3 flex-shrink-0" />
          <span>{formatScheduledTime(job.scheduled_date)}</span>
          {overdue && (
            <span className="ml-1 px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">
              Overdue
            </span>
          )}
        </div>
      )}

      {/* Forklift Info */}
      {job.forklift && (
        <div className="flex items-center gap-1 text-xs text-[var(--text-muted)] mb-3">
          <Truck className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">
            {job.forklift.serial_number} • {job.forklift.make} {job.forklift.model}
          </span>
        </div>
      )}

      {/* Status Badge */}
      <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]">
        <span
          className="px-2 py-1 rounded-lg text-xs font-medium"
          style={{ background: statusColor.bg, color: statusColor.text }}
        >
          {job.status.replace(/_/g, ' ')}
        </span>
        <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
      </div>
    </div>
  );
};
