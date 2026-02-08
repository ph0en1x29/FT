/**
 * TelegramSettingsPanel - Settings panel for connected Telegram accounts
 * Extracted from TelegramConnect for file size management.
 */
import { Bell, Globe } from 'lucide-react';
import React from 'react';
import { TelegramPreferences } from './telegramTypes';

interface TelegramSettingsPanelProps {
  preferences: TelegramPreferences;
  setPreferences: React.Dispatch<React.SetStateAction<TelegramPreferences>>;
  saving: boolean;
  onSave: () => void;
  onDisconnect: () => void;
}

const NOTIFICATION_ITEMS = [
  { key: 'notify_job_assigned', label: 'Job Assignments', labelMs: 'Tugasan Kerja' },
  { key: 'notify_job_accepted', label: 'Job Accepted', labelMs: 'Kerja Diterima' },
  { key: 'notify_job_rejected', label: 'Job Rejected', labelMs: 'Kerja Ditolak' },
  { key: 'notify_request_status', label: 'Request Updates', labelMs: 'Status Permintaan' },
  { key: 'notify_escalations', label: 'Escalation Alerts', labelMs: 'Amaran Eskalasi' },
  { key: 'notify_reminders', label: 'Daily Reminders', labelMs: 'Peringatan Harian' },
] as const;

const TelegramSettingsPanel: React.FC<TelegramSettingsPanelProps> = ({
  preferences,
  setPreferences,
  saving,
  onSave,
  onDisconnect,
}) => (
  <div className="mt-4 pt-4 border-t border-[var(--border)] space-y-4">
    {/* Language selection */}
    <div>
      <label className="block text-sm font-medium text-theme mb-2">
        <Globe size={14} className="inline mr-1" />
        Language / Bahasa
      </label>
      <div className="flex gap-2">
        <button
          onClick={() => setPreferences(prev => ({ ...prev, language: 'en' }))}
          className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-colors ${
            preferences.language === 'en'
              ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
              : 'bg-theme-surface border-[var(--border)] text-theme hover:bg-theme-surface-2'
          }`}
        >
          🇬🇧 English
        </button>
        <button
          onClick={() => setPreferences(prev => ({ ...prev, language: 'ms' }))}
          className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-colors ${
            preferences.language === 'ms'
              ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
              : 'bg-theme-surface border-[var(--border)] text-theme hover:bg-theme-surface-2'
          }`}
        >
          🇲🇾 Bahasa Melayu
        </button>
      </div>
    </div>

    {/* Notification preferences */}
    <div>
      <label className="block text-sm font-medium text-theme mb-2">
        <Bell size={14} className="inline mr-1" />
        Notifications
      </label>
      <div className="space-y-2">
        {NOTIFICATION_ITEMS.map((item) => (
          <label key={item.key} className="flex items-center justify-between p-2 rounded-lg hover:bg-theme-surface-2 cursor-pointer">
            <span className="text-sm text-theme">
              {preferences.language === 'en' ? item.label : item.labelMs}
            </span>
            <button
              onClick={() => setPreferences(prev => ({
                ...prev,
                [item.key]: !prev[item.key as keyof TelegramPreferences]
              }))}
              className={`w-10 h-6 rounded-full transition-colors ${
                preferences[item.key as keyof TelegramPreferences]
                  ? 'bg-green-500'
                  : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${
                preferences[item.key as keyof TelegramPreferences]
                  ? 'translate-x-5'
                  : 'translate-x-1'
              }`} />
            </button>
          </label>
        ))}
      </div>
    </div>

    {/* Action buttons */}
    <div className="flex gap-2 pt-2">
      <button
        onClick={onSave}
        disabled={saving}
        className="flex-1 px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {saving ? 'Saving...' : 'Save Preferences'}
      </button>
      <button
        onClick={onDisconnect}
        disabled={saving}
        className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50 transition-colors"
      >
        Disconnect
      </button>
    </div>
  </div>
);

export default TelegramSettingsPanel;
