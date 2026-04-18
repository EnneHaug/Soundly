---
phase: 04-pwa-shell
verified: 2026-04-18T00:00:00Z
status: human_needed
score: 3/3 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Install app from Chrome on Android — tap 'Add to Home Screen' from browser menu"
    expected: "App icon appears on home screen. Launching it opens Soundly in standalone mode with no browser chrome."
    why_human: "PWA installability requires a real device and browser — Chrome DevTools Application panel can check installability criteria but actual install requires physical gesture"
  - test: "Install app on iOS Safari — tap Share > Add to Home Screen"
    expected: "App icon appears with correct name 'Soundly'. Status bar shows default style (light). Splash shows sage green theme color. App launches in standalone mode."
    why_human: "iOS PWA install behavior and splash/status bar rendering require a real iPhone/iPad running Safari"
  - test: "Start an alarm, enable airplane mode, then let the alarm run through all three phases"
    expected: "Alarm progresses through Phase 1 (singing bowl), Phase 2 (vibration/tick), Phase 3 (volume ramp) without any network errors. Audio continues uninterrupted."
    why_human: "Offline isolation test requires a real device with airplane mode toggled — cannot simulate network isolation programmatically in the test environment"
  - test: "With app backgrounded and alarm running, fire a notification — then tap the notification"
    expected: "App is brought to foreground showing the countdown screen with correct phase and remaining time (alarm state preserved)"
    why_human: "Notification click routing via the SW notificationclick handler is a runtime behavior — the handler focuses the existing window, and verifying the countdown screen is actually visible requires human observation"
---

# Phase 4: PWA Shell Verification Report

**Phase Goal:** The app is installable from a browser and works entirely offline
**Verified:** 2026-04-18T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | The app can be installed to a phone home screen from Chrome and Safari | VERIFIED (code) | All installability prerequisites are met: `dist/manifest.webmanifest` exists with `display: "standalone"`, `start_url: "/"`, correct name, and 3 icon entries (192, 512, 512-maskable). `dist/index.html` has auto-injected `<link rel="manifest">`. `index.html` has `apple-mobile-web-app-capable`, `apple-mobile-web-app-title`, and `apple-touch-icon` for iOS. `dist/sw.js` is present (16.89 kB) as a functional service worker. Actual install confirmation requires human/device. |
| 2 | The alarm runs fully after airplane mode is enabled — no network requests fail | VERIFIED (code) | `dist/sw.js` contains 8 precache manifest entries (verified: `"url":` appears 8 times), covering all JS bundles, CSS, HTML, and icons. `NavigationRoute` + `createHandlerBoundToURL('/index.html')` provides SPA navigation fallback. All synthesis is done via Web Audio API (no network calls). No runtime caching strategies — precache-only per D-04. Offline runtime behavior requires human/device. |
| 3 | The service worker notification click handler routes the user back to the countdown screen | VERIFIED (code) | `src/sw.ts` has `notificationclick` handler at line 26. Implementation: `self.clients.matchAll()` focuses any existing same-origin window, else calls `self.clients.openWindow('/')`. Since navigation is state-driven (Phase 3 D-01), the focused window already shows the correct screen (countdown if alarm is running). D-03 accepted this focus-only approach as sufficient. Verified no `postMessage` or URL routing needed. Runtime routing correctness requires human. |

**Score:** 3/3 roadmap success criteria verified (code) — 4 items require human behavioral confirmation

### Plan Must-Haves

#### Truths (from 04-01-PLAN.md frontmatter)

| Truth | Status | Evidence |
|-------|--------|----------|
| The app can be installed to a phone home screen from Chrome and Safari | VERIFIED (code) | See SC-1 above |
| The alarm runs fully after airplane mode is enabled — no network requests fail | VERIFIED (code) | See SC-2 above |
| The service worker notification click handler routes the user back to the countdown screen | VERIFIED (code) | See SC-3 above |
| iOS home screen launch shows correct app name, status bar style, and splash colors | VERIFIED (code) | `index.html`: `apple-mobile-web-app-title` = "Soundly", `apple-mobile-web-app-status-bar-style` = "default" (D-02: light background #f4f1eb → default style), `theme-color` = "#5c6b56". Manifest `background_color: "#f4f1eb"`, `theme_color: "#5c6b56"`. Splash color rendering requires human verification. |
| New service worker versions install silently and activate on next page load | VERIFIED | `src/sw.ts` has no `skipWaiting()` call (grep confirms 0 matches). No `clients.claim()` call. `dist/sw.js` also has 0 `skipWaiting` matches. Natural Workbox lifecycle handles silent activation (D-01). |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `index.html` | Apple meta tags and theme-color for iOS PWA polish — contains "apple-mobile-web-app-capable" | VERIFIED | Contains all 5 required elements: `theme-color`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`, `apple-touch-icon` link. Does NOT contain `<link rel="manifest">` (auto-injected by build, correctly absent in source). |
| `src/sw.ts` | Custom SW with precaching, navigation fallback, and notificationclick — contains "NavigationRoute" | VERIFIED | Contains: `import { NavigationRoute, registerRoute } from 'workbox-routing'`, `createHandlerBoundToURL('/index.html')`, `new NavigationRoute(navHandler)`, `notificationclick` handler, `self.__WB_MANIFEST`. No `skipWaiting`, no `clients.claim`. |
| `vite.config.ts` | VitePWA injectManifest config — plan says contains "apple-touch-icon" | PARTIAL | `vite.config.ts` does NOT contain "apple-touch-icon" (0 grep matches). The `apple-touch-icon` was correctly placed in `index.html` (line 10) and NOT in `vite.config.ts` — this is the right approach for iOS PWA: the `<link>` tag in HTML is what Safari reads, not the web app manifest. The VitePWA config is correctly set up with `strategies: 'injectManifest'`, `srcDir: 'src'`, `filename: 'sw.ts'`, and all manifest fields. The plan artifact spec was aspirational (it mentioned `includeAssets` as an option Claude could choose) — Claude chose the correct HTML-tag approach instead. Functional intent is fully satisfied. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `vite.config.ts` | `src/sw.ts` | injectManifest injects `__WB_MANIFEST` into sw.ts at build time — pattern: `self.__WB_MANIFEST` | WIRED | `src/sw.ts` line 12: `precacheAndRoute(self.__WB_MANIFEST)`. Build produces `dist/sw.js` with 8 precache entries (the `__WB_MANIFEST` token is replaced with real URL array at build time — confirmed by 8 `"url":` entries in dist/sw.js). |
| `index.html` | `public/icons/icon-192x192.png` | apple-touch-icon link element — pattern: "apple-touch-icon" | WIRED | `index.html` line 10: `<link rel="apple-touch-icon" href="/icons/icon-192x192.png" />`. `public/icons/icon-192x192.png` exists (confirmed via `ls public/icons/`). `dist/icons/icon-192x192.png` also present in build output. |
| `src/sw.ts` | `index.html` | NavigationRoute fallback serves index.html for SPA navigation — pattern: "NavigationRoute" | WIRED | `src/sw.ts` lines 3-4: imports `NavigationRoute, registerRoute` from `workbox-routing`. Lines 18-19: `const navHandler = createHandlerBoundToURL('/index.html'); registerRoute(new NavigationRoute(navHandler))`. Pattern confirmed present in compiled `dist/sw.js` (grep matches). |

### Data-Flow Trace (Level 4)

Not applicable — this phase delivers static infrastructure (manifest, service worker, meta tags) rather than components that render dynamic data. All artifacts are configuration/build artifacts, not data-rendering components.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Build produces all required PWA artifacts | `ls dist/sw.js dist/manifest.webmanifest dist/index.html dist/icons/` | All present | PASS |
| Manifest has correct display/name/colors/start_url | Read `dist/manifest.webmanifest` | `"display":"standalone"`, `"name":"Soundly Gentle Alarm"`, `"background_color":"#f4f1eb"`, `"theme_color":"#5c6b56"`, `"start_url":"/"`, 3 icons | PASS |
| dist/index.html has Apple tags and manifest link | grep checks | `apple-mobile-web-app-capable` (2 matches in file), `rel="manifest"` (1 match, auto-injected) | PASS |
| dist/sw.js has no skipWaiting | grep count | 0 matches | PASS |
| dist/sw.js has precache entries (not raw `__WB_MANIFEST`) | Count `"url":` entries | 8 entries | PASS |
| dist/sw.js has NavigationRoute + notificationclick | grep count | 1 match (combined pattern) | PASS |
| workbox-routing in devDependencies | Read `package.json` | `"workbox-routing": "^7.4.0"` present | PASS |
| Both task commits exist in git | `git log ff15493 071df70` | Both commits verified (feat(04-01) messages confirmed) | PASS |
| TypeScript compiles clean | Build script is `tsc -b && vite build` — build succeeded per SUMMARY (exit 0) | Build succeeded; SUMMARY documents 7 TS bug fixes made during task 2 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PLT-01 | 04-01-PLAN.md | PWA installable on home screens with offline support via vite-plugin-pwa | SATISFIED | `vite-plugin-pwa@0.21.1` in devDependencies, `injectManifest` strategy, manifest with all installability fields, 3 icon sizes, precache-only SW strategy with NavigationRoute SPA fallback. Build produces complete PWA package in `dist/`. |

No orphaned requirements — PLT-01 is the only Phase 4 requirement per REQUIREMENTS.md traceability table (line 80), and it is claimed and satisfied by plan 04-01.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

Scanned key files: `index.html`, `src/sw.ts`, `vite.config.ts`. No TODO/FIXME/placeholder comments. No stub patterns (empty arrays, return null, etc.). No hardcoded empty data. `src/sw.ts` uses `self.clients` (correct) rather than bare `clients` (fixed in task 2). The `/// <reference lib="webworker" />` directive is a proper TypeScript declaration, not a stub.

### Human Verification Required

#### 1. Chrome Install (Android)

**Test:** On an Android device with Chrome, navigate to the app (served via HTTPS). Open the browser menu and select "Add to Home Screen" (or wait for the install banner).
**Expected:** App icon appears on the home screen. Tapping the icon opens Soundly in full-screen standalone mode with no browser address bar or navigation chrome. App name displays as "Soundly".
**Why human:** PWA install requires a real device, HTTPS serving, and a user gesture. Chrome DevTools can inspect installability criteria but cannot execute the actual install flow.

#### 2. iOS Safari Install

**Test:** On an iPhone/iPad running iOS 16.4+ with Safari, navigate to the app. Tap the Share button, then "Add to Home Screen".
**Expected:** App appears on home screen with the correct icon. When launched: status bar shows default style (matches the light cream background #f4f1eb). Theme color (#5c6b56 sage green) appears in the splash screen. App name reads "Soundly" (from `apple-mobile-web-app-title`). App opens without browser chrome.
**Why human:** iOS PWA behavior, splash rendering, and status bar styling are device-specific and not testable programmatically.

#### 3. Full Offline Operation

**Test:** Load the app in browser. Enable airplane mode. Start a Quick Nap alarm. Let it run through all three phases (5 min soft → 5 min nudge → 10s wake).
**Expected:** No network errors. Singing bowl plays in Phase 1. Vibration/tick occurs in Phase 2. Volume ramps in Phase 3. Dismiss button works. All UI interactions respond normally throughout.
**Why human:** Offline isolation requires real network interruption — cannot be simulated with grep/file checks.

#### 4. Notification Click Routes to Countdown

**Test:** Start an alarm on a mobile browser. Background the app (press home button). When the system notification fires, tap it.
**Expected:** App comes to foreground. Countdown screen is visible showing the correct phase and remaining time. The alarm state (running, not reset) is preserved.
**Why human:** The `notificationclick` handler focuses the existing window — verifying the countdown screen is actually visible (vs. a reset/dashboard state) requires human observation during a live alarm session.

### Gaps Summary

No automated gaps found. All 3 roadmap success criteria and all 5 plan must-have truths are satisfied at the code level. The one artifact discrepancy (`vite.config.ts` does not contain "apple-touch-icon") is not a functional gap — the `apple-touch-icon` is correctly placed in `index.html` where Safari actually reads it, which is the right implementation. The plan artifact spec was aspirational about implementation location, not prescriptive.

The 4 human verification items are behavioral and device-specific checks that cannot be verified programmatically. They do not indicate missing code — all PWA infrastructure is present and wired correctly in the build output.

---

_Verified: 2026-04-18T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
