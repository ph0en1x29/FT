import {
AlertOctagon,
Calendar,
ChevronRight,
Clock,
Gauge,Package,
User as UserIcon,
Wrench,
XCircle
} from 'lucide-react';
import React,{ useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ForkliftServiceEntry } from '../../../types';
import { getJobStatusBadge } from '../utils';

interface ServiceHistorySectionProps {
  activeServices: ForkliftServiceEntry[];
  cancelledJobs: ForkliftServiceEntry[];
  canViewCancelled: boolean;
}

export const ServiceHistorySection: React.FC<ServiceHistorySectionProps> = ({
  activeServices,
  cancelledJobs,
  canViewCancelled,
}) => {
  const navigate = useNavigate();
  const [showCancelledJobs, setShowCancelledJobs] = useState(false);

  return (
    <div className="bg-[var(--surface)] rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <Wrench className="w-5 h-5 text-blue-600" /> Service History ({activeServices.length})
        </h3>
      </div>
      
      <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
        {activeServices.length > 0 ? (
          activeServices.map(job => (
            <div
              key={job.job_id}
              onClick={() => navigate(`/jobs/${job.job_id}`)}
              className="p-3 border border-slate-200 rounded-lg hover:shadow-md hover:border-blue-300 transition cursor-pointer group"
            >
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-slate-800 text-sm group-hover:text-blue-600 truncate">
                    {job.title}
                  </h4>
                  <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{job.description}</p>
                  <p className="text-xs text-slate-400 mt-1">{job.customer?.name}</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap flex-shrink-0 ${getJobStatusBadge(job.status)}`}>
                  {job.status}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(job.created_at).toLocaleDateString()}
                </span>
                {job.hourmeter_reading && (
                  <span className="flex items-center gap-1">
                    <Gauge className="w-3 h-3" />
                    {job.hourmeter_reading} hrs
                  </span>
                )}
                {job.parts_used && job.parts_used.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Package className="w-3 h-3" />
                    {job.parts_used.length}
                  </span>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-10 text-slate-400">
            <Wrench className="w-10 h-10 mx-auto mb-2 opacity-20" />
            <p className="text-sm">No service history yet</p>
          </div>
        )}

        {/* Cancelled Jobs Section */}
        {cancelledJobs.length > 0 && canViewCancelled && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <button
              onClick={(e) => { e.stopPropagation(); setShowCancelledJobs(!showCancelledJobs); }}
              className="w-full flex items-center justify-between p-2 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition"
            >
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-500" />
                <span className="text-sm font-medium text-red-800">Cancelled Jobs ({cancelledJobs.length})</span>
              </div>
              <ChevronRight className={`w-4 h-4 text-red-500 transition-transform ${showCancelledJobs ? 'rotate-90' : ''}`} />
            </button>

            {showCancelledJobs && (
              <div className="mt-3 space-y-2">
                {cancelledJobs.map(job => (
                  <div key={job.job_id} className="p-3 bg-red-50/50 border border-red-200 rounded-lg">
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-slate-600 text-sm line-through opacity-70">
                          {job.title}
                        </h4>
                        <p className="text-xs text-slate-400 line-clamp-1">{job.description}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700 flex-shrink-0">
                        Cancelled
                      </span>
                    </div>

                    <div className="text-xs space-y-1 mt-2 pt-2 border-t border-red-100">
                      <div className="flex items-center gap-2 text-red-700">
                        <UserIcon className="w-3 h-3" />
                        <span>Cancelled by: <span className="font-medium">{job.deleted_by_name || 'Unknown'}</span></span>
                      </div>
                      {job.deletion_reason && (
                        <div className="flex items-start gap-2 text-red-600">
                          <AlertOctagon className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          <span>Reason: {job.deletion_reason}</span>
                        </div>
                      )}
                      {job.hourmeter_before_delete && (
                        <div className="flex items-center gap-2 text-amber-600">
                          <Gauge className="w-3 h-3" />
                          <span>{job.hourmeter_before_delete} hrs recorded (invalidated)</span>
                        </div>
                      )}
                      {job.deleted_at && (
                        <div className="flex items-center gap-2 text-slate-400">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(job.deleted_at).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
