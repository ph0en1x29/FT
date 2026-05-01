/**
 * QuotationsSection — ACWER Phase 10 / Tier 4.1.
 *
 * Lists all quotations for a customer + status transitions + create/edit.
 * Renders on CustomerProfilePage. Integrates with the quotationService
 * shipped in Phase 10.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, FileQuestion, Pencil, Plus, Send, XCircle } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  listQuotations,
  markQuotationAccepted,
  markQuotationRejected,
  markQuotationSent,
} from '../../../services/quotationService';
import { showToast } from '../../../services/toastService';
import type { Customer, Quotation, User } from '../../../types';
import QuotationModal from './QuotationModal';

interface Props {
  customer: Customer;
  currentUser: User;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  sent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  accepted: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const QuotationsSection: React.FC<Props> = ({ customer, currentUser }) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Quotation | null>(null);

  const role = currentUser.role.toString().toLowerCase();
  const canManage = role === 'admin' || role === 'admin_service' || role === 'supervisor';

  const { data: quotations = [], isLoading } = useQuery({
    queryKey: ['quotations', customer.customer_id],
    queryFn: () => listQuotations({ customer_id: customer.customer_id }),
  });

  const handleSent = async (q: Quotation) => {
    try {
      await markQuotationSent(q.quotation_id);
      showToast.success('Marked as sent');
      queryClient.invalidateQueries({ queryKey: ['quotations', customer.customer_id] });
    } catch (e) {
      showToast.error('Could not mark sent', (e as Error).message);
    }
  };
  const handleAccepted = async (q: Quotation) => {
    try {
      await markQuotationAccepted(q.quotation_id);
      showToast.success('Marked as accepted');
      queryClient.invalidateQueries({ queryKey: ['quotations', customer.customer_id] });
    } catch (e) {
      showToast.error('Could not mark accepted', (e as Error).message);
    }
  };
  const handleRejected = async (q: Quotation) => {
    if (!confirm('Mark this quotation as rejected?')) return;
    try {
      await markQuotationRejected(q.quotation_id);
      showToast.success('Marked as rejected');
      queryClient.invalidateQueries({ queryKey: ['quotations', customer.customer_id] });
    } catch (e) {
      showToast.error('Could not mark rejected', (e as Error).message);
    }
  };
  const handleConvertToJob = (q: Quotation) => {
    navigate(`/jobs/new?customer_id=${customer.customer_id}&quotation_id=${q.quotation_id}`);
  };

  return (
    <>
      <div className="bg-[var(--surface)] rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold inline-flex items-center gap-2">
            <FileQuestion className="w-4 h-4" />
            Quotations
            <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600 font-normal">
              {quotations.length}
            </span>
          </h3>
          {canManage && (
            <button
              onClick={() => { setEditing(null); setShowModal(true); }}
              className="text-sm px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> New quotation
            </button>
          )}
        </div>

        {isLoading ? (
          <p className="text-sm text-[var(--text-muted)]">Loading…</p>
        ) : quotations.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No quotations yet for this customer.</p>
        ) : (
          <ul className="space-y-2">
            {quotations.map((q: Quotation) => (
              <li key={q.quotation_id} className="border border-[var(--border)] rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-semibold text-sm">{q.quotation_number}</span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] uppercase font-bold ${STATUS_COLORS[q.status] ?? STATUS_COLORS.draft}`}>
                        {q.status}
                      </span>
                      <span className="text-sm text-[var(--text-muted)]">
                        RM {Number(q.total).toFixed(2)}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      <strong>RE:</strong> {q.reference}
                      {q.attention && <> · attn: {q.attention}</>}
                      <> · {new Date(q.date).toISOString().slice(0, 10)}</>
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {q.status === 'draft' && (
                        <>
                          <button onClick={() => { setEditing(q); setShowModal(true); }} className="p-1.5 rounded hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text)]" title="Edit">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleSent(q)} className="p-1.5 rounded hover:bg-blue-50 text-[var(--text-muted)] hover:text-blue-600" title="Mark as sent">
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      {q.status === 'sent' && (
                        <>
                          <button onClick={() => handleAccepted(q)} className="p-1.5 rounded hover:bg-emerald-50 text-[var(--text-muted)] hover:text-emerald-600" title="Mark as accepted">
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleRejected(q)} className="p-1.5 rounded hover:bg-red-50 text-[var(--text-muted)] hover:text-red-600" title="Mark as rejected">
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      {q.status === 'accepted' && !q.job_id && (
                        <button onClick={() => handleConvertToJob(q)} className="text-xs px-2 py-0.5 rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:border-emerald-700">
                          Convert to job
                        </button>
                      )}
                      {q.status === 'accepted' && q.job_id && (
                        <button onClick={() => navigate(`/jobs/${q.job_id}`)} className="text-xs px-2 py-0.5 rounded border border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:border-emerald-700">
                          View job
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <QuotationModal
        isOpen={showModal}
        customer={customer}
        quotation={editing}
        currentUser={currentUser}
        onClose={() => { setShowModal(false); setEditing(null); }}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['quotations', customer.customer_id] })}
      />
    </>
  );
};

export default QuotationsSection;
