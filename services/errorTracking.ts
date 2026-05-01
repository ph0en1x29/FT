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

    // Performance monitoring — browserTracingIntegration captures route
    // navigations and resource timings so the Sentry Performance dashboard
    // shows p50/p95 per page. The 10% sample rate matches sessionReplay's;
    // bump per-route via tracesSampler if specific pages need finer data.
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    tracesSampleRate: 0.1, // 10% of transactions
    tracePropagationTargets: [/^\//, /supabase\.co/],

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
      // Supabase-js navigator.locks lock acquire timeout — mitigated at the
      // client level via a resilient auth lock in services/supabaseClient.ts,
      // filtered here as a safety net for stale tabs still running the old
      // client. See CHANGELOG 2026-04-10.
      'signal is aborted without reason',
      'LockAcquireTimeoutError',
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
 * Wire web-vitals (CLS, INP, LCP, FCP, TTFB) to Sentry as breadcrumbs and
 * messages. This gives us per-route p50/p95 user-experience metrics that
 * Sentry's standard browserTracingIntegration doesn't capture by default.
 * Idempotent — safe to call multiple times.
 */
export const reportWebVitals = async () => {
  if (isDev || !import.meta.env.VITE_SENTRY_DSN) return;
  try {
    const { onCLS, onINP, onLCP, onFCP, onTTFB } = await import('web-vitals');
    const send = (metric: { name: string; value: number; rating?: string; id: string }) => {
      Sentry.addBreadcrumb({
        category: 'web-vitals',
        message: metric.name,
        level: metric.rating === 'poor' ? 'warning' : 'info',
        data: { value: metric.value, rating: metric.rating, id: metric.id },
      });
      // Surface poor-rated vitals as a sampled message so they show up in
      // Issues without flooding the project on healthy pages.
      if (metric.rating === 'poor') {
        Sentry.captureMessage(`web-vitals:${metric.name}=poor`, {
          level: 'warning',
          tags: { web_vital: metric.name, rating: metric.rating },
          extra: { value: metric.value, id: metric.id },
        });
      }
    };
    onCLS(send);
    onINP(send);
    onLCP(send);
    onFCP(send);
    onTTFB(send);
  } catch (_e) {
    /* web-vitals optional — never throw from telemetry path */
  }
};

/**
 * Capture an error with optional context
 */
export const captureError = (
  error: Error,
  context?: Record<string, unknown>
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
  context?: Record<string, unknown>
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
  data?: Record<string, unknown>;
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
  reportWebVitals,
  captureError,
  captureMessage,
  setUser,
  addBreadcrumb,
};
