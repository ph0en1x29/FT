// FieldPro Service Worker for Push Notifications
// Version: 1.0.0

const CACHE_NAME = 'fieldpro-v1';

// Install event - cache essential resources
self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker installing...');
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker activating...');
  event.waitUntil(clients.claim());
});

// Push notification event - handle incoming push messages
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received:', event);

  let data = {
    title: 'FieldPro Notification',
    body: 'You have a new notification',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: 'fieldpro-notification',
    requireInteraction: false,
    data: { url: '/' }
  };

  // Parse push data if available
  if (event.data) {
    try {
      const pushData = event.data.json();
      data = {
        ...data,
        ...pushData,
        data: { 
          url: pushData.url || pushData.data?.url || '/',
          ...pushData.data
        }
      };
    } catch (e) {
      console.warn('[SW] Failed to parse push data:', e);
      data.body = event.data.text();
    }
  }

  // Set notification options based on priority
  const options = {
    body: data.body,
    icon: data.icon || '/favicon.svg',
    badge: data.badge || '/favicon.svg',
    tag: data.tag || 'fieldpro-notification',
    requireInteraction: data.priority === 'urgent' || data.priority === 'high',
    vibrate: data.priority === 'urgent' ? [200, 100, 200, 100, 200] : [200, 100, 200],
    data: data.data,
    actions: data.actions || [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click event - handle user interaction
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);

  event.notification.close();

  // Handle action buttons
  if (event.action === 'dismiss') {
    return;
  }

  // Open the app or focus existing window
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Check if there's already a window/tab open
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            // Navigate to the notification URL and focus
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        // If no window is open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Notification close event
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed:', event);
});

// Background sync for offline notifications (future enhancement)
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  if (event.tag === 'sync-notifications') {
    // Handle background sync
  }
});
