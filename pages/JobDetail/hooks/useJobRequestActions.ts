import { useCallback } from 'react';
import { approveSparePartRequest, createJobRequest, rejectRequest, updateJobRequest, issuePartToTechnician, markOutOfStock, markPartReceived, confirmPartCollection } from '../../../services/jobRequestService';
import { showToast } from '../../../services/toastService';
import { Job, JobRequestType } from '../../../types';
import { JobDetailState } from './useJobDetailState';

interface UseJobRequestActionsParams {
  job: Job | null;
  state: JobDetailState;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
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
  currentUserRole,
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
        currentUserName,
        currentUserRole
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  const handleIssuePartToTechnician = useCallback(async (requestId: string) => {
    try {
      const success = await issuePartToTechnician(requestId, currentUserId, currentUserName, currentUserRole);
      if (success) {
        showToast.success('Part issued', 'Technician has been notified for collection');
        loadJob();
      } else {
        showToast.error('Failed to issue part', 'Check stock availability');
      }
    } catch (e) {
      showToast.error('Error issuing part', (e as Error).message);
    }
  }, [currentUserId, currentUserName, loadJob]);

  const handleMarkOutOfStock = useCallback(async (requestId: string, partId: string, supplierNotes?: string) => {
    try {
      const success = await markOutOfStock(requestId, currentUserId, partId, supplierNotes);
      if (success) {
        showToast.success('Marked out of stock', 'Job set to Pending Parts. Supplier order recorded.');
        loadJob();
      } else {
        showToast.error('Failed to mark out of stock');
      }
    } catch (e) {
      showToast.error('Error', (e as Error).message);
    }
  }, [currentUserId, loadJob]);

  const handleMarkPartReceived = useCallback(async (requestId: string, notes?: string) => {
    try {
      const success = await markPartReceived(requestId, currentUserId, notes);
      if (success) {
        showToast.success('Part received', 'Ready for issuance to technician');
        loadJob();
      } else {
        showToast.error('Failed to mark as received');
      }
    } catch (e) {
      showToast.error('Error', (e as Error).message);
    }
  }, [currentUserId, loadJob]);

  const handleConfirmPartCollection = useCallback(async (requestId: string) => {
    try {
      const success = await confirmPartCollection(requestId, currentUserId);
      if (success) {
        showToast.success('Collection confirmed', 'Part marked as collected');
        loadJob();
      } else {
        showToast.error('Failed to confirm collection');
      }
    } catch (e) {
      showToast.error('Error', (e as Error).message);
    }
  }, [currentUserId, loadJob]);

  const handleBulkApproveRequests = useCallback(async (
    items: { requestId: string; partId: string; quantity: number; notes?: string }[]
  ) => {
    state.setSubmittingApproval(true);
    let success = 0;
    let failed = 0;
    for (const item of items) {
      try {
        const ok = await approveSparePartRequest(
          item.requestId,
          currentUserId,
          item.partId,
          item.quantity,
          item.notes,
          currentUserName,
          currentUserRole
        );
        if (ok) success++;
        else failed++;
      } catch {
        failed++;
      }
    }
    state.setSubmittingApproval(false);
    state.setShowBulkApproveModal(false);
    state.setBulkApproveRequests([]);
    loadJob();
    if (failed === 0) {
      showToast.success(`${success} request${success > 1 ? 's' : ''} approved`, 'Parts added to job');
    } else {
      showToast.error(`${success} approved, ${failed} failed`);
    }
  }, [currentUserId, currentUserName, currentUserRole, loadJob, state]);

  return {
    handleCreateRequest,
    handleApproveRequest,
    handleRejectRequest,
    handleEditRequest,
    handleUpdateRequest,
    handleBulkApproveRequests,
    handleIssuePartToTechnician,
    handleMarkOutOfStock,
    handleMarkPartReceived,
    handleConfirmPartCollection,
  };
};
