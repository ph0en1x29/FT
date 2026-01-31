import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserRole } from '../../../types';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';
import { showToast } from '../../../services/toastService';
import { useJobRealtime } from './useJobRealtime';
import { JobDetailState } from './useJobDetailState';

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
  const { setJob, setLoading } = state;

  const loadJob = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    try {
      const data = await MockDb.getJobById(jobId);
      setJob(data ? { ...data } : null);
      if (data) {
        const serviceRecord = await MockDb.getJobServiceRecord(jobId);
        if (serviceRecord) state.setNoPartsUsed(serviceRecord.no_parts_used || false);
        if (data.forklift_id) {
          const rental = await MockDb.getActiveRentalForForklift(data.forklift_id);
          state.setActiveRental(rental);
        }
        if (data.helper_assignment) {
          const isHelper = data.helper_assignment.technician_id === currentUserId;
          state.setIsCurrentUserHelper(isHelper);
          if (isHelper) state.setHelperAssignmentId(data.helper_assignment.assignment_id);
        } else {
          state.setIsCurrentUserHelper(false);
          state.setHelperAssignmentId(null);
        }
      }
    } catch {
      showToast.error('Failed to load job');
      setJob(null);
    } finally {
      setLoading(false);
    }
  }, [jobId, currentUserId, setJob, setLoading, state]);

  const loadRequests = useCallback(async () => {
    if (!jobId) return;
    try {
      const requests = await MockDb.getJobRequests(jobId);
      state.setJobRequests(requests);
    } catch {
      showToast.error('Failed to load requests');
    }
  }, [jobId, state]);

  const loadVanStock = useCallback(async () => {
    if (currentUserRole !== UserRole.TECHNICIAN) return;
    try {
      const data = await MockDb.getVanStockByTechnician(currentUserId);
      state.setVanStock(data);
    } catch { /* ignore */ }
  }, [currentUserId, currentUserRole, state]);

  // Real-time subscription
  useJobRealtime({
    jobId,
    currentUserId,
    onJobDeleted: () => navigate('/jobs'),
    onJobUpdated: loadJob,
    onRequestsUpdated: loadRequests,
  });

  // Initial data load
  useEffect(() => {
    loadJob();
    loadRequests();
    loadVanStock();
  }, [loadJob, loadRequests, loadVanStock]);

  return { loadJob, loadRequests, loadVanStock };
};
