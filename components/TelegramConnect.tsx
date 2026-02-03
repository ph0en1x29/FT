/**
 * TelegramConnect Component
 * 
 * Allows users to connect their Telegram account for notifications.
 * Shows connection status, language preference, and notification settings.
 * 
 * @author Phoenix (Clawdbot)
 * @created 2026-01-31
 */

import React, { useState, useEffect } from 'react';
import { 
  Send, 
  CheckCircle, 
  XCircle, 
  Settings, 
  Globe, 
  Bell,
  BellOff,
  RefreshCw,
  ExternalLink,
  AlertCircle
} from 'lucide-react';
import { supabase } from '../services/supabaseService';
import { User } from '../types';

interface TelegramLink {
  id: string;
  user_id: string;
  telegram_chat_id: number;
  telegram_username: string | null;
  telegram_first_name: string | null;
  language: 'en' | 'ms';
  is_active: boolean;
  linked_at: string;
  notify_job_assigned: boolean;
  notify_job_accepted: boolean;
  notify_job_rejected: boolean;
  notify_request_status: boolean;
  notify_escalations: boolean;
  notify_reminders: boolean;
}

interface TelegramConnectProps {
  currentUser: User;
  compact?: boolean; // For embedding in profile page
}

// Bot configuration
const TELEGRAM_BOT_USERNAME = 'Acwer_Job_Bot';
const TOKEN_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Generate a connect token for Telegram linking.
 * 
 * SECURITY NOTE: This token is validated server-side by the Telegram bot webhook.
 * The webhook MUST verify:
 * 1. Token hasn't expired (timestamp + TOKEN_EXPIRY_MS > now)
 * 2. User ID exists in the database
 * 3. Token hasn't been used before (one-time use)
 * 
 * For production, consider using Supabase Edge Function to generate signed JWTs.
 */
const generateConnectToken = (userId: string): string => {
  // Include random nonce to prevent replay attacks
  const nonce = crypto.randomUUID();
  const payload = {
    user_id: userId,
    timestamp: Date.now(),
    expires_at: Date.now() + TOKEN_EXPIRY_MS,
    nonce: nonce,
    action: 'link'
  };
  return btoa(JSON.stringify(payload));
};

/**
 * Validate a connect token (client-side pre-check).
 * Server MUST also validate independently.
 */
const isTokenValid = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token));
    if (!payload.expires_at || !payload.user_id || !payload.nonce) {
      return false;
    }
    return Date.now() < payload.expires_at;
  } catch {
    return false;
  }
};

const TelegramConnect: React.FC<TelegramConnectProps> = ({ currentUser, compact = false }) => {
  const [telegramLink, setTelegramLink] = useState<TelegramLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Notification preference state
  const [preferences, setPreferences] = useState({
    notify_job_assigned: true,
    notify_job_accepted: true,
    notify_job_rejected: true,
    notify_request_status: true,
    notify_escalations: true,
    notify_reminders: true,
    language: 'en' as 'en' | 'ms'
  });

  // Fetch existing telegram link
  useEffect(() => {
    fetchTelegramLink();
  }, [currentUser.id]);

  const fetchTelegramLink = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_telegram_links')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      if (data) {
        setTelegramLink(data);
        setPreferences({
          notify_job_assigned: data.notify_job_assigned,
          notify_job_accepted: data.notify_job_accepted,
          notify_job_rejected: data.notify_job_rejected,
          notify_request_status: data.notify_request_status,
          notify_escalations: data.notify_escalations,
          notify_reminders: data.notify_reminders,
          language: data.language
        });
      }
    } catch (err: unknown) {
      setError('Failed to load Telegram status');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Telegram? You will stop receiving notifications.')) {
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase
        .from('user_telegram_links')
        .update({ is_active: false })
        .eq('user_id', currentUser.id);

      if (error) throw error;

      setTelegramLink(null);
      setShowSettings(false);
    } catch (err: unknown) {
      setError('Failed to disconnect');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePreferences = async () => {
    if (!telegramLink) return;

    try {
      setSaving(true);
      const { error } = await supabase
        .from('user_telegram_links')
        .update({
          ...preferences,
          updated_at: new Date().toISOString()
        })
        .eq('id', telegramLink.id);

      if (error) throw error;

      setTelegramLink({ ...telegramLink, ...preferences });
      setShowSettings(false);
    } catch (err: unknown) {
      setError('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const connectUrl = `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${generateConnectToken(currentUser.id)}`;

  // Loading state
  if (loading) {
    return (
      <div className={`${compact ? 'p-3' : 'p-4'} bg-theme-surface rounded-xl border border-[var(--border)]`}>
        <div className="flex items-center gap-2 text-theme-muted">
          <RefreshCw size={16} className="animate-spin" />
          <span>Loading Telegram status...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !telegramLink) {
    return (
      <div className={`${compact ? 'p-3' : 'p-4'} bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800`}>
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={fetchTelegramLink} className="ml-auto text-sm underline">
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Connected state
  if (telegramLink) {
    return (
      <div className={`${compact ? 'p-3' : 'p-4'} bg-theme-surface rounded-xl border border-[var(--border)]`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#0088cc] flex items-center justify-center">
              <Send size={16} className="text-white" />
            </div>
            <div>
              <div className="font-medium text-theme flex items-center gap-2">
                Telegram Connected
                <CheckCircle size={14} className="text-green-500" />
              </div>
              {telegramLink.telegram_username && (
                <div className="text-xs text-theme-muted">
                  @{telegramLink.telegram_username}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-theme-surface-2 rounded-lg transition-colors"
            title="Settings"
          >
            <Settings size={18} className="text-theme-muted" />
          </button>
        </div>

        {/* Language badge */}
        <div className="flex items-center gap-2 mb-3">
          <Globe size={14} className="text-theme-muted" />
          <span className="text-sm text-theme-muted">
            {preferences.language === 'en' ? '🇬🇧 English' : '🇲🇾 Bahasa Melayu'}
          </span>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className="mt-4 pt-4 border-t border-[var(--border)] space-y-4">
            {/* Language selection */}
            <div>
              <label className="block text-sm font-medium text-theme mb-2">
                <Globe size={14} className="inline mr-1" />
                Language / Bahasa
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setPreferences({ ...preferences, language: 'en' })}
                  className={`flex-1 px-3 py-2 rounded-lg border text-sm transition-colors ${
                    preferences.language === 'en'
                      ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                      : 'bg-theme-surface border-[var(--border)] text-theme hover:bg-theme-surface-2'
                  }`}
                >
                  🇬🇧 English
                </button>
                <button
                  onClick={() => setPreferences({ ...preferences, language: 'ms' })}
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
                {[
                  { key: 'notify_job_assigned', label: 'Job Assignments', labelMs: 'Tugasan Kerja' },
                  { key: 'notify_job_accepted', label: 'Job Accepted', labelMs: 'Kerja Diterima' },
                  { key: 'notify_job_rejected', label: 'Job Rejected', labelMs: 'Kerja Ditolak' },
                  { key: 'notify_request_status', label: 'Request Updates', labelMs: 'Status Permintaan' },
                  { key: 'notify_escalations', label: 'Escalation Alerts', labelMs: 'Amaran Eskalasi' },
                  { key: 'notify_reminders', label: 'Daily Reminders', labelMs: 'Peringatan Harian' },
                ].map((item) => (
                  <label key={item.key} className="flex items-center justify-between p-2 rounded-lg hover:bg-theme-surface-2 cursor-pointer">
                    <span className="text-sm text-theme">
                      {preferences.language === 'en' ? item.label : item.labelMs}
                    </span>
                    <button
                      onClick={() => setPreferences({ 
                        ...preferences, 
                        [item.key]: !preferences[item.key as keyof typeof preferences] 
                      })}
                      className={`w-10 h-6 rounded-full transition-colors ${
                        preferences[item.key as keyof typeof preferences]
                          ? 'bg-green-500'
                          : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${
                        preferences[item.key as keyof typeof preferences]
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
                onClick={handleSavePreferences}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {saving ? 'Saving...' : 'Save Preferences'}
              </button>
              <button
                onClick={handleDisconnect}
                disabled={saving}
                className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50 transition-colors"
              >
                Disconnect
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Not connected state
  return (
    <div className={`${compact ? 'p-3' : 'p-4'} bg-theme-surface rounded-xl border border-[var(--border)]`}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-[#0088cc]/10 flex items-center justify-center flex-shrink-0">
          <Send size={20} className="text-[#0088cc]" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-theme mb-1">
            Connect Telegram
          </h4>
          <p className="text-sm text-theme-muted mb-3">
            Get instant notifications for job assignments, approvals, and alerts directly in Telegram.
          </p>
          <a
            href={connectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#0088cc] text-white rounded-lg hover:bg-[#0077b5] transition-colors"
          >
            <Send size={16} />
            Connect @{TELEGRAM_BOT_USERNAME}
            <ExternalLink size={14} />
          </a>
          <p className="text-xs text-theme-muted mt-2">
            Opens Telegram. Tap "Start" to connect.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TelegramConnect;
