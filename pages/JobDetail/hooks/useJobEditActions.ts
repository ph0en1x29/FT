import { useCallback } from 'react';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';
import { showToast } from '../../../services/toastService';
import { ForkliftConditionChecklist, Job, User } from '../../../types';
import { JobDetailState } from './useJobDetailState';

interface UseJobEditActionsParams {
  job: Job | null;
  state: JobDetailState;
  currentUserId: string;
  currentUserName: string;
  technicians: User[];
  loadJob: () => Promise<void>;
  setJob: (j: Job | null | ((prev: Job | null) => Job | null)) => void;
}

/**
 * Hook for job field editing actions:
 * labor cost, hourmeter, notes, signatures, checklist editing,
 * job details, assignment, and helper management
 */
export const useJobEditActions = ({
  job,
  state,
  currentUserId,
  currentUserName,
  technicians,
  loadJob,
  setJob,
}: UseJobEditActionsParams) => {
  const {
    setEditingLabor,
    setLaborCostInput,
    laborCostInput,
    setEditingHourmeter,
    setHourmeterInput,
    hourmeterInput,
    setShowTechSigPad,
    setShowCustSigPad,
  } = state;

  // Notes handler
  const handleAddNote = useCallback(async () => {
    if (!job || !state.noteInput.trim()) return;
    try {
      const updated = await MockDb.addNote(job.job_id, state.noteInput);
      setJob({ ...updated } as Job);
      state.setNoteInput('');
    } catch (error) {
      showToast.error('Could not add note', (error as Error).message);
    }
  }, [job, state, setJob]);

  // Labor cost handlers
  const handleStartEditLabor = useCallback(() => {
    if (!job) return;
    setEditingLabor(true);
    setLaborCostInput((job.labor_cost || 150).toString());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job, setEditingLabor, setLaborCostInput]);

  const handleSaveLabor = useCallback(async () => {
    if (!job) return;
    const parsed = parseFloat(laborCostInput);
    if (isNaN(parsed) || parsed < 0) {
      showToast.error('Please enter a valid labor cost');
      return;
    }
    try {
      const updated = await MockDb.updateLaborCost(job.job_id, parsed);
      setJob({ ...updated } as Job);
      setEditingLabor(false);
      setLaborCostInput('');
      showToast.success('Labor cost updated');
    } catch (_e) {
      showToast.error('Could not update labor cost');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job, state, setJob]);

  const handleCancelLaborEdit = useCallback(() => {
    setEditingLabor(false);
    setLaborCostInput('');
  }, [setEditingLabor, setLaborCostInput]);

  // Hourmeter handlers
  const handleStartEditHourmeter = useCallback(() => {
    if (!job) return;
    setEditingHourmeter(true);
    setHourmeterInput((job.hourmeter_reading || job.forklift?.hourmeter || 0).toString());
  }, [job, setEditingHourmeter, setHourmeterInput]);

  const handleSaveHourmeter = useCallback(async () => {
    if (!job || !job.forklift_id) return;
    const parsed = parseInt(hourmeterInput);
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
        setJob({ ...updated, hourmeter_flagged: true, hourmeter_flag_reasons: validation.flags, ...firstRecordingData } as Job);
        setEditingHourmeter(false);
        setHourmeterInput('');
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
      setJob({ ...updated, ...firstRecordingData } as Job);
      setEditingHourmeter(false);
      setHourmeterInput('');
      state.setHourmeterFlagReasons([]);
      showToast.success('Hourmeter updated');
    } catch (e) {
      showToast.error(e instanceof Error ? e.message : 'Could not update hourmeter');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job, state, currentUserId, currentUserName, setJob]);

  const handleCancelHourmeterEdit = useCallback(() => {
    setEditingHourmeter(false);
    setHourmeterInput('');
  }, [setEditingHourmeter, setHourmeterInput]);

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
      flagReasons,
      currentUserId,
      currentUserName
    );

    state.setShowHourmeterAmendmentModal(false);
    showToast.success('Amendment request submitted', 'Waiting for Admin 1 (Service) approval');
  }, [job, state, currentUserId, currentUserName]);

  // Signature handlers
  const handleTechnicianSignature = useCallback(async (dataUrl: string) => {
    if (!job) return;
    const updated = await MockDb.signJob(job.job_id, 'technician', currentUserName, dataUrl);
    setJob({ ...updated } as Job);
    setShowTechSigPad(false);
  }, [job, currentUserName, setJob, setShowTechSigPad]);

  const handleCustomerSignature = useCallback(async (dataUrl: string) => {
    if (!job) return;
    const customerName = job.customer?.name || 'Customer';
    const updated = await MockDb.signJob(job.job_id, 'customer', customerName, dataUrl);
    setJob({ ...updated } as Job);
    setShowCustSigPad(false);
  }, [job, setJob, setShowCustSigPad]);

  // Condition Checklist handlers
  const handleStartEditChecklist = useCallback(() => {
    if (!job) return;
    state.setEditingChecklist(true);
    state.setChecklistEditData(job.condition_checklist || {});
  }, [job, state]);

  const handleSaveChecklist = useCallback(async () => {
    if (!job) return;
    try {
      const updated = await MockDb.updateConditionChecklist(job.job_id, state.checklistEditData, currentUserId);
      setJob({ ...updated } as Job);
      state.setEditingChecklist(false);
      showToast.success('Checklist saved');
    } catch (e) {
      showToast.error('Could not save checklist', (e as Error).message);
    }
  }, [job, state, currentUserId, setJob]);

  const handleCancelChecklistEdit = useCallback(() => {
    state.setEditingChecklist(false);
    state.setChecklistEditData({});
  }, [state]);

  const handleSetChecklistItemState = useCallback((key: string, newState: 'ok' | 'not_ok' | undefined) => {
    state.setChecklistEditData(prev => {
      const currentState = prev[key as keyof ForkliftConditionChecklist];
      // Auto-X on untick: if clicking OK on an already-OK item, change to 'not_ok'
      if (newState === 'ok' && currentState === 'ok') {
        return { ...prev, [key]: 'not_ok' };
      }
      // If clicking X on an already-X item, clear it
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

  // Job Details handlers
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
      setJob({ ...updated } as Job);
      state.setEditingJobCarriedOut(false);
      showToast.success('Job details saved');
    } catch (e) {
      showToast.error('Could not save', (e as Error).message);
    }
  }, [job, state, setJob]);

  const handleCancelJobCarriedOutEdit = useCallback(() => {
    state.setEditingJobCarriedOut(false);
    state.setJobCarriedOutInput('');
    state.setRecommendationInput('');
  }, [state]);

  // Assignment handlers
  const handleAssignJob = useCallback(async () => {
    if (!job || !state.selectedTechId) return;
    const tech = technicians.find(t => t.user_id === state.selectedTechId);
    if (tech) {
      const updated = await MockDb.assignJob(job.job_id, tech.user_id, tech.name, currentUserId, currentUserName);
      setJob({ ...updated } as Job);
      state.setSelectedTechId('');
    }
  }, [job, state, technicians, currentUserId, currentUserName, setJob]);

  const handleReassignJob = useCallback(async () => {
    if (!job || !state.reassignTechId) return;
    const tech = technicians.find(t => t.user_id === state.reassignTechId);
    if (tech) {
      try {
        const updated = await MockDb.reassignJob(job.job_id, tech.user_id, tech.name, currentUserId, currentUserName);
        if (updated) {
          setJob({ ...updated } as Job);
          state.setShowReassignModal(false);
          state.setReassignTechId('');
          showToast.success(`Job reassigned to ${tech.name}`);
        }
      } catch (e) {
        showToast.error('Failed to reassign job', (e as Error).message);
      }
    }
  }, [job, state, technicians, currentUserId, currentUserName, setJob]);

  // Helper handlers
  const handleAssignHelper = useCallback(async () => {
    if (!job || !state.selectedHelperId) return;
    const helper = technicians.find(t => t.user_id === state.selectedHelperId);
    if (!helper) return;
    try {
      const _assignment = await MockDb.assignHelper(job.job_id, helper.user_id, currentUserId, state.helperNotes);
      // Refresh job to get updated state
      const refreshedJob = await MockDb.getJobById(job.job_id);
      if (refreshedJob) setJob(refreshedJob);
      state.setShowAssignHelperModal(false);
      state.setSelectedHelperId('');
      state.setHelperNotes('');
      showToast.success('Helper assigned', `${helper.name} can now upload photos`);
    } catch (e) {
      showToast.error('Could not assign helper', (e as Error).message);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job, state, technicians, currentUserId, currentUserName, setJob]);

  const handleRemoveHelper = useCallback(async () => {
    if (!job || !job.helper_assignment) return;
    try {
      await MockDb.removeHelper(job.job_id);
      // Refresh job to get updated state
      const refreshedJob = await MockDb.getJobById(job.job_id);
      if (refreshedJob) setJob(refreshedJob);
      showToast.success('Helper removed');
    } catch (e) {
      showToast.error('Could not remove helper', (e as Error).message);
    }
  }, [job, setJob]);

  return {
    // Notes
    handleAddNote,
    // Labor
    handleStartEditLabor,
    handleSaveLabor,
    handleCancelLaborEdit,
    // Hourmeter
    handleStartEditHourmeter,
    handleSaveHourmeter,
    handleCancelHourmeterEdit,
    handleSubmitHourmeterAmendment,
    // Signatures
    handleTechnicianSignature,
    handleCustomerSignature,
    // Checklist
    handleStartEditChecklist,
    handleSaveChecklist,
    handleCancelChecklistEdit,
    handleSetChecklistItemState,
    handleCheckAll,
    // Job Details
    handleStartEditJobCarriedOut,
    handleSaveJobCarriedOut,
    handleCancelJobCarriedOutEdit,
    // Assignment
    handleAssignJob,
    handleReassignJob,
    // Helper
    handleAssignHelper,
    handleRemoveHelper,
  };
};
