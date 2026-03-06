import React, { useState } from 'react';
import { SignaturePad } from '../../../components/SignaturePad';

interface CustomerSignatureModalProps {
  show: boolean;
  defaultName: string;
  onSave: (dataUrl: string, customerName: string, icNo?: string) => void;
  onClose: () => void;
}

export const CustomerSignatureModal: React.FC<CustomerSignatureModalProps> = ({
  show,
  defaultName,
  onSave,
  onClose,
}) => {
  const [customerName, setCustomerName] = useState(defaultName);
  const [icNo, setIcNo] = useState('');

  if (!show) return null;

  const handleSignatureSave = (dataUrl: string) => {
    if (!customerName.trim()) {
      alert('Customer name is required');
      return;
    }
    onSave(dataUrl, customerName.trim(), icNo.trim() || undefined);
    // Reset state
    setCustomerName(defaultName);
    setIcNo('');
  };

  const handleClose = () => {
    setCustomerName(defaultName);
    setIcNo('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--surface)] rounded-2xl p-4 w-full max-w-md shadow-premium-elevated card-premium">
        <h4 className="font-bold mb-2 text-[var(--text)]">Customer Acceptance</h4>
        <p className="text-xs text-[var(--text-muted)] mb-4">
          I acknowledge the service performed and agree to the charges.
        </p>
        
        {/* Customer Name Input */}
        <div className="mb-3">
          <label className="block text-sm font-medium text-[var(--text)] mb-1">
            Customer Name <span className="text-[var(--error)]">*</span>
          </label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            placeholder="Enter customer name"
          />
        </div>

        {/* IC Number Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-[var(--text)] mb-1">
            IC Number <span className="text-xs text-[var(--text-muted)]">(optional)</span>
          </label>
          <input
            type="text"
            value={icNo}
            onChange={(e) => setIcNo(e.target.value)}
            className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            placeholder="e.g. 901234-10-5678"
          />
        </div>

        {/* Signature Pad — "Confirm Signature" directly saves */}
        <SignaturePad onSave={handleSignatureSave} />
        
        <button
          onClick={handleClose}
          className="mt-4 text-sm text-[var(--error)] underline w-full text-center"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
