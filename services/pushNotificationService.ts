/**
 * Push Notification Service for FieldPro
 * 
 * Handles:
 * - Service worker registration
 * - Push notification permission requests
 * - Subscription management
 * - Sending push notifications
 */

// VAPID Public Key - In production, this should come from environment variables
// For demo purposes, we're using a placeholder that will work for local testing
// Generate real keys at: https://web-push-codelab.glitch.me/ or using web-push CLI
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

// Service worker registration
let swRegistration: ServiceWorkerRegistration | null = null;

// Permission states
export type PushPermissionState = 'granted' | 'denied' | 'default' | 'unsupported';

/**
 * Check if push notifications are supported in this browser
 */
export const isPushSupported = (): boolean => {
  return 'serviceWorker' in navigator && 
         'PushManager' in window && 
         'Notification' in window;
};

/**
 * Get current push notification permission state
 */
export const getPushPermissionState = (): PushPermissionState => {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission as PushPermissionState;
};

/**
 * Register the service worker
 */
export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!isPushSupported()) {
    console.warn('[Push] Push notifications not supported in this browser');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });
    
    console.log('[Push] Service Worker registered:', registration.scope);
    swRegistration = registration;
    
    // Wait for the service worker to be ready
    await navigator.serviceWorker.ready;
    console.log('[Push] Service Worker ready');
    
    return registration;
  } catch (error) {
    console.error('[Push] Service Worker registration failed:', error);
    return null;
  }
};

/**
 * Request push notification permission
 */
export const requestPushPermission = async (): Promise<PushPermissionState> => {
  if (!isPushSupported()) {
    console.warn('[Push] Push notifications not supported');
    return 'unsupported';
  }

  try {
    const permission = await Notification.requestPermission();
    console.log('[Push] Permission result:', permission);
    return permission as PushPermissionState;
  } catch (error) {
    console.error('[Push] Permission request failed:', error);
    return 'denied';
  }
};

/**
 * Subscribe to push notifications
 * Returns the subscription object which should be sent to the server
 */
export const subscribeToPush = async (): Promise<PushSubscription | null> => {
  if (!swRegistration) {
    console.warn('[Push] Service worker not registered');
    swRegistration = await registerServiceWorker();
    if (!swRegistration) return null;
  }

  if (Notification.permission !== 'granted') {
    console.warn('[Push] Notification permission not granted');
    return null;
  }

  try {
    // Check for existing subscription
    let subscription = await swRegistration.pushManager.getSubscription();
    
    if (subscription) {
      console.log('[Push] Existing subscription found');
      return subscription;
    }

    // Create new subscription
    // Note: VAPID key is optional for local testing, but required for production
    const subscribeOptions: PushSubscriptionOptionsInit = {
      userVisibleOnly: true,
    };

    if (VAPID_PUBLIC_KEY) {
      subscribeOptions.applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    }

    subscription = await swRegistration.pushManager.subscribe(subscribeOptions);
    console.log('[Push] New subscription created:', subscription.endpoint);
    
    return subscription;
  } catch (error) {
    console.error('[Push] Subscription failed:', error);
    return null;
  }
};

/**
 * Unsubscribe from push notifications
 */
export const unsubscribeFromPush = async (): Promise<boolean> => {
  if (!swRegistration) return false;

  try {
    const subscription = await swRegistration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      console.log('[Push] Unsubscribed from push notifications');
      return true;
    }
    return false;
  } catch (error) {
    console.error('[Push] Unsubscription failed:', error);
    return false;
  }
};

/**
 * Get current push subscription
 */
export const getCurrentSubscription = async (): Promise<PushSubscription | null> => {
  if (!swRegistration) {
    swRegistration = await registerServiceWorker();
    if (!swRegistration) return null;
  }

  try {
    return await swRegistration.pushManager.getSubscription();
  } catch (error) {
    console.error('[Push] Failed to get subscription:', error);
    return null;
  }
};

/**
 * Send a local notification (fallback when push not available)
 * This shows a notification directly without going through push
 */
export const sendLocalNotification = (
  title: string,
  options?: NotificationOptions & { url?: string }
): Notification | null => {
  if (!('Notification' in window)) {
    console.warn('[Push] Notifications not supported');
    return null;
  }

  if (Notification.permission !== 'granted') {
    console.warn('[Push] Notification permission not granted');
    return null;
  }

  try {
    const notification = new Notification(title, {
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      ...options
    } as NotificationOptions & { vibrate?: number[] });

    // Handle notification click
    notification.onclick = () => {
      notification.close();
      if (options?.url) {
        window.focus();
        window.location.href = options.url;
      }
    };

    return notification;
  } catch (error) {
    // Fallback for browsers that require SW for notifications
    console.warn('[Push] Direct notification failed, trying via SW:', error);
    
    if (swRegistration) {
      swRegistration.showNotification(title, {
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        ...options,
        data: { url: options?.url || '/' }
      } as NotificationOptions & { vibrate?: number[] });
    }
    
    return null;
  }
};

/**
 * Initialize push notifications
 * Call this on app startup or after login
 */
export const initializePushNotifications = async (): Promise<{
  supported: boolean;
  permission: PushPermissionState;
  subscription: PushSubscription | null;
}> => {
  const result = {
    supported: isPushSupported(),
    permission: getPushPermissionState(),
    subscription: null as PushSubscription | null
  };

  if (!result.supported) {
    console.log('[Push] Push notifications not supported');
    return result;
  }

  // Register service worker
  await registerServiceWorker();

  // If permission already granted, get/create subscription
  if (result.permission === 'granted') {
    result.subscription = await subscribeToPush();
  }

  return result;
};

/**
 * Request and initialize push notifications
 * Use this when user explicitly enables notifications
 */
export const enablePushNotifications = async (): Promise<{
  success: boolean;
  permission: PushPermissionState;
  subscription: PushSubscription | null;
}> => {
  const result = {
    success: false,
    permission: getPushPermissionState(),
    subscription: null as PushSubscription | null
  };

  if (!isPushSupported()) {
    return result;
  }

  // Request permission
  result.permission = await requestPushPermission();
  
  if (result.permission === 'granted') {
    // Subscribe to push
    result.subscription = await subscribeToPush();
    result.success = result.subscription !== null;
  }

  return result;
};

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  
  return outputArray;
}

// Export types
export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  url?: string;
  data?: Record<string, any>;
  actions?: { action: string; title: string }[];
}
