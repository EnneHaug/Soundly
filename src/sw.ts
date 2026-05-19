/// <reference lib="webworker" />

import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { clientsClaim } from 'workbox-core';

declare let self: ServiceWorkerGlobalScope;

// Clean up old caches from previous versions
cleanupOutdatedCaches();

// Precache static assets injected by vite-plugin-pwa at build time
precacheAndRoute(self.__WB_MANIFEST);

// SPA navigation fallback — serves cached index.html for all navigation requests.
// Belt-and-suspenders: precacheAndRoute handles exact URL matches, but
// NavigationRoute catches browser navigation to paths not in the precache manifest
// (e.g., direct URL entry, refresh on a deep link if one is ever added).
const navHandler = createHandlerBoundToURL('/Soundly/index.html');
registerRoute(new NavigationRoute(navHandler));

/**
 * Handle notification taps (PLT-03).
 * Focuses the existing app window if open, otherwise opens a new one.
 * The notification is closed on tap — alarm dismissal happens in the app UI only.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList: readonly Client[]) => {
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            return (client as WindowClient).focus();
          }
        }
        return self.clients.openWindow('/Soundly/');
      })
  );
});

// ─── Phase 10 / SEO-09 — Service worker auto-update ───────────────────
// Take control of the page immediately on activation so installed PWA
// users receive updated meta + content on next launch without manual
// reload. Combined with `registerType: 'autoUpdate'` in vite.config.ts.
// `clientsClaim()` from workbox-core wraps self.clients.claim() in the
// correct activate-event listener internally — avoids the "claim called
// before activation" runtime exception that naked self.clients.claim()
// at top-level produces. See workbox-core docs + RESEARCH Finding 2.
self.skipWaiting();
clientsClaim();
