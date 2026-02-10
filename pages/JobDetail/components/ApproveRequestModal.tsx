import { AlertTriangle,CheckCircle,Image,Package,PackageX,Send,X,XCircle } from 'lucide-react';
import React,{ useState } from 'react';
import { Combobox,ComboboxOption } from '../../../components/Combobox';
import { usePartsForList } from '../../../hooks/useQueryHooks';
import { JobRequest,Part } from '../../../types';

interface ApproveRequestModalProps {
  show: boolean;
  request: JobRequest | null;
  submitting: boolean;
  onApprove: (partId: string, quantity: number, notes?: string) => void;
  onReject: (notes: string) => void;
  onOutOfStock?: (partId: string, supplierNotes?: string) => void;
  onIssue?: (requestId: string) => void;
  onMarkReceived?: (requestId: string, notes?: string) => void;
  onClose: () => void;
  isStoreAdmin?: boolean;
}

export const ApproveRequestModal: React.FC<ApproveRequestModalProps> = ({
  show,
  request,
  submitting,
  onApprove,
  onReject,
  onOutOfStock,
  onIssue,
  onMarkReceived,
  onClose,
  isStoreAdmin,
}) => {
  const [selectedPartId, setSelectedPartId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [mode, setMode] = useState<'review' | 'approve' | 'reject' | 'out_of_stock'>('review');

  const { data: cachedParts = [] } = usePartsForList();
  const parts = cachedParts as unknown as Part[];

  const partOptions: ComboboxOption[] = parts.map(p => ({
    id: p.part_id,
    label: p.part_name,
    subLabel: `RM${p.sell_price} | Stock: ${p.stock_quantity}`,
  }));

  if (!show || !request) return null;

  const handleApprove = () => {
    if (!selectedPartId || quantity < 1) return;
    onApprove(selectedPartId, quantity, notes || undefined);
  };

  const handleReject = () => {
    if (!notes.trim()) return;
    onReject(notes.trim());
  };

  const handleOutOfStock = () => {
    if (!selectedPartId || !onOutOfStock) return;
    onOutOfStock(selectedPartId, notes || undefined);
  };

  const handleClose = () => {
    setSelectedPartId('');
    setQuantity(1);
    setNotes('');
    setMode('review');
    onClose();
  };

  const getRequestTypeLabel = (type: string) => {
    switch (type) {
      case 'spare_part': return 'Spare Part Request';
      case 'assistance': return 'Assistance Request';
      case 'skillful_technician': return 'Skillful Technician Request';
      default: return type;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-blue-100 text-blue-800',
      issued: 'bg-green-100 text-green-800',
      part_ordered: 'bg-orange-100 text-orange-800',
      out_of_stock: 'bg-red-100 text-red-800',
      rejected: 'bg-red-100 text-red-800',
    };
    const labels: Record<string, string> = {
      pending: 'Pending',
      approved: 'Approved — Ready to Issue',
      issued: 'Issued',
      part_ordered: 'Part Ordered',
      out_of_stock: 'Out of Stock',
      rejected: 'Rejected',
    };
    return (
      <span className={`text-xs font-medium px-2 py-1 rounded-full ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    );
  };

  // For "approved" requests that need issuance (Store Admin flow)
  const showIssueButton = request.status === 'approved' && !request.issued_at && isStoreAdmin && onIssue;
  // For "part_ordered" requests where part has arrived
  const showReceivedButton = request.status === 'part_ordered' && isStoreAdmin && onMarkReceived;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-lg shadow-premium-elevated">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-bold text-lg text-[var(--text)] flex items-center gap-2">
            <Package className="w-5 h-5 text-[var(--accent)]" />
            {getRequestTypeLabel(request.request_type)}
          </h4>
          <div className="flex items-center gap-2">
            {getStatusBadge(request.status)}
            <button onClick={handleClose} className="p-1 hover:bg-[var(--bg-subtle)] rounded-lg">
              <X className="w-5 h-5 text-[var(--text-muted)]" />
            </button>
          </div>
        </div>

        {/* Request Details */}
        <div className="bg-[var(--bg-subtle)] rounded-xl p-4 mb-4">
          <div className="text-sm text-[var(--text-muted)] mb-1">Requested by</div>
          <div className="font-medium text-[var(--text)]">
            {request.requested_by_user?.full_name || request.requested_by_user?.name || 'Unknown'}
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-1">
            {new Date(request.created_at).toLocaleString()}
          </div>
        </div>

        <div className="mb-4">
          <div className="text-sm text-[var(--text-muted)] mb-1">Description</div>
          <p className="text-[var(--text)]">{request.description}</p>
        </div>

        {request.photo_url && (
          <div className="mb-4">
            <div className="text-sm text-[var(--text-muted)] mb-1 flex items-center gap-1">
              <Image className="w-4 h-4" /> Attached Photo
            </div>
            <img
              src={request.photo_url}
              alt="Request attachment"
              className="rounded-lg max-h-40 object-cover"
            />
          </div>
        )}

        {/* Issuance info for already-processed requests */}
        {request.admin_response_part && (
          <div className="bg-[var(--bg-subtle)] rounded-xl p-4 mb-4 border border-[var(--border)]">
            <div className="text-xs text-[var(--text-muted)] mb-1">Approved Part</div>
            <div className="font-medium text-[var(--text)]">
              {request.admin_response_quantity}x {request.admin_response_part.part_name}
              <span className="text-[var(--text-muted)] text-sm ml-2">
                RM{request.admin_response_part.sell_price} each
              </span>
            </div>
            {request.issued_at && (
              <div className="text-xs text-green-600 mt-1">
                ✅ Issued {new Date(request.issued_at).toLocaleString()}
              </div>
            )}
            {request.collected_at && (
              <div className="text-xs text-green-600">
                ✅ Collected {new Date(request.collected_at).toLocaleString()}
              </div>
            )}
            {request.supplier_order_date && (
              <div className="text-xs text-orange-600 mt-1">
                📦 Ordered from supplier {new Date(request.supplier_order_date).toLocaleString()}
                {request.supplier_order_notes && ` — ${request.supplier_order_notes}`}
              </div>
            )}
          </div>
        )}

        {/* Issue Button — for approved requests awaiting physical issuance */}
        {showIssueButton && (
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => onIssue(request.request_id)}
              disabled={submitting}
              className="btn-premium btn-premium-primary w-full disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'Issuing...' : 'Issue Part to Technician'}
            </button>
          </div>
        )}

        {/* Mark Received Button — for ordered parts that arrived */}
        {showReceivedButton && (
          <div className="space-y-3 mt-4">
            <div>
              <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input-premium w-full h-16 resize-none"
                placeholder="Received quantity, condition, etc."
              />
            </div>
            <button
              onClick={() => onMarkReceived(request.request_id, notes || undefined)}
              disabled={submitting}
              className="btn-premium btn-premium-primary w-full disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              {submitting ? 'Updating...' : 'Mark Part as Received'}
            </button>
          </div>
        )}

        {/* Review Mode — only for pending requests */}
        {request.status === 'pending' && mode === 'review' && (
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setMode('reject')}
              className="btn-premium bg-[var(--error)] text-white hover:opacity-90 flex-1"
            >
              <XCircle className="w-4 h-4" /> Reject
            </button>
            {request.request_type === 'spare_part' && onOutOfStock && (
              <button
                onClick={() => setMode('out_of_stock')}
                className="btn-premium bg-orange-500 text-white hover:opacity-90 flex-1"
              >
                <PackageX className="w-4 h-4" /> Out of Stock
              </button>
            )}
            <button
              onClick={() => setMode('approve')}
              className="btn-premium btn-premium-primary flex-1"
            >
              <CheckCircle className="w-4 h-4" /> Approve
            </button>
          </div>
        )}

        {/* Approve Mode */}
        {mode === 'approve' && request.request_type === 'spare_part' && (
          <div className="space-y-4 mt-4 pt-4 border-t border-[var(--border)]">
            <div>
              <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">
                Select Part *
              </label>
              <Combobox
                options={partOptions}
                value={selectedPartId}
                onChange={setSelectedPartId}
                placeholder="Search parts..."
              />
            </div>

            <div>
              <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">
                Quantity *
              </label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="input-premium w-24"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input-premium w-full h-20 resize-none"
                placeholder="Additional notes for the technician..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setMode('review')}
                className="btn-premium btn-premium-secondary flex-1"
                disabled={submitting}
              >
                Back
              </button>
              <button
                onClick={handleApprove}
                disabled={!selectedPartId || quantity < 1 || submitting}
                className="btn-premium btn-premium-primary flex-1 disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                {submitting ? 'Approving...' : 'Confirm Approval'}
              </button>
            </div>
          </div>
        )}

        {/* Approve Mode for non-spare-part requests */}
        {mode === 'approve' && request.request_type !== 'spare_part' && (
          <div className="space-y-4 mt-4 pt-4 border-t border-[var(--border)]">
            <div>
              <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input-premium w-full h-20 resize-none"
                placeholder="Additional notes..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setMode('review')}
                className="btn-premium btn-premium-secondary flex-1"
                disabled={submitting}
              >
                Back
              </button>
              <button
                onClick={() => onApprove('', 0, notes || undefined)}
                disabled={submitting}
                className="btn-premium btn-premium-primary flex-1 disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                {submitting ? 'Approving...' : 'Confirm Approval'}
              </button>
            </div>
          </div>
        )}

        {/* Out of Stock Mode */}
        {mode === 'out_of_stock' && (
          <div className="space-y-4 mt-4 pt-4 border-t border-[var(--border)]">
            <div className="flex items-center gap-2 text-orange-500">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-medium">Part Out of Stock — Order from Supplier</span>
            </div>

            <div>
              <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">
                Select Part *
              </label>
              <Combobox
                options={partOptions}
                value={selectedPartId}
                onChange={setSelectedPartId}
                placeholder="Search parts..."
              />
            </div>

            <div>
              <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">
                Supplier / Order Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input-premium w-full h-20 resize-none"
                placeholder="Supplier name, PO number, expected delivery date..."
              />
            </div>

            <p className="text-xs text-[var(--text-muted)]">
              This will set the job to &ldquo;Pending Parts&rdquo; status until the part arrives.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setMode('review')}
                className="btn-premium btn-premium-secondary flex-1"
                disabled={submitting}
              >
                Back
              </button>
              <button
                onClick={handleOutOfStock}
                disabled={!selectedPartId || submitting}
                className="btn-premium bg-orange-500 text-white hover:opacity-90 flex-1 disabled:opacity-50"
              >
                <PackageX className="w-4 h-4" />
                {submitting ? 'Processing...' : 'Mark Out of Stock & Order'}
              </button>
            </div>
          </div>
        )}

        {/* Reject Mode */}
        {mode === 'reject' && (
          <div className="space-y-4 mt-4 pt-4 border-t border-[var(--border)]">
            <div>
              <label className="text-sm font-medium text-[var(--text-muted)] mb-2 block">
                Reason for Rejection *
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input-premium w-full h-24 resize-none"
                placeholder="Explain why this request is being rejected..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setMode('review')}
                className="btn-premium btn-premium-secondary flex-1"
                disabled={submitting}
              >
                Back
              </button>
              <button
                onClick={handleReject}
                disabled={!notes.trim() || submitting}
                className="btn-premium bg-[var(--error)] text-white hover:opacity-90 flex-1 disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                {submitting ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
