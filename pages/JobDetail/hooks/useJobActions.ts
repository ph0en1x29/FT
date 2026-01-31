import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Job, JobStatus, User, ForkliftConditionChecklist, HourmeterFlagReason } from '../../../types';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';
import { generateJobSummary } from '../../../services/geminiService';
import { showToast } from '../../../services/toastService';
import { getMissingMandatoryItems } from '../utils';
import { JobDetailState } from './useJobDetailState';

interface UseJobActionsParams {
  state: JobDetailState;
  currentUserId: string;
  currentUserName: string;
  technicians: User[];
  loadJob: () => Promise<void>;
}

/**
 * Custom hook that manages all job actions/handlers
 * Extracted to reduce main component complexity
 */
export const useJobActions = ({
  state,
  currentUserId,
  currentUserName,
  technicians,
  loadJob,
}: UseJobActionsParams) => {
  const navigate = useNavigate();
  const { job, setJob } = state;

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
    if (!job || !state.rejectJobReason.trim()) {
      showToast.error('Please provide a reason for rejecting this job');
      return;
    }
    try {
      await MockDb.rejectJobAssignment(job.job_id, currentUserId, currentUserName, state.rejectJobReason.trim());
      showToast.success('Job rejected', 'Admin has been notified for reassignment.');
      state.setShowRejectJobModal(false);
      state.setRejectJobReason('');
      navigate('/jobs');
    } catch (e) {
      showToast.error('Failed to reject job', (e as Error).message);
    }
  }, [job, currentUserId, currentUserName, state, navigate]);

  // Start job handlers
  const handleOpenStartJobModal = useCallback(() => {
    if (!job) return;
    state.setStartJobHourmeter((job.forklift?.hourmeter || 0).toString());
    state.setConditionChecklist({});
    state.setShowStartJobModal(true);
  }, [job, state]);

  const handleChecklistToggle = useCallback((key: string) => {
    state.setConditionChecklist(prev => ({ ...prev, [key]: !prev[key as keyof ForkliftConditionChecklist] }));
  }, [state]);

  const handleStartJobWithCondition = useCallback(async () => {
    if (!job) return;
    const hourmeter = parseInt(state.startJobHourmeter);
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
      const updated = await MockDb.startJobWithCondition(job.job_id, hourmeter, state.conditionChecklist, currentUserId, currentUserName);
      setJob({ ...updated } as Job);
      state.setShowStartJobModal(false);
      showToast.success('Job started', 'Status changed to In Progress');
    } catch (error) {
      showToast.error('Failed to start job', (error as Error).message);
    }
  }, [job, state, currentUserId, currentUserName, setJob]);

  // Status change handler
  const handleStatusChange = useCallback(async (newStatus: JobStatus) => {
    if (!job) return;
    if (newStatus === JobStatus.AWAITING_FINALIZATION) {
      const missing = getMissingMandatoryItems(job);
      if (missing.length > 0) {
        state.setMissingChecklistItems(missing);
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
  }, [job, state, currentUserId, currentUserName, setJob]);

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
      setJob({ ...updated } as Job);
      state.setEditingLabor(false);
      state.setLaborCostInput('');
      showToast.success('Labor cost updated');
    } catch (e) {
      showToast.error('Could not update labor cost');
    }
  }, [job, state, setJob]);

  const handleCancelLaborEdit = useCallback(() => {
    state.setEditingLabor(false);
    state.setLaborCostInput('');
  }, [state]);

  // Hourmeter handlers
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
        setJob({ ...updated, hourmeter_flagged: true, hourmeter_flag_reasons: validation.flags, ...firstRecordingData } as Job);
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
      setJob({ ...updated, ...firstRecordingData } as Job);
      state.setEditingHourmeter(false);
      state.setHourmeterInput('');
      state.setHourmeterFlagReasons([]);
      showToast.success('Hourmeter updated');
    } catch (e) {
      showToast.error(e instanceof Error ? e.message : 'Could not update hourmeter');
    }
  }, [job, state, currentUserId, currentUserName, setJob]);

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
      flagReasons,
      currentUserId,
      currentUserName
    );

    state.setShowHourmeterAmendmentModal(false);
    showToast.success('Amendment request submitted', 'Waiting for Admin 1 (Service) approval');
  }, [job, state, currentUserId, currentUserName]);

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
    } catch (e) {
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
    } catch (e) {
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

  // PDF handlers (lazy loaded)
  const handlePrintServiceReport = useCallback(async () => {
    if (!job) return;
    const { printServiceReport } = await import('../../../components/ServiceReportPDF');
    printServiceReport(job);
  }, [job]);

  const handleExportPDF = useCallback(async () => {
    if (!job) return;
    const { printInvoice } = await import('../../../components/InvoicePDF');
    printInvoice(job);
  }, [job]);

  const handleExportToAutoCount = useCallback(async () => {
    if (!job) return;
    state.setExportingToAutoCount(true);
    try {
      await MockDb.createAutoCountExport(job.job_id, currentUserId, currentUserName);
      showToast.success('Export created', 'Invoice queued for AutoCount export');
    } catch (e) {
      showToast.error('Export failed', e instanceof Error ? e.message : 'Unknown error');
    }
    state.setExportingToAutoCount(false);
  }, [job, state, currentUserId, currentUserName]);

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

  // Signature handlers
  const handleTechnicianSignature = useCallback(async (dataUrl: string) => {
    if (!job) return;
    const updated = await MockDb.signJob(job.job_id, 'technician', currentUserName, dataUrl);
    setJob({ ...updated } as Job);
    state.setShowTechSigPad(false);
  }, [job, currentUserName, setJob, state]);

  const handleCustomerSignature = useCallback(async (dataUrl: string) => {
    if (!job) return;
    const customerName = job.customer?.name || 'Customer';
    const updated = await MockDb.signJob(job.job_id, 'customer', customerName, dataUrl);
    setJob({ ...updated } as Job);
    state.setShowCustSigPad(false);
  }, [job, setJob, state]);

  // AI Summary handler
  const handleAiSummary = useCallback(async () => {
    if (!job) return;
    state.setGeneratingAi(true);
    const summary = await generateJobSummary(job);
    state.setAiSummary(summary);
    state.setGeneratingAi(false);
  }, [job, state]);

  return {
    // Accept/Reject
    handleAcceptJob,
    handleRejectJob,
    
    // Start job
    handleOpenStartJobModal,
    handleChecklistToggle,
    handleStartJobWithCondition,
    
    // Status
    handleStatusChange,
    
    // Assignment
    handleAssignJob,
    handleReassignJob,
    handleAcknowledgeJob,
    
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
    
    // Continue/Resume
    handleContinueTomorrow,
    handleResumeJob,
    
    // Finalize
    handleFinalizeInvoice,
    
    // Export
    handlePrintServiceReport,
    handleExportPDF,
    handleExportToAutoCount,
    
    // Delete
    handleDeleteJob,
    
    // Signatures
    handleTechnicianSignature,
    handleCustomerSignature,
    
    // AI
    handleAiSummary,
  };
};
