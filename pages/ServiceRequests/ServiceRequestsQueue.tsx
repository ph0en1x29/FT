/**
 * ServiceRequestsQueue — Admin 1 (Service) inbox for skillful_technician
 * and assistance requests. Renders inside the Approvals tab alongside
 * the StoreQueue (which handles spare_part requests).
 *
 * Only visible to admin, admin_service, and supervisor roles.
 */
import {
  AlertTriangle,
  Check,
  Clock,
  ExternalLink,
  RefreshCw,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Combobox, ComboboxOption } from '../../components/Combobox';
import {
  acknowledgeSkillfulTechRequest,
  approveAssistanceRequest,
  rejectRequest,
} from '../../services/jobRequestService';
import { getTechnicians } from '../../services/userService';
import { showToast } from '../../services/toastService';
import { supabase } from '../../services/supabaseClient';
import { User } from '../../types';

interface ServiceRequest {
  request_id: string;
  job_id: string;
  request_type: 'skillful_technician' | 'assistance';
  description: string;
  status: string;
  created_at: string;
  requested_by: string;
  requester_name: string;
  job_title: string;
  job_status: string;
  customer_name: string;
  forklift_serial: string;
  assigned_technician_name: string;
}

interface ServiceRequestsQueueProps {
  currentUser: User;
}

export default function ServiceRequestsQueue({ currentUser }: ServiceRequestsQueueProps) {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [technicians, setTechnicians] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<Set<string>>(new Set());
  // Per-request state for assistance helper selection
  const [helperSelection, setHelperSelection] = useState<Record<string, string>>({});
  // Reject modal
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const techOptions: ComboboxOption[] = useMemo(
    () =>
      technicians
        .filter((t) => t.is_active)
        .map((t) => ({
          id: t.user_id,
          label: t.full_name || t.name,
          subLabel: t.role,
        })),
    [technicians]
  );

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('job_requests')
        .select(
          `
          *,
          requested_by_user:users!job_requests_requested_by_fkey(user_id, name, full_name),
          job:jobs(job_id, title, status, assigned_technician_name, deleted_at,
            customer:customers(name),
            forklift:forklifts!forklift_id(serial_number))
        `
        )
        .in('request_type', ['skillful_technician', 'assistance'])
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) {
        setRequests([]);
        return;
      }

      const mapped: ServiceRequest[] = (data || [])
        .filter((r: Record<string, unknown>) => {
          const job = r.job as Record<string, unknown> | null;
          return job && !job.deleted_at;
        })
        .map((r: Record<string, unknown>) => {
          const user = r.requested_by_user as Record<string, unknown> | null;
          const job = r.job as Record<string, unknown> | null;
          const customer = job?.customer as Record<string, unknown> | null;
          const forklift = job?.forklift as Record<string, unknown> | null;
          return {
            request_id: r.request_id as string,
            job_id: r.job_id as string,
            request_type: r.request_type as 'skillful_technician' | 'assistance',
            description: r.description as string,
            status: r.status as string,
            created_at: r.created_at as string,
            requested_by: r.requested_by as string,
            requester_name:
              (user?.full_name as string) || (user?.name as string) || 'Unknown',
            job_title: (job?.title as string) || 'Unknown Job',
            job_status: (job?.status as string) || '',
            customer_name: (customer?.name as string) || '',
            forklift_serial: (forklift?.serial_number as string) || '',
            assigned_technician_name:
              (job?.assigned_technician_name as string) || '',
          };
        });

      setRequests(mapped);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
    getTechnicians().then(setTechnicians);
  }, [loadRequests]);

  const formatTimeAgo = (iso: string) => {
    const mins = Math.floor(
      (Date.now() - new Date(iso).getTime()) / 60000
    );
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const handleAcknowledge = async (req: ServiceRequest) => {
    setProcessing((prev) => new Set(prev).add(req.request_id));
    try {
      const ok = await acknowledgeSkillfulTechRequest(
        req.request_id,
        currentUser.user_id,
        'Acknowledged — job will be reassigned to a skilled technician'
      );
      if (ok) {
        showToast.success(
          'Request acknowledged',
          'Technician notified. Reassign the job from the job detail page.'
        );
        loadRequests();
      } else {
        showToast.error('Failed to acknowledge request');
      }
    } finally {
      setProcessing((prev) => {
        const n = new Set(prev);
        n.delete(req.request_id);
        return n;
      });
    }
  };

  const handleAssignHelper = async (req: ServiceRequest) => {
    const helperId = helperSelection[req.request_id];
    if (!helperId) {
      showToast.error('Select a helper technician first');
      return;
    }
    setProcessing((prev) => new Set(prev).add(req.request_id));
    try {
      const ok = await approveAssistanceRequest(
        req.request_id,
        currentUser.user_id,
        helperId
      );
      if (ok) {
        showToast.success('Helper assigned', 'Both technicians have been notified');
        loadRequests();
      } else {
        showToast.error('Failed to assign helper');
      }
    } finally {
      setProcessing((prev) => {
        const n = new Set(prev);
        n.delete(req.request_id);
        return n;
      });
    }
  };

  const handleReject = async () => {
    if (!rejectingId || !rejectReason.trim()) return;
    setProcessing((prev) => new Set(prev).add(rejectingId));
    try {
      const ok = await rejectRequest(
        rejectingId,
        currentUser.user_id,
        rejectReason.trim()
      );
      if (ok) {
        showToast.success('Request rejected');
        setRejectingId(null);
        setRejectReason('');
        loadRequests();
      } else {
        showToast.error('Rejection failed');
      }
    } finally {
      setProcessing((prev) => {
        const n = new Set(prev);
        n.delete(rejectingId!);
        return n;
      });
    }
  };

  if (!loading && requests.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-[var(--accent)]" />
          <h2 className="text-base font-bold text-[var(--text)]">
            Service Requests
          </h2>
          {requests.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-700">
              {requests.length}
            </span>
          )}
        </div>
        <button
          onClick={loadRequests}
          className="p-2 hover:bg-[var(--bg-subtle)] rounded-lg transition"
        >
          <RefreshCw
            className={`w-4 h-4 text-[var(--text-muted)] ${loading ? 'animate-spin' : ''}`}
          />
        </button>
      </div>

      {loading ? (
        <div className="text-center py-6 text-[var(--text-muted)]">
          <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          Loading service requests...
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const isProcessing = processing.has(req.request_id);
            const isSkillful = req.request_type === 'skillful_technician';

            return (
              <div
                key={req.request_id}
                className="rounded-xl border border-purple-200 bg-purple-50/30 p-4 transition"
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          isSkillful
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {isSkillful ? (
                          <AlertTriangle className="w-3 h-3" />
                        ) : (
                          <UserPlus className="w-3 h-3" />
                        )}
                        {isSkillful ? 'Skillful Technician' : 'Assistance'}
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">
                        <Clock className="w-3 h-3 inline mr-0.5" />
                        {formatTimeAgo(req.created_at)}
                      </span>
                    </div>
                    <p className="font-medium text-sm text-[var(--text)]">
                      {req.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-[var(--text-muted)] flex-wrap">
                      <span>By {req.requester_name}</span>
                      <span>·</span>
                      <span>{req.job_title}</span>
                      {req.customer_name && (
                        <>
                          <span>·</span>
                          <span>{req.customer_name}</span>
                        </>
                      )}
                      {req.forklift_serial && (
                        <>
                          <span>·</span>
                          <span>{req.forklift_serial}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/jobs/${req.job_id}`)}
                    className="p-1.5 hover:bg-[var(--bg-subtle)] rounded transition flex-shrink-0"
                    title="View job"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  </button>
                </div>

                {/* Action row */}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border-subtle)]">
                  {isSkillful ? (
                    /* Skillful Technician: Acknowledge button */
                    <button
                      onClick={() => handleAcknowledge(req)}
                      disabled={isProcessing}
                      className="btn-premium btn-premium-primary text-xs px-3 flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Check className="w-4 h-4" /> Acknowledge
                        </>
                      )}
                    </button>
                  ) : (
                    /* Assistance: Technician picker + Assign button */
                    <>
                      <div className="flex-1 max-w-xs">
                        <Combobox
                          options={techOptions}
                          value={helperSelection[req.request_id] || ''}
                          onChange={(val) =>
                            setHelperSelection((prev) => ({
                              ...prev,
                              [req.request_id]: val,
                            }))
                          }
                          placeholder="Select helper tech..."
                        />
                      </div>
                      <button
                        onClick={() => handleAssignHelper(req)}
                        disabled={
                          isProcessing ||
                          !helperSelection[req.request_id]
                        }
                        className="btn-premium btn-premium-primary text-xs px-3 flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {isProcessing ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <UserPlus className="w-4 h-4" /> Assign
                          </>
                        )}
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => {
                      setRejectingId(req.request_id);
                      setRejectReason('');
                    }}
                    disabled={isProcessing}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition ml-auto"
                    title="Reject"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reject Modal */}
      {rejectingId && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setRejectingId(null)}
        >
          <div
            className="bg-[var(--surface)] rounded-2xl p-5 w-full max-w-sm shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="font-semibold text-[var(--text)] mb-3 flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-500" /> Reject Request
            </h4>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="input-premium w-full h-24 resize-none mb-3"
              placeholder="Reason for rejection..."
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => setRejectingId(null)}
                className="btn-premium btn-premium-ghost flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={
                  !rejectReason.trim() || processing.has(rejectingId)
                }
                className="btn-premium bg-[var(--error)] text-white hover:opacity-90 flex-1 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
