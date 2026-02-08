import { AlertTriangle,Bell,BellOff,CheckCircle,Smartphone,XCircle } from 'lucide-react';
import React from 'react';
import { useNotifications } from '../contexts/NotificationContext';
import { showToast } from '../services/toastService';

interface NotificationSettingsProps {
  compact?: boolean;
}

/**
 * Notification Settings Component
 * 
 * Displays push notification status and allows users to enable/disable notifications.
 * Can be used in user profile, settings page, or as a prompt card.
 */
const NotificationSettings: React.FC<NotificationSettingsProps> = ({ compact = false }) => {
  const { pushSupported, pushPermission, requestPushPermission } = useNotifications();
  const [requesting, setRequesting] = React.useState(false);

  const handleEnableNotifications = async () => {
    setRequesting(true);
    try {
      const success = await requestPushPermission();
      if (success) {
        showToast.success('Notifications enabled', 'You will now receive push notifications');
      } else if (pushPermission === 'denied') {
        showToast.error(
          'Notifications blocked',
          'Please enable notifications in your browser settings'
        );
      }
    } catch (_error) {
      showToast.error('Failed to enable notifications');
    } finally {
      setRequesting(false);
    }
  };

  // Not supported
  if (!pushSupported) {
    if (compact) return null;
    
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-slate-100 rounded-full">
            <BellOff className="w-5 h-5 text-slate-400" />
          </div>
          <div>
            <h4 className="font-medium text-slate-700">Push Notifications Unavailable</h4>
            <p className="text-sm text-slate-500 mt-1">
              Your browser doesn't support push notifications. Try using Chrome, Firefox, or Edge.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Already granted
  if (pushPermission === 'granted') {
    if (compact) {
      return (
        <div className="flex items-center gap-2 text-green-600 text-sm">
          <CheckCircle className="w-4 h-4" />
          <span>Notifications enabled</span>
        </div>
      );
    }

    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-green-100 rounded-full">
            <Bell className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h4 className="font-medium text-green-700 flex items-center gap-2">
              Push Notifications Enabled
              <CheckCircle className="w-4 h-4" />
            </h4>
            <p className="text-sm text-green-600 mt-1">
              You'll receive notifications for:
            </p>
            <ul className="text-sm text-green-600 mt-2 space-y-1">
              <li className="flex items-center gap-2">
                <Smartphone className="w-3 h-3" />
                New job assignments
              </li>
              <li className="flex items-center gap-2">
                <Smartphone className="w-3 h-3" />
                Request approvals/rejections
              </li>
              <li className="flex items-center gap-2">
                <Smartphone className="w-3 h-3" />
                Job reassignments
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Denied
  if (pushPermission === 'denied') {
    if (compact) {
      return (
        <div className="flex items-center gap-2 text-red-600 text-sm">
          <XCircle className="w-4 h-4" />
          <span>Notifications blocked</span>
        </div>
      );
    }

    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-red-100 rounded-full">
            <BellOff className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h4 className="font-medium text-red-700 flex items-center gap-2">
              Notifications Blocked
              <XCircle className="w-4 h-4" />
            </h4>
            <p className="text-sm text-red-600 mt-1">
              You've blocked notifications for this site. To enable them:
            </p>
            <ol className="text-sm text-red-600 mt-2 space-y-1 list-decimal list-inside">
              <li>Click the lock/info icon in your browser's address bar</li>
              <li>Find "Notifications" and change to "Allow"</li>
              <li>Refresh this page</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  // Default - prompt to enable
  if (compact) {
    return (
      <button
        onClick={handleEnableNotifications}
        disabled={requesting}
        className="flex items-center gap-2 text-amber-600 hover:text-amber-700 text-sm transition-colors"
      >
        <AlertTriangle className="w-4 h-4" />
        <span>{requesting ? 'Enabling...' : 'Enable notifications'}</span>
      </button>
    );
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-amber-100 rounded-full">
          <Bell className="w-5 h-5 text-amber-600" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-amber-700">Enable Push Notifications</h4>
          <p className="text-sm text-amber-600 mt-1">
            Get instant alerts for job assignments, approvals, and important updates even when FieldPro isn't open.
          </p>
          <button
            onClick={handleEnableNotifications}
            disabled={requesting}
            className="mt-3 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium text-sm disabled:opacity-50"
          >
            {requesting ? 'Enabling...' : 'Enable Notifications'}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Notification Permission Prompt
 * 
 * A smaller prompt that can be shown at the top of pages to encourage
 * users to enable notifications.
 */
export const NotificationPermissionPrompt: React.FC = () => {
  const { pushSupported, pushPermission, requestPushPermission } = useNotifications();
  const [dismissed, setDismissed] = React.useState(false);
  const [requesting, setRequesting] = React.useState(false);

  // Don't show if not supported, already granted/denied, or dismissed
  if (!pushSupported || pushPermission !== 'default' || dismissed) {
    return null;
  }

  const handleEnable = async () => {
    setRequesting(true);
    try {
      const success = await requestPushPermission();
      if (success) {
        showToast.success('Notifications enabled!');
      }
    } catch (_error) {
      /* Silently ignore */
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Bell className="w-5 h-5 text-blue-600" />
        <span className="text-sm text-blue-700">
          Enable notifications to stay updated on job assignments and requests
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setDismissed(true)}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          Later
        </button>
        <button
          onClick={handleEnable}
          disabled={requesting}
          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
        >
          {requesting ? 'Enabling...' : 'Enable'}
        </button>
      </div>
    </div>
  );
};

export default NotificationSettings;
