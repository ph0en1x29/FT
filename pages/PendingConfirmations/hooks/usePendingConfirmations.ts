import { useState, useEffect, useMemo, useCallback } from 'react';
import { Job, JobStatus, UserRole, User } from '../../../types';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';
import { showToast } from '../../../services/toastService';
import { TabType } from '../types';

export function usePendingConfirmations(currentUser: User) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('parts');
  const [processing, setProcessing] = useState(false);

  // Rejection modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingJobId, setRejectingJobId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionType, setRejectionType] = useState<'parts' | 'job'>('parts');

  // User role permissions
  const isAdminService = currentUser.role === UserRole.ADMIN_SERVICE || currentUser.role === UserRole.ADMIN;
  const isAdminStore = currentUser.role === UserRole.ADMIN_STORE || currentUser.role === UserRole.ADMIN;
  const isSupervisor = currentUser.role === UserRole.SUPERVISOR;
  const canConfirm = isAdminService || isAdminStore || isSupervisor;

  const loadJobs = useCallback(async () => {
    try {
      setLoading(true);
      const allJobs = await MockDb.getJobs(currentUser);
      const awaitingJobs = allJobs.filter(j =>
        j.status === JobStatus.AWAITING_FINALIZATION
      );
      setJobs(awaitingJobs);
    } catch (error) {
      showToast.error('Failed to load pending confirmations');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  // Jobs pending parts confirmation (Admin 2 / Store)
  const jobsPendingPartsConfirmation = useMemo(() => {
    return jobs.filter(job =>
      job.status === JobStatus.AWAITING_FINALIZATION &&
      job.parts_used.length > 0 &&
      !job.parts_confirmed_at &&
      !job.parts_confirmation_skipped
    );
  }, [jobs]);

  // Jobs pending job confirmation (Admin 1 / Service)
  const jobsPendingJobConfirmation = useMemo(() => {
    return jobs.filter(job =>
      job.status === JobStatus.AWAITING_FINALIZATION &&
      (job.parts_confirmed_at || job.parts_confirmation_skipped || job.parts_used.length === 0) &&
      !job.job_confirmed_at
    );
  }, [jobs]);

  // Confirm Parts (Admin 2)
  const handleConfirmParts = useCallback(async (jobId: string) => {
    try {
      setProcessing(true);

      const lockCheck = await MockDb.checkJobLock(jobId, currentUser.user_id);
      if (lockCheck.isLocked) {
        showToast.error(
          'Job Locked',
          `This job is being reviewed by ${lockCheck.lockedByName || 'another admin'}. Please try again later.`
        );
        return;
      }

      const lockResult = await MockDb.acquireJobLock(jobId, currentUser.user_id, currentUser.name);
      if (!lockResult.success) {
        showToast.error(
          'Job Locked',
          `This job is being reviewed by ${lockResult.lockedByName || 'another admin'}. Please try again later.`
        );
        return;
      }

      const updated = await MockDb.updateJob(jobId, {
        parts_confirmed_at: new Date().toISOString(),
        parts_confirmed_by_id: currentUser.user_id,
        parts_confirmed_by_name: currentUser.name,
      });
      setJobs(prev => prev.map(j => j.job_id === jobId ? { ...j, ...updated } : j));
      showToast.success('Parts confirmed', 'Job moved to service confirmation queue');

      await MockDb.releaseJobLock(jobId, currentUser.user_id);
      loadJobs();
    } catch (error) {
      showToast.error('Failed to confirm parts', (error as Error).message);
    } finally {
      setProcessing(false);
    }
  }, [currentUser, loadJobs]);

  // Confirm Job (Admin 1)
  const handleConfirmJob = useCallback(async (jobId: string) => {
    const job = jobs.find(j => j.job_id === jobId);
    if (!job) {
      showToast.error('Job not found');
      return;
    }

    if (job.parts_used.length > 0 && !job.parts_confirmed_at && !job.parts_confirmation_skipped) {
      showToast.error(
        'Store Verification Pending',
        'Admin 2 (Store) must approve parts before final service closure'
      );
      return;
    }

    try {
      setProcessing(true);

      const lockCheck = await MockDb.checkJobLock(jobId, currentUser.user_id);
      if (lockCheck.isLocked) {
        showToast.error(
          'Job Locked',
          `This job is being reviewed by ${lockCheck.lockedByName || 'another admin'}. Please try again later.`
        );
        return;
      }

      const lockResult = await MockDb.acquireJobLock(jobId, currentUser.user_id, currentUser.name);
      if (!lockResult.success) {
        showToast.error(
          'Job Locked',
          `This job is being reviewed by ${lockResult.lockedByName || 'another admin'}. Please try again later.`
        );
        return;
      }

      await MockDb.updateJobStatus(jobId, JobStatus.COMPLETED, currentUser.user_id, currentUser.name);
      await MockDb.updateJob(jobId, {
        job_confirmed_at: new Date().toISOString(),
        job_confirmed_by_id: currentUser.user_id,
        job_confirmed_by_name: currentUser.name,
      });
      setJobs(prev => prev.filter(j => j.job_id !== jobId));
      showToast.success('Job confirmed', 'Job marked as completed');

      await MockDb.releaseJobLock(jobId, currentUser.user_id);
    } catch (error) {
      showToast.error('Failed to confirm job', (error as Error).message);
    } finally {
      setProcessing(false);
    }
  }, [currentUser, jobs]);

  // Skip parts confirmation
  const handleSkipPartsConfirmation = useCallback(async (jobId: string) => {
    try {
      setProcessing(true);
      const updated = await MockDb.updateJob(jobId, {
        parts_confirmation_skipped: true,
      });
      setJobs(prev => prev.map(j => j.job_id === jobId ? { ...j, ...updated } : j));
      showToast.success('Parts confirmation skipped', 'Job moved to service confirmation queue');
      loadJobs();
    } catch (error) {
      showToast.error('Failed to skip parts confirmation', (error as Error).message);
    } finally {
      setProcessing(false);
    }
  }, [loadJobs]);

  // Open rejection modal
  const openRejectModal = useCallback((jobId: string, type: 'parts' | 'job') => {
    setRejectingJobId(jobId);
    setRejectionType(type);
    setRejectionReason('');
    setShowRejectModal(true);
  }, []);

  // Handle rejection
  const handleReject = useCallback(async () => {
    if (!rejectingJobId || !rejectionReason.trim()) {
      showToast.error('Please provide a rejection reason');
      return;
    }

    try {
      setProcessing(true);
      if (rejectionType === 'parts') {
        await MockDb.updateJob(rejectingJobId, {
          parts_confirmation_notes: `REJECTED: ${rejectionReason}`,
        });
        showToast.warning('Parts rejected', 'Technician will be notified');
      } else {
        await MockDb.updateJob(rejectingJobId, {
          job_confirmation_notes: `REJECTED: ${rejectionReason}`,
        });
        showToast.warning('Job rejected', 'Technician will be notified');
      }
      setShowRejectModal(false);
      loadJobs();
    } catch (error) {
      showToast.error('Failed to reject', (error as Error).message);
    } finally {
      setProcessing(false);
    }
  }, [rejectingJobId, rejectionReason, rejectionType, loadJobs]);

  const closeRejectModal = useCallback(() => {
    setShowRejectModal(false);
  }, []);

  return {
    // State
    jobs,
    loading,
    activeTab,
    processing,
    canConfirm,
    showRejectModal,
    rejectionReason,
    rejectionType,
    // Filtered jobs
    jobsPendingPartsConfirmation,
    jobsPendingJobConfirmation,
    // Actions
    setActiveTab,
    setRejectionReason,
    loadJobs,
    handleConfirmParts,
    handleConfirmJob,
    handleSkipPartsConfirmation,
    openRejectModal,
    handleReject,
    closeRejectModal,
  };
}
