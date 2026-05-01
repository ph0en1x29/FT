import { useCallback,useEffect,useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';
import { showToast } from '../../../services/toastService';
import type { Job, VanStock } from '../../../types';
import { UserRole } from '../../../types';
import { JobDetailState } from './useJobDetailState';
import { useJobRealtime } from './useJobRealtime';

interface UseJobDataParams {
  jobId: string | undefined;
  currentUserId: string;
  currentUserRole: string;
  state: JobDetailState;
}

/**
 * Hook to handle job data loading and real-time subscriptions
 */
export const useJobData = ({ jobId, currentUserId, currentUserRole, state }: UseJobDataParams) => {
  const navigate = useNavigate();
  
  // Destructure stable setters to avoid dependency on entire state object
  const {
    setJob,
    setLoading,
    setNoPartsUsed,
    setActiveRental,
    setIsCurrentUserHelper,
    setHelperAssignmentId,
    setJobRequests,
    setVanStock,
    setAvailableVans,
    lastSeenUpdatedAtRef,
  } = state;

  const loadJob = useCallback(async (opts?: { silent?: boolean }) => {
    if (!jobId) return;
    if (!opts?.silent) setLoading(true);
    try {
      // Step 1: fetch the job row (need data.forklift_id and data.job_van_stock_id
      // before we can fan out the dependent queries).
      const data = await MockDb.getJobById(jobId);
      setJob(data ? { ...data } : null);
      if (!data) return;

      // Step 2: fan out the dependent fetches in parallel. Each branch swallows
      // its own non-critical failures so a missing service record / rental /
      // van stock doesn't kill the whole detail load.
      const isTech = currentUserRole === UserRole.TECHNICIAN;
      const [serviceRecord, rental, vanResult] = await Promise.all([
        MockDb.getJobServiceRecord(jobId).catch(() => null),
        data.forklift_id
          ? MockDb.getActiveRentalForForklift(data.forklift_id).catch(() => null)
          : Promise.resolve(null),
        isTech
          ? Promise.all([
              data.job_van_stock_id
                ? MockDb.getVanStockById(data.job_van_stock_id)
                : MockDb.getVanStockByTechnician(currentUserId),
              MockDb.getActiveVansList(),
            ]).catch(() => [null, [] as VanStock[]] as [VanStock | null, VanStock[]])
          : Promise.resolve([null, [] as VanStock[]] as [VanStock | null, VanStock[]]),
      ]);

      if (serviceRecord) setNoPartsUsed(serviceRecord.no_parts_used || false);
      setActiveRental(rental);

      if (data.helper_assignment) {
        const isHelper = data.helper_assignment.technician_id === currentUserId;
        setIsCurrentUserHelper(isHelper);
        if (isHelper) setHelperAssignmentId(data.helper_assignment.assignment_id);
      } else {
        setIsCurrentUserHelper(false);
        setHelperAssignmentId(null);
      }

      if (isTech) {
        const [vanData, activeVans] = vanResult;
        setVanStock(vanData);
        setAvailableVans(activeVans);
      }
    } catch {
      showToast.error('Failed to load job');
      setJob(null);
    } finally {
      setLoading(false);
    }
  }, [jobId, currentUserId, currentUserRole, setJob, setLoading, setNoPartsUsed, setActiveRental, setIsCurrentUserHelper, setHelperAssignmentId, setVanStock, setAvailableVans]);

  const loadRequests = useCallback(async () => {
    if (!jobId) return;
    try {
      const requests = await MockDb.getJobRequests(jobId);
      setJobRequests(requests);
    } catch {
      showToast.error('Failed to load requests');
    }
  }, [jobId, setJobRequests]);

  const loadVanStock = useCallback(async (jobVanStockId?: string) => {
    if (currentUserRole !== UserRole.TECHNICIAN) return;
    try {
      // Use job's selected van if set, otherwise fall back to tech's default
      const data = jobVanStockId
        ? await MockDb.getVanStockById(jobVanStockId)
        : await MockDb.getVanStockByTechnician(currentUserId);
      setVanStock(data);
    } catch { /* ignore */ }
  }, [currentUserId, currentUserRole, setVanStock]);

  // Use refs to avoid re-subscribing on every callback change
  const loadJobRef = useRef(loadJob);
  const loadRequestsRef = useRef(loadRequests);
  loadJobRef.current = loadJob;
  loadRequestsRef.current = loadRequests;

  // Apply a flat row patch from a realtime event without re-fetching the
  // full DETAIL shape (with media + parts + extra_charges joins). Used when
  // the changed columns don't imply a joined table changed.
  const applyJobPatch = useCallback((patch: Partial<Job>) => {
    setJob(prev => (prev ? ({ ...prev, ...patch } as Job) : prev));
  }, [setJob]);

  // Real-time subscription - use stable callbacks via refs
  useJobRealtime({
    jobId,
    currentUserId,
    lastSeenUpdatedAtRef,
    onJobDeleted: () => navigate('/jobs'),
    onJobUpdated: useCallback((patch, requiresFullReload) => {
      if (requiresFullReload) {
        loadJobRef.current({ silent: true });
      } else {
        applyJobPatch(patch as Partial<Job>);
      }
    }, [applyJobPatch]),
    onRequestsUpdated: useCallback(() => loadRequestsRef.current(), []),
  });

  // Initial data load - only run once when jobId changes
  useEffect(() => {
    loadJob();
    loadRequests();
    loadVanStock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]); // Only depend on jobId, not the callbacks

  return { loadJob, loadRequests, loadVanStock };
};
