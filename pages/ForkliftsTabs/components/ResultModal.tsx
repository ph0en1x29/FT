import { AlertCircle,CheckCircle,X } from 'lucide-react';
import React from 'react';

interface ResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'success' | 'error' | 'mixed';
  title: string;
  message: string;
  details?: string[];
}

const ResultModal: React.FC<ResultModalProps> = ({
  isOpen,
  onClose,
  type,
  title,
  message,
  details,
}) => {
  if (!isOpen) return null;

  const headerColors = {
    success: 'bg-green-50 border-green-100',
    error: 'bg-red-50 border-red-100',
    mixed: 'bg-amber-50 border-amber-100',
  };

  const titleColors = {
    success: 'text-green-800',
    error: 'text-red-800',
    mixed: 'text-amber-800',
  };

  const buttonColors = {
    success: 'bg-green-600 hover:bg-green-700',
    error: 'bg-red-600 hover:bg-red-700',
    mixed: 'bg-amber-600 hover:bg-amber-700',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className={`px-6 py-4 border-b flex justify-between items-center ${headerColors[type]}`}>
          <h3 className={`font-bold text-lg flex items-center gap-2 ${titleColors[type]}`}>
            {type === 'success' && <CheckCircle className="w-5 h-5" />}
            {type === 'error' && <AlertCircle className="w-5 h-5" />}
            {type === 'mixed' && <AlertCircle className="w-5 h-5" />}
            {title}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-slate-700">{message}</p>
          
          {details && details.length > 0 && (
            <div className="bg-slate-50 rounded-lg p-3 max-h-48 overflow-y-auto">
              <div className="space-y-1 text-sm font-mono">
                {details.map((detail, idx) => (
                  <p 
                    key={idx} 
                    className={
                      detail.startsWith('✓') ? 'text-green-600' : 
                      detail.startsWith('✗') ? 'text-red-600' : 
                      'text-slate-600'
                    }
                  >
                    {detail}
                  </p>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2">
            <button
              type="button"
              onClick={onClose}
              className={`w-full py-2.5 rounded-lg font-medium shadow-sm text-white ${buttonColors[type]}`}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResultModal;
