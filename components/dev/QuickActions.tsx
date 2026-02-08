import { Bell,Copy,Database,RotateCcw,Trash2 } from 'lucide-react';
import React,{ useState } from 'react';
import { toast } from 'sonner';
import { useDevModeContext } from '../../contexts/DevModeContext';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';

/**
 * QuickActions - Utility buttons for dev testing
 *
 * Features:
 * - Clear localStorage (reset all state)
 * - Copy current state as JSON
 * - Reset all dev settings
 * - Trigger test notifications
 */
export const QuickActions: React.FC = () => {
  const {
    displayRole,
    permissionRole,
    devModeType,
    permissionOverrides,
    isDevModeActive,
    deactivateDevMode,
    clearPermissionOverrides,
  } = useDevModeContext();

  const { flags, resetFlags } = useFeatureFlags();
  const [copied, setCopied] = useState(false);

  // Clear all localStorage
  const handleClearLocalStorage = () => {
    if (window.confirm('This will clear ALL localStorage data for this app. Continue?')) {
      localStorage.clear();
      toast.success('LocalStorage cleared. Refreshing page...');
      setTimeout(() => window.location.reload(), 1000);
    }
  };

  // Copy current dev state as JSON
  const handleCopyState = async () => {
    const state = {
      devMode: {
        isActive: isDevModeActive,
        displayRole,
        permissionRole,
        devModeType,
        permissionOverrides,
      },
      featureFlags: flags,
      timestamp: new Date().toISOString(),
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(state, null, 2));
      setCopied(true);
      toast.success('Dev state copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = JSON.stringify(state, null, 2);
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      toast.success('Dev state copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Reset all dev settings
  const handleResetAll = () => {
    deactivateDevMode();
    clearPermissionOverrides();
    resetFlags();
    toast.success('All dev settings reset to defaults');
  };

  // Trigger test notification
  const handleTestNotification = () => {
    toast.success('Test notification triggered!', {
      description: 'This is a sample notification for testing.',
    });
    toast.info('Info notification', {
      description: 'This is an info notification.',
    });
    toast.warning('Warning notification', {
      description: 'This is a warning notification.',
    });
    toast.error('Error notification', {
      description: 'This is an error notification.',
    });
  };

  // Clear specific dev-related localStorage keys
  const handleClearDevStorage = () => {
    localStorage.removeItem('fieldpro_dev_mode');
    localStorage.removeItem('fieldpro_permission_overrides');
    localStorage.removeItem('fieldpro_feature_flags');
    deactivateDevMode();
    clearPermissionOverrides();
    resetFlags();
    toast.success('Dev storage cleared');
  };

  const actions = [
    {
      icon: <Copy className={`w-4 h-4 ${copied ? 'text-green-400' : ''}`} />,
      label: copied ? 'Copied!' : 'Copy State',
      onClick: handleCopyState,
      variant: 'default' as const,
    },
    {
      icon: <RotateCcw className="w-4 h-4" />,
      label: 'Reset All Dev',
      onClick: handleResetAll,
      variant: 'default' as const,
    },
    {
      icon: <Bell className="w-4 h-4" />,
      label: 'Test Toasts',
      onClick: handleTestNotification,
      variant: 'default' as const,
    },
    {
      icon: <Database className="w-4 h-4" />,
      label: 'Clear Dev Storage',
      onClick: handleClearDevStorage,
      variant: 'warning' as const,
    },
    {
      icon: <Trash2 className="w-4 h-4" />,
      label: 'Clear All Storage',
      onClick: handleClearLocalStorage,
      variant: 'danger' as const,
    },
  ];

  const getButtonClasses = (variant: 'default' | 'warning' | 'danger') => {
    const base = 'flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border transition-colors';
    switch (variant) {
      case 'danger':
        return `${base} bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20`;
      case 'warning':
        return `${base} bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20`;
      default:
        return `${base} bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700`;
    }
  };

  return (
    <div className="space-y-3">
      {/* Action Buttons - Grid layout */}
      <div className="grid grid-cols-2 gap-2">
        {actions.map(action => (
          <button
            key={action.label}
            onClick={action.onClick}
            className={getButtonClasses(action.variant)}
          >
            {action.icon}
            <span>{action.label}</span>
          </button>
        ))}
      </div>

      {/* Quick Info */}
      <div className="p-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
        <h4 className="text-[10px] font-medium text-slate-500 uppercase mb-1.5">Storage Keys</h4>
        <div className="space-y-1 text-[10px] font-mono text-slate-400">
          <div>fieldpro_dev_mode</div>
          <div>fieldpro_permission_overrides</div>
          <div>fieldpro_feature_flags</div>
          <div>fieldpro-theme</div>
        </div>
      </div>
    </div>
  );
};

export default QuickActions;
