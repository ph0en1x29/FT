import { useState, useCallback, useEffect } from 'react';
import { User, DeletedJob, UserRole } from '../../../types';
import { SupabaseDb as MockDb, supabase } from '../../../services/supabaseService';
import { showToast } from '../../../services/toastService';
import { Job, JobStatus } from '../../../types';
import { JobWithHelperFlag } from '../types';

interface UseJobDataProps {
  currentUser: User;
  displayRole: UserRole;
}

interface UseJobDataReturn {
  jobs: JobWithHelperFlag[];
  loading: boolean;
  deletedJobs: DeletedJob[];
  isRealtimeConnected: boolean;
  canViewDeleted: boolean;
  fetchJobs: () => Promise<void>;
}

/**
 * Hook for fetching and managing job data with real-time updates
 */
export function useJobData({ currentUser, displayRole }: UseJobDataProps): UseJobDataReturn {
  const [jobs, setJobs] = useState<JobWithHelperFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletedJobs, setDeletedJobs] = useState<DeletedJob[]>([]);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

  const canViewDeleted = displayRole === UserRole.ADMIN || displayRole === UserRole.SUPERVISOR;

  // Fetch jobs function (extracted for reuse)
  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await MockDb.getJobs(currentUser);
      setJobs(data);
      
      // Fetch recently deleted jobs for admin/supervisor
      if (canViewDeleted) {
        try {
          const deleted = await MockDb.getRecentlyDeletedJobs();
          setDeletedJobs(deleted);
        } catch {
          showToast.error('Failed to load deleted jobs');
        }
      }
    } catch {
      showToast.error('Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, [currentUser, canViewDeleted]);

  // Initial fetch
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Real-time subscription for job changes
  useEffect(() => {
    const channel = supabase
      .channel('job-board-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'jobs',
        },
        (payload) => {
          const updatedJob = payload.new as Job;
          const oldJob = payload.old as Partial<Job>;
          
          // Handle soft-deleted jobs
          if (updatedJob?.deleted_at !== null && oldJob?.deleted_at === null) {
            setJobs(prevJobs => {
              const wasInList = prevJobs.some(j => j.job_id === updatedJob.job_id);
              if (wasInList) {
                showToast.info('Job removed', 'A job has been cancelled or deleted');
              }
              return prevJobs.filter(j => j.job_id !== updatedJob.job_id);
            });
            return;
          }
          
          // Handle job status changes - update in place
          setJobs(prevJobs => {
            const jobIndex = prevJobs.findIndex(j => j.job_id === updatedJob.job_id);
            if (jobIndex === -1) return prevJobs;
            
            const previousStatus = prevJobs[jobIndex].status;
            const newStatus = updatedJob.status;
            
            // Show toast for significant status changes
            if (previousStatus !== newStatus) {
              if (newStatus === JobStatus.IN_PROGRESS) {
                showToast.info('Job started', `${updatedJob.title || 'A job'} is now in progress`);
              } else if (newStatus === JobStatus.COMPLETED) {
                showToast.success('Job completed', `${updatedJob.title || 'A job'} has been completed`);
              } else if (newStatus === JobStatus.AWAITING_FINALIZATION) {
                showToast.info('Job awaiting finalization', `${updatedJob.title || 'A job'} needs finalization`);
              }
            }
            
            // Update job assignment notification
            if (updatedJob.assigned_technician_id !== prevJobs[jobIndex].assigned_technician_id && updatedJob.assigned_technician_name) {
              showToast.info('Job assigned', `${updatedJob.title || 'A job'} assigned to ${updatedJob.assigned_technician_name}`);
            }
            
            // Update job in list
            const updatedJobs = [...prevJobs];
            updatedJobs[jobIndex] = { ...updatedJobs[jobIndex], ...updatedJob };
            return updatedJobs;
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'jobs',
        },
        (payload) => {
          const newJob = payload.new as Job;
          if (newJob && !newJob.deleted_at) {
            showToast.info('New job created', newJob.title || 'A new job has been added');
            fetchJobs();
          }
        }
      )
      .subscribe((status) => {
        setIsRealtimeConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [canViewDeleted, fetchJobs]);

  return {
    jobs,
    loading,
    deletedJobs,
    isRealtimeConnected,
    canViewDeleted,
    fetchJobs,
  };
}
