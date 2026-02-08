/**
 * Service Upgrade Modal
 * 
 * Shown when a technician starts a Minor Service job but the forklift
 * is overdue for a Full Service. Allows upgrade or decline.
 * 
 * Created: 2026-02-05 for customer feedback implementation
 */

import { AlertTriangle,ArrowUpCircle,X } from 'lucide-react';
import React from 'react';
import { ServiceUpgradePrompt } from '../types';

interface ServiceUpgradeModalProps {
  prompt: ServiceUpgradePrompt;
  onUpgrade: () => Promise<void>;
  onDecline: () => Promise<void>;
  onClose: () => void;
  isLoading?: boolean;
}

const ServiceUpgradeModal: React.FC<ServiceUpgradeModalProps> = ({
  prompt,
  onUpgrade,
  onDecline,
  onClose,
  isLoading = false
}) => {
  const [isProcessing, setIsProcessing] = React.useState(false);
  
  if (!prompt.show) return null;

  const handleUpgrade = async () => {
    if (isProcessing || isLoading) return; // Prevent double-click
    setIsProcessing(true);
    try {
      await onUpgrade();
      onClose();
    } catch (error) {
      console.error('Failed to upgrade:', error);
      setIsProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (isProcessing || isLoading) return; // Prevent double-click
    setIsProcessing(true);
    try {
      await onDecline();
      onClose();
    } catch (error) {
      console.error('Failed to decline:', error);
      setIsProcessing(false);
    }
  };
  
  const disabled = isLoading || isProcessing;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-amber-50 dark:bg-amber-900/30 px-6 py-4 flex items-center gap-3 border-b border-amber-200 dark:border-amber-800">
          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-800 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-100">
              Full Service Overdue
            </h2>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              This unit needs attention
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
            disabled={disabled}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            This forklift is <span className="font-semibold text-red-600 dark:text-red-400">
              {prompt.hours_overdue} hours
            </span> past the Full Service target.
          </p>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Current Reading
              </div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">
                {prompt.current_hourmeter.toLocaleString()} hrs
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Target Was
              </div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">
                {prompt.target_hourmeter.toLocaleString()} hrs
              </div>
            </div>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Would you like to upgrade this job to a <strong>Full Service</strong>?
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            If you upgrade, the service checklist will change to the Full Service checklist 
            and the 500-hour cycle will reset upon completion.
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/30 border-t border-gray-200 dark:border-gray-700 flex gap-3">
          <button
            onClick={handleDecline}
            disabled={disabled}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            Keep Minor Service
          </button>
          <button
            onClick={handleUpgrade}
            disabled={disabled}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <ArrowUpCircle className="w-4 h-4" />
            Upgrade to Full
          </button>
        </div>

        {/* Info footer */}
        <div className="px-6 py-3 bg-blue-50 dark:bg-blue-900/20 border-t border-blue-100 dark:border-blue-800">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            💡 If you keep as Minor Service, this unit will remain flagged as "Service Due" 
            on the fleet dashboard for monitoring.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ServiceUpgradeModal;
