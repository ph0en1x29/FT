// FieldPro Service Worker v2.0
// Push Notifications + Offline Caching + PWA

const CACHE_NAME = 'fieldpro-v2';
const STATIC_CACHE = 'fieldpro-static-v2';
const API_CACHE = 'fieldpro-api-v1';

// Static assets to precache
const PRECACHE_URLS = [
  '/',
  '/favicon.svg',
  '/manifest.json',
];

// Install: precache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing v2...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating v2...');
  event.waitUntil(
    caches.keys().then(keys => 
      Promise.all(
        keys
          .filter(key => key !== STATIC_CACHE && key !== API_CACHE && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => clients.claim())
  );
});

// Fetch: network-first for API, cache-first for static
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET and cross-origin
  if (event.request.method !== 'GET') return;
  if (!url.origin.includes(self.location.origin) && !url.hostname.includes('supabase')) return;

  // API requests (Supabase): network-first with cache fallback
  if (url.hostname.includes('supabase')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache successful GET responses
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(API_CACHE).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Offline: serve from cache
          return caches.match(event.request).then(cached => {
            if (cached) return cached;
            return new Response(JSON.stringify({ error: 'offline', message: 'No network connection' }), {
              headers: { 'Content-Type': 'application/json' }
            });
          });
        })
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Return cache but also update in background
        fetch(event.request).then(response => {
          if (response.ok) {
            caches.open(STATIC_CACHE).then(cache => cache.put(event.request, response));
          }
        }).catch(() => {});
        return cached;
      }
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback for navigation
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

// Push notifications
self.addEventListener('push', (event) => {
  let data = {
    title: 'FieldPro',
    body: 'You have a new notification',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'fieldpro-notification',
    data: { url: '/' }
  };

  if (event.data) {
    try {
      const pushData = event.data.json();
      data = { ...data, ...pushData, data: { url: pushData.url || '/', ...pushData.data } };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      tag: data.tag,
      requireInteraction: data.priority === 'urgent',
      vibrate: data.priority === 'urgent' ? [200, 100, 200, 100, 200] : [200, 100, 200],
      data: data.data,
      actions: [
        { action: 'open', title: 'Open' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    })
  );
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const urlToOpen = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      return clients.openWindow(urlToOpen);
    })
  );
});

// Background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-notifications') {
    // Future: sync offline actions
  }
});
