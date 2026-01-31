import React from 'react';
import { MapPin, User as UserIcon, Calendar, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { JobType, User } from '../../../types';
import SlotInSLABadge from '../../../components/SlotInSLABadge';
import { JobWithHelperFlag, ResponseTimeState } from '../types';
import { getStatusColor, getJobTypeColor } from '../constants';

interface JobCardProps {
  job: JobWithHelperFlag;
  currentUser: User;
  isTechnician: boolean;
  processingJobId: string | null;
  jobNeedsAcceptance: (job: JobWithHelperFlag) => boolean;
  getResponseTimeRemaining: (job: JobWithHelperFlag) => ResponseTimeState;
  onNavigate: (jobId: string) => void;
  onAccept: (e: React.MouseEvent, jobId: string) => void;
  onReject: (e: React.MouseEvent, jobId: string) => void;
}

/**
 * Individual job card displaying job details with technician actions
 */
export const JobCard: React.FC<JobCardProps> = ({
  job,
  currentUser,
  isTechnician,
  processingJobId,
  jobNeedsAcceptance,
  getResponseTimeRemaining,
  onNavigate,
  onAccept,
  onReject,
}) => {
  return (
    <div 
      onClick={() => onNavigate(job.job_id)}
      className="card-theme p-5 rounded-xl clickable-card group theme-transition"
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex gap-2 flex-wrap">
          <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wide ${getStatusColor(job.status)}`}>
            {job.status}
          </span>
          {job.job_type && (
            <span className={`px-2 py-1 rounded text-xs font-medium border ${getJobTypeColor(job.job_type as JobType)}`}>
              {job.job_type}
            </span>
          )}
          {/* Helper badge for technicians viewing helper assignments */}
          {job._isHelperAssignment && (
            <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-700 border border-purple-200">
              Helper
            </span>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          {job.priority === 'Emergency' && (
            <span className="text-xs font-bold text-red-600 animate-pulse">EMERGENCY</span>
          )}
          {/* Slot-In SLA Badge */}
          {job.job_type === JobType.SLOT_IN && (
            <SlotInSLABadge
              createdAt={job.created_at}
              acknowledgedAt={job.acknowledged_at}
              slaTargetMinutes={job.sla_target_minutes || 15}
              size="sm"
            />
          )}
        </div>
      </div>
      
      <h3 className="font-bold text-lg text-theme group-hover:text-blue-600 mb-1">{job.title}</h3>
      <p className="text-theme-muted text-sm mb-4 line-clamp-2">{job.description}</p>
      
      <div className="space-y-2 text-sm text-theme-muted">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 opacity-60" />
          <span className="truncate">{job.customer?.address || 'No address'}</span>
        </div>
        <div className="flex items-center gap-2">
          <UserIcon className="w-4 h-4 opacity-60" />
          {job.customer ? (
            <span>{job.customer.name}</span>
          ) : (
            <span className="text-amber-600 font-medium flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> No Customer
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 opacity-60" />
          <span>{new Date(job.scheduled_date || job.created_at).toLocaleDateString()}</span>
        </div>
        {job.assigned_technician_name && (
          <div className="flex items-center gap-2 text-blue-600">
            <UserIcon className="w-4 h-4" />
            <span className="font-medium">{job.assigned_technician_name}</span>
          </div>
        )}
      </div>

      {/* On-Call Accept/Reject Buttons for Technicians */}
      {isTechnician && jobNeedsAcceptance(job) && (
        <div className="mt-4 pt-3 border-t border-slate-200">
          {/* Response timer */}
          {job.technician_response_deadline && (
            <div className={`flex items-center gap-1 mb-2 text-xs ${
              getResponseTimeRemaining(job).urgency === 'critical' ? 'text-red-600' :
              getResponseTimeRemaining(job).urgency === 'warning' ? 'text-amber-600' :
              'text-slate-500'
            }`}>
              <Clock className="w-3 h-3" />
              <span>
                {getResponseTimeRemaining(job).isExpired 
                  ? 'Response time expired' 
                  : `Respond within: ${getResponseTimeRemaining(job).text}`}
              </span>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={(e) => onAccept(e, job.job_id)}
              disabled={processingJobId === job.job_id}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              {processingJobId === job.job_id ? 'Accepting...' : 'Accept'}
            </button>
            <button
              onClick={(e) => onReject(e, job.job_id)}
              disabled={processingJobId === job.job_id}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium disabled:opacity-50"
            >
              <XCircle className="w-4 h-4" />
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Show acceptance status for already accepted jobs */}
      {isTechnician && job.assigned_technician_id === currentUser.user_id && job.technician_accepted_at && (
        <div className="mt-3 pt-2 border-t border-green-200">
          <span className="text-xs text-green-600 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Accepted - Ready to start
          </span>
        </div>
      )}
    </div>
  );
};
