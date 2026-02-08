import { CheckCircle,Image,Package,X,XCircle } from 'lucide-react';
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
  onClose: () => void;
}

export const ApproveRequestModal: React.FC<ApproveRequestModalProps> = ({
  show,
  request,
  submitting,
  onApprove,
  onReject,
  onClose,
}) => {
  const [selectedPartId, setSelectedPartId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [mode, setMode] = useState<'review' | 'approve' | 'reject'>('review');

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

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] rounded-2xl p-6 w-full max-w-lg shadow-premium-elevated">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-bold text-lg text-[var(--text)] flex items-center gap-2">
            <Package className="w-5 h-5 text-[var(--accent)]" />
            {getRequestTypeLabel(request.request_type)}
          </h4>
          <button onClick={handleClose} className="p-1 hover:bg-[var(--bg-subtle)] rounded-lg">
            <X className="w-5 h-5 text-[var(--text-muted)]" />
          </button>
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

        {/* Review Mode */}
        {mode === 'review' && (
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setMode('reject')}
              className="btn-premium bg-[var(--error)] text-white hover:opacity-90 flex-1"
            >
              <XCircle className="w-4 h-4" /> Reject
            </button>
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
