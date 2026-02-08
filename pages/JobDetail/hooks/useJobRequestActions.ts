import { useCallback } from 'react';
import { approveSparePartRequest, createJobRequest, rejectRequest, updateJobRequest } from '../../../services/jobRequestService';
import { showToast } from '../../../services/toastService';
import { Job, JobRequestType } from '../../../types';
import { JobDetailState } from './useJobDetailState';

interface UseJobRequestActionsParams {
  job: Job | null;
  state: JobDetailState;
  currentUserId: string;
  currentUserName: string;
  loadJob: () => Promise<void>;
}

/**
 * Hook for job request actions (create, approve, reject, edit, update)
 */
export const useJobRequestActions = ({
  job,
  state,
  currentUserId,
  currentUserName,
  loadJob,
}: UseJobRequestActionsParams) => {
  const handleCreateRequest = useCallback(async (
    type: JobRequestType,
    description: string,
    photoUrl?: string
  ) => {
    if (!job) return;
    state.setSubmittingRequest(true);
    try {
      const result = await createJobRequest(job.job_id, type, currentUserId, description, photoUrl);
      if (result) {
        showToast.success('Request submitted', 'Admin will review your request');
        state.setShowRequestModal(false);
      } else {
        showToast.error('Failed to submit request');
      }
    } catch (e) {
      showToast.error('Error submitting request', (e as Error).message);
    } finally {
      state.setSubmittingRequest(false);
    }
  }, [job, currentUserId, state]);

  const handleApproveRequest = useCallback(async (
    partId: string,
    quantity: number,
    notes?: string
  ) => {
    const request = state.approvalRequest;
    if (!request) return;
    
    state.setSubmittingApproval(true);
    try {
      const success = await approveSparePartRequest(
        request.request_id,
        currentUserId,
        partId,
        quantity,
        notes,
        currentUserName
      );
      if (success) {
        showToast.success('Request approved', 'Part added to job');
        state.setShowApprovalModal(false);
        state.setApprovalRequest(null);
        loadJob(); // Refresh job data to show new parts
      } else {
        showToast.error('Failed to approve request', 'Check part availability');
      }
    } catch (e) {
      showToast.error('Error approving request', (e as Error).message);
    } finally {
      state.setSubmittingApproval(false);
    }
  }, [state, currentUserId, currentUserName, loadJob]);

  const handleRejectRequest = useCallback(async (notes: string) => {
    const request = state.approvalRequest;
    if (!request) return;
    
    state.setSubmittingApproval(true);
    try {
      const success = await rejectRequest(request.request_id, currentUserId, notes);
      if (success) {
        showToast.success('Request rejected', 'Technician has been notified');
        state.setShowApprovalModal(false);
        state.setApprovalRequest(null);
      } else {
        showToast.error('Failed to reject request');
      }
    } catch (e) {
      showToast.error('Error rejecting request', (e as Error).message);
    } finally {
      state.setSubmittingApproval(false);
    }
  }, [state, currentUserId]);

  const handleEditRequest = useCallback((request: any) => {
    state.setEditingRequest(request);
    state.setShowRequestModal(true);
  }, [state]);

  const handleUpdateRequest = useCallback(async (
    requestId: string,
    type: JobRequestType,
    description: string,
    photoUrl?: string
  ) => {
    state.setSubmittingRequest(true);
    try {
      const success = await updateJobRequest(requestId, currentUserId, {
        request_type: type,
        description,
        photo_url: photoUrl || null,
      });
      if (success) {
        showToast.success('Request updated');
        state.setShowRequestModal(false);
        state.setEditingRequest(null);
      } else {
        showToast.error('Failed to update request', 'You can only edit your own pending requests');
      }
    } catch (e) {
      showToast.error('Error updating request', (e as Error).message);
    } finally {
      state.setSubmittingRequest(false);
    }
  }, [currentUserId, state]);

  return {
    handleCreateRequest,
    handleApproveRequest,
    handleRejectRequest,
    handleEditRequest,
    handleUpdateRequest,
  };
};
