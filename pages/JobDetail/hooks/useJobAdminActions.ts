import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadRejectionPhoto } from '../../../services/rejectionPhotoUpload';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';
import { showToast } from '../../../services/toastService';
import type { Job, User } from '../../../types';
import { JobStatus } from '../../../types';
import type { JobDetailState } from './useJobDetailState';

interface UseJobAdminActionsParams {
  state: JobDetailState;
  currentUserId: string;
  currentUserName: string;
  technicians: User[];
}

export function useJobAdminActions({
  state,
  currentUserId,
  currentUserName,
  technicians,
}: UseJobAdminActionsParams) {
  const navigate = useNavigate();
  const { job } = state;

  const handleAcceptJob = useCallback(async () => {
    if (!job) return;
    try {
      const updated = await MockDb.acceptJobAssignment(job.job_id, currentUserId, currentUserName);
      state.setJob(updated as Job);
      showToast.success('Job accepted', 'You can now start the job when ready.');
    } catch (e) {
      showToast.error('Failed to accept job', (e as Error).message, e, { action_target: 'job', target_id: job?.job_id });
    }
  }, [job, currentUserId, currentUserName, state]);

  const handleRejectJob = useCallback(async () => {
    if (!job || !state.rejectJobReason.trim()) {
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
      await MockDb.rejectJobAssignment(job.job_id, currentUserId, currentUserName, state.rejectJobReason.trim(), mediaId);
      showToast.success('Job rejected', 'Admin has been notified for reassignment.');
      state.setShowRejectJobModal(false);
      state.setRejectJobReason('');
      if (state.rejectionPhotoPreviewUrl) URL.revokeObjectURL(state.rejectionPhotoPreviewUrl);
      state.setRejectionPhotoFile(null);
      state.setRejectionPhotoPreviewUrl('');
      navigate('/jobs');
    } catch (e) {
      showToast.error('Failed to reject job', (e as Error).message, e, { action_target: 'job', target_id: job?.job_id });
    } finally {
      state.setRejectionUploading(false);
    }
  }, [job, currentUserId, currentUserName, state, navigate]);

  const handleAssignJob = useCallback(async () => {
    if (!job || !state.selectedTechId) return;
    const tech = technicians.find(t => t.user_id === state.selectedTechId);
    if (!tech) {
      showToast.error('Assignment failed', 'Technician not found');
      return;
    }
    try {
      const updated = await MockDb.assignJob(job.job_id, tech.user_id, tech.name, currentUserId, currentUserName);
      state.setJob({ ...updated } as Job);
      state.setSelectedTechId('');
      showToast.success('Job assigned', `Assigned to ${tech.name}`);
    } catch (error) {
      showToast.error('Assignment failed', (error as Error).message, error, { action_target: 'job', target_id: job?.job_id });
    }
  }, [job, state, technicians, currentUserId, currentUserName]);

  const handleReassignJob = useCallback(async () => {
    if (!job || !state.reassignTechId) return;
    const tech = technicians.find(t => t.user_id === state.reassignTechId);
    if (!tech) return;
    try {
      const updated = await MockDb.reassignJob(job.job_id, tech.user_id, tech.name, currentUserId, currentUserName);
      if (updated) {
        state.setJob({ ...updated } as Job);
        state.setShowReassignModal(false);
        state.setReassignTechId('');
        showToast.success(`Job reassigned to ${tech.name}`);
      }
    } catch (e) {
      showToast.error('Failed to reassign job', (e as Error).message, e, { action_target: 'job', target_id: job?.job_id });
    }
  }, [job, state, technicians, currentUserId, currentUserName]);

  const handleScheduledDateChange = useCallback(async (iso: string) => {
    if (!job) return;
    if (job.status !== JobStatus.NEW && job.status !== JobStatus.ASSIGNED) {
      showToast.error('Cannot change schedule', 'Only unstarted jobs can be rescheduled');
      return;
    }
    try {
      const updated = await MockDb.updateJob(job.job_id, {
        scheduled_date: iso || null,
        scheduled_reminder_sent_at: null,
      } as Partial<Job>);
      state.setJob({ ...updated } as Job);
      if (iso) {
        showToast.success('Schedule updated', 'Technician will be notified at 7:30 AM Malaysia Time on the new date');
      } else {
        showToast.success('Schedule cleared', 'This job is no longer scheduled');
      }
    } catch (error) {
      showToast.error('Failed to update schedule', (error as Error).message, error, { action_target: 'job', target_id: job?.job_id });
    }
  }, [job, state]);

  const handleAcknowledgeJob = useCallback(async () => {
    if (!job) return;
    try {
      const updated = await MockDb.updateJob(job.job_id, {
        acknowledged_at: new Date().toISOString(),
        acknowledged_by_id: currentUserId,
        acknowledged_by_name: currentUserName,
      });
      state.setJob({ ...updated } as Job);
      showToast.success('Job acknowledged', 'SLA timer stopped');
    } catch (error) {
      showToast.error('Failed to acknowledge job', (error as Error).message, error, { action_target: 'job', target_id: job?.job_id });
    }
  }, [job, currentUserId, currentUserName, state]);

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
      showToast.error('Could not delete job', (e as Error).message, e, { action_target: 'job', target_id: job?.job_id });
    }
  }, [job, state, currentUserId, currentUserName, navigate]);

  const handleSwitchForklift = useCallback(async (forkliftId: string) => {
    if (!job) return;
    try {
      const updated = await MockDb.updateJob(job.job_id, { forklift_id: forkliftId });
      state.setJob({ ...updated });
      showToast.success('Forklift switched successfully');
    } catch (e) {
      showToast.error('Could not switch forklift', (e as Error).message, e, { action_target: 'job', target_id: job?.job_id });
    }
  }, [job, state]);

  const handleAssignHelper = useCallback(async () => {
    if (!job || !state.selectedHelperId) return;
    const helper = technicians.find(t => t.user_id === state.selectedHelperId);
    if (!helper) return;
    try {
      await MockDb.assignHelper(job.job_id, helper.user_id, currentUserId, state.helperNotes);
      const refreshedJob = await MockDb.getJobById(job.job_id);
      if (refreshedJob) state.setJob(refreshedJob);
      state.setShowAssignHelperModal(false);
      state.setSelectedHelperId('');
      state.setHelperNotes('');
      showToast.success('Helper assigned', `${helper.name} can now upload photos`);
    } catch (e) {
      showToast.error('Could not assign helper', (e as Error).message, e, { action_target: 'job', target_id: job?.job_id });
    }
  }, [job, state, technicians, currentUserId]);

  const handleRemoveHelper = useCallback(async () => {
    if (!job || !job.helper_assignment) return;
    try {
      await MockDb.removeHelper(job.job_id);
      const refreshedJob = await MockDb.getJobById(job.job_id);
      if (refreshedJob) state.setJob(refreshedJob);
      showToast.success('Helper removed');
    } catch (e) {
      showToast.error('Could not remove helper', (e as Error).message, e, { action_target: 'job', target_id: job?.job_id });
    }
  }, [job, state]);

  return {
    handleAcceptJob,
    handleAcknowledgeJob,
    handleAssignHelper,
    handleAssignJob,
    handleDeleteJob,
    handleReassignJob,
    handleRejectJob,
    handleRemoveHelper,
    handleScheduledDateChange,
    handleSwitchForklift,
  };
}
