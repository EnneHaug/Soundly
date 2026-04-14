/// <reference lib="webworker" />

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope;

// Clean up old caches from previous versions
cleanupOutdatedCaches();

// Precache static assets injected by vite-plugin-pwa at build time
precacheAndRoute(self.__WB_MANIFEST);

/**
 * Handle notification taps (PLT-03).
 * Focuses the existing app window if open, otherwise opens a new one.
 * The notification is closed on tap — alarm dismissal happens in the app UI only.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            return (client as WindowClient).focus();
          }
        }
        return clients.openWindow('/');
      })
  );
});
