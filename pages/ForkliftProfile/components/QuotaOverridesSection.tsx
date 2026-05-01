/**
 * QuotaOverridesSection — ACWER Phase 6 + Tier 3.2 admin override UI on
 * ForkliftProfile (company-owned only). Lets admin add per-forklift quota
 * exceptions ("FLT-12 gets 6 tires/year because heavy duty cycle").
 *
 * Globals (Wheels & Tyres / Lights & Bulbs / Filters at 4/year) are the
 * fallback; per-forklift rows here override them for THIS forklift only.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, ShieldOff, Sliders } from 'lucide-react';
import React, { useState } from 'react';

import {
  createQuota,
  deactivateQuota,
  listQuotas,
  listQuotasForForklift,
} from '../../../services/partsUsageQuotaService';
import { showToast } from '../../../services/toastService';
import type { Forklift, PartsUsageQuota, User } from '../../../types';

interface Props {
  forklift: Forklift;
  currentUser: User;
}

const QuotaOverridesSection: React.FC<Props> = ({ forklift, currentUser }) => {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [category, setCategory] = useState('');
  const [maxQty, setMaxQty] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const role = currentUser.role.toString().toLowerCase();
  const canManage = role === 'admin' || role === 'admin_service' || role === 'admin_store' || role === 'supervisor';
  const isFleet = forklift.ownership === 'company';

  const { data: forkliftOverrides = [] } = useQuery({
    queryKey: ['parts-usage-quotas', forklift.forklift_id],
    queryFn: () => listQuotasForForklift(forklift.forklift_id),
    enabled: isFleet,
  });
  const { data: globals = [] } = useQuery({
    queryKey: ['parts-usage-quotas', 'global'],
    queryFn: () => listQuotas({ scope_type: 'global', active_only: true }),
    enabled: isFleet,
  });

  if (!isFleet) return null;

  const handleAdd = async () => {
    if (!category.trim() || !maxQty || Number(maxQty) <= 0) {
      showToast.error('Category and a positive max quantity are required');
      return;
    }
    setSaving(true);
    try {
      await createQuota({
        scope_type: 'per_forklift',
        scope_id: forklift.forklift_id,
        part_category: category.trim(),
        period_unit: 'year',
        max_quantity: Number(maxQty),
        notes: notes.trim() || null,
      });
      showToast.success('Override added');
      queryClient.invalidateQueries({ queryKey: ['parts-usage-quotas', forklift.forklift_id] });
      setShowAdd(false);
      setCategory('');
      setMaxQty('');
      setNotes('');
    } catch (e) {
      showToast.error('Could not add override', (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (q: PartsUsageQuota) => {
    if (!confirm(`Deactivate the override "${q.part_category}" (${q.max_quantity}/${q.period_unit})?`)) return;
    try {
      await deactivateQuota(q.quota_id);
      showToast.success('Override deactivated');
      queryClient.invalidateQueries({ queryKey: ['parts-usage-quotas', forklift.forklift_id] });
    } catch (e) {
      showToast.error('Could not deactivate', (e as Error).message);
    }
  };

  return (
    <div className="bg-[var(--surface)] rounded-xl shadow-sm border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold inline-flex items-center gap-2">
          <Sliders className="w-4 h-4" />
          Consumable quota overrides
          <span className="ml-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600 font-normal">
            {forkliftOverrides.length} for this forklift
          </span>
        </h3>
        {canManage && !showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Add override
          </button>
        )}
      </div>

      {globals.length > 0 && (
        <p className="text-xs text-[var(--text-muted)] mb-2">
          Global defaults active: {(globals as PartsUsageQuota[]).map(g => `${g.part_category} ${g.max_quantity}/${g.period_unit}`).join(' · ')}
        </p>
      )}

      {forkliftOverrides.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">No per-forklift overrides — global defaults apply.</p>
      ) : (
        <ul className="space-y-1.5 mb-2">
          {(forkliftOverrides as PartsUsageQuota[]).map(q => (
            <li key={q.quota_id} className="border border-emerald-200 bg-emerald-50/30 dark:bg-emerald-900/10 rounded px-3 py-2 flex items-center justify-between text-sm">
              <div>
                <span className="font-semibold">{q.part_category ?? '(any category)'}</span>
                <span className="text-[var(--text-muted)] ml-2">{q.max_quantity}/{q.period_unit}</span>
                {q.notes && <span className="text-xs text-[var(--text-muted)] ml-2">— {q.notes}</span>}
              </div>
              {canManage && (
                <button
                  onClick={() => handleDeactivate(q)}
                  className="p-1 rounded hover:bg-red-50 text-[var(--text-muted)] hover:text-red-600"
                  title="Deactivate"
                >
                  <ShieldOff className="w-3.5 h-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {showAdd && canManage && (
        <div className="border border-[var(--border)] rounded p-3 mt-2 space-y-2">
          <label className="block text-xs">
            <span className="text-[var(--text-muted)]">Category (must match parts.category exactly)</span>
            <input
              type="text"
              value={category}
              onChange={e => setCategory(e.target.value)}
              placeholder="e.g. Wheels & Tyres"
              className="mt-0.5 w-full border border-[var(--border)] rounded px-2 py-1 bg-[var(--surface)] text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="text-[var(--text-muted)]">Max per year</span>
            <input
              type="number"
              value={maxQty}
              onChange={e => setMaxQty(e.target.value)}
              min="1"
              className="mt-0.5 w-full border border-[var(--border)] rounded px-2 py-1 bg-[var(--surface)] text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="text-[var(--text-muted)]">Notes (optional)</span>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. heavy duty cycle"
              className="mt-0.5 w-full border border-[var(--border)] rounded px-2 py-1 bg-[var(--surface)] text-sm"
            />
          </label>
          <div className="flex justify-end gap-2 mt-1">
            <button
              onClick={() => { setShowAdd(false); setCategory(''); setMaxQty(''); setNotes(''); }}
              className="px-2 py-1 text-xs hover:bg-[var(--bg-subtle)] rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={saving || !category.trim() || !maxQty}
              className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded inline-flex items-center gap-1"
            >
              {saving && <Loader2 className="w-3 h-3 animate-spin" />}
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuotaOverridesSection;
