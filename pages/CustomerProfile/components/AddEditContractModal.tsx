/**
 * AddEditContractModal — ACWER service contract create/edit modal (Phase 2).
 *
 * Renders inside CustomerProfilePage. Lets admin create a new service
 * contract for the current customer or edit an existing one. Coverage scope
 * defaults to "all customer's forklifts" (NULL `covered_forklift_ids`); admin
 * can switch to a specific subset via a multi-select.
 */
import { Loader2, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import { getForkliftsByCustomerId } from '../../../services/forkliftService';
import { getParts } from '../../../services/partsService';
import { createContract,updateContract } from '../../../services/serviceContractService';
import { showToast } from '../../../services/toastService';
import type { Forklift, Part, ServiceContract, User } from '../../../types';

interface Props {
  isOpen: boolean;
  customerId: string;
  contract: ServiceContract | null;
  currentUser: User;
  onClose: () => void;
  onSaved: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);
const oneYearOut = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
};

export const AddEditContractModal: React.FC<Props> = ({
  isOpen, customerId, contract, currentUser, onClose, onSaved,
}) => {
  const editing = contract !== null;
  const [contractNumber, setContractNumber] = useState('');
  const [contractType, setContractType] = useState<'amc' | 'warranty' | 'maintenance'>('amc');
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(oneYearOut());
  const [coverAll, setCoverAll] = useState(true);
  const [selectedForkliftIds, setSelectedForkliftIds] = useState<string[]>([]);
  const [includesParts, setIncludesParts] = useState(true);
  const [includesLabor, setIncludesLabor] = useState(true);
  const [notes, setNotes] = useState('');
  const [forklifts, setForklifts] = useState<Forklift[]>([]);
  const [wearTearOverrideIds, setWearTearOverrideIds] = useState<string[]>([]);
  const [showWearTearPicker, setShowWearTearPicker] = useState(false);
  const [allWearTearParts, setAllWearTearParts] = useState<Part[]>([]);
  const [saving, setSaving] = useState(false);

  // Reset form whenever the modal opens or the contract being edited changes
  useEffect(() => {
    if (!isOpen) return;
    setContractNumber(contract?.contract_number ?? '');
    setContractType((contract?.contract_type ?? 'amc') as 'amc' | 'warranty' | 'maintenance');
    setStartDate(contract?.start_date ?? today());
    setEndDate(contract?.end_date ?? oneYearOut());
    const covered = contract?.covered_forklift_ids ?? null;
    setCoverAll(!covered || covered.length === 0);
    setSelectedForkliftIds(covered ?? []);
    setIncludesParts(contract?.includes_parts ?? true);
    setIncludesLabor(contract?.includes_labor ?? true);
    setNotes(contract?.notes ?? '');
    const wearOverrides = contract?.wear_tear_part_ids ?? null;
    setWearTearOverrideIds(wearOverrides ?? []);
    setShowWearTearPicker(Boolean(wearOverrides && wearOverrides.length > 0));
  }, [isOpen, contract]);

  // Load the wear-and-tear parts catalog when admin expands the override picker
  useEffect(() => {
    if (!isOpen || !showWearTearPicker || allWearTearParts.length > 0) return;
    let cancelled = false;
    (async () => {
      const all = await getParts();
      if (cancelled) return;
      setAllWearTearParts(all.filter(p => p.is_warranty_excluded === true));
    })();
    return () => { cancelled = true; };
  }, [isOpen, showWearTearPicker, allWearTearParts.length]);

  // Load this customer's forklifts for the multi-select
  useEffect(() => {
    if (!isOpen || !customerId) return;
    let cancelled = false;
    (async () => {
      const list = await getForkliftsByCustomerId(customerId);
      if (!cancelled) setForklifts(list ?? []);
    })();
    return () => { cancelled = true; };
  }, [isOpen, customerId]);

  const isValid = useMemo(() => {
    if (!startDate || !endDate) return false;
    if (new Date(endDate) < new Date(startDate)) return false;
    if (!coverAll && selectedForkliftIds.length === 0) return false;
    return true;
  }, [startDate, endDate, coverAll, selectedForkliftIds]);

  if (!isOpen) return null;

  const toggleForklift = (id: string) => {
    setSelectedForkliftIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  };

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      const payload = {
        customer_id: customerId,
        contract_number: contractNumber.trim() || null,
        contract_type: contractType,
        start_date: startDate,
        end_date: endDate,
        covered_forklift_ids: coverAll ? null : selectedForkliftIds,
        includes_parts: includesParts,
        includes_labor: includesLabor,
        wear_tear_part_ids: wearTearOverrideIds.length > 0 ? wearTearOverrideIds : null,
        notes: notes.trim() || null,
      };
      if (editing && contract) {
        await updateContract(contract.contract_id, payload, currentUser.user_id, currentUser.name);
        showToast.success('Contract updated');
      } else {
        await createContract(payload, currentUser.user_id, currentUser.name);
        showToast.success('Contract created');
      }
      onSaved();
      onClose();
    } catch (err) {
      showToast.error('Failed to save contract', (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--surface)] rounded-xl shadow-lg max-w-xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold">{editing ? 'Edit contract' : 'New service contract'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-[var(--bg-subtle)] rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="text-[var(--text-muted)]">Contract type</span>
              <select
                value={contractType}
                onChange={e => setContractType(e.target.value as 'amc' | 'warranty' | 'maintenance')}
                className="mt-1 w-full border border-[var(--border)] rounded px-2 py-1.5 bg-[var(--surface)]"
              >
                <option value="amc">AMC (Annual Maintenance Contract)</option>
                <option value="warranty">Warranty</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-[var(--text-muted)]">Contract number (optional)</span>
              <input
                type="text"
                value={contractNumber}
                onChange={e => setContractNumber(e.target.value)}
                placeholder="e.g. AMC-2026-001"
                className="mt-1 w-full border border-[var(--border)] rounded px-2 py-1.5 bg-[var(--surface)]"
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--text-muted)]">Start date</span>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="mt-1 w-full border border-[var(--border)] rounded px-2 py-1.5 bg-[var(--surface)]"
              />
            </label>
            <label className="block text-sm">
              <span className="text-[var(--text-muted)]">End date</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="mt-1 w-full border border-[var(--border)] rounded px-2 py-1.5 bg-[var(--surface)]"
              />
            </label>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-[var(--text)]">Coverage</p>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={coverAll} onChange={() => setCoverAll(true)} />
              <span>All forklifts owned by this customer</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={!coverAll} onChange={() => setCoverAll(false)} />
              <span>Specific forklifts only</span>
            </label>
            {!coverAll && (
              <div className="border border-[var(--border)] rounded p-2 max-h-40 overflow-y-auto">
                {forklifts.length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)]">No forklifts found for this customer.</p>
                ) : (
                  forklifts.map(f => (
                    <label key={f.forklift_id} className="flex items-center gap-2 text-sm py-1">
                      <input
                        type="checkbox"
                        checked={selectedForkliftIds.includes(f.forklift_id)}
                        onChange={() => toggleForklift(f.forklift_id)}
                      />
                      <span>
                        {f.forklift_no ?? f.serial_number}
                        {f.make ? ` — ${f.make}` : ''}
                        {f.model ? ` ${f.model}` : ''}
                      </span>
                    </label>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showWearTearPicker}
                onChange={e => {
                  setShowWearTearPicker(e.target.checked);
                  if (!e.target.checked) setWearTearOverrideIds([]);
                }}
              />
              <span>Override wear-and-tear list for this contract (carve out exceptions)</span>
            </label>
            {showWearTearPicker && (
              <div className="border border-[var(--border)] rounded p-2 max-h-40 overflow-y-auto">
                {allWearTearParts.length === 0 ? (
                  <p className="text-xs text-[var(--text-muted)]">Loading wear-and-tear catalog…</p>
                ) : (
                  <>
                    <p className="text-xs text-[var(--text-muted)] mb-1.5">
                      Selected parts will be treated as <strong>covered</strong> by this contract (overriding the global wear-and-tear flag). Adding any of them to a job under this contract will NOT trigger Path A → Chargeable auto-flip.
                    </p>
                    {allWearTearParts.map(p => (
                      <label key={p.part_id} className="flex items-center gap-2 text-xs py-0.5">
                        <input
                          type="checkbox"
                          checked={wearTearOverrideIds.includes(p.part_id)}
                          onChange={() => setWearTearOverrideIds(prev =>
                            prev.includes(p.part_id) ? prev.filter(x => x !== p.part_id) : [...prev, p.part_id]
                          )}
                        />
                        <span>{p.part_code ?? '(no code)'} — {p.part_name}</span>
                      </label>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={includesParts} onChange={e => setIncludesParts(e.target.checked)} />
              <span>Includes parts (excluding wear-and-tear)</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={includesLabor} onChange={e => setIncludesLabor(e.target.checked)} />
              <span>Includes labor</span>
            </label>
          </div>

          <label className="block text-sm">
            <span className="text-[var(--text-muted)]">Notes (optional)</span>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="mt-1 w-full border border-[var(--border)] rounded px-2 py-1.5 bg-[var(--surface)]"
            />
          </label>
        </div>

        <div className="p-4 border-t border-[var(--border)] flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm hover:bg-[var(--bg-subtle)] rounded">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid || saving}
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded inline-flex items-center gap-1.5"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {editing ? 'Save changes' : 'Create contract'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddEditContractModal;
