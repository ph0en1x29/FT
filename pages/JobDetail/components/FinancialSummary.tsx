import { DollarSign,Edit2,Save,X } from 'lucide-react';
import React from 'react';
import { Job } from '../../../types';
import { RoleFlags } from '../types';
import { calculateJobTotals } from '../utils';

interface FinancialSummaryProps {
  job: Job;
  roleFlags: RoleFlags;
  // Labor editing state
  editingLabor: boolean;
  laborCostInput: string;
  onLaborInputChange: (value: string) => void;
  onStartEditLabor: () => void;
  onSaveLabor: () => void;
  onCancelLaborEdit: () => void;
}

export const FinancialSummary: React.FC<FinancialSummaryProps> = ({
  job,
  roleFlags,
  editingLabor,
  laborCostInput,
  onLaborInputChange,
  onStartEditLabor,
  onSaveLabor,
  onCancelLaborEdit,
}) => {
  const { canViewPricing, canEditPrices } = roleFlags;
  
  if (!canViewPricing) return null;
  
  const { totalPartsCost, laborCost, extraChargesCost, totalCost } = calculateJobTotals(job);

  return (
    <div className="card-premium-elevated card-tint-success p-3 md:p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-[var(--success-bg)] flex items-center justify-center">
          <DollarSign className="w-5 h-5 text-[var(--success)]" />
        </div>
        <h3 className="font-semibold text-[var(--text)]">Summary</h3>
      </div>

      <div className="space-y-3 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-[var(--text-muted)]">Labor</span>
          {editingLabor ? (
            <div className="flex items-center gap-1">
              <input 
                type="number" 
                className="input-premium w-20 text-sm py-1 pl-2" 
                value={laborCostInput} 
                onChange={(e) => onLaborInputChange(e.target.value)} 
                autoFocus 
              />
              <button onClick={onSaveLabor} className="p-1 text-[var(--success)]">
                <Save className="w-3 h-3" />
              </button>
              <button onClick={onCancelLaborEdit} className="p-1 text-[var(--text-muted)]">
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className="text-[var(--text)]">RM{laborCost.toFixed(2)}</span>
              {canEditPrices && (
                <button onClick={onStartEditLabor} className="p-1 text-[var(--accent)]">
                  <Edit2 className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>
        
        <div className="flex justify-between">
          <span className="text-[var(--text-muted)]">Parts</span>
          <span className="text-[var(--text)]">RM{totalPartsCost.toFixed(2)}</span>
        </div>
        
        {extraChargesCost > 0 && (
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">Extra</span>
            <span className="text-[var(--text)]">RM{extraChargesCost.toFixed(2)}</span>
          </div>
        )}
        
        <div className="divider"></div>
        
        <div className="flex justify-between items-center">
          <span className="font-semibold text-[var(--text)]">Total</span>
          <span className="text-xl font-bold text-[var(--success)]">RM{totalCost.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};
