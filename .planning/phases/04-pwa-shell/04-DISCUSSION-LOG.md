# Phase 4: PWA Shell - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-17
**Phase:** 04-pwa-shell
**Areas discussed:** SW update UX, Apple meta tags, Notification click routing, Offline scope

---

## SW Update UX

| Option | Description | Selected |
|--------|-------------|----------|
| Silent + next visit | New SW installs silently in background. Activates on next full page load. User never sees a prompt. Simplest, no UX disruption. | :heavy_check_mark: |
| Toast with reload button | A subtle 'Update available' toast appears. User taps to reload and get the new version. More control, but adds UI complexity. | |
| Auto-reload immediately | New SW activates and reloads the page automatically. Guarantees latest version, but could interrupt an active alarm. | |

**User's choice:** Silent + next visit (Recommended)
**Notes:** Chosen for simplicity and to avoid any risk of interrupting an active alarm.

---

## Apple Meta Tags

| Option | Description | Selected |
|--------|-------------|----------|
| Full polish | Add apple-touch-icon, apple-mobile-web-app-capable, apple-mobile-web-app-status-bar-style, and apple-mobile-web-app-title. | |
| Minimal viable | Just apple-touch-icon. Skip other meta tags — Safari handles standalone via manifest now. | |
| You decide | Claude picks the right set based on current Safari PWA support. | :heavy_check_mark: |

**User's choice:** You decide
**Notes:** Claude has discretion to pick the appropriate Apple meta tags for current Safari PWA support.

---

## Notification Click Routing

| Option | Description | Selected |
|--------|-------------|----------|
| Focus only | SW focuses existing window. Alarm state already drives screen display. No special routing needed. | :heavy_check_mark: |
| PostMessage intent | SW sends 'show-countdown' message to client after focusing. Handles edge case where state might not be reflected yet. | |
| URL param hint | SW opens /?view=countdown. App reads param on load. Works for cold-start scenario. | |

**User's choice:** Focus only (Recommended)
**Notes:** The existing notificationclick handler already implements this correctly. State-driven navigation means the alarm state determines which screen shows.

---

## Offline Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Precache only | Build assets precached by Workbox. No API calls. Already fully offline-capable. | :heavy_check_mark: |
| Add offline fallback page | Dedicated offline.html as safety net if precache misses something. | |
| Navigation fallback to index | Workbox NavigationRoute falls back to index.html for any navigation request. | |

**User's choice:** Precache only (Recommended)
**Notes:** App is fully client-side with no API calls. Precaching build assets is sufficient for complete offline support.

---

## Claude's Discretion

- Apple meta tag selection and values (based on current Safari PWA support)
- Whether NavigationRoute fallback is prudent as belt-and-suspenders
- SW registration verification in production build
- Any index.html cleanup (theme-color meta, manifest link injection)

## Deferred Ideas

None — discussion stayed within phase scope
