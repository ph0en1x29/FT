/**
 * Error Tracking Service
 * 
 * Provides centralized error tracking with Sentry integration.
 * Only active in production to avoid noise in development.
 */

import * as Sentry from '@sentry/react';

const isDev = import.meta.env.DEV;

/**
 * Initialize error tracking
 * Call this once at app startup
 */
export const initErrorTracking = () => {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  
  if (!dsn) {
    if (!isDev) {
      /* Silently ignore */
    }
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    
    // Performance monitoring
    tracesSampleRate: 0.1, // 10% of transactions
    
    // Session replay for debugging
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
    
    // Filter out noisy errors
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      'Network request failed',
      'Load failed',
      'Failed to fetch',
    ],
    
    // Don't send errors in development
    enabled: !isDev,
    
    beforeSend(event) {
      // Don't send chunk load errors (handled by ErrorBoundary)
      if (event.exception?.values?.some(e => 
        e.value?.includes('dynamically imported module') ||
        e.value?.includes('Loading chunk')
      )) {
        return null;
      }
      return event;
    },
  });

};

/**
 * Capture an error with optional context
 */
export const captureError = (
  error: Error,
  context?: Record<string, any>
) => {
  
  if (!isDev && import.meta.env.VITE_SENTRY_DSN) {
    Sentry.captureException(error, {
      extra: context,
    });
  }
};

/**
 * Capture a message/warning
 */
export const captureMessage = (
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: Record<string, any>
) => {
  
  if (!isDev && import.meta.env.VITE_SENTRY_DSN) {
    Sentry.captureMessage(message, {
      level,
      extra: context,
    });
  }
};

/**
 * Set user context for error tracking
 */
export const setUser = (user: { id: string; email?: string; name?: string } | null) => {
  if (!isDev && import.meta.env.VITE_SENTRY_DSN) {
    Sentry.setUser(user);
  }
};

/**
 * Add breadcrumb for debugging
 */
export const addBreadcrumb = (breadcrumb: {
  category: string;
  message: string;
  level?: 'info' | 'warning' | 'error';
  data?: Record<string, any>;
}) => {
  if (!isDev && import.meta.env.VITE_SENTRY_DSN) {
    Sentry.addBreadcrumb({
      ...breadcrumb,
      level: breadcrumb.level || 'info',
    });
  }
};

export default {
  initErrorTracking,
  captureError,
  captureMessage,
  setUser,
  addBreadcrumb,
};
