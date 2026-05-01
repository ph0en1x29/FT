/**
 * QuotationModal — ACWER Phase 10 / Tier 4.1
 *
 * Create + edit a quotation for a customer (Path B chargeable workflow).
 * Items are added inline in a small editable table; subtotal / tax / total
 * recompute on every change.
 *
 * Status transitions (draft → sent → accepted/rejected) and convert-to-job
 * are handled by the parent QuotationsSection — this modal only covers
 * create/edit.
 */
import { Loader2, Plus, Trash2, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import {
  createQuotation,
  updateQuotation,
} from '../../../services/quotationService';
import { showToast } from '../../../services/toastService';
import type { Customer, Quotation, QuotationItem, User } from '../../../types';

interface Props {
  isOpen: boolean;
  customer: Customer;
  quotation: Quotation | null;
  currentUser: User;
  onClose: () => void;
  onSaved: () => void;
}

const blankItem = (n: number): QuotationItem => ({
  item_number: n,
  description: '',
  quantity: 1,
  unit_price: 0,
  amount: 0,
});

const QuotationModal: React.FC<Props> = ({ isOpen, customer, quotation, currentUser, onClose, onSaved }) => {
  const editing = quotation !== null;
  const [attention, setAttention] = useState('');
  const [reference, setReference] = useState('');
  const [items, setItems] = useState<QuotationItem[]>([blankItem(1)]);
  const [validity, setValidity] = useState('30 days');
  const [deliveryTerm, setDeliveryTerm] = useState('Ex Works');
  const [paymentTerm, setPaymentTerm] = useState('Net 30');
  const [remark, setRemark] = useState('');
  const [taxRate, setTaxRate] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setAttention(quotation?.attention ?? customer.contact_person ?? '');
    setReference(quotation?.reference ?? '');
    setItems(quotation?.items?.length ? quotation.items : [blankItem(1)]);
    setValidity(quotation?.validity ?? '30 days');
    setDeliveryTerm(quotation?.delivery_term ?? 'Ex Works');
    setPaymentTerm(quotation?.payment_term ?? 'Net 30');
    setRemark(quotation?.remark ?? '');
    setTaxRate(Number(quotation?.tax_rate ?? 0));
  }, [isOpen, quotation, customer.contact_person]);

  const subtotal = useMemo(
    () => items.reduce((acc, i) => acc + i.amount, 0),
    [items],
  );
  const taxAmount = useMemo(() => subtotal * (taxRate / 100), [subtotal, taxRate]);
  const total = useMemo(() => subtotal + taxAmount, [subtotal, taxAmount]);

  const isValid = items.length > 0
    && items.every(i => i.description.trim() && i.quantity > 0)
    && attention.trim() !== ''
    && reference.trim() !== '';

  if (!isOpen) return null;

  const updateItem = (idx: number, patch: Partial<QuotationItem>) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const next = { ...it, ...patch };
      next.amount = Number((next.quantity * next.unit_price).toFixed(2));
      return next;
    }));
  };

  const addRow = () => {
    setItems(prev => [...prev, blankItem(prev.length + 1)]);
  };

  const removeRow = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx).map((it, i) => ({ ...it, item_number: i + 1 })));
  };

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      const payload = {
        customer_id: customer.customer_id,
        date: new Date().toISOString(),
        attention: attention.trim(),
        reference: reference.trim(),
        items,
        sub_total: Number(subtotal.toFixed(2)),
        tax_rate: taxRate,
        tax_amount: Number(taxAmount.toFixed(2)),
        total: Number(total.toFixed(2)),
        validity,
        delivery_term: deliveryTerm,
        payment_term: paymentTerm,
        remark: remark.trim() || null,
      };
      if (editing && quotation) {
        await updateQuotation(quotation.quotation_id, payload);
        showToast.success('Quotation updated');
      } else {
        const result = await createQuotation(payload, currentUser.user_id, currentUser.name);
        showToast.success(`Quotation ${result.quotation_number} created`);
      }
      onSaved();
      onClose();
    } catch (e) {
      showToast.error('Could not save quotation', (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] rounded-xl shadow-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)] sticky top-0 bg-[var(--surface)]">
          <h2 className="text-lg font-semibold">{editing ? `Edit quotation ${quotation?.quotation_number}` : 'New quotation'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-[var(--bg-subtle)] rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-[var(--text-muted)]">Attention</span>
              <input
                type="text"
                value={attention}
                onChange={e => setAttention(e.target.value)}
                placeholder="Recipient name"
                className="mt-1 w-full border border-[var(--border)] rounded px-2 py-1.5 bg-[var(--surface)]"
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--text-muted)]">Reference (RE:)</span>
              <input
                type="text"
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="e.g. Forklift maintenance contract"
                className="mt-1 w-full border border-[var(--border)] rounded px-2 py-1.5 bg-[var(--surface)]"
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--text-muted)]">Validity</span>
              <input
                type="text"
                value={validity}
                onChange={e => setValidity(e.target.value)}
                className="mt-1 w-full border border-[var(--border)] rounded px-2 py-1.5 bg-[var(--surface)]"
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--text-muted)]">Tax rate %</span>
              <input
                type="number"
                value={taxRate}
                onChange={e => setTaxRate(Number(e.target.value) || 0)}
                min="0"
                step="0.01"
                className="mt-1 w-full border border-[var(--border)] rounded px-2 py-1.5 bg-[var(--surface)]"
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--text-muted)]">Delivery term</span>
              <input
                type="text"
                value={deliveryTerm}
                onChange={e => setDeliveryTerm(e.target.value)}
                className="mt-1 w-full border border-[var(--border)] rounded px-2 py-1.5 bg-[var(--surface)]"
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--text-muted)]">Payment term</span>
              <input
                type="text"
                value={paymentTerm}
                onChange={e => setPaymentTerm(e.target.value)}
                className="mt-1 w-full border border-[var(--border)] rounded px-2 py-1.5 bg-[var(--surface)]"
              />
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold">Items</p>
              <button
                onClick={addRow}
                className="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add row
              </button>
            </div>
            <div className="border border-[var(--border)] rounded overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-[var(--bg-subtle)]">
                  <tr>
                    <th className="px-2 py-1.5 text-left w-10">#</th>
                    <th className="px-2 py-1.5 text-left">Description</th>
                    <th className="px-2 py-1.5 text-right w-16">Qty</th>
                    <th className="px-2 py-1.5 text-right w-24">Unit price</th>
                    <th className="px-2 py-1.5 text-right w-28">Amount</th>
                    <th className="px-2 py-1.5 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={idx} className="border-t border-[var(--border)]">
                      <td className="px-2 py-1">{it.item_number}</td>
                      <td className="px-2 py-1">
                        <input
                          type="text"
                          value={it.description}
                          onChange={e => updateItem(idx, { description: e.target.value })}
                          placeholder="Item description"
                          className="w-full border-0 bg-transparent focus:ring-1 focus:ring-blue-500 rounded px-1"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          value={it.quantity}
                          onChange={e => updateItem(idx, { quantity: Number(e.target.value) || 0 })}
                          min="0"
                          className="w-full text-right border-0 bg-transparent focus:ring-1 focus:ring-blue-500 rounded px-1"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          value={it.unit_price}
                          onChange={e => updateItem(idx, { unit_price: Number(e.target.value) || 0 })}
                          min="0"
                          step="0.01"
                          className="w-full text-right border-0 bg-transparent focus:ring-1 focus:ring-blue-500 rounded px-1"
                        />
                      </td>
                      <td className="px-2 py-1 text-right">{it.amount.toFixed(2)}</td>
                      <td className="px-2 py-1">
                        {items.length > 1 && (
                          <button
                            onClick={() => removeRow(idx)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                            title="Remove row"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-[var(--bg-subtle)] text-sm">
                  <tr className="border-t border-[var(--border)]">
                    <td colSpan={4} className="px-2 py-1 text-right">Subtotal</td>
                    <td className="px-2 py-1 text-right">{subtotal.toFixed(2)}</td>
                    <td></td>
                  </tr>
                  {taxRate > 0 && (
                    <tr>
                      <td colSpan={4} className="px-2 py-1 text-right">Tax ({taxRate}%)</td>
                      <td className="px-2 py-1 text-right">{taxAmount.toFixed(2)}</td>
                      <td></td>
                    </tr>
                  )}
                  <tr className="font-bold">
                    <td colSpan={4} className="px-2 py-1.5 text-right">Total (RM)</td>
                    <td className="px-2 py-1.5 text-right">{total.toFixed(2)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <label className="block text-sm">
            <span className="text-[var(--text-muted)]">Remark</span>
            <textarea
              value={remark}
              onChange={e => setRemark(e.target.value)}
              rows={2}
              className="mt-1 w-full border border-[var(--border)] rounded px-2 py-1.5 bg-[var(--surface)]"
            />
          </label>
        </div>

        <div className="p-4 border-t border-[var(--border)] flex items-center justify-end gap-2 sticky bottom-0 bg-[var(--surface)]">
          <button onClick={onClose} className="px-3 py-1.5 text-sm hover:bg-[var(--bg-subtle)] rounded">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid || saving}
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded inline-flex items-center gap-1.5"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {editing ? 'Save changes' : 'Create quotation'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuotationModal;
