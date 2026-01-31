import React from 'react';
import { Trash2, ChevronRight, Clock } from 'lucide-react';
import { DeletedJob } from '../../../types';

interface DeletedJobsSectionProps {
  deletedJobs: DeletedJob[];
  showSection: boolean;
  onToggle: () => void;
}

/**
 * Expandable section showing recently deleted jobs (admin/supervisor only)
 */
export const DeletedJobsSection: React.FC<DeletedJobsSectionProps> = ({
  deletedJobs,
  showSection,
  onToggle,
}) => {
  if (deletedJobs.length === 0) return null;

  return (
    <div className="mt-8">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition"
      >
        <div className="flex items-center gap-3">
          <Trash2 className="w-5 h-5 text-red-500" />
          <span className="font-semibold text-red-800">Recently Deleted ({deletedJobs.length})</span>
          <span className="text-xs text-red-500">Last 30 days</span>
        </div>
        <ChevronRight className={`w-5 h-5 text-red-500 transition-transform ${showSection ? 'rotate-90' : ''}`} />
      </button>

      {showSection && (
        <div className="mt-3 space-y-3">
          {deletedJobs.map(job => (
            <div
              key={job.job_id}
              className="bg-red-50/50 border border-red-200 rounded-lg p-4"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="font-medium text-slate-800 line-through opacity-60">{job.title}</h4>
                  <p className="text-sm text-slate-500 line-clamp-1">{job.description}</p>
                </div>
                <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700">
                  Cancelled
                </span>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mt-3">
                <div>
                  <span className="text-xs text-slate-400 uppercase">Customer</span>
                  <p className="text-slate-600">{job.customer_name || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-400 uppercase">Equipment</span>
                  <p className="text-slate-600">{job.forklift_serial || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-400 uppercase">Cancelled By</span>
                  <p className="text-slate-600">{job.deleted_by_name || 'Unknown'}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-400 uppercase">Cancelled On</span>
                  <p className="text-slate-600 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(job.deleted_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {job.deletion_reason && (
                <div className="mt-3 p-2 bg-white/50 rounded border border-red-100">
                  <span className="text-xs text-red-600 font-medium">Reason: </span>
                  <span className="text-sm text-slate-700">{job.deletion_reason}</span>
                </div>
              )}

              {job.hourmeter_before_delete && (
                <div className="mt-2 text-xs text-amber-600">
                  ⚠️ Hourmeter {job.hourmeter_before_delete} hrs was recorded but invalidated due to cancellation
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
