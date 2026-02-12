import { useCallback,useEffect,useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';
import { showToast } from '../../../services/toastService';
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
    setAvailableVans 
  } = state;

  const loadJob = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    try {
      const data = await MockDb.getJobById(jobId);
      setJob(data ? { ...data } : null);
      if (data) {
        const serviceRecord = await MockDb.getJobServiceRecord(jobId);
        if (serviceRecord) setNoPartsUsed(serviceRecord.no_parts_used || false);
        if (data.forklift_id) {
          const rental = await MockDb.getActiveRentalForForklift(data.forklift_id);
          setActiveRental(rental);
        }
        if (data.helper_assignment) {
          const isHelper = data.helper_assignment.technician_id === currentUserId;
          setIsCurrentUserHelper(isHelper);
          if (isHelper) setHelperAssignmentId(data.helper_assignment.assignment_id);
        } else {
          setIsCurrentUserHelper(false);
          setHelperAssignmentId(null);
        }
        // Load van stock for the selected van (or tech's default) + available vans list
        if (currentUserRole === UserRole.TECHNICIAN) {
          try {
            const [vanData, allVans] = await Promise.all([
              data.job_van_stock_id
                ? MockDb.getVanStockById(data.job_van_stock_id)
                : MockDb.getVanStockByTechnician(currentUserId),
              MockDb.getAllVanStocks(),
            ]);
            setVanStock(vanData);
            setAvailableVans(allVans.filter(v => v.is_active));
          } catch { /* ignore */ }
        }
      }
    } catch {
      showToast.error('Failed to load job');
      setJob(null);
    } finally {
      setLoading(false);
    }
  }, [jobId, currentUserId, setJob, setLoading, setNoPartsUsed, setActiveRental, setIsCurrentUserHelper, setHelperAssignmentId]);

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

  // Real-time subscription - use stable callbacks via refs
  useJobRealtime({
    jobId,
    currentUserId,
    onJobDeleted: () => navigate('/jobs'),
    onJobUpdated: useCallback(() => loadJobRef.current(), []),
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
