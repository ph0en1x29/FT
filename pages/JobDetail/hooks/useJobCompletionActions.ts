import { useCallback } from 'react';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';
import { showToast } from '../../../services/toastService';
import type { Job } from '../../../types';
import type { JobDetailState } from './useJobDetailState';

interface UseJobCompletionActionsParams {
  state: JobDetailState;
  currentUserId: string;
  currentUserName: string;
}

export function useJobCompletionActions({
  state,
  currentUserId,
  currentUserName,
}: UseJobCompletionActionsParams) {
  const { job } = state;

  const handleContinueTomorrow = useCallback(async () => {
    if (!job || !state.continueTomorrowReason.trim()) return;
    state.setSubmittingContinue(true);
    try {
      const updated = await MockDb.markJobContinueTomorrow(job.job_id, state.continueTomorrowReason, currentUserId, currentUserName);
      if (updated) {
        state.setJob({ ...updated });
        showToast.success('Job marked to continue tomorrow');
        state.setShowContinueTomorrowModal(false);
        state.setContinueTomorrowReason('');
      } else {
        showToast.error('Failed to update job');
      }
    } catch (_e) {
      showToast.error('Error updating job');
    } finally {
      state.setSubmittingContinue(false);
    }
  }, [job, state, currentUserId, currentUserName]);

  const handleResumeJob = useCallback(async () => {
    if (!job) return;
    try {
      const updated = await MockDb.resumeMultiDayJob(job.job_id, currentUserId, currentUserName);
      if (updated) {
        state.setJob({ ...updated });
        showToast.success('Job resumed');
      } else {
        showToast.error('Failed to resume job');
      }
    } catch (_e) {
      showToast.error('Error resuming job');
    }
  }, [job, currentUserId, currentUserName, state]);

  const handleFinalizeInvoice = useCallback(async () => {
    if (!job) return;
    const needsPartsVerification = job.parts_used.length > 0 && !job.parts_confirmation_skipped;
    if (needsPartsVerification && !job.parts_confirmed_at) {
      showToast.error('Store Verification Pending', 'Admin 2 (Store) must verify parts before final service closure.');
      state.setShowFinalizeModal(false);
      return;
    }
    try {
      const updated = await MockDb.finalizeInvoice(job.job_id, currentUserId, currentUserName);
      state.setJob({ ...updated } as Job);
      state.setShowFinalizeModal(false);
      showToast.success('Invoice finalized');
    } catch (e) {
      showToast.error('Could not finalize invoice', (e as Error).message, e, { action_target: 'job', target_id: job?.job_id });
    }
  }, [job, state, currentUserId, currentUserName]);

  const handleDeferredCompletion = useCallback(async () => {
    if (!job) return;
    if (!state.deferredReason.trim() || state.selectedEvidenceIds.length === 0) {
      showToast.error('Please provide reason and select evidence photos');
      return;
    }
    state.setSubmittingDeferred(true);
    try {
      const hourmeter = parseInt(state.deferredHourmeter) || undefined;
      const result = await MockDb.completeDeferredAcknowledgement(
        job.job_id,
        state.deferredReason,
        state.selectedEvidenceIds,
        hourmeter,
        currentUserId,
        currentUserName
      );
      if (result.success && result.job) {
        state.setJob({ ...result.job });
        showToast.success('Job marked as completed', 'Pending customer acknowledgement');
        state.setShowDeferredModal(false);
        state.setDeferredReason('');
        state.setDeferredHourmeter('');
        state.setSelectedEvidenceIds([]);
      } else {
        showToast.error('Failed to complete job');
      }
    } catch (e) {
      showToast.error('Error completing job', (e as Error).message, e, { action_target: 'job', target_id: job?.job_id });
    } finally {
      state.setSubmittingDeferred(false);
    }
  }, [job, state, currentUserId, currentUserName]);

  return {
    handleContinueTomorrow,
    handleDeferredCompletion,
    handleFinalizeInvoice,
    handleResumeJob,
  };
}
