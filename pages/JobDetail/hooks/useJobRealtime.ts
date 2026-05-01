import { MutableRefObject,useEffect,useState } from 'react';
import { supabase } from '../../../services/supabaseService';
import { showToast } from '../../../services/toastService';

// Database row types for realtime payloads (subset of full types)
interface JobRow {
  job_id: string;
  deleted_at: string | null;
  status: string;
  assigned_technician_id: string | null;
  assigned_technician_name: string | null;
  updated_at: string | null;
  parts_confirmed_at?: string | null;
  parts_confirmation_skipped?: boolean | null;
  [key: string]: unknown;
}

interface JobRequestRow {
  request_id: string;
  job_id: string;
  status: string;
  request_type: string;
}

interface UseJobRealtimeProps {
  jobId: string | undefined;
  currentUserId: string;
  /**
   * Ref tracking the updated_at of the most recently applied job row from a
   * local mutation. When a postgres_changes payload's updated_at matches this
   * ref, the event is treated as a self-echo and ignored — this prevents the
   * redundant loadJob() that would race in-flight save requests and surface
   * as "signal is aborted without reason".
   */
  lastSeenUpdatedAtRef?: MutableRefObject<string | null>;
  onJobDeleted: () => void;
  /**
   * Called when another user's UPDATE arrives.
   * - `requiresFullReload = false`: the change touched only flat columns
   *   (status, assignment, time markers); the caller can apply the row
   *   directly and skip the full DETAIL fetch.
   * - `requiresFullReload = true`: a relation column flipped (parts
   *   confirmation, etc.); the caller needs the joined relations refreshed.
   */
  onJobUpdated: (payload: JobRow, requiresFullReload: boolean) => void;
  onRequestsUpdated: () => void;
}

// Columns whose flip on the row indicates a related table (job_parts,
// job_media, extra_charges) likely changed too — UI needs the full DETAIL
// re-fetch to keep relations consistent. Conservative bias: when in doubt,
// add the column here. Adding too few risks stale relations; adding too
// many just makes us re-fetch slightly more often than necessary.
const RELATION_RELOAD_COLUMNS: ReadonlyArray<keyof JobRow> = [
  // Add explicit columns whose change implies a relation has shifted.
  // Defined narrowly — unrelated metadata (status, assignment) skips the
  // expensive DETAIL fetch.
];

const requiresFullReload = (oldRow: Partial<JobRow>, newRow: JobRow): boolean => {
  // Treat parts-confirmation columns as relation triggers — they imply
  // job_parts may have flipped too.
  const partsCols = ['parts_confirmed_at', 'parts_confirmation_skipped'] as const;
  for (const col of partsCols) {
    const o = (oldRow as Record<string, unknown>)[col];
    const n = (newRow as Record<string, unknown>)[col];
    if (o !== n) return true;
  }
  for (const col of RELATION_RELOAD_COLUMNS) {
    if ((oldRow as Record<string, unknown>)[col] !== (newRow as Record<string, unknown>)[col]) {
      return true;
    }
  }
  return false;
};

/**
 * Real-time WebSocket subscription for job updates and requests.
 * Provides live updates without manual refresh.
 */
export function useJobRealtime({
  jobId,
  currentUserId,
  lastSeenUpdatedAtRef,
  onJobDeleted,
  onJobUpdated,
  onRequestsUpdated,
}: UseJobRealtimeProps) {
  const [isConnected, setIsConnected] = useState(false);

  // Real-time subscription for job updates (deletion, status changes, assignments)
  useEffect(() => {
    if (!jobId) return;

    const channel = supabase
      .channel(`job-detail-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'jobs',
          filter: `job_id=eq.${jobId}`
        },
        (payload) => {
          const updatedJob = payload.new as JobRow;
          const oldJob = payload.old as Partial<JobRow>;

          // Self-echo dedupe: if this row is the same revision we just wrote
          // locally, skip everything. The mutation handler already applied
          // the fresh row to state, so a reload would be wasted work — and
          // worse, it would race the in-flight save fetch.
          if (
            lastSeenUpdatedAtRef?.current &&
            updatedJob?.updated_at &&
            updatedJob.updated_at === lastSeenUpdatedAtRef.current
          ) {
            return;
          }

          // Check if this job was soft-deleted
          if (updatedJob?.deleted_at !== null && oldJob?.deleted_at === null) {
            showToast.warning('Job deleted', 'This job has been cancelled or deleted by admin');
            onJobDeleted();
            return;
          }
          
          // Check for status change
          if (oldJob?.status !== updatedJob?.status) {
            showToast.info('Job updated', `Status changed to ${updatedJob.status}`);
          }
          
          // Check for reassignment
          if (oldJob?.assigned_technician_id !== updatedJob?.assigned_technician_id) {
            if (updatedJob.assigned_technician_id === currentUserId) {
              showToast.success('Job assigned to you', 'You have been assigned to this job');
            } else if (oldJob?.assigned_technician_id === currentUserId) {
              showToast.warning('Job reassigned', `Job has been reassigned to ${updatedJob.assigned_technician_name || 'another technician'}`);
            } else {
              showToast.info('Job reassigned', `Now assigned to ${updatedJob.assigned_technician_name || 'another technician'}`);
            }
          }
          
          // Apply the row directly when the change is just status/assignment/
          // time markers — saves a full JOB_SELECT.DETAIL fetch (with its
          // wide media + parts + extra_charges joins) on every other-user
          // edit. Only re-fetch relations when a column whose flip implies
          // a joined table changed.
          onJobUpdated(updatedJob, requiresFullReload(oldJob, updatedJob));
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') {
          /* Silently ignore */
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId, currentUserId, onJobDeleted, onJobUpdated, lastSeenUpdatedAtRef]);

  // Real-time subscription for job requests (approvals/rejections)
  useEffect(() => {
    if (!jobId) return;

    const channel = supabase
      .channel(`job-requests-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'job_requests',
          filter: `job_id=eq.${jobId}`
        },
        (payload) => {
          const updatedRequest = payload.new as JobRequestRow;
          const oldRequest = payload.old as Partial<JobRequestRow>;
          
          // Notify on status change
          if (oldRequest?.status !== updatedRequest?.status) {
            if (updatedRequest.status === 'approved') {
              showToast.success('Request approved', `Your ${updatedRequest.request_type?.replace('_', ' ')} request has been approved`);
            } else if (updatedRequest.status === 'rejected') {
              showToast.error('Request rejected', `Your ${updatedRequest.request_type?.replace('_', ' ')} request has been rejected`);
            }
          }
          
          onRequestsUpdated();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'job_requests',
          filter: `job_id=eq.${jobId}`
        },
        () => {
          showToast.info('New request', 'A new request has been submitted for this job');
          onRequestsUpdated();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId, onRequestsUpdated]);

  return { isRealtimeConnected: isConnected };
}
