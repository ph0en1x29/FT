/* eslint-disable max-lines */
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkServiceUpgradeNeeded,declineServiceUpgrade,upgradeToFullService } from '../../../services/serviceTrackingService';
import { CHECKLIST_CATEGORIES } from '../constants';
import { uploadRejectionPhoto } from '../../../services/rejectionPhotoUpload';
import { SupabaseDb as MockDb, supabase } from '../../../services/supabaseService';
import { showToast } from '../../../services/toastService';
import { ForkliftConditionChecklist,Job,JobStatus,JobType,User } from '../../../types';
import { compressPhoto } from '../../../utils/compressPhoto';
import { getMissingMandatoryItems } from '../utils';
import { JobDetailState } from './useJobDetailState';
import { useJobExportActions } from './useJobExportActions';
import { useJobRequestActions } from './useJobRequestActions';
import { useJobPartsHandlers } from './useJobPartsHandlers';

interface UseJobActionsParams {
  state: JobDetailState;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
  technicians: User[];
  loadJob: (opts?: { silent?: boolean }) => Promise<void>;
}

/**
 * Custom hook that manages all job actions/handlers
 * Extracted to reduce main component complexity
 */
export const useJobActions = ({
  state,
  currentUserId,
  currentUserName,
  currentUserRole,
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
  } = state;

  // Compose sub-hooks for export and request actions
  const exportActions = useJobExportActions({
    job,
    state,
    currentUserId,
    currentUserName,
  });

  const requestActions = useJobRequestActions({
    job,
    state,
    currentUserId,
    currentUserName,
    currentUserRole,
    loadJob,
  });

  const partsHandlers = useJobPartsHandlers({
    job,
    state,
    currentUserId,
    currentUserName,
    currentUserRole,
    loadJob,
    setJob,
  });

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
    if (!state.rejectionPhotoFile) {
      showToast.error('On-site photo is required to reject a job');
      return;
    }
    state.setRejectionUploading(true);
    try {
      const { mediaId } = await uploadRejectionPhoto({
        file: state.rejectionPhotoFile,
        jobId: job.job_id,
        uploadedById: currentUserId,
        uploadedByName: currentUserName,
      });
      await MockDb.rejectJobAssignment(job.job_id, currentUserId, currentUserName, rejectJobReason.trim(), mediaId);
      showToast.success('Job rejected', 'Admin has been notified for reassignment.');
      setShowRejectJobModal(false);
      setRejectJobReason('');
      if (state.rejectionPhotoPreviewUrl) URL.revokeObjectURL(state.rejectionPhotoPreviewUrl);
      state.setRejectionPhotoFile(null);
      state.setRejectionPhotoPreviewUrl('');
      navigate('/jobs');
    } catch (e) {
      showToast.error('Failed to reject job', (e as Error).message);
    } finally {
      state.setRejectionUploading(false);
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
    state.setBeforePhotos([]);
    setShowStartJobModal(true);
  }, [job, state, setStartJobHourmeter, setConditionChecklist, setShowStartJobModal]);

  const handleChecklistToggle = useCallback((key: string) => {
    setConditionChecklist(prev => {
      const currentValue = prev[key as keyof ForkliftConditionChecklist];
      const nextValue = currentValue === 'not_ok' ? true : currentValue ? 'not_ok' : true;
      return { ...prev, [key]: nextValue };
    });
  }, [setConditionChecklist]);

  const handleConditionCheckAll = useCallback(() => {
    const allChecked: Partial<ForkliftConditionChecklist> = {};
    // Dynamically get all keys from CHECKLIST_CATEGORIES to avoid hardcoded list going stale
    CHECKLIST_CATEGORIES.forEach(cat => {
      cat.items.forEach(item => {
        allChecked[item.key as keyof ForkliftConditionChecklist] = true;
      });
    });
    setConditionChecklist(allChecked as ForkliftConditionChecklist);
  }, [setConditionChecklist]);

  const handleConditionUncheckAll = useCallback(() => {
    setConditionChecklist({} as ForkliftConditionChecklist);
  }, [setConditionChecklist]);

  const handleStartJobWithCondition = useCallback(async () => {
    if (!job) return;

    // Gate 1: require at least one before photo. The DB trigger
    // trg_enforce_before_photo_on_start (migration 20260409_enforce_before_photo_on_start.sql)
    // enforces this server-side too — this check is the friendly UX layer.
    if (state.beforePhotos.length === 0) {
      showToast.error('Before photos required', 'Take at least one before condition photo before starting the job.');
      return;
    }

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

    // Gate 2: upload ALL before photos FIRST, creating job_media rows with
    // category='before'. Only if every upload succeeds do we proceed to
    // startJobWithCondition — which is guarded by the DB trigger as well.
    // This fixes the BT-RT incident (2026-04-09) where the job went to
    // In Progress with zero before photos because the old flow uploaded
    // AFTER the status change and any upload failure was a silent toast.
    // The hourmeter + checklist the tech entered stay in modal state on
    // failure so they don't have to re-enter anything.
    try {
      for (let index = 0; index < state.beforePhotos.length; index++) {
        const file = state.beforePhotos[index];

        // Compress to ≤ 2048px JPEG at 75% quality (~1-2 MB) so the upload
        // stays well within the 20 MB bucket limit even on slow mobile data.
        const { blob, mime } = await compressPhoto(file);

        const timestamp = Date.now();
        const fileName = `${job.job_id}/before_${timestamp}_${index}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from('job-photos')
          .upload(fileName, blob, { contentType: mime, upsert: false });
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('job-photos')
          .getPublicUrl(fileName);

        await MockDb.addMedia(
          job.job_id,
          {
            type: 'photo',
            url: publicUrl,
            description: 'Before condition photo',
            created_at: new Date().toISOString(),
            category: 'before',
            source: 'camera',
          },
          currentUserId,
          currentUserName,
          false
        );
      }
    } catch (uploadErr) {
      console.error('Before photo upload failed:', uploadErr);
      showToast.error(
        'Photo upload failed',
        'Could not upload before photos. Job NOT started — please retry.'
      );
      // Intentionally keep modal open and state.beforePhotos intact so the
      // technician can retry without losing hourmeter, checklist, or photos.
      return;
    }

    // Gate 3: all photos landed as job_media rows → now it's safe to
    // transition the job to In Progress. The DB trigger will verify the
    // before-photo precondition one more time at the moment of the status
    // change (defense in depth).
    try {
      const updated = await MockDb.startJobWithCondition(job.job_id, hourmeter, conditionChecklist, currentUserId, currentUserName);
      setJob({ ...updated } as Job);
      setShowStartJobModal(false);
      showToast.success('Job started', `Status changed to In Progress. ${state.beforePhotos.length} before photo(s) saved.`);
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
      state.setBeforePhotos([]);
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
      state.setBeforePhotos([]);
      setShowStartJobModal(true);
    } catch (error) {
      showToast.error('Failed to log decision', (error as Error).message);
    }
  }, [job, currentUserId, currentUserName, state, setStartJobHourmeter, setConditionChecklist, setShowStartJobModal]);

  // Status change handler
  const handleStatusChange = useCallback(async (newStatus: JobStatus) => {
    if (!job) return;
    if (newStatus === JobStatus.AWAITING_FINALIZATION) {
      // Field Technical Services are exempt from hourmeter tracking and checklist
      const isFieldTech = job.job_type === JobType.FIELD_TECHNICAL_SERVICES;
      // Hourmeter is mandatory before completion (except Field Technical Services)
      if (!isFieldTech && !job.hourmeter_reading) {
        showToast.error('Hourmeter reading required', 'Please record the hourmeter reading before completing the job');
        return;
      }
      // Hourmeter must be updated from the start reading (end-of-job reading)
      if (!isFieldTech) {
        const startReading = job.forklift?.hourmeter || 0;
        if (job.hourmeter_reading && job.hourmeter_reading < startReading && startReading > 0) {
          showToast.error('Invalid hourmeter reading', 'Hourmeter reading cannot be lower than the start reading');
          return;
        }
      }
      // "After" photo is mandatory
      const hasAfterPhoto = job.media?.some(m => m.category === 'after');
      if (!hasAfterPhoto) {
        showToast.error('After photo required', 'Please upload at least one "After" photo of the forklift before completing');
        return;
      }
      // Signatures are mandatory
      if (!job.technician_signature || !job.customer_signature) {
        showToast.error('Signatures required', 'Both technician and customer signatures are required');
        return;
      }
      // Parts declaration is mandatory for lead technicians (helpers excluded).
      // Admins/supervisors are exempt on the server trigger, so we skip the check here too.
      // Mirrors the DB trigger in 20260407_repair_skip_checklist_completion.sql so the user
      // gets a friendly toast instead of a raw "Cannot complete job: Parts must be recorded..." error.
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
      // Block completion when parts have been approved/issued but Used Parts is empty.
      // This prevents technicians AND admins from completing with an empty Used Parts
      // list when spare part requests were approved for the job.
      const approvedRequests = state.jobRequests.filter(
        r => r.request_type === 'spare_part' && (r.status === 'approved' || r.status === 'issued')
      );
      if (approvedRequests.length > 0 && (job.parts_used?.length ?? 0) === 0) {
        showToast.error(
          'Approved parts not recorded',
          'Parts have been approved for this job. Please ensure all used parts are added to the \'Used Part\' section before completing.'
        );
        return;
      }
      // Repair and Field Technical Services jobs are exempt from checklist
      if (job.job_type !== JobType.REPAIR && !isFieldTech) {
        const missing = getMissingMandatoryItems(job);
        if (missing.length > 0) {
          setMissingChecklistItems(missing);
          state.setShowChecklistWarningModal(true);
          return;
        }
      }
    }
    try {
      const updated = await MockDb.updateJobStatus(job.job_id, newStatus, currentUserId, currentUserName);
      setJob({ ...updated } as Job);
      showToast.success(`Status updated to ${newStatus}`);
      
      // Redirect technician to dashboard after completing job
      if (newStatus === JobStatus.AWAITING_FINALIZATION && currentUserRole === 'technician') {
        navigate('/');
      }
    } catch (error) {
      showToast.error('Failed to update status', (error as Error).message);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job, state, currentUserId, currentUserName, setJob]);

  // Assignment handlers
  const handleAssignJob = useCallback(async () => {
    if (!job || !state.selectedTechId) return;
    const tech = technicians.find(t => t.user_id === state.selectedTechId);
    if (!tech) {
      showToast.error('Assignment failed', 'Technician not found');
      return;
    }
    try {
      const updated = await MockDb.assignJob(job.job_id, tech.user_id, tech.name, currentUserId, currentUserName);
      setJob({ ...updated } as Job);
      state.setSelectedTechId('');
      showToast.success('Job assigned', `Assigned to ${tech.name}`);
    } catch (error) {
      showToast.error('Assignment failed', (error as Error).message);
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

  // Schedule date change (admin/supervisor only — gated at the UI level by CustomerAssignmentCard).
  // Accepts either a Malaysia-time ISO string (from DatePicker) or an empty string to clear.
  // Allowed only while the job is still unstarted: once the tech begins work, the scheduled
  // date becomes historical and shouldn't be rewritten.
  const handleScheduledDateChange = useCallback(async (iso: string) => {
    if (!job) return;
    if (job.status !== JobStatus.NEW && job.status !== JobStatus.ASSIGNED) {
      showToast.error('Cannot change schedule', 'Only unstarted jobs can be rescheduled');
      return;
    }
    try {
      // Pass null to clear the column, otherwise pass the ISO string verbatim.
      // Also reset scheduled_reminder_sent_at so a newly-scheduled date fires a fresh reminder.
      const updated = await MockDb.updateJob(job.job_id, {
        scheduled_date: iso || null,
        scheduled_reminder_sent_at: null,
      } as Partial<Job>);
      setJob({ ...updated } as Job);
      if (iso) {
        showToast.success('Schedule updated', 'Technician will be notified at 7:30 AM Malaysia Time on the new date');
      } else {
        showToast.success('Schedule cleared', 'This job is no longer scheduled');
      }
    } catch (error) {
      showToast.error('Failed to update schedule', (error as Error).message);
    }
  }, [job, setJob]);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    } catch (_e) {
      showToast.error('Could not update labor cost');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job, state, setJob]);

  const handleCancelLaborEdit = useCallback(() => {
    setEditingLabor(false);
    setLaborCostInput('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setConditionChecklist]);

  // Hourmeter handlers
  const handleStartEditHourmeter = useCallback(() => {
    if (!job) return;
    setEditingHourmeter(true);
    setHourmeterInput((job.hourmeter_reading || job.forklift?.hourmeter || 0).toString());
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job, state, currentUserId, currentUserName, setJob]);

  const handleCancelHourmeterEdit = useCallback(() => {
    setEditingHourmeter(false);
    setHourmeterInput('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        loadJob({ silent: true });
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

  // Switch forklift handler
  const handleSwitchForklift = useCallback(async (forkliftId: string) => {
    if (!job) return;
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ forklift_id: forkliftId })
        .eq('job_id', job.job_id);

      if (error) throw error;

      showToast.success('Forklift switched successfully');
      await loadJob(); // Refresh job data to get updated forklift info
    } catch (e) {
      showToast.error('Could not switch forklift', (e as Error).message);
    }
  }, [job, loadJob]);

  // Signature handlers (legacy - kept for backward compatibility if needed)
  const handleTechnicianSignature = useCallback(async (dataUrl: string) => {
    if (!job) return;
    const updated = await MockDb.signJob(job.job_id, 'technician', currentUserName, dataUrl);
    setJob({ ...updated } as Job);
    setShowTechSigPad(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job, currentUserName, setJob, setShowRejectJobModal, setRejectJobReason]);

  const handleCustomerSignature = useCallback(async (dataUrl: string, customerName: string, icNo?: string) => {
    if (!job) return;
    const updated = await MockDb.signJob(job.job_id, 'customer', customerName, dataUrl, icNo);
    setJob({ ...updated } as Job);
    setShowCustSigPad(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job, setJob, setShowRejectJobModal, setRejectJobReason]);

  // Swipe signature handlers
  const handleTechnicianSwipeSign = useCallback(async () => {
    if (!job) return;
    const updated = await MockDb.swipeSignJob(job.job_id, 'technician', currentUserName);
    setJob({ ...updated } as Job);
  }, [job, currentUserName, setJob]);

  const handleCustomerSwipeSign = useCallback(async (customerName: string, icNo?: string) => {
    if (!job) return;
    const updated = await MockDb.swipeSignJob(job.job_id, 'customer', customerName, icNo);
    setJob({ ...updated } as Job);
  }, [job, setJob]);

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
    // Set all checklist items to 'ok'
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

  // Parts handlers moved to useJobPartsHandlers

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
      setJob({ ...updated } as Job);
      state.setEditingDescription(false);
      showToast.success('Description updated');
    } catch (e) {
      showToast.error('Could not update description', (e as Error).message);
    }
  }, [job, state, setJob]);

  const handleCancelDescriptionEdit = useCallback(() => {
    state.setEditingDescription(false);
    state.setDescriptionInput('');
  }, [state]);

  // Confirmation handlers moved to useJobPartsHandlers

  // Extra Charges handlers
  const handleAddExtraCharge = useCallback(async () => {
    if (!job) return;
    const amount = parseFloat(state.chargeAmount);
    if (!state.chargeName.trim() || isNaN(amount) || amount <= 0) {
      showToast.error('Please fill in all required fields');
      return;
    }
    try {
      const updated = await MockDb.addExtraCharge(job.job_id, { name: state.chargeName, description: state.chargeDescription, amount });
      setJob({ ...updated } as Job);
      state.setShowAddCharge(false);
      state.setChargeName('');
      state.setChargeDescription('');
      state.setChargeAmount('');
      showToast.success('Extra charge added');
    } catch (e) {
      showToast.error('Could not add charge', (e as Error).message);
    }
  }, [job, state, setJob]);

  const handleRemoveExtraCharge = useCallback(async (chargeId: string) => {
    if (!job) return;
    try {
      const updated = await MockDb.removeExtraCharge(job.job_id, chargeId);
      setJob({ ...updated } as Job);
      showToast.success('Charge removed');
    } catch (e) {
      showToast.error('Could not remove charge', (e as Error).message);
    }
  }, [job, setJob]);

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
    // Accept/Reject
    handleAcceptJob,
    handleRejectJob,
    
    // Start job
    handleOpenStartJobModal,
    handleChecklistToggle,
    handleConditionCheckAll,
    handleConditionUncheckAll,
    handleStartJobWithCondition,
    
    // Service upgrade
    handleServiceUpgrade,
    handleDeclineServiceUpgrade,
    
    // Status
    handleStatusChange,
    
    // Assignment
    handleAssignJob,
    handleReassignJob,
    handleAcknowledgeJob,
    handleScheduledDateChange,
    
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
    
    // Export (from useJobExportActions)
    ...exportActions,
    
    // Delete
    handleDeleteJob,
    
    // Forklift
    handleSwitchForklift,
    
    // Signatures
    handleTechnicianSignature,
    handleCustomerSignature,
    handleTechnicianSwipeSign,
    handleCustomerSwipeSign,
    
    // AI
    
    // Requests (from useJobRequestActions)
    ...requestActions,
    
    // Checklist
    handleStartEditChecklist,
    handleSaveChecklist,
    handleCancelChecklistEdit,
    handleSetChecklistItemState,
    handleCheckAll,
    
    // Parts (from useJobPartsHandlers)
    ...partsHandlers,
    
    // Job Details
    handleStartEditJobCarriedOut,
    handleSaveJobCarriedOut,
    handleCancelJobCarriedOutEdit,

    // Description
    handleStartEditDescription,
    handleSaveDescription,
    handleCancelDescriptionEdit,
    
    // Extra Charges
    handleAddExtraCharge,
    handleRemoveExtraCharge,
    
    // Helper
    handleAssignHelper,
    handleRemoveHelper,
    
    // Deferred Completion
    handleDeferredCompletion,
  };
};
