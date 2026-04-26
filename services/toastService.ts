import { toast } from 'sonner';
import { trackActionError } from './errorTrackingService';

/**
 * Toast Service - Centralized toast notifications for FieldPro
 * 
 * Now with automatic error tracking for "Desire Paths" analysis.
 * 
 * Usage:
 *   import { showToast, asyncToast } from './services/toastService';
 * 
 *   // Simple notifications
 *   showToast.success('Job created successfully');
 *   showToast.error('Failed to save changes');
 *   showToast.warning('Unsaved changes will be lost');
 *   showToast.info('New job assigned to you');
 * 
 *   // Async operations with loading state
 *   const result = await asyncToast(
 *     saveJob(data),
 *     { loading: 'Saving...', success: 'Saved!', error: 'Failed to save' }
 *   );
 */

// Simple toast notifications
export const showToast = {
  success: (message: string, description?: string) => {
    toast.success(message, { description });
  },
  
  /**
   * Show an error toast and log to user_action_errors + Sentry.
   *
   * @param message      Headline shown in the toast (also the slugified action_type)
   * @param description  Sub-text shown in the toast + recorded as error_message
   * @param error        Original Error/value — passes stack + code through to tracking
   * @param context      Extra structured payload (job_id, target, etc.) for triage
   */
  error: (
    message: string,
    description?: string,
    error?: unknown,
    context?: { action_target?: string; target_id?: string; payload?: Record<string, unknown> },
  ) => {
    toast.error(message, { description });
    trackActionError({
      action_type: message.toLowerCase().replace(/\s+/g, '_'),
      action_target: context?.action_target,
      target_id: context?.target_id,
      error_message: description || message,
      request_payload: context?.payload,
      error,
    }).catch(() => {}); // Don't let tracking errors break the app
  },
  
  warning: (message: string, description?: string) => {
    toast.warning(message, { description });
  },
  
  info: (message: string, description?: string) => {
    toast.info(message, { description });
  },
  
  // For custom messages
  message: (message: string, description?: string) => {
    toast.message(message, { description });
  },
};

// Async operation wrapper with loading/success/error states
interface AsyncToastOptions<T = unknown> {
  loading?: string;
  success?: string | ((data: T) => string);
  error?: string | ((error: Error) => string);
}

export async function asyncToast<T>(
  promise: Promise<T>,
  options: AsyncToastOptions = {}
): Promise<T> {
  const {
    loading = 'Loading...',
    success = 'Done!',
    error = 'Something went wrong',
  } = options;

  toast.promise(promise, {
    loading,
    success: (data) => typeof success === 'function' ? success(data) : success,
    error: (err) => typeof error === 'function' ? error(err) : `${error}: ${err.message || err}`,
  });
  
  return promise;
}

// Toast with Undo action
interface UndoToastOptions {
  message: string;
  description?: string;
  undoLabel?: string;
  duration?: number;
  onUndo: () => void | Promise<void>;
}

export function showUndoToast({ message, description, undoLabel = 'Undo', duration = 5000, onUndo }: UndoToastOptions) {
  let _undoClicked = false;
  
  return toast(message, {
    description,
    duration,
    action: {
      label: undoLabel,
      onClick: async () => {
        _undoClicked = true;
        try {
          await onUndo();
          showToast.success('Action undone');
        } catch (error) {
          showToast.error('Failed to undo', (error as Error).message);
        }
      },
    },
    onDismiss: () => {
      // Optional: Could track if action was not undone
    },
  });
}

// Re-export toast for advanced usage
export { toast };
