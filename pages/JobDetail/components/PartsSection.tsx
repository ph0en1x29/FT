import React from 'react';
import { Job, Part } from '../../../types';
import { RoleFlags, StatusFlags } from '../types';
import { Combobox, ComboboxOption } from '../../../components/Combobox';
import { Box, Plus, Edit2, Save, X, Trash2, Clock, CheckCircle, Info } from 'lucide-react';

interface PartsSectionProps {
  job: Job;
  roleFlags: RoleFlags;
  statusFlags: StatusFlags;
  partOptions: ComboboxOption[];
  selectedPartId: string;
  selectedPartPrice: string;
  editingPartId: string | null;
  editingPrice: string;
  noPartsUsed: boolean;
  onSelectedPartIdChange: (id: string) => void;
  onSelectedPartPriceChange: (price: string) => void;
  onAddPart: () => void;
  onStartEditPrice: (partId: string, currentPrice: number) => void;
  onSavePartPrice: (partId: string) => void;
  onCancelEdit: () => void;
  onRemovePart: (partId: string) => void;
  onEditingPriceChange: (price: string) => void;
  onToggleNoPartsUsed: () => void;
}

export const PartsSection: React.FC<PartsSectionProps> = ({
  job,
  roleFlags,
  statusFlags,
  partOptions,
  selectedPartId,
  selectedPartPrice,
  editingPartId,
  editingPrice,
  noPartsUsed,
  onSelectedPartIdChange,
  onSelectedPartPriceChange,
  onAddPart,
  onStartEditPrice,
  onSavePartPrice,
  onCancelEdit,
  onRemovePart,
  onEditingPriceChange,
  onToggleNoPartsUsed,
}) => {
  const { isTechnician, isAdmin, isSupervisor, isAccountant, canViewPricing, canEditPrices, canAddParts, isHelperOnly } = roleFlags;
  const { isInProgress, isAwaitingFinalization } = statusFlags;

  return (
    <div className="card-premium p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center">
            <Box className="w-5 h-5 text-[var(--text-muted)]" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--text)]">Parts Used</h3>
            <p className="text-xs text-[var(--text-muted)]">{job.parts_used.length} items</p>
          </div>
        </div>
        {canEditPrices && <span className="badge badge-info text-[10px]">Editable</span>}
      </div>

      {/* Parts list - always visible to technicians (without prices) */}
      {job.parts_used.length > 0 ? (
        <div className="space-y-2 mb-4">
          {/* Show verification status badge for technicians */}
          {isTechnician && job.parts_confirmed_at && (
            <div className="flex items-center gap-2 mb-2 text-xs text-[var(--success)]">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Verified by {job.parts_confirmed_by_name} on {new Date(job.parts_confirmed_at).toLocaleDateString()}</span>
            </div>
          )}
          {job.parts_used.map(p => (
            <div key={p.job_part_id} className="flex items-center justify-between p-3 bg-[var(--bg-subtle)] rounded-xl">
              <div>
                <span className="font-medium text-[var(--text)]">{p.quantity}× {p.part_name}</span>
              </div>
              {canViewPricing && editingPartId === p.job_part_id ? (
                <div className="flex items-center gap-2">
                  <div className="relative w-24">
                    <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-xs">RM</span>
                    <input 
                      type="number" 
                      className="input-premium pl-8 text-sm" 
                      value={editingPrice} 
                      onChange={(e) => onEditingPriceChange(e.target.value)} 
                      autoFocus 
                    />
                  </div>
                  <button onClick={() => onSavePartPrice(p.job_part_id)} className="p-1 text-[var(--success)] hover:bg-[var(--success-bg)] rounded">
                    <Save className="w-4 h-4" />
                  </button>
                  <button onClick={onCancelEdit} className="p-1 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] rounded">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : canViewPricing ? (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[var(--text-secondary)]">RM{p.sell_price_at_time.toFixed(2)}</span>
                  {canEditPrices && (
                    <>
                      <button onClick={() => onStartEditPrice(p.job_part_id, p.sell_price_at_time)} className="p-1 text-[var(--accent)] hover:bg-[var(--accent-subtle)] rounded">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => onRemovePart(p.job_part_id)} className="p-1 text-[var(--error)] hover:bg-[var(--error-bg)] rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="mb-4">
          <p className="text-[var(--text-muted)] italic text-sm mb-3">No parts added yet.</p>
          {(isInProgress || isAwaitingFinalization) && !isHelperOnly && (
            <label className="flex items-center gap-2 cursor-pointer text-sm bg-[var(--warning-bg)] p-3 rounded-xl border border-[var(--warning)] border-opacity-20">
              <input 
                type="checkbox" 
                checked={noPartsUsed} 
                onChange={onToggleNoPartsUsed} 
                className="rounded border-[var(--border)] text-[var(--warning)]" 
              />
              <span className={noPartsUsed ? 'text-[var(--warning)] font-medium' : 'text-[var(--text-secondary)]'}>
                No parts were used for this job
              </span>
              {noPartsUsed && <CheckCircle className="w-4 h-4 text-[var(--warning)] ml-auto" />}
            </label>
          )}
        </div>
      )}

      {/* Technician hint: Use Spare Part Request */}
      {isTechnician && !canAddParts && (isInProgress || isAwaitingFinalization) && (
        <div className="border-t border-[var(--border-subtle)] pt-4">
          <div className="p-3 bg-[var(--info-bg)] rounded-xl text-xs text-[var(--info)] flex items-center gap-2">
            <Info className="w-4 h-4 flex-shrink-0" />
            <span>Need additional parts? Use <strong>Request Part</strong> in the Part Requests section.</span>
          </div>
        </div>
      )}

      {/* Admin/Supervisor: Add Part */}
      {canAddParts && (
        <div className="border-t border-[var(--border-subtle)] pt-4">
          <p className="text-xs font-medium text-[var(--text-muted)] mb-2">Add Part</p>
          <div className="flex gap-2 items-start">
            <div className="flex-1">
              <Combobox
                options={partOptions}
                value={selectedPartId}
                onChange={(val) => {
                  onSelectedPartIdChange(val);
                  const part = partOptions.find(p => p.id === val);
                  if (part && part.subLabel) {
                    const priceMatch = part.subLabel.match(/RM([\d.]+)/);
                    if (priceMatch) onSelectedPartPriceChange(priceMatch[1]);
                  }
                }}
                placeholder="Search parts..."
              />
            </div>
            {canViewPricing && (
              <div className="w-24">
                <div className="relative">
                  <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-xs">RM</span>
                  <input 
                    type="number" 
                    className="input-premium pl-8 text-sm" 
                    placeholder="Price" 
                    value={selectedPartPrice} 
                    onChange={(e) => onSelectedPartPriceChange(e.target.value)} 
                  />
                </div>
              </div>
            )}
            <button onClick={onAddPart} disabled={!selectedPartId} className="btn-premium btn-premium-primary disabled:opacity-50">
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
