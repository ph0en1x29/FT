import { useEffect, useState } from 'react';
import { supabase } from '../../../services/supabaseService';
import { showToast } from '../../../services/toastService';

interface UseJobRealtimeProps {
  jobId: string | undefined;
  currentUserId: string;
  onJobDeleted: () => void;
  onJobUpdated: () => void;
  onRequestsUpdated: () => void;
}

/**
 * Real-time WebSocket subscription for job updates and requests.
 * Provides live updates without manual refresh.
 */
export function useJobRealtime({
  jobId,
  currentUserId,
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
          const updatedJob = payload.new as any;
          const oldJob = payload.old as any;
          
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
          
          // Reload job to get fresh data with all relations
          onJobUpdated();
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') {
          console.log('[JobDetail] ✅ Real-time connected for job:', jobId);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId, currentUserId, onJobDeleted, onJobUpdated]);

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
          const updatedRequest = payload.new as any;
          const oldRequest = payload.old as any;
          
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
