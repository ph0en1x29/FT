import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Job,
  JobStatus,
  UserRole,
  ROLE_PERMISSIONS,
} from '../types';
import { SupabaseDb as MockDb } from '../services/supabaseService';
import { showToast } from '../services/toastService';
import {
  Package,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  ChevronRight,
  Users,
  Wrench,
  RefreshCw,
  X,
  FileText,
} from 'lucide-react';

interface PendingConfirmationsProps {
  currentUser: User;
  hideHeader?: boolean;
}

type TabType = 'parts' | 'jobs';

export default function PendingConfirmations({ currentUser, hideHeader = false }: PendingConfirmationsProps) {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('parts');

  // Rejection modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingJobId, setRejectingJobId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionType, setRejectionType] = useState<'parts' | 'job'>('parts');
  const [processing, setProcessing] = useState(false);

  // Check user role permissions
  const isAdminService = currentUser.role === UserRole.ADMIN_SERVICE || currentUser.role === UserRole.ADMIN;
  const isAdminStore = currentUser.role === UserRole.ADMIN_STORE || currentUser.role === UserRole.ADMIN;
  const isSupervisor = currentUser.role === UserRole.SUPERVISOR;
  const canConfirm = isAdminService || isAdminStore || isSupervisor;

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    try {
      setLoading(true);
      const allJobs = await MockDb.getJobs(currentUser);
      // Filter to jobs awaiting finalization only
      const awaitingJobs = allJobs.filter(j =>
        j.status === JobStatus.AWAITING_FINALIZATION
      );
      setJobs(awaitingJobs);
    } catch (error) {
      console.error('Error loading jobs:', error);
      showToast.error('Failed to load pending confirmations');
    } finally {
      setLoading(false);
    }
  };

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

  // Calculate hours pending
  const getHoursPending = (job: Job): number => {
    const completedAt = job.completed_at ? new Date(job.completed_at) : new Date();
    const now = new Date();
    return Math.floor((now.getTime() - completedAt.getTime()) / (1000 * 60 * 60));
  };

  const getUrgencyClass = (hours: number): string => {
    if (hours >= 24) return 'bg-red-100 text-red-700 border-red-200';
    if (hours >= 12) return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-green-100 text-green-700 border-green-200';
  };

  // Confirm Parts (Admin 2)
  const handleConfirmParts = async (jobId: string) => {
    try {
      setProcessing(true);
      const updated = await MockDb.updateJob(jobId, {
        parts_confirmed_at: new Date().toISOString(),
        parts_confirmed_by_id: currentUser.user_id,
        parts_confirmed_by_name: currentUser.name,
      });
      setJobs(prev => prev.map(j => j.job_id === jobId ? { ...j, ...updated } : j));
      showToast.success('Parts confirmed', 'Job moved to service confirmation queue');
      loadJobs();
    } catch (error) {
      showToast.error('Failed to confirm parts', (error as Error).message);
    } finally {
      setProcessing(false);
    }
  };

  // Confirm Job (Admin 1)
  const handleConfirmJob = async (jobId: string) => {
    try {
      setProcessing(true);
      const updated = await MockDb.updateJobStatus(jobId, JobStatus.COMPLETED, currentUser.user_id, currentUser.name);
      await MockDb.updateJob(jobId, {
        job_confirmed_at: new Date().toISOString(),
        job_confirmed_by_id: currentUser.user_id,
        job_confirmed_by_name: currentUser.name,
      });
      setJobs(prev => prev.filter(j => j.job_id !== jobId));
      showToast.success('Job confirmed', 'Job marked as completed');
    } catch (error) {
      showToast.error('Failed to confirm job', (error as Error).message);
    } finally {
      setProcessing(false);
    }
  };

  // Skip parts confirmation (no parts used)
  const handleSkipPartsConfirmation = async (jobId: string) => {
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
  };

  // Open rejection modal
  const openRejectModal = (jobId: string, type: 'parts' | 'job') => {
    setRejectingJobId(jobId);
    setRejectionType(type);
    setRejectionReason('');
    setShowRejectModal(true);
  };

  // Handle rejection
  const handleReject = async () => {
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
  };

  const currentJobs = activeTab === 'parts' ? jobsPendingPartsConfirmation : jobsPendingJobConfirmation;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      {!hideHeader && (
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-theme">Pending Confirmations</h1>
            <p className="text-theme-muted text-sm mt-1">
              Dual admin confirmation workflow for completed jobs
            </p>
          </div>
          <button
            onClick={loadJobs}
            className="btn-premium btn-premium-secondary"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-theme">
        <button
          onClick={() => setActiveTab('parts')}
          className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'parts'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-theme-muted hover:text-theme'
          }`}
        >
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Parts Confirmation
            {jobsPendingPartsConfirmation.length > 0 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">
                {jobsPendingPartsConfirmation.length}
              </span>
            )}
          </div>
          <div className="text-xs text-theme-muted mt-0.5">Admin 2 (Store)</div>
        </button>
        <button
          onClick={() => setActiveTab('jobs')}
          className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'jobs'
              ? 'border-[var(--accent)] text-[var(--accent)]'
              : 'border-transparent text-theme-muted hover:text-theme'
          }`}
        >
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4" />
            Job Confirmation
            {jobsPendingJobConfirmation.length > 0 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">
                {jobsPendingJobConfirmation.length}
              </span>
            )}
          </div>
          <div className="text-xs text-theme-muted mt-0.5">Admin 1 (Service)</div>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card-theme p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-theme">
                {jobsPendingPartsConfirmation.length}
              </div>
              <div className="text-xs text-theme-muted">Parts Pending</div>
            </div>
          </div>
        </div>
        <div className="card-theme p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Wrench className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-theme">
                {jobsPendingJobConfirmation.length}
              </div>
              <div className="text-xs text-theme-muted">Jobs Pending</div>
            </div>
          </div>
        </div>
        <div className="card-theme p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-theme">
                {[...jobsPendingPartsConfirmation, ...jobsPendingJobConfirmation].filter(j => getHoursPending(j) >= 24).length}
              </div>
              <div className="text-xs text-theme-muted">Overdue (&gt;24h)</div>
            </div>
          </div>
        </div>
        <div className="card-theme p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-theme">
                {jobs.filter(j => j.status === JobStatus.COMPLETED).length}
              </div>
              <div className="text-xs text-theme-muted">Confirmed Today</div>
            </div>
          </div>
        </div>
      </div>

      {/* Job List */}
      {currentJobs.length === 0 ? (
        <div className="card-theme p-8 rounded-xl text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-theme">All Caught Up!</h3>
          <p className="text-theme-muted text-sm mt-1">
            No {activeTab === 'parts' ? 'parts confirmations' : 'job confirmations'} pending.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {currentJobs.map(job => {
            const hoursPending = getHoursPending(job);
            const urgencyClass = getUrgencyClass(hoursPending);

            return (
              <div
                key={job.job_id}
                className="card-theme p-4 rounded-xl hover:shadow-theme transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    {/* Job Header */}
                    <div className="flex items-center gap-2 mb-2">
                      <button
                        onClick={() => navigate(`/jobs/${job.job_id}`)}
                        className="font-semibold text-theme hover:text-[var(--accent)] transition-colors"
                      >
                        {job.title}
                      </button>
                      <span className={`px-2 py-0.5 text-xs rounded-full border ${urgencyClass}`}>
                        {hoursPending}h pending
                      </span>
                      {job.job_type && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-600">
                          {job.job_type}
                        </span>
                      )}
                    </div>

                    {/* Job Details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-theme-muted">Customer:</span>
                        <span className="ml-1 text-theme">{job.customer?.name || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-theme-muted">Technician:</span>
                        <span className="ml-1 text-theme">{job.assigned_technician_name || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-theme-muted">Completed:</span>
                        <span className="ml-1 text-theme">
                          {job.completed_at
                            ? new Date(job.completed_at).toLocaleDateString()
                            : 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-theme-muted">SRN:</span>
                        <span className="ml-1 text-theme">{job.service_report_number || 'N/A'}</span>
                      </div>
                    </div>

                    {/* Parts Used (for parts tab) */}
                    {activeTab === 'parts' && job.parts_used.length > 0 && (
                      <div className="mt-3 p-3 bg-[var(--bg-subtle)] rounded-lg">
                        <div className="text-xs font-medium text-theme-muted mb-2">
                          Parts Used ({job.parts_used.length})
                        </div>
                        <div className="space-y-1">
                          {job.parts_used.slice(0, 3).map((part, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                              <span className="text-theme">{part.part_name}</span>
                              <span className="text-theme-muted">
                                x{part.quantity} @ RM{part.sell_price_at_time}
                              </span>
                            </div>
                          ))}
                          {job.parts_used.length > 3 && (
                            <div className="text-xs text-theme-muted">
                              +{job.parts_used.length - 3} more items
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-2">
                    {activeTab === 'parts' ? (
                      <>
                        <button
                          onClick={() => handleConfirmParts(job.job_id)}
                          disabled={processing || !canConfirm}
                          className="btn-premium btn-premium-primary text-sm"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Confirm Parts
                        </button>
                        {job.parts_used.length === 0 && (
                          <button
                            onClick={() => handleSkipPartsConfirmation(job.job_id)}
                            disabled={processing}
                            className="btn-premium btn-premium-secondary text-sm"
                          >
                            Skip (No Parts)
                          </button>
                        )}
                        <button
                          onClick={() => openRejectModal(job.job_id, 'parts')}
                          disabled={processing}
                          className="btn-premium btn-premium-secondary text-sm text-red-600 border-red-200 hover:bg-red-50"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleConfirmJob(job.job_id)}
                          disabled={processing || !canConfirm}
                          className="btn-premium btn-premium-primary text-sm"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Confirm Job
                        </button>
                        <button
                          onClick={() => openRejectModal(job.job_id, 'job')}
                          disabled={processing}
                          className="btn-premium btn-premium-secondary text-sm text-red-600 border-red-200 hover:bg-red-50"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => navigate(`/jobs/${job.job_id}`)}
                      className="btn-premium btn-premium-secondary text-sm"
                    >
                      <FileText className="w-4 h-4" />
                      View Details
                    </button>
                  </div>
                </div>

                {/* Confirmation Status */}
                <div className="mt-3 pt-3 border-t border-theme flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1">
                    <Package className="w-3 h-3" />
                    <span className="text-theme-muted">Parts:</span>
                    {job.parts_confirmed_at ? (
                      <span className="text-green-600 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Confirmed by {job.parts_confirmed_by_name}
                      </span>
                    ) : job.parts_confirmation_skipped ? (
                      <span className="text-slate-500">Skipped (no parts)</span>
                    ) : job.parts_used.length === 0 ? (
                      <span className="text-slate-500">No parts used</span>
                    ) : (
                      <span className="text-amber-600 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Pending
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Wrench className="w-3 h-3" />
                    <span className="text-theme-muted">Job:</span>
                    {job.job_confirmed_at ? (
                      <span className="text-green-600 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Confirmed by {job.job_confirmed_by_name}
                      </span>
                    ) : (
                      <span className="text-amber-600 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Pending
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface)] rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-theme">
                Reject {rejectionType === 'parts' ? 'Parts' : 'Job'} Confirmation
              </h3>
              <button
                onClick={() => setShowRejectModal(false)}
                className="p-1 hover:bg-[var(--bg-subtle)] rounded-lg"
              >
                <X className="w-5 h-5 text-theme-muted" />
              </button>
            </div>

            <p className="text-sm text-theme-muted mb-4">
              Please provide a reason for rejection. The technician will be notified.
            </p>

            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="w-full p-3 border border-theme rounded-lg bg-theme-surface text-theme resize-none h-24"
            />

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 btn-premium btn-premium-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={processing || !rejectionReason.trim()}
                className="flex-1 btn-premium bg-red-600 hover:bg-red-700 text-white border-red-600"
              >
                {processing ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
