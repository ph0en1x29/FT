import { Calendar,Truck,Wrench,XCircle } from 'lucide-react';
import React from 'react';
import { ServiceHistoryProps } from '../types';

const ServiceHistory: React.FC<ServiceHistoryProps> = ({
  activeJobs,
  openJobs,
  completedJobs,
  cancelledJobs,
  filteredJobs,
  serviceTab,
  setServiceTab,
  showCancelledJobs,
  setShowCancelledJobs,
  canViewCancelled,
  onNavigateToJob,
}) => {
  return (
    <div className="bg-[var(--surface)] rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => { setServiceTab('open'); setShowCancelledJobs(false); }}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            serviceTab === 'open' && !showCancelledJobs
              ? 'text-amber-600 border-b-2 border-amber-600 bg-amber-50/50' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Open ({openJobs.length})
        </button>
        <button
          onClick={() => { setServiceTab('completed'); setShowCancelledJobs(false); }}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            serviceTab === 'completed' && !showCancelledJobs
              ? 'text-green-600 border-b-2 border-green-600 bg-green-50/50' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Completed ({completedJobs.length})
        </button>
        <button
          onClick={() => { setServiceTab('all'); setShowCancelledJobs(false); }}
          className={`flex-1 py-3 text-sm font-medium transition-colors ${
            serviceTab === 'all' && !showCancelledJobs
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' 
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          All ({activeJobs.length})
        </button>
        {cancelledJobs.length > 0 && canViewCancelled && (
          <button
            onClick={() => setShowCancelledJobs(true)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              showCancelledJobs
                ? 'text-red-600 border-b-2 border-red-600 bg-red-50/50' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Cancelled ({cancelledJobs.length})
          </button>
        )}
      </div>

      <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
        {showCancelledJobs ? (
          // Cancelled jobs view
          cancelledJobs.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <XCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No cancelled jobs</p>
            </div>
          ) : (
            cancelledJobs.map(job => (
              <div
                key={job.job_id}
                className="p-3 border border-red-200 bg-red-50/50 rounded-lg"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-slate-600 text-sm line-through truncate">
                      {job.title}
                    </h4>
                    <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{job.description}</p>
                    {job.forklift && (
                      <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                        <Truck className="w-3 h-3" />
                        {job.forklift.serial_number}
                      </p>
                    )}
                  </div>
                  <span className="px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap flex-shrink-0 bg-red-100 text-red-700">
                    Cancelled
                  </span>
                </div>

                {/* Cancellation info */}
                <div className="mt-2 pt-2 border-t border-red-200 text-xs">
                  <div className="flex items-center gap-1 text-red-600">
                    <XCircle className="w-3 h-3" />
                    <span>Cancelled by {job.deleted_by_name || 'Unknown'}</span>
                  </div>
                  {job.deletion_reason && (
                    <div className="mt-1 text-slate-500 italic">
                      Reason: {job.deletion_reason}
                    </div>
                  )}
                  {job.deleted_at && (
                    <div className="mt-1 text-slate-400">
                      {new Date(job.deleted_at).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            ))
          )
        ) : (
          // Normal jobs view
          filteredJobs.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Wrench className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No {serviceTab === 'all' ? '' : serviceTab} jobs</p>
            </div>
          ) : (
            filteredJobs.map(job => (
              <div
                key={job.job_id}
                onClick={() => onNavigateToJob(job.job_id)}
                className="p-3 border border-slate-200 rounded-lg hover:shadow-md hover:border-blue-300 transition cursor-pointer group"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-slate-800 text-sm group-hover:text-blue-600 truncate">
                      {job.title}
                    </h4>
                    <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{job.description}</p>
                    {job.forklift && (
                      <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                        <Truck className="w-3 h-3" />
                        {job.forklift.serial_number}
                      </p>
                    )}
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap flex-shrink-0 ${
                    job.status === 'Completed' ? 'bg-green-100 text-green-700' :
                    job.status === 'Awaiting Finalization' ? 'bg-purple-100 text-purple-700' :
                    job.status === 'In Progress' ? 'bg-amber-100 text-amber-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {job.status}
                  </span>
                </div>

                <div className="flex justify-between items-center text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(job.created_at).toLocaleDateString()}
                  </span>
                  {job.parts_used && job.parts_used.length > 0 && (
                    <span className="flex items-center gap-1">
                      <Wrench className="w-3 h-3" />
                      {job.parts_used.length} parts
                    </span>
                  )}
                </div>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
};

export default ServiceHistory;
