import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';
import { showToast } from '../../../services/toastService';
import type { Job } from '../../../types';
import { JobStatus } from '../../../types';
import { getMissingMandatoryItems, isChecklistExemptJob, isHourmeterExemptJob } from '../utils';
import type { JobDetailState } from './useJobDetailState';

interface UseJobStatusActionsParams {
  state: JobDetailState;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
}

export function useJobStatusActions({
  state,
  currentUserId,
  currentUserName,
  currentUserRole,
}: UseJobStatusActionsParams) {
  const navigate = useNavigate();
  const { job } = state;

  const handleStatusChange = useCallback(async (newStatus: JobStatus) => {
    if (!job) return;
    if (newStatus === JobStatus.AWAITING_FINALIZATION) {
      const isHourmeterExempt = isHourmeterExemptJob(job.job_type);
      const isHelper = state.isCurrentUserHelper;
      if (!isHourmeterExempt && !isHelper && !job.hourmeter_reading) {
        showToast.error('Hourmeter reading required', 'Please record the hourmeter reading before completing the job');
        return;
      }
      if (!isHourmeterExempt && !isHelper) {
        const startReading = job.forklift?.hourmeter || 0;
        if (job.hourmeter_reading && job.hourmeter_reading < startReading && startReading > 0) {
          showToast.error('Invalid hourmeter reading', 'Hourmeter reading cannot be lower than the start reading');
          return;
        }
      }
      const hasAfterPhoto = job.media?.some(m => m.category === 'after');
      if (!hasAfterPhoto) {
        showToast.error('After photo required', 'Please upload at least one "After" photo of the forklift before completing');
        return;
      }
      if (!job.technician_signature || !job.customer_signature) {
        showToast.error('Signatures required', 'Both technician and customer signatures are required');
        return;
      }
      if (currentUserRole === 'technician' && !state.isCurrentUserHelper) {
        const partsDeclared = (job.parts_used?.length ?? 0) > 0 || state.noPartsUsed;
        if (!partsDeclared) {
          showToast.error(
            'Parts declaration required',
            'Add the parts used or tick "No parts were used" before completing the job'
          );
          return;
        }
      }

      const activeParts = (job.parts_used ?? []).filter(
        p => p.return_status !== 'pending_return' && p.return_status !== 'returned'
      );
      const hasActiveParts = activeParts.length > 0;
      const hasAnyPartsRow = (job.parts_used?.length ?? 0) > 0;

      if (currentUserRole === 'technician' && !state.isCurrentUserHelper) {
        const sparePartPhotoCount = (job.media?.filter(m => m.category === 'spare_part').length ?? 0);
        if (sparePartPhotoCount > 0 && !hasActiveParts && state.noPartsUsed) {
          showToast.error(
            'Parts photo conflicts with "No parts used"',
            `You uploaded ${sparePartPhotoCount} photo(s) tagged as "Parts" but ticked "No parts used". Either add the parts you used to the Used Parts list, or re-tag the photo(s) as Condition / Evidence / Other.`
          );
          return;
        }
      }

      const approvedRequests = state.jobRequests.filter(
        r => r.request_type === 'spare_part' && (r.status === 'approved' || r.status === 'issued')
      );
      if (approvedRequests.length > 0 && !hasAnyPartsRow) {
        showToast.error(
          'Approved parts not recorded',
          'Parts have been approved for this job but the Used Parts list is empty. Ask an admin to re-add the approved part, or have it returned to inventory before completing.'
        );
        return;
      }

      if (!isChecklistExemptJob(job.job_type) && !isHelper) {
        const missing = getMissingMandatoryItems(job);
        if (missing.length > 0) {
          state.setMissingChecklistItems(missing);
          state.setShowChecklistWarningModal(true);
          return;
        }
      }
    }
    try {
      const updated = await MockDb.updateJobStatus(job.job_id, newStatus, currentUserId, currentUserName);
      state.setJob({ ...updated } as Job);
      showToast.success(`Status updated to ${newStatus}`);

      if (newStatus === JobStatus.AWAITING_FINALIZATION && currentUserRole === 'technician') {
        navigate('/');
      }
    } catch (error) {
      showToast.error('Failed to update status', (error as Error).message, error, { action_target: 'job', target_id: job?.job_id });
    }
  }, [job, state, currentUserId, currentUserName, currentUserRole, navigate]);

  return { handleStatusChange };
}
