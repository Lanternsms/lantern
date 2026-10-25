// Lantern Hand-Written Service Worker
// Strictly offline navigation fallback + Web Push notifications.
// NEVER caches authenticated responses, API requests, or user data.

const OFFLINE_CACHE_NAME = 'lantern-offline-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(OFFLINE_CACHE_NAME).then((cache) => cache.add(OFFLINE_URL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== OFFLINE_CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// Minimal fetch handler: ONLY intercepts failed navigation requests to show offline page.
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cache = await caches.open(OFFLINE_CACHE_NAME);
        const cachedResponse = await cache.match(OFFLINE_URL);
        return cachedResponse || new Response('Offline', { status: 503, statusText: 'Offline' });
      })
    );
  }
  // All other requests pass straight through to the network without caching
});

// Web Push handler
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { title: 'Lantern', body: event.data.text() };
    }
  }

  const title = data.title || 'Lantern';
  const body = data.body || '';
  const url = data.url || '/dashboard';
  const tag = data.tag || (data.nid ? `nid-${data.nid}` : 'lantern-alert');

  // Update app badge if supported
  if (typeof data.unread === 'number' && 'setAppBadge' in self.navigator) {
    try {
      if (data.unread > 0) {
        self.navigator.setAppBadge(data.unread).catch(() => {});
      } else {
        self.navigator.clearAppBadge().catch(() => {});
      }
    } catch {
      // Ignore badge errors
    }
  }

  const options = {
    body,
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    tag,
    renotify: true,
    vibrate: [100, 50, 100],
    data: { url },
  };

  // Browsers require a notification to be shown for every push event
  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const rawUrl = event.notification.data?.url || '/dashboard';

  // Security check: only allow same-origin routes matching /n/ or /dashboard
  let targetUrl;
  try {
    const parsed = new URL(rawUrl, self.location.origin);
    if (parsed.origin !== self.location.origin) {
      return;
    }
    // Must be either an /n/ route or /dashboard
    if (!parsed.pathname.startsWith('/n/') && !parsed.pathname.startsWith('/dashboard')) {
      return;
    }
    targetUrl = parsed.href;
  } catch {
    return;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus().then(() => {
            if ('navigate' in client) {
              return client.navigate(targetUrl);
            }
          });
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
