/**
 * PathOverrideModal — combined modal for ACWER admin overrides on a job:
 *   - Mark/unmark as accident (Phase 6 — flips Path C to chargeable on save)
 *   - Manual override of billing_path with reason (Phase 1+ — for restoring
 *     auto-flipped jobs to AMC, or correcting misclassifications)
 *
 * Two modes selected via the `mode` prop. The single component avoids
 * duplicating the visual chrome between two near-identical modals.
 */
import { Loader2, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { markJobAsAccident, overrideBillingPath } from '../../../services/jobService';
import { showToast } from '../../../services/toastService';
import type { Job, User } from '../../../types';

type Mode = 'accident' | 'override';

interface Props {
  isOpen: boolean;
  mode: Mode;
  job: Job;
  currentUser: User;
  onClose: () => void;
  onSaved: (updated: Job) => void;
}

const PATH_OPTIONS: Array<{ value: 'amc' | 'chargeable' | 'fleet' | 'unset'; label: string }> = [
  { value: 'amc', label: 'Path A — AMC (under contract)' },
  { value: 'chargeable', label: 'Path B — Chargeable (ad-hoc)' },
  { value: 'fleet', label: 'Path C — Fleet (Acwer-owned)' },
  { value: 'unset', label: 'Unset (clear classification)' },
];

const PathOverrideModal: React.FC<Props> = ({ isOpen, mode, job, currentUser, onClose, onSaved }) => {
  const [accidentNotes, setAccidentNotes] = useState('');
  const [clearAccident, setClearAccident] = useState(false);
  const [newPath, setNewPath] = useState<'amc' | 'chargeable' | 'fleet' | 'unset'>('amc');
  const [overrideReason, setOverrideReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setAccidentNotes(job.accident_notes ?? '');
    setClearAccident(false);
    setNewPath((job.billing_path && job.billing_path !== 'unset' ? job.billing_path : 'amc') as 'amc' | 'chargeable' | 'fleet' | 'unset');
    setOverrideReason('');
  }, [isOpen, job]);

  if (!isOpen) return null;

  const isCurrentlyAccident = job.is_accident === true;

  const handleSave = async () => {
    setSaving(true);
    try {
      if (mode === 'accident') {
        const setTo = clearAccident ? false : true;
        const updated = await markJobAsAccident(
          job.job_id,
          setTo,
          setTo ? accidentNotes.trim() || null : null,
          currentUser.user_id,
          currentUser.name,
        );
        showToast.success(setTo ? 'Marked as accident' : 'Accident flag cleared');
        onSaved(updated);
        onClose();
      } else {
        if (!overrideReason.trim()) {
          showToast.error('Override reason is required');
          return;
        }
        const updated = await overrideBillingPath(
          job.job_id,
          newPath,
          overrideReason.trim(),
          currentUser.user_id,
          currentUser.name,
        );
        showToast.success(`Path overridden to ${newPath.toUpperCase()}`);
        onSaved(updated);
        onClose();
      }
    } catch (e) {
      showToast.error('Could not save', (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] rounded-xl shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h2 className="text-base font-semibold">
            {mode === 'accident' ? (isCurrentlyAccident ? 'Edit accident flag' : 'Mark as accident') : 'Override billing path'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-[var(--bg-subtle)] rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {mode === 'accident' ? (
            <>
              <p className="text-sm text-[var(--text-muted)]">
                Marking a job as an accident case applies the ACWER flow doc&apos;s &quot;Accident Case?&quot; gate.
                {job.billing_path === 'fleet' && (
                  <> Since this job is currently <strong>Path C · Fleet</strong>, saving will auto-flip it to <strong>Path B · Chargeable</strong>.</>
                )}
              </p>

              {isCurrentlyAccident && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={clearAccident}
                    onChange={e => setClearAccident(e.target.checked)}
                  />
                  <span>Clear the accident flag (does NOT restore original billing path — use override for that)</span>
                </label>
              )}

              {!clearAccident && (
                <label className="block text-sm">
                  <span className="text-[var(--text-muted)]">Accident notes</span>
                  <textarea
                    value={accidentNotes}
                    onChange={e => setAccidentNotes(e.target.value)}
                    rows={4}
                    placeholder="e.g. Forklift hit a pillar in customer warehouse during loading; operator error"
                    className="mt-1 w-full border border-[var(--border)] rounded px-2 py-1.5 bg-[var(--surface)]"
                  />
                </label>
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-[var(--text-muted)]">
                Manually set the billing path. Use this to restore an auto-flipped job back to AMC, or to correct a misclassification.
                Current path: <strong>{job.billing_path?.toUpperCase() ?? 'UNSET'}</strong>.
              </p>

              <label className="block text-sm">
                <span className="text-[var(--text-muted)]">New path</span>
                <select
                  value={newPath}
                  onChange={e => setNewPath(e.target.value as 'amc' | 'chargeable' | 'fleet' | 'unset')}
                  className="mt-1 w-full border border-[var(--border)] rounded px-2 py-1.5 bg-[var(--surface)]"
                >
                  {PATH_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="text-[var(--text-muted)]">Reason (required)</span>
                <textarea
                  value={overrideReason}
                  onChange={e => setOverrideReason(e.target.value)}
                  rows={3}
                  placeholder="e.g. Wear-and-tear part flagged but actually a manufacturer defect — covered under warranty"
                  className="mt-1 w-full border border-[var(--border)] rounded px-2 py-1.5 bg-[var(--surface)]"
                  required
                />
              </label>
            </>
          )}
        </div>

        <div className="p-4 border-t border-[var(--border)] flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm hover:bg-[var(--bg-subtle)] rounded">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || (mode === 'override' && !overrideReason.trim())}
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded inline-flex items-center gap-1.5"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default PathOverrideModal;
