import { Box,CheckCircle,Edit2,Info,Lock,Plus,Save,Trash2,Truck,X } from 'lucide-react';
import React from 'react';
import { Combobox,ComboboxOption } from '../../../components/Combobox';
import { Job, VanStock } from '../../../types';
import { RoleFlags,StatusFlags } from '../types';

interface PartsSectionProps {
  job: Job;
  roleFlags: RoleFlags;
  statusFlags: StatusFlags;
  partOptions: ComboboxOption[];
  selectedPartId: string;
  selectedPartPrice: string;
  addPartQuantity?: string;
  editingPartId: string | null;
  editingPrice: string;
  noPartsUsed: boolean;
  onSelectedPartIdChange: (id: string) => void;
  onSelectedPartPriceChange: (price: string) => void;
  onAddPartQuantityChange?: (qty: string) => void;
  onAddPart: () => void;
  onStartEditPrice: (partId: string, currentPrice: number) => void;
  onSavePartPrice: (partId: string) => void;
  onCancelEdit: () => void;
  onRemovePart: (partId: string) => void;
  onEditingPriceChange: (price: string) => void;
  onToggleNoPartsUsed: () => void;
  // Van stock props (technician)
  vanStock?: VanStock | null;
  useFromVanStock?: boolean;
  onToggleVanStock?: () => void;
  selectedVanStockItemId?: string;
  onSelectedVanStockItemIdChange?: (id: string) => void;
  vanStockQuantity?: string;
  onVanStockQuantityChange?: (qty: string) => void;
  onUseVanStockPart?: () => void;
  // Van selection props
  availableVans?: VanStock[];
  onSelectJobVan?: (vanStockId: string) => void;
}

export const PartsSection: React.FC<PartsSectionProps> = ({
  job,
  roleFlags,
  statusFlags,
  partOptions,
  selectedPartId,
  selectedPartPrice,
  addPartQuantity,
  editingPartId,
  editingPrice,
  noPartsUsed,
  onSelectedPartIdChange,
  onSelectedPartPriceChange,
  onAddPartQuantityChange,
  onAddPart,
  onStartEditPrice,
  onSavePartPrice,
  onCancelEdit,
  onRemovePart,
  onEditingPriceChange,
  onToggleNoPartsUsed,
  vanStock,
  useFromVanStock,
  onToggleVanStock,
  selectedVanStockItemId,
  onSelectedVanStockItemIdChange,
  vanStockQuantity,
  onVanStockQuantityChange,
  onUseVanStockPart,
  availableVans,
  onSelectJobVan,
}) => {
  const { isTechnician, _isAdmin, _isSupervisor, _isAccountant, canViewPricing, canEditPrices, canAddParts, isHelperOnly } = roleFlags;
  const { isNew, isAssigned, isInProgress, isAwaitingFinalization } = statusFlags;

  return (
    <div className="card-premium p-3 md:p-5">
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
            <div key={p.job_part_id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-[var(--bg-subtle)] rounded-xl">
              <div>
                <span className="font-medium text-[var(--text)]">{Number.isInteger(p.quantity) ? p.quantity : p.quantity.toFixed(2)}× {p.part_name}</span>
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

      {/* Technician: Van Selection + Van Stock usage + hint */}
      {isTechnician && !canAddParts && (isInProgress || isAwaitingFinalization) && (
        <div className="border-t border-[var(--border-subtle)] pt-4 space-y-3">
          {/* Van Selection Dropdown */}
          {availableVans && availableVans.length > 1 && onSelectJobVan && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-[var(--text-muted)] flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5" /> Select Van
                {job.parts_used.some(p => p.from_van_stock) && (
                  <span className="inline-flex items-center gap-1 text-[var(--warning)] ml-1">
                    <Lock className="w-3 h-3" /> Locked
                  </span>
                )}
              </p>
              <select
                value={job.job_van_stock_id || vanStock?.van_stock_id || ''}
                onChange={(e) => onSelectJobVan(e.target.value)}
                disabled={job.parts_used.some(p => p.from_van_stock)}
                className="input-premium text-sm w-full disabled:opacity-50"
              >
                {availableVans.map(v => (
                  <option key={v.van_stock_id} value={v.van_stock_id}>
                    {v.van_code || 'Van'} — {v.technician_name || 'Unassigned'}
                    {v.technician_id === job.assigned_technician_id ? ' (Your van)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Van Stock usage */}
          {vanStock && vanStock.items && vanStock.items.length > 0 && onToggleVanStock && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-[var(--text-muted)] flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5" /> Use from Van Stock
                </p>
                <button
                  onClick={onToggleVanStock}
                  className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
                    useFromVanStock
                      ? 'bg-blue-100 text-blue-700 font-medium'
                      : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  {useFromVanStock ? 'Van Stock ✓' : 'Use Van Stock'}
                </button>
              </div>
              {useFromVanStock && (
                <div className="space-y-2">
                  <div className="flex gap-2 items-start">
                    <div className="flex-1">
                      <select
                        value={selectedVanStockItemId || ''}
                        onChange={(e) => onSelectedVanStockItemIdChange?.(e.target.value)}
                        className="input-premium text-sm w-full"
                      >
                        <option value="">Select part from van...</option>
                        {vanStock.items
                          .filter(i => i.quantity > 0)
                          .map(i => {
                            const unit = i.part?.unit || 'pcs';
                            const qtyDisplay = Number.isInteger(i.quantity) ? i.quantity : i.quantity.toFixed(2);
                            return (
                              <option key={i.item_id} value={i.item_id}>
                                {i.part?.part_name || 'Unknown'} — {qtyDisplay} {unit} available
                              </option>
                            );
                          })}
                      </select>
                    </div>
                    <div className="w-20">
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0.1"
                        step="any"
                        value={vanStockQuantity || '1'}
                        onChange={(e) => onVanStockQuantityChange?.(e.target.value)}
                        className="input-premium text-sm w-full text-center"
                        placeholder="Qty"
                      />
                    </div>
                    <button
                      onClick={onUseVanStockPart}
                      disabled={!selectedVanStockItemId}
                      className="btn-premium btn-premium-primary disabled:opacity-50"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                  {selectedVanStockItemId && (() => {
                    const selectedItem = vanStock.items?.find(i => i.item_id === selectedVanStockItemId);
                    if (!selectedItem) return null;
                    const unit = selectedItem.part?.unit || 'pcs';
                    return (
                      <p className="text-xs text-[var(--text-muted)]">
                        Available: {Number.isInteger(selectedItem.quantity) ? selectedItem.quantity : selectedItem.quantity.toFixed(2)} {unit}
                        {unit !== 'pcs' && ' · Supports decimal quantities'}
                      </p>
                    );
                  })()}
                </div>
              )}
            </>
          )}
          <div className="p-3 bg-[var(--info-bg)] rounded-xl text-xs text-[var(--info)] flex items-center gap-2">
            <Info className="w-4 h-4 flex-shrink-0" />
            <span>
              {vanStock && vanStock.items && vanStock.items.length > 0
                ? <>Use parts from your van stock above, or <strong>Request Part</strong> in Part Requests for parts not in your van.</>
                : <>Need parts? Use <strong>Request Part</strong> in the Part Requests section.</>
              }
            </span>
          </div>
        </div>
      )}

      {/* Admin/Supervisor: Add Part (including pre-job allocation) */}
      {canAddParts && (
        <div className="border-t border-[var(--border-subtle)] pt-4">
          <p className="text-xs font-medium text-[var(--text-muted)] mb-2">
            Add Part {(isNew || isAssigned) && <span className="text-[var(--info)]">(Pre-allocation)</span>}
          </p>
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
            <div className="w-20">
              <input
                type="number"
                inputMode="decimal"
                min="0.1"
                step="any"
                value={addPartQuantity || '1'}
                onChange={(e) => onAddPartQuantityChange?.(e.target.value)}
                className="input-premium text-sm w-full text-center"
                placeholder="Qty"
              />
            </div>
            <button onClick={onAddPart} disabled={!selectedPartId} className="btn-premium btn-premium-primary disabled:opacity-50">
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
