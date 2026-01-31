import { useState } from 'react';
import { User, Job, JobStatus } from '../../../types';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';
import { showToast } from '../../../services/toastService';
import { ResponseTimeState } from '../types';

interface UseJobAcceptanceProps {
  currentUser: User;
  onJobUpdated: () => void;
}

interface UseJobAcceptanceReturn {
  processingJobId: string | null;
  showRejectModal: boolean;
  rejectingJobId: string | null;
  rejectReason: string;
  setRejectReason: (reason: string) => void;
  handleAcceptJob: (e: React.MouseEvent, jobId: string) => Promise<void>;
  handleOpenRejectModal: (e: React.MouseEvent, jobId: string) => void;
  handleRejectJob: () => Promise<void>;
  closeRejectModal: () => void;
  jobNeedsAcceptance: (job: Job) => boolean;
  getResponseTimeRemaining: (job: Job) => ResponseTimeState;
}

/**
 * Hook for managing job acceptance/rejection flow for technicians
 */
export function useJobAcceptance({ currentUser, onJobUpdated }: UseJobAcceptanceProps): UseJobAcceptanceReturn {
  const [processingJobId, setProcessingJobId] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingJobId, setRejectingJobId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Accept job handler
  const handleAcceptJob = async (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation();
    setProcessingJobId(jobId);
    try {
      await MockDb.acceptJobAssignment(jobId, currentUser.user_id, currentUser.name);
      showToast.success('Job accepted', 'You can now start the job when ready.');
      onJobUpdated();
    } catch (err) {
      showToast.error('Failed to accept job', (err as Error).message);
    } finally {
      setProcessingJobId(null);
    }
  };

  // Open reject modal
  const handleOpenRejectModal = (e: React.MouseEvent, jobId: string) => {
    e.stopPropagation();
    setRejectingJobId(jobId);
    setRejectReason('');
    setShowRejectModal(true);
  };

  // Reject job handler
  const handleRejectJob = async () => {
    if (!rejectingJobId || !rejectReason.trim()) {
      showToast.error('Please provide a reason for rejection');
      return;
    }
    setProcessingJobId(rejectingJobId);
    try {
      await MockDb.rejectJobAssignment(rejectingJobId, currentUser.user_id, currentUser.name, rejectReason.trim());
      showToast.success('Job rejected', 'Admin has been notified for reassignment.');
      setShowRejectModal(false);
      setRejectingJobId(null);
      setRejectReason('');
      onJobUpdated();
    } catch (err) {
      showToast.error('Failed to reject job', (err as Error).message);
    } finally {
      setProcessingJobId(null);
    }
  };

  const closeRejectModal = () => {
    setShowRejectModal(false);
    setRejectingJobId(null);
    setRejectReason('');
  };

  // Helper to check if job needs acceptance (15-min window)
  const jobNeedsAcceptance = (job: Job): boolean => {
    if (job.status !== JobStatus.ASSIGNED) return false;
    if (job.assigned_technician_id !== currentUser.user_id) return false;
    if (job.technician_accepted_at || job.technician_rejected_at) return false;
    return true;
  };

  // Helper to get remaining response time
  const getResponseTimeRemaining = (job: Job): ResponseTimeState => {
    if (!job.technician_response_deadline) {
      return { text: '', isExpired: false, urgency: 'ok' };
    }
    const deadline = new Date(job.technician_response_deadline);
    const now = new Date();
    const remaining = deadline.getTime() - now.getTime();
    
    if (remaining <= 0) {
      return { text: 'Expired', isExpired: true, urgency: 'critical' };
    }
    
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    const urgency = minutes < 5 ? 'critical' : minutes < 10 ? 'warning' : 'ok';
    
    return {
      text: `${minutes}:${seconds.toString().padStart(2, '0')}`,
      isExpired: false,
      urgency,
    };
  };

  return {
    processingJobId,
    showRejectModal,
    rejectingJobId,
    rejectReason,
    setRejectReason,
    handleAcceptJob,
    handleOpenRejectModal,
    handleRejectJob,
    closeRejectModal,
    jobNeedsAcceptance,
    getResponseTimeRemaining,
  };
}
