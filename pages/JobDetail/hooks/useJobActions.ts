import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Job, JobStatus, User, ForkliftConditionChecklist, HourmeterFlagReason, JobRequestType } from '../../../types';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';
import { generateJobSummary } from '../../../services/geminiService';
import { showToast } from '../../../services/toastService';
import { getMissingMandatoryItems } from '../utils';
import { JobDetailState } from './useJobDetailState';
import { createJobRequest, approveSparePartRequest, rejectRequest } from '../../../services/jobRequestService';

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
  
  // Destructure stable setters to avoid 'state' object in dependency arrays
  const { 
    job, 
    setJob,
    rejectJobReason,
    setShowRejectJobModal,
    setRejectJobReason,
    setStartJobHourmeter,
    setConditionChecklist,
    setShowStartJobModal,
    startJobHourmeter,
    conditionChecklist,
    setMissingChecklistItems,
    setEditingLabor,
    setLaborCostInput,
    laborCostInput,
    setEditingHourmeter,
    setHourmeterInput,
    hourmeterInput,
    setShowTechSigPad,
    setShowCustSigPad,
    setGeneratingAi,
    setAiSummary,
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
  }, [job, currentUserId, currentUserName, state, navigate]);

  // Start job handlers
  const handleOpenStartJobModal = useCallback(() => {
    if (!job) return;
    setStartJobHourmeter((job.forklift?.hourmeter || 0).toString());
    setConditionChecklist({});
    setShowStartJobModal(true);
  }, [job, setShowRejectJobModal, setRejectJobReason]);

  const handleChecklistToggle = useCallback((key: string) => {
    setConditionChecklist(prev => ({ ...prev, [key]: !prev[key as keyof ForkliftConditionChecklist] }));
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
  }, [job, state, currentUserId, currentUserName, setJob]);

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
    setEditingLabor(true);
    setLaborCostInput((job.labor_cost || 150).toString());
  }, [job, setShowRejectJobModal, setRejectJobReason]);

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
    } catch (e) {
      showToast.error('Could not update labor cost');
    }
  }, [job, state, setJob]);

  const handleCancelLaborEdit = useCallback(() => {
    setEditingLabor(false);
    setLaborCostInput('');
  }, [setConditionChecklist]);

  // Hourmeter handlers
  const handleStartEditHourmeter = useCallback(() => {
    if (!job) return;
    setEditingHourmeter(true);
    setHourmeterInput((job.hourmeter_reading || job.forklift?.hourmeter || 0).toString());
  }, [job, setShowRejectJobModal, setRejectJobReason]);

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
  }, [job, state, currentUserId, currentUserName, setJob]);

  const handleCancelHourmeterEdit = useCallback(() => {
    setEditingHourmeter(false);
    setHourmeterInput('');
  }, [setConditionChecklist]);

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
    setShowTechSigPad(false);
  }, [job, currentUserName, setJob, setShowRejectJobModal, setRejectJobReason]);

  const handleCustomerSignature = useCallback(async (dataUrl: string) => {
    if (!job) return;
    const customerName = job.customer?.name || 'Customer';
    const updated = await MockDb.signJob(job.job_id, 'customer', customerName, dataUrl);
    setJob({ ...updated } as Job);
    setShowCustSigPad(false);
  }, [job, setJob, setShowRejectJobModal, setRejectJobReason]);

  // AI Summary handler
  const handleAiSummary = useCallback(async () => {
    if (!job) return;
    setGeneratingAi(true);
    const summary = await generateJobSummary(job);
    setAiSummary(summary);
    setGeneratingAi(false);
  }, [job, setShowRejectJobModal, setRejectJobReason]);

  // Job Request handlers
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
        notes
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
  }, [state, currentUserId, loadJob]);

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

  const handleSetChecklistItemState = useCallback((key: string, itemState: 'ok' | 'not_ok' | undefined) => {
    state.setChecklistEditData(prev => ({ ...prev, [key]: itemState }));
  }, [state]);

  const handleCheckAll = useCallback(() => {
    // Set all items to 'ok'
    const allOk: ForkliftConditionChecklist = {};
    // This will be populated by the component using CHECKLIST_CATEGORIES
    state.setChecklistEditData(prev => {
      const updated = { ...prev };
      // Mark all as 'ok' - the component will handle the actual keys
      return updated;
    });
    showToast.info('Use OK buttons to mark items', 'Click each item to set status');
  }, [state]);

  // Parts handlers
  const handleAddPart = useCallback(async () => {
    if (!job || !state.selectedPartId) return;
    const price = parseFloat(state.selectedPartPrice) || 0;
    try {
      const updated = await MockDb.addPartToJob(job.job_id, state.selectedPartId, 1, price, 'admin');
      setJob({ ...updated } as Job);
      state.setSelectedPartId('');
      state.setSelectedPartPrice('');
      showToast.success('Part added');
    } catch (e) {
      showToast.error('Could not add part', (e as Error).message);
    }
  }, [job, state, setJob]);

  const handleStartEditPartPrice = useCallback((partId: string, currentPrice: number) => {
    state.setEditingPartId(partId);
    state.setEditingPrice(currentPrice.toString());
  }, [state]);

  const handleSavePartPrice = useCallback(async (partId: string) => {
    if (!job) return;
    const price = parseFloat(state.editingPrice);
    if (isNaN(price) || price < 0) {
      showToast.error('Invalid price');
      return;
    }
    try {
      const updated = await MockDb.updatePartPrice(job.job_id, partId, price);
      setJob({ ...updated } as Job);
      state.setEditingPartId(null);
      state.setEditingPrice('');
      showToast.success('Price updated');
    } catch (e) {
      showToast.error('Could not update price', (e as Error).message);
    }
  }, [job, state, setJob]);

  const handleCancelPartEdit = useCallback(() => {
    state.setEditingPartId(null);
    state.setEditingPrice('');
  }, [state]);

  const handleRemovePart = useCallback(async (partId: string) => {
    if (!job) return;
    try {
      const updated = await MockDb.removePartFromJob(job.job_id, partId);
      setJob({ ...updated } as Job);
      showToast.success('Part removed');
    } catch (e) {
      showToast.error('Could not remove part', (e as Error).message);
    }
  }, [job, setJob]);

  const handleToggleNoPartsUsed = useCallback(async () => {
    if (!job) return;
    const newValue = !state.noPartsUsed;
    try {
      await MockDb.setNoPartsUsed(job.job_id, newValue);
      state.setNoPartsUsed(newValue);
      showToast.success(newValue ? 'Marked as no parts used' : 'Cleared no parts flag');
    } catch (e) {
      showToast.error('Could not update', (e as Error).message);
    }
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
    
    // Requests
    handleCreateRequest,
    handleApproveRequest,
    handleRejectRequest,
    
    // Checklist
    handleStartEditChecklist,
    handleSaveChecklist,
    handleCancelChecklistEdit,
    handleSetChecklistItemState,
    handleCheckAll,
    
    // Parts
    handleAddPart,
    handleStartEditPartPrice,
    handleSavePartPrice,
    handleCancelPartEdit,
    handleRemovePart,
    handleToggleNoPartsUsed,
  };
};
