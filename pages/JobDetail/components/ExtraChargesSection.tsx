import { Plus,Receipt,Trash2 } from 'lucide-react';
import React from 'react';
import { Job } from '../../../types';
import { RoleFlags } from '../types';

interface ExtraChargesSectionProps {
  job: Job;
  roleFlags: RoleFlags;
  showAddCharge: boolean;
  chargeName: string;
  chargeDescription: string;
  chargeAmount: string;
  onShowAddChargeChange: (show: boolean) => void;
  onChargeNameChange: (name: string) => void;
  onChargeDescriptionChange: (desc: string) => void;
  onChargeAmountChange: (amount: string) => void;
  onAddCharge: () => void;
  onRemoveCharge: (chargeId: string) => void;
}

export const ExtraChargesSection: React.FC<ExtraChargesSectionProps> = ({
  job,
  roleFlags,
  showAddCharge,
  chargeName,
  chargeDescription,
  chargeAmount,
  onShowAddChargeChange,
  onChargeNameChange,
  onChargeDescriptionChange,
  onChargeAmountChange,
  onAddCharge,
  onRemoveCharge,
}) => {
  const { canViewPricing, canEditPrices } = roleFlags;

  // Only show for users who can view pricing
  if (!canViewPricing) return null;

  const handleCancel = () => {
    onShowAddChargeChange(false);
    onChargeNameChange('');
    onChargeDescriptionChange('');
    onChargeAmountChange('');
  };

  return (
    <div className="card-premium p-3 md:p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center">
            <Receipt className="w-5 h-5 text-[var(--text-muted)]" />
          </div>
          <h3 className="font-semibold text-[var(--text)]">Extra Charges</h3>
        </div>
        {canEditPrices && !showAddCharge && (
          <button onClick={() => onShowAddChargeChange(true)} className="btn-premium btn-premium-ghost text-xs">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        )}
      </div>

      {job.extra_charges && job.extra_charges.length > 0 ? (
        <div className="space-y-2 mb-4">
          {job.extra_charges.map(charge => (
            <div key={charge.charge_id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 bg-[var(--warning-bg)] rounded-xl">
              <div>
                <p className="font-medium text-[var(--text)]">{charge.name}</p>
                {charge.description && <p className="text-xs text-[var(--text-muted)]">{charge.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[var(--text-secondary)]">RM{charge.amount.toFixed(2)}</span>
                {canEditPrices && (
                  <button 
                    onClick={() => onRemoveCharge(charge.charge_id)} 
                    className="p-1 text-[var(--error)] hover:bg-[var(--error-bg)] rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[var(--text-muted)] italic text-sm mb-4">No extra charges added.</p>
      )}

      {showAddCharge && canEditPrices && (
        <div className="border-t border-[var(--border-subtle)] pt-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">Name *</label>
            <input 
              type="text" 
              className="input-premium w-full" 
              placeholder="e.g., Emergency Call-Out Fee" 
              value={chargeName} 
              onChange={(e) => onChargeNameChange(e.target.value)} 
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">Description</label>
            <input 
              type="text" 
              className="input-premium w-full" 
              placeholder="Optional details..." 
              value={chargeDescription} 
              onChange={(e) => onChargeDescriptionChange(e.target.value)} 
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">Amount *</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">RM</span>
              <input 
                type="number" 
                className="input-premium pl-10 w-full" 
                placeholder="0.00" 
                value={chargeAmount} 
                onChange={(e) => onChargeAmountChange(e.target.value)} 
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={onAddCharge} className="btn-premium btn-premium-primary flex-1">Add Charge</button>
            <button onClick={handleCancel} className="btn-premium btn-premium-secondary">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};
