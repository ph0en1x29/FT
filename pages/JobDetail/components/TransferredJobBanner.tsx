/**
 * TransferredJobBanner — KPI Engine Phase 3 polish.
 *
 * Shown at the top of the JobDetail page when the job is the *parent* of a
 * Transfer (status = 'Incomplete - Reassigned' AND a clone exists with
 * parent_job_id pointing here). Makes it explicit to anyone viewing the
 * parent that:
 *   1. This job is frozen (view only — no actions can be taken on it)
 *   2. The active work continues on the clone (link provided)
 *
 * Backs up the architectural decision per spec §3.2 + Q2 client confirmation
 * (2026-05-03): receiving tech "can view everything, including parts used by
 * Tech A in the job, but cannot make changes to any records created before
 * the transfer."
 */

import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Lock } from 'lucide-react';
import React from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../services/supabaseClient';

interface TransferredJobBannerProps {
  jobId: string;
}

interface CloneRow {
  job_id: string;
  job_number: string;
  assigned_technician_name: string | null;
  status: string;
}

const TransferredJobBanner: React.FC<TransferredJobBannerProps> = ({ jobId }) => {
  const { data: clones = [] } = useQuery({
    queryKey: ['job-clones', jobId],
    queryFn: async (): Promise<CloneRow[]> => {
      const { data, error } = await supabase
        .from('jobs')
        .select('job_id, job_number, assigned_technician_name, status')
        .eq('parent_job_id', jobId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as CloneRow[];
    },
    staleTime: 60_000,
  });

  if (clones.length === 0) return null;
  const latest = clones[0];

  return (
    <div className="card-premium p-3 mb-4 border border-amber-200 bg-amber-50 flex items-start gap-3">
      <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
      <div className="flex-1 text-sm">
        <p className="font-medium text-amber-800">
          This job has been transferred — view only
        </p>
        <p className="text-xs text-amber-700 mt-1">
          All work has moved to the new job. The records here (parts, notes, history) are
          preserved as a snapshot at the moment of transfer; they cannot be modified.
          The receiving technician now owns the clone below.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {clones.map((c) => (
            <Link
              key={c.job_id}
              to={`/jobs/${c.job_id}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 transition"
            >
              {c.job_number}
              {c.assigned_technician_name && ` · ${c.assigned_technician_name}`}
              <ArrowRight className="w-3 h-3" />
            </Link>
          ))}
        </div>
        {clones.length > 1 && (
          <p className="text-[11px] text-amber-700 mt-1.5">
            {clones.length} clones exist. The latest ({latest.job_number}) is where current work lives.
          </p>
        )}
      </div>
    </div>
  );
};

export default TransferredJobBanner;
