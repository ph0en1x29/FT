import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkServiceUpgradeNeeded, declineServiceUpgrade, upgradeToFullService } from '../../../services/serviceTrackingService';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';
import { showToast } from '../../../services/toastService';
import { ForkliftConditionChecklist, Job, JobStatus } from '../../../types';
import { getMissingMandatoryItems } from '../utils';
import { JobDetailState } from './useJobDetailState';

interface UseJobStatusActionsParams {
  job: Job | null;
  state: JobDetailState;
  currentUserId: string;
  currentUserName: string;
  loadJob: () => Promise<void>;
  setJob: (j: Job | null | ((prev: Job | null) => Job | null)) => void;
}

/**
 * Hook for job status/lifecycle actions:
 * accept, reject, start, status change, service upgrade,
 * continue tomorrow, resume, finalize, delete, deferred completion, acknowledge
 */
export const useJobStatusActions = ({
  job,
  state,
  currentUserId,
  currentUserName,
  loadJob,
  setJob,
}: UseJobStatusActionsParams) => {
  const navigate = useNavigate();

  const {
    rejectJobReason,
    setShowRejectJobModal,
    setRejectJobReason,
    setStartJobHourmeter,
    setConditionChecklist,
    setShowStartJobModal,
    startJobHourmeter,
    conditionChecklist,
    setMissingChecklistItems,
  } = state;

  // Accept/Reject job handlers
  const handleAcceptJob = useCallback(async () => {
    if (!job) return;
    try {
      const updated = await MockDb.acceptJobAssignment(job.job_id, currentUserId, currentUserName);
      setJob(updated as Job);
      showToast.success('Job accepted', 'You can now start the job when ready.');
    } catch (e) {
      showToast.error('Failed to accept job', (e as Error).message);
    }
  }, [job, currentUserId, currentUserName, setJob]);

  const handleRejectJob = useCallback(async () => {
    if (!job || !rejectJobReason.trim()) {
      showToast.error('Please provide a reason for rejecting this job');
      return;
    }
    try {
      await MockDb.rejectJobAssignment(job.job_id, currentUserId, currentUserName, rejectJobReason.trim());
      showToast.success('Job rejected', 'Admin has been notified for reassignment.');
      setShowRejectJobModal(false);
      setRejectJobReason('');
      navigate('/jobs');
    } catch (e) {
      showToast.error('Failed to reject job', (e as Error).message);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job, currentUserId, currentUserName, state, navigate]);

  // Start job handlers
  const handleOpenStartJobModal = useCallback(async () => {
    if (!job) return;

    // Check if this is a Minor Service on an overdue unit
    if (job.job_type === 'Minor Service' && job.forklift_id) {
      try {
        const upgradePrompt = await checkServiceUpgradeNeeded(
          job.forklift_id,
          job.job_id,
          job.job_type
        );

        if (upgradePrompt) {
          // Show upgrade prompt instead of start job modal
          state.setServiceUpgradePrompt(upgradePrompt);
          return;
        }
      } catch (error) {
        console.error('Failed to check service upgrade:', error);
        // Continue with normal flow if check fails
      }
    }

    setStartJobHourmeter((job.forklift?.hourmeter || 0).toString());
    setConditionChecklist({});
    setShowStartJobModal(true);
  }, [job, state, setStartJobHourmeter, setConditionChecklist, setShowStartJobModal]);

  const handleChecklistToggle = useCallback((key: string) => {
    setConditionChecklist(prev => ({ ...prev, [key]: !prev[key as keyof ForkliftConditionChecklist] }));
  }, [setConditionChecklist]);

  const handleConditionCheckAll = useCallback(() => {
    const allChecked: Partial<ForkliftConditionChecklist> = {};
    const allKeys = [
      'drive_front_axle', 'drive_rear_axle', 'drive_motor_engine', 'drive_controller_transmission',
      'hydraulic_pump', 'hydraulic_control_valve', 'hydraulic_hose', 'hydraulic_oil_level',
      'braking_brake_pedal', 'braking_parking_brake', 'braking_fluid_pipe', 'braking_master_pump',
      'electrical_ignition', 'electrical_battery', 'electrical_wiring', 'electrical_instruments',
      'steering_wheel_valve', 'steering_cylinder', 'steering_motor', 'steering_knuckle',
      'load_fork', 'load_mast_roller', 'load_chain_wheel', 'load_cylinder',
      'tyres_front', 'tyres_rear', 'tyres_rim', 'tyres_screw_nut',
      'wheels_drive', 'wheels_load', 'wheels_support', 'wheels_hub_nut',
      'safety_overhead_guard', 'safety_backrest', 'safety_lights', 'safety_horn_alarm'
    ];
    allKeys.forEach(key => { allChecked[key as keyof ForkliftConditionChecklist] = true; });
    setConditionChecklist(allChecked as ForkliftConditionChecklist);
  }, [setConditionChecklist]);

  const handleConditionUncheckAll = useCallback(() => {
    setConditionChecklist({} as ForkliftConditionChecklist);
  }, [setConditionChecklist]);

  const handleStartJobWithCondition = useCallback(async () => {
    if (!job) return;
    const hourmeter = parseInt(startJobHourmeter);
    if (isNaN(hourmeter) || hourmeter < 0) {
      showToast.error('Please enter a valid hourmeter reading');
      return;
    }
    const currentForkliftHourmeter = job.forklift?.hourmeter || 0;
    if (hourmeter < currentForkliftHourmeter) {
      showToast.error(`Hourmeter must be ≥ ${currentForkliftHourmeter} (forklift's current reading)`);
      return;
    }
    try {
      const updated = await MockDb.startJobWithCondition(job.job_id, hourmeter, conditionChecklist, currentUserId, currentUserName);
      setJob({ ...updated } as Job);
      setShowStartJobModal(false);
      showToast.success('Job started', 'Status changed to In Progress');
    } catch (error) {
      showToast.error('Failed to start job', (error as Error).message);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job, state, currentUserId, currentUserName, setJob]);

  // Service upgrade handlers (Minor Service → Full Service)
  const handleServiceUpgrade = useCallback(async () => {
    if (!job) return;
    try {
      await upgradeToFullService(job.job_id, currentUserId, currentUserName);
      await loadJob(); // Reload to get updated job type
      state.setServiceUpgradePrompt(prev => ({ ...prev, show: false }));
      showToast.success('Job upgraded to Full Service', 'The service checklist has been updated.');
      // Now open the start job modal
      setStartJobHourmeter((job.forklift?.hourmeter || 0).toString());
      setConditionChecklist({});
      setShowStartJobModal(true);
    } catch (error) {
      showToast.error('Failed to upgrade job', (error as Error).message);
    }
  }, [job, currentUserId, currentUserName, loadJob, state, setStartJobHourmeter, setConditionChecklist, setShowStartJobModal]);

  const handleDeclineServiceUpgrade = useCallback(async () => {
    if (!job) return;
    const prompt = state.serviceUpgradePrompt;
    try {
      await declineServiceUpgrade(
        job.job_id,
        prompt.forklift_id,
        currentUserId,
        currentUserName,
        prompt.current_hourmeter,
        prompt.target_hourmeter,
        prompt.original_job_type
      );
      state.setServiceUpgradePrompt(prev => ({ ...prev, show: false }));
      showToast.info('Continuing as Minor Service', 'Unit will remain flagged as Service Due.');
      // Open the start job modal
      setStartJobHourmeter((job.forklift?.hourmeter || 0).toString());
      setConditionChecklist({});
      setShowStartJobModal(true);
    } catch (error) {
      showToast.error('Failed to log decision', (error as Error).message);
    }
  }, [job, currentUserId, currentUserName, state, setStartJobHourmeter, setConditionChecklist, setShowStartJobModal]);

  // Status change handler
  const handleStatusChange = useCallback(async (newStatus: JobStatus) => {
    if (!job) return;
    if (newStatus === JobStatus.AWAITING_FINALIZATION) {
      const missing = getMissingMandatoryItems(job);
      if (missing.length > 0) {
        setMissingChecklistItems(missing);
        state.setShowChecklistWarningModal(true);
        return;
      }
    }
    try {
      const updated = await MockDb.updateJobStatus(job.job_id, newStatus, currentUserId, currentUserName);
      setJob({ ...updated } as Job);
      showToast.success(`Status updated to ${newStatus}`);
    } catch (error) {
      showToast.error('Failed to update status', (error as Error).message);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job, state, currentUserId, currentUserName, setJob]);

  // Acknowledgement handler
  const handleAcknowledgeJob = useCallback(async () => {
    if (!job) return;
    try {
      const updated = await MockDb.updateJob(job.job_id, {
        acknowledged_at: new Date().toISOString(),
        acknowledged_by_id: currentUserId,
        acknowledged_by_name: currentUserName,
      });
      setJob({ ...updated } as Job);
      showToast.success('Job acknowledged', 'SLA timer stopped');
    } catch (error) {
      showToast.error('Failed to acknowledge job', (error as Error).message);
    }
  }, [job, currentUserId, currentUserName, setJob]);

  // Continue tomorrow handlers
  const handleContinueTomorrow = useCallback(async () => {
    if (!job || !state.continueTomorrowReason.trim()) return;
    state.setSubmittingContinue(true);
    try {
      const success = await MockDb.markJobContinueTomorrow(job.job_id, state.continueTomorrowReason, currentUserId, currentUserName);
      if (success) {
        showToast.success('Job marked to continue tomorrow');
        state.setShowContinueTomorrowModal(false);
        state.setContinueTomorrowReason('');
        loadJob();
      } else {
        showToast.error('Failed to update job');
      }
    } catch (_e) {
      showToast.error('Error updating job');
    } finally {
      state.setSubmittingContinue(false);
    }
  }, [job, state, currentUserId, currentUserName, loadJob]);

  const handleResumeJob = useCallback(async () => {
    if (!job) return;
    try {
      const success = await MockDb.resumeMultiDayJob(job.job_id, currentUserId, currentUserName);
      if (success) {
        showToast.success('Job resumed');
        loadJob();
      } else {
        showToast.error('Failed to resume job');
      }
    } catch (_e) {
      showToast.error('Error resuming job');
    }
  }, [job, currentUserId, currentUserName, loadJob]);

  // Finalize invoice handler
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
      setJob({ ...updated } as Job);
      state.setShowFinalizeModal(false);
      showToast.success('Invoice finalized');
    } catch (e) {
      showToast.error('Could not finalize invoice', (e as Error).message);
    }
  }, [job, state, currentUserId, currentUserName, setJob]);

  // Delete job handler
  const handleDeleteJob = useCallback(async () => {
    if (!job) return;
    if (!state.deletionReason.trim()) {
      showToast.error('Please provide a reason for deleting this job');
      return;
    }
    try {
      await MockDb.deleteJob(job.job_id, currentUserId, currentUserName, state.deletionReason.trim());
      state.setShowDeleteModal(false);
      showToast.success('Job deleted');
      navigate('/jobs');
    } catch (e) {
      showToast.error('Could not delete job', (e as Error).message);
    }
  }, [job, state, currentUserId, currentUserName, navigate]);

  // Deferred Completion handler
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
      if (result.success) {
        showToast.success('Job marked as completed', 'Pending customer acknowledgement');
        state.setShowDeferredModal(false);
        state.setDeferredReason('');
        state.setDeferredHourmeter('');
        state.setSelectedEvidenceIds([]);
        loadJob();
      } else {
        showToast.error('Failed to complete job');
      }
    } catch (e) {
      showToast.error('Error completing job', (e as Error).message);
    } finally {
      state.setSubmittingDeferred(false);
    }
  }, [job, state, currentUserId, currentUserName, loadJob]);

  return {
    handleAcceptJob,
    handleRejectJob,
    handleOpenStartJobModal,
    handleChecklistToggle,
    handleConditionCheckAll,
    handleConditionUncheckAll,
    handleStartJobWithCondition,
    handleServiceUpgrade,
    handleDeclineServiceUpgrade,
    handleStatusChange,
    handleAcknowledgeJob,
    handleContinueTomorrow,
    handleResumeJob,
    handleFinalizeInvoice,
    handleDeleteJob,
    handleDeferredCompletion,
  };
};
