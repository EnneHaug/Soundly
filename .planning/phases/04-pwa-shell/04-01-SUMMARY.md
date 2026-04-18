---
phase: "04-pwa-shell"
plan: "01"
subsystem: "pwa"
tags: ["pwa", "service-worker", "ios", "offline", "workbox"]
dependency_graph:
  requires: []
  provides: ["installable-pwa", "offline-support", "ios-polish"]
  affects: ["index.html", "src/sw.ts", "vite.config.ts"]
tech_stack:
  added: ["workbox-routing"]
  patterns: ["NavigationRoute SPA fallback", "injectManifest precache-only", "silent SW update"]
key_files:
  created: ["src/vite-env.d.ts"]
  modified:
    - "index.html"
    - "src/sw.ts"
    - "tsconfig.app.json"
    - "src/engine/index.ts"
    - "src/components/Countdown.tsx"
    - "src/engine/sounds/__tests__/phase3Tone.test.ts"
    - "src/platform/notifications.ts"
decisions:
  - "D-01: Silent SW update — no skipWaiting/clients.claim, new SW activates naturally on next page load"
  - "D-02: apple-mobile-web-app-status-bar-style set to 'default' (not black-translucent) because app uses light background #f4f1eb"
  - "D-04: Precache-only strategy — NavigationRoute added as belt-and-suspenders for SPA navigation, but no runtime caching"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-18"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 7
---

# Phase 04 Plan 01: PWA Shell Completion Summary

**One-liner:** iOS Apple meta tags, Workbox NavigationRoute SPA fallback, and production build validation producing installable PWA with offline support via precache-only strategy.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Add Apple meta tags to index.html and NavigationRoute to service worker | ff15493 | index.html, src/sw.ts, package.json |
| 2 | Validate production build produces correct installable PWA | 071df70 | tsconfig.app.json, src/vite-env.d.ts, src/sw.ts, src/engine/index.ts |

## What Was Built

### Task 1 — Apple Meta Tags + NavigationRoute
- Added `<meta name="theme-color" content="#5c6b56" />` to index.html
- Added four Apple PWA meta tags: `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style` (default), `apple-mobile-web-app-title`, and `apple-touch-icon` link
- Added `workbox-routing` dev dependency
- Extended `src/sw.ts` with `NavigationRoute` + `createHandlerBoundToURL('/index.html')` for SPA navigation resilience
- No `skipWaiting` or `clients.claim` added — D-01 silent update strategy preserved

### Task 2 — Production Build Validation
- Production build succeeds: `npm run build` exits 0
- `dist/sw.js` present (16.89 kB): contains `createHandlerBoundToURL`, `notificationclick` handler, precache manifest (8 entries, 219.66 KiB), no `skipWaiting`
- `dist/manifest.webmanifest` present: name "Soundly Gentle Alarm", display "standalone", start_url "/", background_color "#f4f1eb", theme_color "#5c6b56", 3 icons (192, 512, 512-maskable)
- `dist/index.html` contains `apple-mobile-web-app-capable` and auto-injected `rel="manifest"`
- All icon files present in `dist/icons/`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Missing `jsx` compiler option in tsconfig.app.json**
- **Found during:** Task 2 (npm run build used `tsc -b` which revealed the missing option)
- **Issue:** `tsconfig.app.json` was missing `"jsx": "react-jsx"`, causing all JSX files to fail `tsc -b`. The plan's `tsc --noEmit` verification in Task 1 passed because it uses a different invocation path that didn't reveal this.
- **Fix:** Added `"jsx": "react-jsx"` to `tsconfig.app.json`
- **Files modified:** `tsconfig.app.json`
- **Commit:** 071df70

**2. [Rule 2 - Missing] No `vite-env.d.ts` type declaration file**
- **Found during:** Task 2
- **Issue:** `src/main.tsx` imports `./index.css` which requires Vite client type declarations to resolve. Without `vite-env.d.ts`, `tsc -b` fails with "Cannot find module './index.css'".
- **Fix:** Created `src/vite-env.d.ts` with `/// <reference types="vite/client" />`
- **Files modified:** `src/vite-env.d.ts` (created)
- **Commit:** 071df70

**3. [Rule 1 - Bug] `clients` global not typed in sw.ts**
- **Found during:** Task 2
- **Issue:** The existing `notificationclick` handler used bare `clients` global which TypeScript couldn't resolve. The `/// <reference lib="webworker" />` directive exposes `self.clients` (typed `Clients`) but not `clients` as a standalone global.
- **Fix:** Changed `clients.matchAll(...)` and `clients.openWindow(...)` to `self.clients.matchAll(...)` and `self.clients.openWindow(...)`. Added explicit `readonly Client[]` type annotation for the callback parameter.
- **Files modified:** `src/sw.ts`
- **Commit:** 071df70

**4. [Rule 1 - Bug] `export type` required for type re-exports in isolatedModules mode**
- **Found during:** Task 2
- **Issue:** `src/engine/index.ts` re-exported `AlarmPhase`, `AlarmConfig`, `PhaseChangeCallback` (all types) using value `export {}` syntax, which violates `isolatedModules: true` requirement.
- **Fix:** Split into `export type { AlarmPhase, AlarmConfig, PhaseChangeCallback }` and `export { DEFAULT_CONFIG, QUICK_NAP_CONFIG, FOCUS_CONFIG, validateConfig }`
- **Files modified:** `src/engine/index.ts`
- **Commit:** 071df70

**5. [Rule 1 - Bug] Unused variable `phaseToIndex` in Countdown.tsx**
- **Found during:** Task 2
- **Issue:** `noUnusedLocals: true` flagged `phaseToIndex` function that was defined but never called (component uses `alarm.phase` string directly).
- **Fix:** Removed the unused function
- **Files modified:** `src/components/Countdown.tsx`
- **Commit:** 071df70

**6. [Rule 1 - Bug] Unused variable `mockGainNode` in phase3Tone.test.ts**
- **Found during:** Task 2
- **Issue:** `noUnusedLocals: true` flagged `mockGainNode` assigned but never read (test uses `fakeGainNode` instead).
- **Fix:** Removed the unused variable assignment
- **Files modified:** `src/engine/sounds/__tests__/phase3Tone.test.ts`
- **Commit:** 071df70

**7. [Rule 1 - Bug] `renotify` missing from TypeScript NotificationOptions type**
- **Found during:** Task 2
- **Issue:** `src/platform/notifications.ts` used `renotify: false` in notification options, which is a valid Notifications API property but absent from TypeScript's `NotificationOptions` type definition.
- **Fix:** Spread `renotify: false` as `Record<string, unknown>` to bypass the missing type without removing the runtime behavior.
- **Files modified:** `src/platform/notifications.ts`
- **Commit:** 071df70

## Known Stubs

None — all PWA artifacts are fully wired. The manifest, service worker, icons, and Apple meta tags are all real values, not placeholders.

## Threat Flags

No new security surface introduced beyond what the plan's threat model covers. `NavigationRoute` is restricted to navigation requests only (T-04-04 mitigation confirmed — Workbox default scope). `self.clients` usage is same-origin only.

## Verification Results

All plan verification criteria passed:

1. `npm run build` exits 0
2. `dist/manifest.webmanifest` contains name "Soundly Gentle Alarm", display "standalone", start_url "/", background_color "#f4f1eb", theme_color "#5c6b56", 3 icon entries
3. `dist/sw.js` contains precache manifest (8 entries, `__WB_MANIFEST` replaced with actual URL array) and `createHandlerBoundToURL`
4. `dist/index.html` contains `apple-mobile-web-app-capable` and auto-injected `rel="manifest"`
5. `tsc -b` compiles with zero errors
6. No `skipWaiting` or `clients.claim` in `dist/sw.js`

## Self-Check: PASSED

All required files exist. Both task commits verified in git log.
