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
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);

  if (!show) return null;

  const handleSignatureSave = (dataUrl: string) => {
    setSignatureDataUrl(dataUrl);
  };

  const handleFinalSave = () => {
    if (!signatureDataUrl) return;
    if (!customerName.trim()) {
      alert('Customer name is required');
      return;
    }
    onSave(signatureDataUrl, customerName.trim(), icNo.trim() || undefined);
    // Reset state
    setCustomerName(defaultName);
    setIcNo('');
    setSignatureDataUrl(null);
  };

  const handleClose = () => {
    setCustomerName(defaultName);
    setIcNo('');
    setSignatureDataUrl(null);
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
        <div className="mb-4">
          <label className="block text-sm font-medium text-[var(--text)] mb-1">
            Customer Name <span className="text-[var(--error)]">*</span>
          </label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-[var(--surface)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. 901234-10-5678"
          />
        </div>

        {/* Signature Pad */}
        <SignaturePad onSave={handleSignatureSave} />

        {/* Action Buttons */}
        {signatureDataUrl && (
          <button
            onClick={handleFinalSave}
            className="mt-4 w-full px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium"
          >
            Save Signature
          </button>
        )}
        
        <button
          onClick={handleClose}
          className="mt-2 text-sm text-[var(--error)] underline w-full text-center"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
