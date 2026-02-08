import { AlertTriangle,ChevronRight,Clock,Package,Wrench } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Job,JobType } from '../../../types';
import { getJobTypeTone,getStatusTone } from '../utils/jobStyles';

interface JobCardProps {
  job: Job;
}

const getJobTypeIcon = (type?: string) => {
  switch (type) {
    case JobType.SLOT_IN:
      return <AlertTriangle className="w-5 h-5" />;
    case JobType.COURIER:
      return <Package className="w-5 h-5" />;
    default:
      return <Wrench className="w-5 h-5" />;
  }
};

const JobCard: React.FC<JobCardProps> = ({ job }) => {
  const navigate = useNavigate();
  const statusTone = getStatusTone(job.status);
  const typeTone = getJobTypeTone(job.job_type);

  return (
    <div
      onClick={() => navigate(`/jobs/${job.job_id}`)}
      className="p-4 cursor-pointer hover:bg-theme-surface-2 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Job Type Icon */}
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${typeTone.bg} ${typeTone.text}`}
          >
            {getJobTypeIcon(job.job_type)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-theme truncate">
                {job.job_number || job.title}
              </p>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-theme-muted">
              <span>{job.customer?.name || 'No customer'}</span>
              {job.forklift && (
                <span>&middot; {job.forklift.model || job.forklift.serial_number}</span>
              )}
              {job.scheduled_date && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(job.scheduled_date).toLocaleDateString('en-MY', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Status badge */}
          <span
            className={`px-2 py-1 rounded-lg text-xs font-medium whitespace-nowrap ${statusTone.bg} ${statusTone.text}`}
          >
            {job.status.replace(/_/g, ' ')}
          </span>
          {/* Job type badge */}
          {job.job_type && (
            <span
              className={`px-2 py-1 rounded-lg text-xs font-medium whitespace-nowrap ${typeTone.bg} ${typeTone.text}`}
            >
              {job.job_type}
            </span>
          )}
          <ChevronRight className="w-4 h-4 text-theme-muted flex-shrink-0" />
        </div>
      </div>
    </div>
  );
};

export default JobCard;
