import { CheckCircle, Clock, Loader2, XCircle } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../../services/supabaseClient';
import { showToast } from '../../../services/toastService';
import { User } from '../../../types';

interface PendingAdjustment {
  movement_id: string;
  part_id: string;
  bulk_qty_change: number;
  adjustment_reason: string;
  notes: string | null;
  performed_by: string;
  performed_by_name: string | null;
  performed_at: string;
  parts?: { part_name: string } | null;
}

interface PendingAdjustmentsTabProps {
  currentUser: User;
}

const PendingAdjustmentsTab: React.FC<PendingAdjustmentsTabProps> = ({ currentUser }) => {
  const [adjustments, setAdjustments] = useState<PendingAdjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ id: string; partName: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('inventory_movements')
      .select('movement_id, part_id, bulk_qty_change, adjustment_reason, notes, performed_by, performed_by_name, performed_at, parts(part_name)')
      .eq('is_pending', true)
      .eq('movement_type', 'adjustment')
      .order('performed_at', { ascending: false });

    if (!error && data) {
      setAdjustments(data as unknown as PendingAdjustment[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (adj: PendingAdjustment) => {
    // No self-approval
    if (adj.performed_by === currentUser.user_id) {
      showToast.error('You cannot approve your own adjustment.');
      return;
    }

    setProcessingId(adj.movement_id);
    try {
      // 1. Mark movement as approved
      const { error: updateErr } = await supabase
        .from('inventory_movements')
        .update({
          is_pending: false,
          approved_by: currentUser.user_id,
          approved_at: new Date().toISOString(),
        })
        .eq('movement_id', adj.movement_id);

      if (updateErr) throw updateErr;

      // 2. Apply qty change to parts table
      const { data: partData, error: partErr } = await supabase
        .from('parts')
        .select('bulk_quantity')
        .eq('part_id', adj.part_id)
        .single();

      if (partErr) throw partErr;

      const currentBulk = partData?.bulk_quantity ?? 0;
      const newBulk = Math.max(0, currentBulk + adj.bulk_qty_change);

      const { error: updatePartErr } = await supabase
        .from('parts')
        .update({ bulk_quantity: newBulk })
        .eq('part_id', adj.part_id);

      if (updatePartErr) throw updatePartErr;

      showToast.success('Adjustment approved and applied.');
      await load();
    } catch (e: unknown) {
      showToast.error('Failed to approve', e instanceof Error ? e.message : undefined);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectModal) return;
    if (!rejectReason.trim()) {
      showToast.error('Please enter a rejection reason.');
      return;
    }

    setProcessingId(rejectModal.id);
    try {
      const { data: existing } = await supabase
        .from('inventory_movements')
        .select('notes')
        .eq('movement_id', rejectModal.id)
        .single();

      const existingNotes = existing?.notes ?? '';
      const updatedNotes = existingNotes
        ? `${existingNotes}\n[REJECTED] ${rejectReason}`
        : `[REJECTED] ${rejectReason}`;

      const { error } = await supabase
        .from('inventory_movements')
        .update({
          is_pending: false,
          approved_by: currentUser.user_id,
          approved_at: new Date().toISOString(),
          notes: updatedNotes,
        })
        .eq('movement_id', rejectModal.id);

      if (error) throw error;

      showToast.success('Adjustment rejected.');
      setRejectModal(null);
      setRejectReason('');
      await load();
    } catch (e: unknown) {
      showToast.error('Failed to reject', e instanceof Error ? e.message : undefined);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-[var(--text-muted)]">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading pending adjustments...
      </div>
    );
  }

  if (adjustments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-[var(--text-muted)]">
        <CheckCircle className="w-10 h-10 mb-3 text-green-400" />
        <p className="font-medium">No pending adjustments</p>
        <p className="text-sm mt-1">All stock adjustments have been reviewed.</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg-subtle)]">
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Date</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Part</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Change</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Reason</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Requested By</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody>
            {adjustments.map(adj => {
              const partName = adj.parts?.part_name ?? adj.part_id;
              const isOwnAdjustment = adj.performed_by === currentUser.user_id;
              const isProcessing = processingId === adj.movement_id;

              return (
                <tr key={adj.movement_id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-subtle)] transition-colors">
                  <td className="px-4 py-3 text-[var(--text-muted)] whitespace-nowrap">
                    {new Date(adj.performed_at).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 font-medium text-[var(--text)]">{partName}</td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold ${adj.bulk_qty_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {adj.bulk_qty_change >= 0 ? '+' : ''}{adj.bulk_qty_change.toFixed(2)} L
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-500" />
                      <span className="text-[var(--text)]">{adj.adjustment_reason}</span>
                    </span>
                    {adj.notes && (
                      <p className="text-xs text-[var(--text-muted)] mt-0.5 max-w-xs truncate">{adj.notes}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{adj.performed_by_name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {isOwnAdjustment ? (
                        <span className="text-xs text-[var(--text-muted)] italic">Cannot self-approve</span>
                      ) : (
                        <>
                          <button
                            onClick={() => handleApprove(adj)}
                            disabled={isProcessing}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
                          >
                            {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                            Approve
                          </button>
                          <button
                            onClick={() => setRejectModal({ id: adj.movement_id, partName })}
                            disabled={isProcessing}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                          >
                            <XCircle className="w-3 h-3" />
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Reject reason modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm bg-[var(--surface)] rounded-2xl shadow-xl p-5 space-y-4">
            <h3 className="font-semibold text-[var(--text)]">Reject Adjustment</h3>
            <p className="text-sm text-[var(--text-muted)]">
              Rejecting adjustment for <strong>{rejectModal.partName}</strong>. Please provide a reason.
            </p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Reason for rejection..."
              rows={3}
              className="input-premium text-sm w-full resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setRejectModal(null); setRejectReason(''); }}
                className="btn-premium btn-premium-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectConfirm}
                disabled={!!processingId}
                className="btn-premium flex-1 bg-red-500 hover:bg-red-600 text-white disabled:opacity-50"
              >
                {processingId ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PendingAdjustmentsTab;
