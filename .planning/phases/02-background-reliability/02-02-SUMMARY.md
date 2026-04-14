---
phase: "02"
plan: "02"
subsystem: platform
tags: [pwa, notifications, service-worker, ios-detection, workbox]
dependency_graph:
  requires: []
  provides:
    - src/sw.ts (custom service worker with notificationclick handler)
    - src/platform/notifications.ts (notification permission + show/clear utilities)
    - src/platform/standalone.ts (iOS standalone detection)
    - vite.config.ts (vite-plugin-pwa injectManifest config)
    - public/icons/ (placeholder PWA icons)
  affects:
    - vite build (now produces SW via injectManifest)
    - PWA installability (manifest + icons present)
tech_stack:
  added:
    - workbox-precaching ^7.4.0 (dev dep, required by injectManifest mode custom SW)
    - vite-plugin-pwa (already installed, now configured)
  patterns:
    - injectManifest strategy for custom SW with notificationclick handler
    - ServiceWorkerRegistration.showNotification() for mobile-compatible notifications
    - tag-based notification deduplication (soundly-alarm tag, renotify:false)
    - typeof Notification check instead of 'Notification' in window (Node-test compatible)
    - combined display-mode media query + navigator.standalone for iOS PWA detection
key_files:
  created:
    - src/sw.ts
    - src/platform/notifications.ts
    - src/platform/standalone.ts
    - src/platform/__tests__/notifications.test.ts
    - src/platform/__tests__/standalone.test.ts
    - public/icons/icon-192x192.png
    - public/icons/icon-512x512.png
    - public/icons/icon-512x512-maskable.png
  modified:
    - vite.config.ts
    - package.json
decisions:
  - "Use typeof Notification check (not 'Notification' in window) for Node test environment compatibility"
  - "Placeholder PNGs generated programmatically at 192x192 and 512x512; real brand assets deferred to Phase 4"
  - "Single notification on Phase 1 trigger with Soundly — Alarm ringing message; tapping foregrounds app only"
metrics:
  duration: "3 minutes"
  completed_date: "2026-04-14"
  tasks_completed: 2
  tasks_total: 2
  files_created: 8
  files_modified: 2
  tests_added: 17
  tests_passing: 17
---

# Phase 02 Plan 02: PWA Service Worker, Notifications, and iOS Detection Summary

**One-liner:** Custom service worker with notificationclick handler via vite-plugin-pwa injectManifest, notification permission/show/clear utilities using ServiceWorkerRegistration.showNotification with tag deduplication, and iOS standalone detection combining display-mode media query with navigator.standalone.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install workbox-precaching, configure vite-plugin-pwa, create custom SW and placeholder icons | ef90692 | vite.config.ts, src/sw.ts, package.json, public/icons/*.png |
| 2 | Notification utilities and iOS standalone detection with tests (TDD) | 547c1a5 | src/platform/notifications.ts, src/platform/standalone.ts, src/platform/__tests__/*.test.ts |

## What Was Built

### Custom Service Worker (src/sw.ts)
Handles `notificationclick` events: closes the notification, then focuses an existing app window or opens a new one at origin root. Uses workbox-precaching for static asset precaching via the injected `__WB_MANIFEST`.

### Notification Utilities (src/platform/notifications.ts)
- `requestNotificationPermission()` — guards all paths: unavailable API, already granted/denied, and user prompt. Must be called from a user gesture per T-02-05.
- `showAlarmNotification()` — fires via `ServiceWorkerRegistration.showNotification()` with `tag: 'soundly-alarm'` and `requireInteraction: true`. At-most-one notification guaranteed by `renotify: false` (T-02-08).
- `clearAlarmNotification()` — fetches notifications by tag and closes each.

### iOS Standalone Detection (src/platform/standalone.ts)
- `isPwaInstalled()` — checks `display-mode: standalone` media query (cross-browser) and `navigator.standalone` (iOS WebKit).
- `isIosSafariNonInstalled()` — tests iOS user agent regex then delegates to `isPwaInstalled()`.

### vite-plugin-pwa Configuration (vite.config.ts)
Uses `injectManifest` strategy pointing to `src/sw.ts`, full PWA manifest with dark navy palette (`#1a1a2e`), portrait orientation, standalone display, and three icon entries.

### Placeholder Icons (public/icons/)
Three programmatically generated minimal valid PNGs (192x192, 512x512, 512x512-maskable) in dark navy. Real brand assets to be generated in Phase 4 with `@vite-pwa/assets-generator`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced `'Notification' in window` guard with `typeof Notification`**
- **Found during:** Task 2 GREEN phase
- **Issue:** The vitest environment is `node`, where `window` is not defined. The implementation guard `'Notification' in window` threw `ReferenceError: window is not defined` in tests that set Notification to undefined on `globalThis`.
- **Fix:** Changed both guards in `notifications.ts` to `typeof Notification === 'undefined'` / `typeof Notification !== 'undefined'`. Semantically equivalent in browsers; works in Node test environment.
- **Files modified:** src/platform/notifications.ts
- **Commit:** 547c1a5 (included in implementation commit)

## Known Stubs

None — all functions are fully implemented and wired. Placeholder icons are intentional placeholders documented in decisions; they do not affect plan goal (PWA manifest validity).

## Threat Surface Scan

All new surface matches the plan's threat model. No new unplanned surface introduced.

| Threat | File | Mitigated |
|--------|------|-----------|
| T-02-05: Notification permission abuse | notifications.ts | Permission checked before every showNotification call; no auto-request |
| T-02-06: SW scope overreach | sw.ts | notificationclick only focuses existing windows or opens origin root |
| T-02-08: Notification spam | notifications.ts | tag + renotify:false ensures at most one notification at a time |

## Self-Check: PASSED

Files exist:
- src/sw.ts: FOUND
- src/platform/notifications.ts: FOUND
- src/platform/standalone.ts: FOUND
- src/platform/__tests__/notifications.test.ts: FOUND
- src/platform/__tests__/standalone.test.ts: FOUND
- public/icons/icon-192x192.png: FOUND
- public/icons/icon-512x512.png: FOUND
- public/icons/icon-512x512-maskable.png: FOUND
- vite.config.ts (modified): FOUND

Commits exist:
- ef90692: Task 1 — FOUND
- 547c1a5: Task 2 — FOUND

Tests: 17/17 passing. TypeScript: zero errors.
