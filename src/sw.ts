/// <reference lib="webworker" />

import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { clientsClaim } from 'workbox-core';

declare let self: ServiceWorkerGlobalScope;

// Clean up old caches from previous versions
cleanupOutdatedCaches();

// Precache static assets injected by vite-plugin-pwa at build time
precacheAndRoute(self.__WB_MANIFEST);

// SPA navigation fallback — serves cached app/index.html for /Soundly/app/* navigations.
// Phase 11 / LAND-02 narrowed the allowlist to /Soundly/app/* only; landing (/Soundly/)
// is served from the network per D-LAND-15. Plan 11-01 vite.config.ts manifest
// (start_url + scope + id) is COUPLED with this rescoping per Pitfall A —
// both MUST ship in the same deploy or installed users see stale precached HTML.
const navHandler = createHandlerBoundToURL('/Soundly/app/index.html');
registerRoute(
  new NavigationRoute(navHandler, {
    allowlist: [/^\/Soundly\/app\//],
  })
);

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
        return self.clients.openWindow('/Soundly/app/');  // Phase 11 — notification taps land in /app/, not the landing
      })
  );
});

// ─── Phase 10 / SEO-09 + Phase 11 — Service worker auto-update ────────
// Take control of the page immediately on activation so installed PWA
// users receive updated meta + content on next launch without manual
// reload. Combined with `registerType: 'autoUpdate'` in vite.config.ts.
// `clientsClaim()` from workbox-core wraps self.clients.claim() in the
// correct activate-event listener internally — avoids the "claim called
// before activation" runtime exception that naked self.clients.claim()
// at top-level produces. See workbox-core docs + RESEARCH Finding 2.
//
// Phase 11 — these calls are CRITICAL for the SW rescoping (manifest
// start_url /Soundly/ → /Soundly/app/) to propagate to installed PWA
// users on next launch. Without clientsClaim(), installed users would
// keep the old SW serving stale /Soundly/index.html until they manually
// refresh. See Pitfall A + D-LAND-14/15/16 deploy-runbook addendum.
self.skipWaiting();
clientsClaim();
