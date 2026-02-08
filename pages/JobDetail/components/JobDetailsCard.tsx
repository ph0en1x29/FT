import { Edit2,FileText } from 'lucide-react';
import React from 'react';
import { Job } from '../../../types';
import { RoleFlags,StatusFlags } from '../types';

interface JobDetailsCardProps {
  job: Job;
  roleFlags: RoleFlags;
  statusFlags: StatusFlags;
  editingJobCarriedOut: boolean;
  jobCarriedOutInput: string;
  recommendationInput: string;
  onJobCarriedOutInputChange: (value: string) => void;
  onRecommendationInputChange: (value: string) => void;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
}

export const JobDetailsCard: React.FC<JobDetailsCardProps> = ({
  job,
  roleFlags,
  statusFlags,
  editingJobCarriedOut,
  jobCarriedOutInput,
  recommendationInput,
  onJobCarriedOutInputChange,
  onRecommendationInputChange,
  onStartEdit,
  onSave,
  onCancel,
}) => {
  const { isHelperOnly } = roleFlags;
  const { isInProgress, isAwaitingFinalization } = statusFlags;

  return (
    <div className="card-premium p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center">
            <FileText className="w-5 h-5 text-[var(--text-muted)]" />
          </div>
          <h3 className="font-semibold text-[var(--text)]">Job Details</h3>
        </div>
        {(isInProgress || isAwaitingFinalization) && !editingJobCarriedOut && !isHelperOnly && (
          <button onClick={onStartEdit} className="btn-premium btn-premium-ghost text-xs">
            <Edit2 className="w-3.5 h-3.5" /> Edit
          </button>
        )}
      </div>
      
      {editingJobCarriedOut ? (
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">Job Carried Out</label>
            <textarea 
              className="input-premium min-h-[100px] resize-none w-full" 
              placeholder="Describe the work performed..." 
              value={jobCarriedOutInput} 
              onChange={(e) => onJobCarriedOutInputChange(e.target.value)} 
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">Recommendation</label>
            <textarea 
              className="input-premium min-h-[80px] resize-none w-full" 
              placeholder="Any recommendations..." 
              value={recommendationInput} 
              onChange={(e) => onRecommendationInputChange(e.target.value)} 
            />
          </div>
          <div className="flex gap-2">
            <button onClick={onSave} className="btn-premium btn-premium-primary flex-1">Save</button>
            <button onClick={onCancel} className="btn-premium btn-premium-secondary">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="label-premium mb-1">Job Carried Out</p>
            <p className="text-[var(--text-secondary)] text-sm">
              {job.job_carried_out || <span className="italic text-[var(--text-muted)]">Not specified</span>}
            </p>
          </div>
          <div>
            <p className="label-premium mb-1">Recommendation</p>
            <p className="text-[var(--text-secondary)] text-sm">
              {job.recommendation || <span className="italic text-[var(--text-muted)]">None</span>}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
