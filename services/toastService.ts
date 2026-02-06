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
  
  error: (message: string, description?: string) => {
    toast.error(message, { description });
    // Track error for Desire Paths analysis
    trackActionError({
      action_type: message.toLowerCase().replace(/\s+/g, '_'),
      error_message: description || message,
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
  let undoClicked = false;
  
  return toast(message, {
    description,
    duration,
    action: {
      label: undoLabel,
      onClick: async () => {
        undoClicked = true;
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

// Destructive action with undo (e.g., delete)
interface DestructiveToastOptions {
  message: string;
  description?: string;
  duration?: number;
  onConfirm: () => void | Promise<void>;
  onUndo?: () => void | Promise<void>;
}

export function showDestructiveToast({ 
  message, 
  description, 
  duration = 5000, 
  onConfirm, 
  onUndo 
}: DestructiveToastOptions) {
  // Immediately execute the action
  const executeAction = async () => {
    try {
      await onConfirm();
    } catch (error) {
      showToast.error('Action failed', (error as Error).message);
    }
  };
  
  executeAction();
  
  // Show toast with undo option if provided
  if (onUndo) {
    return showUndoToast({
      message,
      description,
      duration,
      onUndo,
    });
  } else {
    return toast.success(message, { description, duration });
  }
}

// Common operation toasts for consistency
export const toastMessages = {
  // Job operations
  job: {
    created: () => showToast.success('Job created successfully'),
    updated: () => showToast.success('Job updated'),
    assigned: (techName: string) => showToast.success(`Job assigned to ${techName}`),
    statusChanged: (status: string) => showToast.success(`Status updated to ${status}`),
    deleted: () => showToast.success('Job deleted'),
  },
  
  // Invoice operations
  invoice: {
    created: () => showToast.success('Invoice created'),
    finalized: () => showToast.success('Invoice finalized'),
    updated: () => showToast.success('Invoice updated'),
  },
  
  // User/HR operations
  user: {
    created: () => showToast.success('User created successfully'),
    updated: () => showToast.success('User updated'),
    leaveApproved: () => showToast.success('Leave request approved'),
    leaveRejected: () => showToast.success('Leave request rejected'),
  },
  
  // Inventory operations
  inventory: {
    added: () => showToast.success('Part added to job'),
    removed: () => showToast.success('Part removed from job'),
    stockUpdated: () => showToast.success('Stock updated'),
  },
  
  // Generic errors
  errors: {
    generic: (action: string) => showToast.error(`Failed to ${action}`, 'Please try again'),
    network: () => showToast.error('Network error', 'Check your connection'),
    unauthorized: () => showToast.error('Unauthorized', 'You don\'t have permission for this action'),
    validation: (field: string) => showToast.error('Validation error', `Please check ${field}`),
  },
};

// Re-export toast for advanced usage
export { toast };
