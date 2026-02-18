import { CheckCircle,PenTool,ShieldCheck,UserCheck } from 'lucide-react';
import React from 'react';
import { Job } from '../../../types';
import { RoleFlags,StatusFlags } from '../types';

interface SignaturesCardProps {
  job: Job;
  roleFlags: RoleFlags;
  statusFlags: StatusFlags;
  onOpenTechSignature: () => void;
  onOpenCustomerSignature: () => void;
}

export const SignaturesCard: React.FC<SignaturesCardProps> = ({
  job,
  roleFlags,
  statusFlags,
  onOpenTechSignature,
  onOpenCustomerSignature,
}) => {
  const { isTechnician, isHelperOnly } = roleFlags;
  const { isInProgress, isAwaitingFinalization, hasBothSignatures } = statusFlags;

  return (
    <div className="card-premium p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-[var(--bg-subtle)] flex items-center justify-center">
          <PenTool className="w-5 h-5 text-[var(--text-muted)]" />
        </div>
        <h3 className="font-semibold text-[var(--text)]">Signatures</h3>
      </div>

      {isInProgress && !hasBothSignatures && (
        <div className="p-3 bg-[var(--warning-bg)] rounded-xl text-xs text-[var(--warning)] mb-4">
          <strong>Required:</strong>
          <ul className="mt-1 ml-4 list-disc">
            {!job.technician_signature && <li>Technician signature</li>}
            {!job.customer_signature && <li>Customer signature</li>}
          </ul>
        </div>
      )}

      <div className="space-y-4">
        {/* Technician Signature */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-4 h-4 text-[var(--accent)]" />
            <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Technician</span>
          </div>
          {job.technician_signature ? (
            <div>
              <div className="flex items-center gap-1 text-[var(--success)] text-xs font-medium mb-2">
                <CheckCircle className="w-3.5 h-3.5" /> Signed
              </div>
              <img 
                src={job.technician_signature.signature_url} 
                loading="lazy" 
                decoding="async" 
                alt="Tech Signature" 
                className="w-full h-16 object-contain bg-[var(--surface)] rounded border border-[var(--border)]" 
              />
              <p className="text-[10px] text-[var(--text-muted)] mt-1">{job.technician_signature.signed_by_name}</p>
            </div>
          ) : (
            isTechnician && !isHelperOnly && (isInProgress || isAwaitingFinalization) ? (
              <button 
                onClick={onOpenTechSignature} 
                className="w-full py-3 border-2 border-dashed border-[var(--border)] rounded-xl text-[var(--text-muted)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors flex items-center justify-center gap-2"
              >
                <PenTool className="w-4 h-4" /> Sign
              </button>
            ) : (
              <div className="text-center py-3 text-[var(--text-muted)] text-xs">Waiting...</div>
            )
          )}
        </div>

        {/* Customer Signature */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <UserCheck className="w-4 h-4 text-[var(--success)]" />
            <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">Customer</span>
          </div>
          {job.customer_signature ? (
            <div>
              <div className="flex items-center gap-1 text-[var(--success)] text-xs font-medium mb-2">
                <CheckCircle className="w-3.5 h-3.5" /> Signed
              </div>
              <img 
                src={job.customer_signature.signature_url} 
                loading="lazy" 
                decoding="async" 
                alt="Customer Signature" 
                className="w-full h-16 object-contain bg-[var(--surface)] rounded border border-[var(--border)]" 
              />
              <p className="text-[10px] text-[var(--text-muted)] mt-1">{job.customer_signature.signed_by_name}</p>
            </div>
          ) : (
            !isHelperOnly && (isInProgress || isAwaitingFinalization) ? (
              <button 
                onClick={onOpenCustomerSignature} 
                className="w-full py-3 border-2 border-dashed border-[var(--border)] rounded-xl text-[var(--text-muted)] hover:text-[var(--success)] hover:border-[var(--success)] transition-colors flex items-center justify-center gap-2"
              >
                <PenTool className="w-4 h-4" /> Collect Signature
              </button>
            ) : (
              <div className="text-center py-3 text-[var(--text-muted)] text-xs">Waiting...</div>
            )
          )}
        </div>
      </div>
    </div>
  );
};
