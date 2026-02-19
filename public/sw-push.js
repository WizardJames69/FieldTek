// Service Worker for Push Notifications and Background Sync
const CACHE_NAME = 'fieldtek-push-v1';
const SYNC_TAG = 'fieldtek-offline-sync';

// Handle push events
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);

  let data = {
    title: 'FieldTek Notification',
    body: 'You have a new notification',
    icon: '/pwa-icon-192.png',
    badge: '/fieldtek-favicon.png',
    tag: 'default',
    data: {}
  };

  try {
    if (event.data) {
      const payload = event.data.json();
      data = {
        title: payload.title || data.title,
        body: payload.body || data.body,
        icon: payload.icon || data.icon,
        badge: payload.badge || data.badge,
        tag: payload.tag || payload.type || data.tag,
        data: payload.data || {},
        actions: payload.actions || []
      };
    }
  } catch (e) {
    console.error('[SW] Error parsing push data:', e);
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    data: data.data,
    vibrate: [200, 100, 200],
    requireInteraction: data.tag === 'job_assignment',
    actions: data.actions
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);
  
  event.notification.close();

  const data = event.notification.data || {};
  let urlToOpen = '/dashboard';

  // Determine URL based on notification type
  if (data.type === 'job_assignment' && data.jobId) {
    urlToOpen = `/my-jobs?job=${data.jobId}`;
  } else if (data.type === 'job_status_change' && data.jobId) {
    urlToOpen = `/jobs?job=${data.jobId}`;
  } else if (data.url) {
    urlToOpen = data.url;
  }

  // Handle action clicks
  if (event.action === 'view') {
    urlToOpen = data.url || urlToOpen;
  } else if (event.action === 'dismiss') {
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            // Post message for in-app navigation
            client.postMessage({
              type: 'NOTIFICATION_CLICK',
              data: data,
              url: urlToOpen
            });
            return client.focus();
          }
        }
        // Open new window — append ?notification=1 so the app can detect launch-from-notification
        if (clients.openWindow) {
          const separator = urlToOpen.includes('?') ? '&' : '?';
          return clients.openWindow(urlToOpen + separator + 'notification=1');
        }
      })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed:', event);
});

// Handle background sync events
self.addEventListener('sync', (event) => {
  console.log('[SW] Sync event triggered:', event.tag);
  
  if (event.tag === SYNC_TAG) {
    event.waitUntil(syncOfflineData());
  }
});

// Background sync function
async function syncOfflineData() {
  console.log('[SW] Starting background sync...');
  
  try {
    // Send message to all clients to trigger sync
    const clients = await self.clients.matchAll({ type: 'window' });
    
    for (const client of clients) {
      client.postMessage({
        type: 'BACKGROUND_SYNC_TRIGGERED',
        timestamp: Date.now()
      });
    }
    
    console.log('[SW] Background sync message sent to clients');
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
    throw error; // Re-throw to let the browser retry
  }
}

// Handle messages from main thread
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  // Handle request to register background sync
  if (event.data && event.data.type === 'REGISTER_SYNC') {
    if ('sync' in self.registration) {
      self.registration.sync.register(SYNC_TAG)
        .then(() => {
          console.log('[SW] Background sync registered');
          event.source.postMessage({ type: 'SYNC_REGISTERED', success: true });
        })
        .catch((err) => {
          console.error('[SW] Failed to register sync:', err);
          event.source.postMessage({ type: 'SYNC_REGISTERED', success: false, error: err.message });
        });
    } else {
      console.log('[SW] Background Sync not supported');
      event.source.postMessage({ type: 'SYNC_REGISTERED', success: false, error: 'Not supported' });
    }
  }
});

// Periodic sync for newer browsers (if available)
self.addEventListener('periodicsync', (event) => {
  console.log('[SW] Periodic sync:', event.tag);
  
  if (event.tag === 'fieldtek-periodic-sync') {
    event.waitUntil(syncOfflineData());
  }
});

// Online/offline detection
self.addEventListener('online', () => {
  console.log('[SW] Online detected, triggering sync...');
  if ('sync' in self.registration) {
    self.registration.sync.register(SYNC_TAG);
  }
});

// Install event
self.addEventListener('install', (event) => {
  console.log('[SW] Push service worker installed');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[SW] Push service worker activated');
  event.waitUntil(clients.claim());
});
