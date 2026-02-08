import { CheckCircle,Clock,Edit3,Package,Plus,XCircle } from 'lucide-react';
import React,{ useEffect,useState } from 'react';
import { getJobRequests } from '../../../services/jobRequestService';
import { Job,JobRequest,JobRequestStatus,JobRequestType } from '../../../types';
import { RoleFlags,StatusFlags } from '../types';

interface JobRequestsSectionProps {
  job: Job;
  roleFlags: RoleFlags;
  statusFlags: StatusFlags;
  currentUserId: string;
  onCreateRequest: () => void;
  onApproveRequest: (request: JobRequest) => void;
  onEditRequest?: (request: JobRequest) => void;
}

export const JobRequestsSection: React.FC<JobRequestsSectionProps> = ({
  job,
  roleFlags,
  statusFlags,
  currentUserId,
  onCreateRequest,
  onApproveRequest,
  onEditRequest,
}) => {
  const [requests, setRequests] = useState<JobRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRequests();
  }, [job.job_id]);

  const loadRequests = async () => {
    setLoading(true);
    const data = await getJobRequests(job.job_id);
    setRequests(data);
    setLoading(false);
  };

  const getStatusBadge = (status: JobRequestStatus) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle className="w-3 h-3" /> Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <XCircle className="w-3 h-3" /> Rejected
          </span>
        );
      default:
        return null;
    }
  };

  const getRequestTypeLabel = (type: JobRequestType) => {
    switch (type) {
      case 'spare_part':
        return 'Spare Part';
      case 'assistance':
        return 'Assistance';
      case 'skillful_technician':
        return 'Skillful Technician';
      default:
        return type;
    }
  };

  const canCreateRequest = roleFlags.isTechnician && (statusFlags.isInProgress || statusFlags.isAssigned);
  const canApproveRequest = (roleFlags.isAdmin || roleFlags.isSupervisor) && requests.some(r => r.status === 'pending');
  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="card-theme rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[var(--text)] flex items-center gap-2">
          <Package className="w-5 h-5 text-[var(--accent)]" />
          Part Requests
          {pendingCount > 0 && (
            <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
              {pendingCount} pending
            </span>
          )}
        </h3>
        {canCreateRequest && (
          <button
            onClick={onCreateRequest}
            className="btn-premium btn-premium-primary text-sm"
          >
            <Plus className="w-4 h-4" /> Request Part
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-4 text-[var(--text-muted)]">Loading requests...</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-6 text-[var(--text-muted)]">
          <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No part requests yet</p>
          {canCreateRequest && (
            <p className="text-xs mt-1">Click "Request Part" to submit a request</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <div
              key={request.request_id}
              className="bg-[var(--bg-subtle)] rounded-lg p-3 border border-[var(--border)]"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <span className="text-xs font-medium text-[var(--text-muted)] uppercase">
                    {getRequestTypeLabel(request.request_type)}
                  </span>
                  <p className="text-sm text-[var(--text)] mt-0.5">{request.description}</p>
                </div>
                {getStatusBadge(request.status)}
              </div>

              <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span>
                  By {request.requested_by_user?.full_name || request.requested_by_user?.name || 'Unknown'}
                  {' · '}
                  {new Date(request.created_at).toLocaleString()}
                </span>
                
                <div className="flex items-center gap-3">
                  {/* Edit button - only for technician's own pending requests */}
                  {request.status === 'pending' && 
                   request.requested_by === currentUserId && 
                   roleFlags.isTechnician && 
                   onEditRequest && (
                    <button
                      onClick={() => onEditRequest(request)}
                      className="text-blue-600 hover:underline font-medium flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3" /> Edit
                    </button>
                  )}
                  
                  {/* Review button - for admins/supervisors */}
                  {request.status === 'pending' && canApproveRequest && (
                    <button
                      onClick={() => onApproveRequest(request)}
                      className="text-[var(--accent)] hover:underline font-medium"
                    >
                      Review
                    </button>
                  )}
                </div>
              </div>

              {request.status === 'approved' && request.admin_response_part && (
                <div className="mt-2 pt-2 border-t border-[var(--border-subtle)] text-xs">
                  <span className="text-green-600 font-medium">
                    ✓ {request.admin_response_quantity}x {request.admin_response_part.part_name} added
                  </span>
                  {request.admin_response_notes && (
                    <p className="text-[var(--text-muted)] mt-1">{request.admin_response_notes}</p>
                  )}
                </div>
              )}

              {request.status === 'rejected' && request.admin_response_notes && (
                <div className="mt-2 pt-2 border-t border-[var(--border-subtle)] text-xs">
                  <span className="text-red-600 font-medium">Reason: </span>
                  <span className="text-[var(--text-muted)]">{request.admin_response_notes}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
