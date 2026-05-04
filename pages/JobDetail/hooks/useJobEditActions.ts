import { useCallback } from 'react';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';
import { showToast } from '../../../services/toastService';
import type { ForkliftConditionChecklist, Job, JobType } from '../../../types';
import type { JobDetailState } from './useJobDetailState';

interface UseJobEditActionsParams {
  state: JobDetailState;
  currentUserId: string;
  currentUserName: string;
}

export function useJobEditActions({
  state,
  currentUserId,
  currentUserName,
}: UseJobEditActionsParams) {
  const { job } = state;

  const handleAddNote = useCallback(async () => {
    if (!job || !state.noteInput.trim()) return;
    try {
      const updated = await MockDb.addNote(job.job_id, state.noteInput);
      state.setJob({ ...updated } as Job);
      state.setNoteInput('');
    } catch (error) {
      showToast.error('Could not add note', (error as Error).message, error, { action_target: 'job', target_id: job?.job_id });
    }
  }, [job, state]);

  const handleTechnicianSignature = useCallback(async (dataUrl: string) => {
    if (!job) return;
    const updated = await MockDb.signJob(job.job_id, 'technician', currentUserName, dataUrl);
    state.setJob({ ...updated } as Job);
    state.setShowTechSigPad(false);
  }, [job, currentUserName, state]);

  const handleCustomerSignature = useCallback(async (dataUrl: string, customerName: string, icNo?: string) => {
    if (!job) return;
    const updated = await MockDb.signJob(job.job_id, 'customer', customerName, dataUrl, icNo);
    state.setJob({ ...updated } as Job);
    state.setShowCustSigPad(false);
  }, [job, state]);

  const handleTechnicianSwipeSign = useCallback(async () => {
    if (!job) return;
    const updated = await MockDb.swipeSignJob(job.job_id, 'technician', currentUserName);
    state.setJob({ ...updated } as Job);
  }, [job, currentUserName, state]);

  const handleCustomerSwipeSign = useCallback(async (customerName: string, icNo?: string) => {
    if (!job) return;
    const updated = await MockDb.swipeSignJob(job.job_id, 'customer', customerName, icNo);
    state.setJob({ ...updated } as Job);
  }, [job, state]);

  const handleStartEditChecklist = useCallback(() => {
    if (!job) return;
    state.setEditingChecklist(true);
    state.setChecklistEditData(job.condition_checklist || {});
  }, [job, state]);

  const handleSaveChecklist = useCallback(async () => {
    if (!job) return;
    try {
      const updated = await MockDb.updateConditionChecklist(job.job_id, state.checklistEditData, currentUserId);
      state.setJob({ ...updated } as Job);
      state.setEditingChecklist(false);
      showToast.success('Checklist saved');
    } catch (e) {
      showToast.error('Could not save checklist', (e as Error).message, e, { action_target: 'job', target_id: job?.job_id });
    }
  }, [job, state, currentUserId]);

  const handleCancelChecklistEdit = useCallback(() => {
    state.setEditingChecklist(false);
    state.setChecklistEditData({});
  }, [state]);

  const handleSetChecklistItemState = useCallback((key: string, newState: 'ok' | 'not_ok' | undefined) => {
    state.setChecklistEditData(prev => {
      const currentState = prev[key as keyof ForkliftConditionChecklist];
      if (newState === 'ok' && currentState === 'ok') {
        return { ...prev, [key]: 'not_ok' };
      }
      if (newState === 'not_ok' && currentState === 'not_ok') {
        return { ...prev, [key]: undefined };
      }
      return { ...prev, [key]: newState };
    });
  }, [state]);

  const handleCheckAll = useCallback(() => {
    const allKeys = [
      'drive_front_axle', 'drive_rear_axle', 'drive_motor_engine', 'drive_controller_transmission',
      'hydraulic_pump', 'hydraulic_control_valve', 'hydraulic_hose', 'hydraulic_oil_level',
      'braking_brake_pedal', 'braking_parking_brake', 'braking_fluid_pipe', 'braking_master_pump',
      'electrical_ignition', 'electrical_battery', 'electrical_wiring', 'electrical_instruments',
      'steering_wheel_valve', 'steering_cylinder', 'steering_motor', 'steering_knuckle',
      'load_fork', 'load_mast_roller', 'load_chain_wheel', 'load_cylinder',
      'tyres_front', 'tyres_rear', 'tyres_rim', 'tyres_screw_nut',
      'wheels_drive', 'wheels_load', 'wheels_support', 'wheels_hub_nut',
      'safety_overhead_guard', 'safety_cabin_body', 'safety_backrest', 'safety_seat_belt',
      'lighting_beacon_light', 'lighting_horn', 'lighting_buzzer', 'lighting_rear_view_mirror',
      'fuel_engine_oil_level', 'fuel_line_leaks', 'fuel_radiator', 'fuel_exhaust_piping',
      'transmission_fluid_level', 'transmission_inching_valve', 'transmission_air_cleaner', 'transmission_lpg_regulator',
    ];
    state.setChecklistEditData(prev => {
      const updated = { ...prev };
      allKeys.forEach(key => { updated[key as keyof ForkliftConditionChecklist] = 'ok'; });
      return updated;
    });
    showToast.success('All items checked', 'Untick any item to mark as needs attention');
  }, [state]);

  const handleStartEditJobCarriedOut = useCallback(() => {
    if (!job) return;
    state.setEditingJobCarriedOut(true);
    state.setJobCarriedOutInput(job.job_carried_out || '');
    state.setRecommendationInput(job.recommendation || '');
  }, [job, state]);

  const handleSaveJobCarriedOut = useCallback(async () => {
    if (!job) return;
    try {
      const updated = await MockDb.updateJob(job.job_id, {
        job_carried_out: state.jobCarriedOutInput,
        recommendation: state.recommendationInput,
      });
      state.setJob({ ...updated } as Job);
      state.setEditingJobCarriedOut(false);
      showToast.success('Job details saved');
    } catch (e) {
      showToast.error('Could not save', (e as Error).message, e, { action_target: 'job', target_id: job?.job_id });
    }
  }, [job, state]);

  const handleCancelJobCarriedOutEdit = useCallback(() => {
    state.setEditingJobCarriedOut(false);
    state.setJobCarriedOutInput('');
    state.setRecommendationInput('');
  }, [state]);

  const handleStartEditDescription = useCallback(() => {
    if (!job) return;
    state.setEditingDescription(true);
    state.setDescriptionInput(job.description || '');
  }, [job, state]);

  const handleSaveDescription = useCallback(async () => {
    if (!job) return;
    try {
      const updated = await MockDb.updateJob(job.job_id, {
        description: state.descriptionInput,
      });
      state.setJob({ ...updated } as Job);
      state.setEditingDescription(false);
      showToast.success('Description updated');
    } catch (e) {
      showToast.error('Could not update description', (e as Error).message, e, { action_target: 'job', target_id: job?.job_id });
    }
  }, [job, state]);

  const handleCancelDescriptionEdit = useCallback(() => {
    state.setEditingDescription(false);
    state.setDescriptionInput('');
  }, [state]);

  // Job type edit — admin/admin_service only, gated to pre-start statuses
  // (New, Assigned). The role + status gates are in CustomerAssignmentCard;
  // these handlers trust the UI's gating.
  const handleStartEditJobType = useCallback(() => {
    if (!job) return;
    state.setEditingJobType(true);
    state.setJobTypeInput((job.job_type as JobType | undefined) ?? '');
  }, [job, state]);

  const handleSaveJobType = useCallback(async () => {
    if (!job || !state.jobTypeInput) return;
    if (state.jobTypeInput === job.job_type) {
      state.setEditingJobType(false);
      return;
    }
    try {
      const updated = await MockDb.updateJob(job.job_id, {
        job_type: state.jobTypeInput,
      } as Partial<Job>);
      state.setJob({ ...updated } as Job);
      state.setEditingJobType(false);
      showToast.success('Job type updated');
    } catch (e) {
      showToast.error('Could not update job type', (e as Error).message, e, { action_target: 'job', target_id: job?.job_id });
    }
  }, [job, state]);

  const handleCancelJobTypeEdit = useCallback(() => {
    state.setEditingJobType(false);
    state.setJobTypeInput('');
  }, [state]);

  const handleAddExtraCharge = useCallback(async () => {
    if (!job) return;
    const amount = parseFloat(state.chargeAmount);
    if (!state.chargeName.trim() || isNaN(amount) || amount <= 0) {
      showToast.error('Please fill in all required fields');
      return;
    }
    try {
      const updated = await MockDb.addExtraCharge(job.job_id, { name: state.chargeName, description: state.chargeDescription, amount });
      state.setJob({ ...updated } as Job);
      state.setShowAddCharge(false);
      state.setChargeName('');
      state.setChargeDescription('');
      state.setChargeAmount('');
      showToast.success('Extra charge added');
    } catch (e) {
      showToast.error('Could not add charge', (e as Error).message, e, { action_target: 'job', target_id: job?.job_id });
    }
  }, [job, state]);

  const handleRemoveExtraCharge = useCallback(async (chargeId: string) => {
    if (!job) return;
    try {
      const updated = await MockDb.removeExtraCharge(job.job_id, chargeId);
      state.setJob({ ...updated } as Job);
      showToast.success('Charge removed');
    } catch (e) {
      showToast.error('Could not remove charge', (e as Error).message, e, { action_target: 'job', target_id: job?.job_id });
    }
  }, [job, state]);

  return {
    handleAddExtraCharge,
    handleAddNote,
    handleCancelChecklistEdit,
    handleCancelDescriptionEdit,
    handleCancelJobCarriedOutEdit,
    handleCheckAll,
    handleCustomerSignature,
    handleCustomerSwipeSign,
    handleRemoveExtraCharge,
    handleSaveChecklist,
    handleSaveDescription,
    handleSaveJobCarriedOut,
    handleSetChecklistItemState,
    handleStartEditChecklist,
    handleStartEditDescription,
    handleStartEditJobCarriedOut,
    handleStartEditJobType,
    handleSaveJobType,
    handleCancelJobTypeEdit,
    handleTechnicianSignature,
    handleTechnicianSwipeSign,
  };
}
