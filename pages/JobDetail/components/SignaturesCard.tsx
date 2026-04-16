import { CheckCircle, PenTool, ShieldCheck, UserCheck } from 'lucide-react';
import React, { useState } from 'react';
import { SwipeToSign } from '../../../components/SwipeToSign';
import { Job } from '../../../types';
import { RoleFlags, StatusFlags } from '../types';

interface SignaturesCardProps {
  job: Job;
  roleFlags: RoleFlags;
  statusFlags: StatusFlags;
  onTechSign: () => void;
  onCustomerSign: (customerName: string, icNo?: string) => void;
}

export const SignaturesCard: React.FC<SignaturesCardProps> = ({
  job,
  roleFlags,
  statusFlags,
  onTechSign,
  onCustomerSign,
}) => {
  const { isTechnician, isHelperOnly } = roleFlags;
  const { isInProgress, isAwaitingFinalization, hasBothSignatures } = statusFlags;

  const [customerName, setCustomerName] = useState('');
  const [icNo, setIcNo] = useState('');

  const handleCustomerSwipe = () => {
    if (customerName.trim()) {
      onCustomerSign(customerName.trim(), icNo.trim() || undefined);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-MY', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

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
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-[var(--accent)]" />
            <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
              Technician
            </span>
          </div>
          {job.technician_signature ? (
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-[var(--success)] mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--text)] font-medium">
                  Signed by {job.technician_signature.signed_by_name}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {formatTimestamp(job.technician_signature.signed_at)}
                </p>
              </div>
            </div>
          ) : isTechnician && !isHelperOnly && (isInProgress || isAwaitingFinalization) ? (
            <SwipeToSign onSign={onTechSign} label="Swipe to Sign" />
          ) : (
            <div className="text-center py-3 text-[var(--text-muted)] text-xs">Waiting...</div>
          )}
        </div>

        {/* Customer Signature */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <UserCheck className="w-4 h-4 text-[var(--success)]" />
            <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">
              Customer
            </span>
          </div>
          {job.customer_signature ? (
            <div className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-[var(--success)] mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--text)] font-medium">
                  Signed by {job.customer_signature.signed_by_name}
                </p>
                {job.customer_signature.ic_no && (
                  <p className="text-xs text-[var(--text-muted)]">IC: {job.customer_signature.ic_no}</p>
                )}
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {formatTimestamp(job.customer_signature.signed_at)}
                </p>
              </div>
            </div>
          ) : !isHelperOnly && (isInProgress || isAwaitingFinalization) ? (
            <div className="space-y-3">
              {/* Customer Name Input */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
                  Customer Name <span className="text-[var(--error)]">*</span>
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter customer name"
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
              </div>

              {/* IC Number Input */}
              <div>
                <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
                  IC Number <span className="text-[var(--error)]">*</span>
                </label>
                <input
                  type="text"
                  value={icNo}
                  onChange={(e) => setIcNo(e.target.value)}
                  placeholder="e.g. 901234-10-5678"
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
              </div>

              {/* Swipe to Sign — requires both name and IC */}
              {(!customerName.trim() || !icNo.trim()) && (
                <p className="text-xs text-[var(--warning)]">Fill in name and IC number to sign</p>
              )}
              <SwipeToSign
                onSign={handleCustomerSwipe}
                label="Swipe to Confirm"
                disabled={!customerName.trim() || !icNo.trim()}
              />
            </div>
          ) : (
            <div className="text-center py-3 text-[var(--text-muted)] text-xs">Waiting...</div>
          )}
        </div>
      </div>
    </div>
  );
};
