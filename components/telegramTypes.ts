/**
 * Shared types for Telegram integration components.
 */

export interface TelegramLink {
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

export interface TelegramPreferences {
  notify_job_assigned: boolean;
  notify_job_accepted: boolean;
  notify_job_rejected: boolean;
  notify_request_status: boolean;
  notify_escalations: boolean;
  notify_reminders: boolean;
  language: 'en' | 'ms';
}

// Bot configuration
export const TELEGRAM_BOT_USERNAME = 'Acwer_Job_Bot';
export const TOKEN_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

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
export const generateConnectToken = (userId: string): string => {
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
export const _isTokenValid = (token: string): boolean => {
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
