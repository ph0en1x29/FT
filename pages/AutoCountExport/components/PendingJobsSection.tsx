import React from 'react';
import { Clock, Download, Send } from 'lucide-react';
import { Job } from '../../../types';

interface PendingJobsSectionProps {
  pendingJobs: Job[];
  selectedJobIds: Set<string>;
  processing: boolean;
  onExportJob: (jobId: string) => Promise<void>;
  onBulkExport: () => Promise<void>;
  onToggleSelection: (jobId: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
}

export function PendingJobsSection({
  pendingJobs,
  selectedJobIds,
  processing,
  onExportJob,
  onBulkExport,
  onToggleSelection,
  onSelectAll,
  onClearSelection,
}: PendingJobsSectionProps) {
  if (pendingJobs.length === 0) return null;

  return (
    <div className="card-theme rounded-xl p-5 theme-transition">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-theme flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-600" />
          Jobs Ready for Export ({pendingJobs.length})
        </h3>
        <div className="flex gap-2">
          <button
            onClick={onSelectAll}
            className="text-xs text-blue-600 hover:underline"
          >
            Select All
          </button>
          {selectedJobIds.size > 0 && (
            <>
              <span className="text-slate-300">|</span>
              <button
                onClick={onClearSelection}
                className="text-xs text-slate-500 hover:underline"
              >
                Clear
              </button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-2 max-h-60 overflow-y-auto">
        {pendingJobs.map((job) => (
          <div
            key={job.job_id}
            className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
              selectedJobIds.has(job.job_id)
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <button
                onClick={() => onToggleSelection(job.job_id)}
                className={`w-5 h-5 rounded border flex items-center justify-center ${
                  selectedJobIds.has(job.job_id)
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-slate-300'
                }`}
              >
                {selectedJobIds.has(job.job_id) && (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <div>
                <p className="font-medium text-sm text-theme">{job.title}</p>
                <p className="text-xs text-theme-muted">
                  {job.customer?.name} • RM {((job.parts_used || []).reduce((sum, p) => sum + (p.sell_price_at_time || 0) * (p.quantity || 0), 0) + (job.labor_cost || 0) + ((job.extra_charges || []).reduce((sum, c) => sum + (c.amount || 0), 0))).toFixed(2)}
                </p>
              </div>
            </div>
            <button
              onClick={() => onExportJob(job.job_id)}
              disabled={processing}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Download className="w-3 h-3" /> Export
            </button>
          </div>
        ))}
      </div>

      {selectedJobIds.size > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-200">
          <button
            onClick={onBulkExport}
            disabled={processing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
          >
            <Send className="w-4 h-4" />
            {processing ? 'Exporting...' : `Export ${selectedJobIds.size} Selected`}
          </button>
        </div>
      )}
    </div>
  );
}
