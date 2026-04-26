/**
 * Error Tracking Service
 *
 * Records failed user actions to `public.user_action_errors` for "Desire Paths"
 * analysis AND forwards to Sentry (via services/errorTracking.ts) so the same
 * event lands in both the queryable backend log and the live exception monitor.
 *
 * Cached user identity is set by App.tsx after login via `setTrackedUser` so
 * each call avoids a per-error round trip to auth + users — falls back to
 * supabase.auth.getUser() if not yet hydrated.
 */

import { captureError as sentryCaptureError } from './errorTracking';
import { supabase } from './supabaseClient';

interface ActionError {
  action_type: string;      // e.g., 'update_status', 'add_part', 'complete_job'
  action_target?: string;   // e.g., 'job', 'checklist', 'forklift'
  target_id?: string;       // e.g., job_id
  error_message: string;    // The actual error
  error_code?: string;      // PostgreSQL error code if available
  request_payload?: Record<string, unknown>; // What the user was trying to do
  page_url?: string;        // Where the error occurred
  error?: unknown;          // Original Error/value — used to enrich payload + Sentry
}

// Identity cache populated by setTrackedUser; saves a per-call auth round trip.
let cachedUserId: string | null = null;
let cachedUserRole: string | null = null;

export const setTrackedUser = (user: { user_id: string; role: string } | null): void => {
  cachedUserId = user?.user_id ?? null;
  cachedUserRole = user?.role ?? null;
};

/**
 * Log a failed user action for analysis. Fans out to Sentry too.
 */
export const trackActionError = async (input: ActionError): Promise<void> => {
  const { error: rawError, ...meta } = input;
  const parsed = rawError !== undefined ? parseError(rawError) : null;

  try {
    let userId = cachedUserId;
    let userRole = cachedUserRole;

    if (!userId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('user_id, role')
          .eq('auth_id', user.id)
          .single();
        if (userData) {
          userId = userData.user_id;
          userRole = userData.role;
        }
      }
    }

    const stack = parsed?.stack;
    const enrichedPayload: Record<string, unknown> | undefined = (meta.request_payload || stack)
      ? { ...(meta.request_payload || {}), ...(stack ? { _stack: stack } : {}) }
      : undefined;

    await supabase
      .from('user_action_errors')
      .insert({
        user_id: userId,
        user_role: userRole,
        action_type: meta.action_type,
        action_target: meta.action_target,
        target_id: meta.target_id,
        error_message: meta.error_message,
        error_code: meta.error_code ?? parsed?.code,
        request_payload: enrichedPayload,
        page_url: meta.page_url || (typeof window !== 'undefined' ? window.location.href : null),
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      });
  } catch (e) {
    // Don't let error tracking errors break the app
    console.error('[ErrorTracking] Failed to log error:', e);
  }

  if (rawError instanceof Error) {
    sentryCaptureError(rawError, {
      action_type: meta.action_type,
      action_target: meta.action_target,
      target_id: meta.target_id,
      page_url: meta.page_url || (typeof window !== 'undefined' ? window.location.href : undefined),
    });
  } else if (rawError !== undefined) {
    sentryCaptureError(new Error(meta.error_message || 'Unknown error'), {
      action_type: meta.action_type,
      raw_error: String(rawError),
      page_url: meta.page_url || (typeof window !== 'undefined' ? window.location.href : undefined),
    });
  }
};

/**
 * Helper to extract error info from various error types.
 */
export const parseError = (error: unknown): { message: string; code?: string; stack?: string } => {
  if (error instanceof Error) {
    const pgCodeMatch = (error.message || '').match(/(\d{5}):/);
    return {
      message: error.message,
      code: pgCodeMatch ? pgCodeMatch[1] : undefined,
      stack: error.stack,
    };
  }
  if (typeof error === 'string') {
    return { message: error };
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return {
      message: String((error as { message: unknown }).message),
      code: 'code' in error ? String((error as { code: unknown }).code) : undefined,
    };
  }
  return { message: 'Unknown error' };
};
