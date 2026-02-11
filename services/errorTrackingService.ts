/**
 * Error Tracking Service
 * 
 * Tracks failed user actions for "Desire Paths" analysis.
 * Helps identify what users are trying to do that fails,
 * so we can build features to support those actions.
 */

import { supabase } from './supabaseClient';

interface ActionError {
  action_type: string;      // e.g., 'update_status', 'add_part', 'complete_job'
  action_target?: string;   // e.g., 'job', 'checklist', 'forklift'
  target_id?: string;       // e.g., job_id
  error_message: string;    // The actual error
  error_code?: string;      // PostgreSQL error code if available
  request_payload?: Record<string, unknown>; // What the user was trying to do
  page_url?: string;        // Where the error occurred
}

/**
 * Log a failed user action for analysis
 */
export const trackActionError = async (error: ActionError): Promise<void> => {
  try {
    // Get current user info
    const { data: { user } } = await supabase.auth.getUser();
    
    let userRole: string | null = null;
    let userId: string | null = null;
    
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

    await supabase
      .from('user_action_errors')
      .insert({
        user_id: userId,
        user_role: userRole,
        action_type: error.action_type,
        action_target: error.action_target,
        target_id: error.target_id,
        error_message: error.error_message,
        error_code: error.error_code,
        request_payload: error.request_payload,
        page_url: error.page_url || (typeof window !== 'undefined' ? window.location.href : null),
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      });
  } catch (e) {
    // Don't let error tracking errors break the app
    console.error('[ErrorTracking] Failed to log error:', e);
  }
};

/**
 * Helper to extract error info from various error types
 */
export const parseError = (error: unknown): { message: string; code?: string } => {
  if (error instanceof Error) {
    // Check for PostgreSQL error codes in message
    const pgCodeMatch = (error.message || '').match(/(\d{5}):/);
    return {
      message: error.message,
      code: pgCodeMatch ? pgCodeMatch[1] : undefined,
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

// Removed: withErrorTracking (unused wrapper)

// Removed: getRecentErrors, getErrorSummary (unused admin functions)
