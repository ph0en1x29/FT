import { useCallback,useEffect,useRef,useState } from 'react';
import { SupabaseDb as MockDb,supabase } from '../../../services/supabaseService';
import { showToast } from '../../../services/toastService';
import { DeletedJob,Job,JobStatus,User,UserRole } from '../../../types';
import { JobWithHelperFlag, StatusCounts } from '../types';

interface UseJobDataProps {
  currentUser: User;
  displayRole: UserRole;
}

interface UseJobDataReturn {
  jobs: JobWithHelperFlag[];
  loading: boolean;
  loadingMore: boolean;
  /**
   * Server-reported count of primary assigned jobs (excludes helper rows).
   * Use for status-count math, not for the load-more guard — for technicians,
   * `jobs.length` includes helpers and may exceed `totalJobs`.
   */
  totalJobs: number;
  /**
   * Whether more pages of primary jobs exist on the server. Driven by
   * `JobsPageResult.hasMore`, which is computed as `to + 1 < total` against
   * the primary-jobs query — so it stays correct even after helper rows are
   * appended client-side.
   */
  hasMoreJobs: boolean;
  /**
   * Status counts computed server-side via parallel HEAD count queries —
   * accurate even when only the first page of jobs is loaded. `null` until
   * the first fetch completes; consumers should fall back to client-side
   * counting on the loaded set in that brief window.
   */
  serverStatusCounts: StatusCounts | null;
  deletedJobs: DeletedJob[];
  isRealtimeConnected: boolean;
  canViewDeleted: boolean;
  fetchJobs: () => Promise<void>;
  loadMoreJobs: () => Promise<void>;
  /**
   * Patch a single job row in local state without triggering a full refetch.
   * Used by mutation handlers (accept, reject, etc.) that already have the
   * freshly updated job row from the service call. Mirrors the
   * setJob({...updated}) pattern in JobDetail — the row from `.select().single()`
   * after a mutation is already the source of truth.
   */
  patchJob: (updated: Job) => void;
}

const JOB_BOARD_PAGE_SIZE = 100;

/**
 * Hook for fetching and managing job data with real-time updates
 */
export function useJobData({ currentUser, displayRole }: UseJobDataProps): UseJobDataReturn {
  const [jobs, setJobs] = useState<JobWithHelperFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalJobs, setTotalJobs] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [serverStatusCounts, setServerStatusCounts] = useState<StatusCounts | null>(null);
  const [deletedJobs, setDeletedJobs] = useState<DeletedJob[]>([]);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

  const canViewDeleted = displayRole === UserRole.ADMIN || displayRole === UserRole.SUPERVISOR;

  // Stable refs for callbacks invoked from inside the realtime channel —
  // avoids re-subscribing every render. The realtime effect runs once with
  // `[]` deps and reads the latest functions through these refs.
  const fetchJobsRef = useRef<(() => Promise<void>) | null>(null);
  const fetchCountsRef = useRef<(() => Promise<void>) | null>(null);
  // Trailing-debounce timer for the count refetch. The realtime stream can
  // emit 5-20 UPDATE/INSERT events per second on a busy day; without this,
  // each one fires 11 parallel HEAD count queries.
  const fetchCountsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-fetch only the server-side status counts (without re-fetching the
  // paginated job list). Used by the realtime handlers below so that
  // INSERT / status-change / soft-delete events keep the QuickStats KPI
  // tiles honest — otherwise the counts would only update when the user
  // manually refreshed or scrolled to load more.
  const fetchCounts = useCallback(async () => {
    try {
      const counts = await MockDb.getJobStatusCounts(currentUser);
      setServerStatusCounts(counts);
    } catch {
      // Silent: a transient count-fetch failure shouldn't show a toast or
      // wipe the previous values. Counts will recover on the next event.
    }
  }, [currentUser]);

  // Debounced wrapper used by realtime handlers. Collapses bursts of UPDATE/
  // INSERT events into one count fetch — KPI tiles lag at most ~750ms behind
  // a status change, which is well within the perception threshold for a
  // multi-user board, in exchange for ~10× fewer count queries.
  const scheduleFetchCounts = useCallback(() => {
    if (fetchCountsDebounceRef.current) {
      clearTimeout(fetchCountsDebounceRef.current);
    }
    fetchCountsDebounceRef.current = setTimeout(() => {
      fetchCountsRef.current?.();
      fetchCountsDebounceRef.current = null;
    }, 750);
  }, []);

  // Fetch jobs function (extracted for reuse).
  // Issues the page query and the server-side status-count query in parallel so
  // the QuickStats KPI tiles reflect every job in the database — not just the
  // first page that's been rendered into `jobs`.
  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const [data, counts] = await Promise.all([
        MockDb.getJobsPage(currentUser, {
          page: 1,
          pageSize: JOB_BOARD_PAGE_SIZE,
        }),
        MockDb.getJobStatusCounts(currentUser),
      ]);
      setJobs(data.jobs as JobWithHelperFlag[]);
      setPage(1);
      setTotalJobs(data.total);
      setHasMore(data.hasMore);
      setServerStatusCounts(counts);

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

  const loadMoreJobs = useCallback(async () => {
    // Guard on server-reported `hasMore` rather than `jobs.length >= totalJobs`.
    // For technicians, `jobs` includes helper rows that aren't counted in
    // `totalJobs`, so the count comparison hides the action prematurely.
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const data = await MockDb.getJobsPage(currentUser, {
        page: nextPage,
        pageSize: JOB_BOARD_PAGE_SIZE,
      });

      setJobs(prev => {
        const seen = new Set(prev.map(job => job.job_id));
        const nextJobs = (data.jobs as JobWithHelperFlag[]).filter(job => !seen.has(job.job_id));
        return [...prev, ...nextJobs];
      });
      setPage(nextPage);
      setTotalJobs(data.total);
      setHasMore(data.hasMore);
    } catch {
      showToast.error('Failed to load older jobs');
    } finally {
      setLoadingMore(false);
    }
  }, [currentUser, hasMore, loadingMore, page]);

  // Keep refs in sync
  fetchJobsRef.current = fetchJobs;
  fetchCountsRef.current = fetchCounts;

  // Initial fetch
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Real-time subscription for job changes — stable deps via ref
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
              if (wasInList) {
                setTotalJobs(prev => Math.max(0, prev - 1));
              }
              return prevJobs.filter(j => j.job_id !== updatedJob.job_id);
            });
            // Re-fetch counts so QuickStats reflects the deletion even when
            // the row wasn't in the loaded page.
            scheduleFetchCounts();
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
          // Re-fetch counts on every UPDATE — status changes, slot-in
          // acknowledgements, escalation flips, etc. can all shift counts.
          // Debounced (~750ms trailing) so a burst of edits collapses into
          // one fetch instead of 11 HEAD queries × N events.
          scheduleFetchCounts();
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
            // Prepend new job instead of full refetch
            setJobs(prevJobs => {
              if (prevJobs.some(j => j.job_id === newJob.job_id)) return prevJobs;
              setTotalJobs(prev => prev + 1);
              return [newJob as JobWithHelperFlag, ...prevJobs];
            });
            // Re-fetch counts so the new row's status and (if applicable) its
            // slot-in pending-ack contribution land in QuickStats. Debounced.
            scheduleFetchCounts();
          }
        }
      )
      .subscribe((status) => {
        setIsRealtimeConnected(status === 'SUBSCRIBED');
      });

    return () => {
      if (fetchCountsDebounceRef.current) {
        clearTimeout(fetchCountsDebounceRef.current);
        fetchCountsDebounceRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  // Stable subscription — no dependency on fetchJobs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patchJob = useCallback((updated: Job) => {
    setJobs(prev => {
      const idx = prev.findIndex(j => j.job_id === updated.job_id);
      if (idx === -1) return prev;
      const next = [...prev];
      // Preserve the JobWithHelperFlag augmentation from the existing row
      next[idx] = { ...prev[idx], ...updated };
      return next;
    });
  }, []);

  return {
    jobs,
    loading,
    loadingMore,
    totalJobs,
    hasMoreJobs: hasMore,
    serverStatusCounts,
    deletedJobs,
    isRealtimeConnected,
    canViewDeleted,
    fetchJobs,
    loadMoreJobs,
    patchJob,
  };
}
