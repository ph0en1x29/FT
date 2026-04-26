import { useCallback } from 'react';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';
import { showToast } from '../../../services/toastService';
import type { HourmeterFlagReason, Job } from '../../../types';
import type { JobDetailState } from './useJobDetailState';

interface UseJobMeterActionsParams {
  state: JobDetailState;
  currentUserId: string;
  currentUserName: string;
}

export function useJobMeterActions({
  state,
  currentUserId,
  currentUserName,
}: UseJobMeterActionsParams) {
  const { job } = state;

  const handleStartEditLabor = useCallback(() => {
    if (!job) return;
    state.setEditingLabor(true);
    state.setLaborCostInput((job.labor_cost || 150).toString());
  }, [job, state]);

  const handleSaveLabor = useCallback(async () => {
    if (!job) return;
    const parsed = parseFloat(state.laborCostInput);
    if (isNaN(parsed) || parsed < 0) {
      showToast.error('Please enter a valid labor cost');
      return;
    }
    try {
      const updated = await MockDb.updateLaborCost(job.job_id, parsed);
      state.setJob({ ...updated } as Job);
      state.setEditingLabor(false);
      state.setLaborCostInput('');
      showToast.success('Labor cost updated');
    } catch (_e) {
      showToast.error('Could not update labor cost');
    }
  }, [job, state]);

  const handleCancelLaborEdit = useCallback(() => {
    state.setEditingLabor(false);
    state.setLaborCostInput('');
  }, [state]);

  const handleStartEditHourmeter = useCallback(() => {
    if (!job) return;
    state.setEditingHourmeter(true);
    state.setHourmeterInput((job.hourmeter_reading || job.forklift?.hourmeter || 0).toString());
  }, [job, state]);

  const handleSaveHourmeter = useCallback(async () => {
    if (!job || !job.forklift_id) return;
    const parsed = parseInt(state.hourmeterInput);
    if (isNaN(parsed) || parsed < 0) {
      showToast.error('Please enter a valid hourmeter reading');
      return;
    }

    const validation = await MockDb.validateHourmeterReading(job.forklift_id, parsed);
    const isFirstRecording = !job.first_hourmeter_recorded_by_id;
    const firstRecordingData = isFirstRecording ? {
      first_hourmeter_recorded_by_id: currentUserId,
      first_hourmeter_recorded_by_name: currentUserName,
      first_hourmeter_recorded_at: new Date().toISOString(),
    } : {};

    if (!validation.isValid) {
      state.setHourmeterFlagReasons(validation.flags);
      try {
        const updated = await MockDb.updateJobHourmeter(job.job_id, parsed);
        await MockDb.flagJobHourmeter(job.job_id, validation.flags);
        if (isFirstRecording) {
          await MockDb.updateJob(job.job_id, firstRecordingData);
        }
        state.setJob({ ...updated, hourmeter_flagged: true, hourmeter_flag_reasons: validation.flags, ...firstRecordingData } as Job);
        state.setEditingHourmeter(false);
        state.setHourmeterInput('');
        showToast.warning('Hourmeter saved with flags', 'This reading has been flagged for review.');
      } catch (e) {
        showToast.error(e instanceof Error ? e.message : 'Could not update hourmeter');
      }
      return;
    }

    try {
      const updated = await MockDb.updateJobHourmeter(job.job_id, parsed);
      if (isFirstRecording) {
        await MockDb.updateJob(job.job_id, firstRecordingData);
      }
      state.setJob({ ...updated, ...firstRecordingData } as Job);
      state.setEditingHourmeter(false);
      state.setHourmeterInput('');
      state.setHourmeterFlagReasons([]);
      showToast.success('Hourmeter updated');
    } catch (e) {
      showToast.error(e instanceof Error ? e.message : 'Could not update hourmeter');
    }
  }, [job, state, currentUserId, currentUserName]);

  const handleCancelHourmeterEdit = useCallback(() => {
    state.setEditingHourmeter(false);
    state.setHourmeterInput('');
  }, [state]);

  const handleSubmitHourmeterAmendment = useCallback(async (amendedReading: number, reason: string) => {
    if (!job || !job.forklift_id) throw new Error('Job or forklift not found');
    const originalReading = job.hourmeter_reading || 0;
    const flagReasons = job.hourmeter_flag_reasons || state.hourmeterFlagReasons;

    await MockDb.createHourmeterAmendment(
      job.job_id,
      job.forklift_id,
      originalReading,
      amendedReading,
      reason,
      flagReasons as HourmeterFlagReason[],
      currentUserId,
      currentUserName
    );

    state.setShowHourmeterAmendmentModal(false);
    showToast.success('Amendment request submitted', 'Waiting for Admin 1 (Service) approval');
  }, [job, state, currentUserId, currentUserName]);

  return {
    handleCancelHourmeterEdit,
    handleCancelLaborEdit,
    handleSaveHourmeter,
    handleSaveLabor,
    handleStartEditHourmeter,
    handleStartEditLabor,
    handleSubmitHourmeterAmendment,
  };
}
