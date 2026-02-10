import { AlertTriangle,CheckCircle,Clock,Edit3,Package,PackageCheck,Plus,Truck,XCircle } from 'lucide-react';
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
  onIssuePartToTechnician?: (requestId: string) => void;
  onMarkOutOfStock?: (requestId: string, partId: string, notes?: string) => void;
  onMarkPartReceived?: (requestId: string, notes?: string) => void;
  onConfirmPartCollection?: (requestId: string) => void;
}

export const JobRequestsSection: React.FC<JobRequestsSectionProps> = ({
  job,
  roleFlags,
  statusFlags,
  currentUserId,
  onCreateRequest,
  onApproveRequest,
  onEditRequest,
  onIssuePartToTechnician,
  onMarkOutOfStock,
  onMarkPartReceived,
  onConfirmPartCollection,
}) => {
  const [requests, setRequests] = useState<JobRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRequests();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      case 'issued':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
            <PackageCheck className="w-3 h-3" /> Issued
          </span>
        );
      case 'out_of_stock':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
            <AlertTriangle className="w-3 h-3" /> Out of Stock
          </span>
        );
      case 'part_ordered':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
            <Truck className="w-3 h-3" /> Part Ordered
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
                
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Edit button - only for technician's own pending requests */}
                  {request.status === 'pending' && 
                   request.requested_by === currentUserId && 
                   roleFlags.isTechnician && 
                   onEditRequest && (
                    <button
                      onClick={() => onEditRequest(request)}
                      className="text-blue-600 hover:underline font-medium flex items-center gap-1 text-xs"
                    >
                      <Edit3 className="w-3 h-3" /> Edit
                    </button>
                  )}
                  
                  {/* Review button - for admins/supervisors on pending requests */}
                  {request.status === 'pending' && canApproveRequest && (
                    <button
                      onClick={() => onApproveRequest(request)}
                      className="text-[var(--accent)] hover:underline font-medium text-xs"
                    >
                      Review
                    </button>
                  )}

                  {/* Issue button - Store admin issues approved part to tech */}
                  {request.status === 'approved' && !request.issued_at && (roleFlags.isAdmin || roleFlags.isAdminStore) && onIssuePartToTechnician && (
                    <button
                      onClick={() => onIssuePartToTechnician(request.request_id)}
                      className="text-blue-600 hover:underline font-medium flex items-center gap-1 text-xs"
                    >
                      <PackageCheck className="w-3 h-3" /> Issue Part
                    </button>
                  )}

                  {/* Out of Stock button - Store admin marks part unavailable */}
                  {request.status === 'pending' && request.request_type === 'spare_part' && (roleFlags.isAdmin || roleFlags.isAdminStore) && onMarkOutOfStock && (
                    <button
                      onClick={() => {
                        const notes = prompt('Supplier order notes (optional):');
                        onMarkOutOfStock(request.request_id, request.admin_response_part_id || '', notes || undefined);
                      }}
                      className="text-orange-600 hover:underline font-medium flex items-center gap-1 text-xs"
                    >
                      <AlertTriangle className="w-3 h-3" /> Out of Stock
                    </button>
                  )}

                  {/* Mark Received - Store admin marks ordered part as arrived */}
                  {request.status === 'part_ordered' && (roleFlags.isAdmin || roleFlags.isAdminStore) && onMarkPartReceived && (
                    <button
                      onClick={() => onMarkPartReceived(request.request_id)}
                      className="text-green-600 hover:underline font-medium flex items-center gap-1 text-xs"
                    >
                      <Package className="w-3 h-3" /> Mark Received
                    </button>
                  )}

                  {/* Confirm Collection - Technician confirms they picked up the part */}
                  {request.status === 'issued' && !request.collected_at && request.requested_by === currentUserId && onConfirmPartCollection && (
                    <button
                      onClick={() => onConfirmPartCollection(request.request_id)}
                      className="text-green-600 hover:underline font-medium flex items-center gap-1 text-xs"
                    >
                      <CheckCircle className="w-3 h-3" /> Confirm Collection
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

              {request.status === 'issued' && (
                <div className="mt-2 pt-2 border-t border-[var(--border-subtle)] text-xs">
                  <span className="text-blue-600 font-medium">
                    ✓ Part issued{request.issued_at ? ` on ${new Date(request.issued_at).toLocaleString()}` : ''}
                  </span>
                  {request.collected_at && (
                    <span className="text-green-600 ml-2">· Collected {new Date(request.collected_at).toLocaleString()}</span>
                  )}
                </div>
              )}

              {request.status === 'part_ordered' && (
                <div className="mt-2 pt-2 border-t border-[var(--border-subtle)] text-xs">
                  <span className="text-purple-600 font-medium">
                    ⏳ Ordered from supplier{request.supplier_order_date ? ` on ${new Date(request.supplier_order_date).toLocaleString()}` : ''}
                  </span>
                  {request.supplier_order_notes && (
                    <p className="text-[var(--text-muted)] mt-1">{request.supplier_order_notes}</p>
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
