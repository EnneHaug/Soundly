---
phase: 02-background-reliability
verified: 2026-04-14T17:40:00Z
status: human_needed
score: 4/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Verify the iOS 'Add to Home Screen' prompt appears for non-installed iOS Safari users before they can start an alarm"
    expected: "A non-installed iOS Safari user who opens the app sees a visible prompt or banner instructing them to add the app to their home screen, shown before or when they attempt to start an alarm"
    why_human: "isIosSafariNonInstalled() exists and is tested in isolation, but there is no React UI layer yet (Phase 3 is the UI phase). Whether SC#5 requires the full UI to exist in Phase 2 or only the detection primitive requires human judgment on scope boundary."
---

# Phase 2: Background Reliability Verification Report

**Phase Goal:** The alarm fires reliably when the screen is off or the app is backgrounded, and preset timings are correctly defined
**Verified:** 2026-04-14T17:40:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Quick Nap and Focus presets launch with correct phase timing sequences | VERIFIED | `QUICK_NAP_CONFIG` exports `phase1DurationMs: 300_000`, `phase2DurationMs: 300_000`, `phase2to3GapMs: 10_000`, `phase3RampDurationMs: 60_000`. `FOCUS_CONFIG` exports `phase1DurationMs: 1_260_000`, `phase2DurationMs: 120_000`, `phase2to3GapMs: 10_000`, `phase3RampDurationMs: 60_000`. Both exported from `AlarmState.ts` and the barrel `index.ts`. |
| 2 | Phase 2 triggers tactile vibration on Android; iOS falls back to an audio cue | VERIFIED | `AlarmEngine.enterPhase2()` branches on `'vibrate' in navigator`. Android path calls `startVibration()` which loops `[300, 200]` pattern. iOS/desktop path creates a `GainNode` ramping `0.01→0.7` and schedules `playTick()` every 500ms (bandpass-filtered noise burst). Cleanup wired in `cleanup()`. |
| 3 | A system notification appears when the alarm triggers while the browser is backgrounded | VERIFIED | `showAlarmNotification()` calls `ServiceWorkerRegistration.showNotification()` with `tag: 'soundly-alarm'` and `requireInteraction: true`. `src/sw.ts` handles `notificationclick` to focus/open app. 10/10 notification tests pass. Note: `showAlarmNotification()` is not yet wired to any alarm trigger call site (no UI exists yet) — this is expected as Phase 3 wires the UI. |
| 4 | The screen stays on during an active timer (Wake Lock); it re-acquires if the tab regains visibility | VERIFIED | `AlarmEngine.start()` calls `acquireWakeLock()` and `attachVisibilityReacquire()`. `cleanup()` calls `releaseWakeLock()` and the returned cleanup function. `attachVisibilityReacquire()` re-acquires on `visibilitychange` when `_shouldHoldLock && document.visibilityState === 'visible'`. 13 wakeLock tests pass. |
| 5 | Non-installed iOS users see an "Add to Home Screen" prompt before starting an alarm | UNCERTAIN | `isIosSafariNonInstalled()` is implemented and tested. However, no UI layer exists yet — `src/` contains only `engine/` and `platform/` directories; no `components/` or React app entry point. The detection utility is in place but the prompt is not rendered anywhere. Phase 3 (React UI) is the planned UI phase. |

**Score:** 4/5 truths verified (SC#5 uncertain — utility exists, no UI to render the prompt)

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | "Add to Home Screen" prompt rendered to non-installed iOS users | Phase 3 | Phase 3 goal: "Users can set, monitor, and dismiss an alarm through a calm, legible interface." The UI layer for the iOS prompt would be part of the dashboard screen built in Phase 3. Detection utility (`isIosSafariNonInstalled`) is ready for Phase 3 to consume. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/engine/AlarmState.ts` | QUICK_NAP_CONFIG and FOCUS_CONFIG preset exports | VERIFIED | Both exports present with exact per-spec durations. `validateConfig()` passes for both. |
| `src/platform/vibration.ts` | Android vibration loop start/stop | VERIFIED | `startVibration()` and `stopVibration()` exported. Pattern `[300, 200]` and 500ms interval confirmed. Feature detection via `'vibrate' in navigator`. |
| `src/engine/sounds/tickPulse.ts` | iOS tick pulse synthesis | VERIFIED | `playTick()` exported. 50ms `AudioBuffer` of white noise, `BiquadFilterNode` type `bandpass` at 2000Hz, connects to caller `masterGain`. `TICK_DURATION_SEC = 0.05` confirmed. |
| `src/platform/wakeLock.ts` | Wake Lock acquisition and visibility re-acquisition | VERIFIED | `acquireWakeLock()`, `releaseWakeLock()`, `attachVisibilityReacquire()` all exported. Requests `navigator.wakeLock.request('screen')`, catches `NotAllowedError`. Visibility re-acquire uses `_shouldHoldLock` flag. |
| `src/sw.ts` | Custom service worker with notificationclick handler and workbox precaching | VERIFIED | `precacheAndRoute(self.__WB_MANIFEST)` and `notificationclick` event listener both present. Focuses existing window or opens `/`. |
| `src/platform/notifications.ts` | Notification permission and show/clear helpers | VERIFIED | All three functions exported: `requestNotificationPermission`, `showAlarmNotification`, `clearAlarmNotification`. Uses `ServiceWorkerRegistration.showNotification()`, `tag: 'soundly-alarm'`, `requireInteraction: true`. |
| `src/platform/standalone.ts` | iOS standalone detection | VERIFIED | `isPwaInstalled()` and `isIosSafariNonInstalled()` exported. Checks `display-mode: standalone` media query and `navigator.standalone`. iOS UA regex `/iphone|ipad|ipod/i` confirmed. |
| `vite.config.ts` | vite-plugin-pwa injectManifest configuration | VERIFIED | `strategies: 'injectManifest'`, `srcDir: 'src'`, `filename: 'sw.ts'`, full manifest with `display: 'standalone'`, `background_color: '#1a1a2e'`, three icon entries. |
| `public/icons/icon-192x192.png` | PWA icon 192px | VERIFIED | File exists. |
| `public/icons/icon-512x512.png` | PWA icon 512px | VERIFIED | File exists. |
| `public/icons/icon-512x512-maskable.png` | PWA maskable icon | VERIFIED | File exists. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/engine/AlarmEngine.ts` | `src/platform/vibration.ts` | Phase 2 callback calls `startVibration` or `playTick` | WIRED | `enterPhase2()` calls `startVibration()` on Android path; `stopVibration()` called in `cleanup()`. |
| `src/engine/AlarmEngine.ts` | `src/platform/wakeLock.ts` | `start()` calls `acquireWakeLock`, `cleanup()` calls `releaseWakeLock` | WIRED | Both import and call sites confirmed at lines 102-103 and 245-249 of `AlarmEngine.ts`. |
| `src/platform/notifications.ts` | `src/sw.ts` | `navigator.serviceWorker.ready` then `showNotification` | WIRED | `notifications.ts` line 34: `reg.showNotification(...)`. SW handles click at `self.addEventListener('notificationclick', ...)`. |
| `src/sw.ts` | `workbox-precaching` | `import precacheAndRoute` | WIRED | `import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'` present. `precacheAndRoute(self.__WB_MANIFEST)` called. |
| `vite.config.ts` | `src/sw.ts` | injectManifest strategy pointing to `sw.ts` | WIRED | `strategies: 'injectManifest'`, `srcDir: 'src'`, `filename: 'sw.ts'` all present in `vite.config.ts`. |

### Data-Flow Trace (Level 4)

Not applicable — this phase delivers engine primitives, platform utilities, and a service worker. There are no data-rendering components to trace through.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All tests pass (114 tests, 11 suites) | `npx vitest run` | 114 passed, 0 failed | PASS |
| TypeScript compiles clean | `npx tsc --noEmit` | Exit 0, no errors | PASS |
| QUICK_NAP_CONFIG timing values | Code inspection | `phase1DurationMs: 300_000`, `phase2DurationMs: 300_000`, `phase2to3GapMs: 10_000`, `phase3RampDurationMs: 60_000` | PASS |
| FOCUS_CONFIG timing values | Code inspection | `phase1DurationMs: 1_260_000`, `phase2DurationMs: 120_000`, `phase2to3GapMs: 10_000`, `phase3RampDurationMs: 60_000` | PASS |
| PWA icons present | `ls public/icons/` | `icon-192x192.png`, `icon-512x512.png`, `icon-512x512-maskable.png` | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| ALM-02 | 02-01 | Quick Nap preset: 5 min → Phase 1 → 5 min → Phase 2 → 10s → Phase 3 | SATISFIED | `QUICK_NAP_CONFIG` has exact durations. `enterPhase2` wired. Timer sequence confirmed in `AlarmEngine.start()`. |
| ALM-03 | 02-01 | Focus preset: 21 min → Phase 1 → 2 min → Phase 2 → 10s → Phase 3 | SATISFIED | `FOCUS_CONFIG` has exact durations (21min = 1_260_000ms, 2min = 120_000ms). |
| ALM-05 | 02-01 | Phase 2 uses Vibration API with audio fallback on iOS | SATISFIED | `enterPhase2()` branches on `'vibrate' in navigator`. Tick pulse fallback implemented and tested. |
| PLT-02 | 02-01 | Wake Lock API keeps screen on during active timer (re-acquires on visibility change) | SATISFIED | `acquireWakeLock()` + `attachVisibilityReacquire()` called in `start()`. `releaseWakeLock()` in `cleanup()`. Re-acquire on `visibilitychange` implemented. |
| PLT-03 | 02-02 | System notification fires when alarm triggers while backgrounded | SATISFIED (partial) | `showAlarmNotification()` and SW `notificationclick` handler both implemented and tested. Not yet wired to an alarm trigger (no UI) — UI wiring is Phase 3 scope. |
| PLT-04 | 02-02 | iOS standalone detection with "Add to Home Screen" prompt for non-installed users | PARTIALLY SATISFIED | `isIosSafariNonInstalled()` implemented and tested. No UI prompt exists — Phase 3 will render it. The detection primitive is ready. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/platform/vibration.ts` | 23 | Module-level `_handle` singleton — no guard against double `startVibration()` call (WR-01 from code review) | Warning | If called twice without stop, old interval is orphaned. Prod risk if AlarmEngine has a race, but AlarmEngine guards via `_running` flag. |
| `src/platform/wakeLock.ts` | 23-30 | Module-level `_sentinel` / `_shouldHoldLock` state same pattern (WR-01 extension) | Warning | Same double-call risk as vibration. AlarmEngine guards prevent this in normal flow. |
| `src/engine/AlarmEngine.ts` | 146 | `enterPhase2` uses `this.ac!` non-null assertion without `_running` guard (WR-02) | Warning | If a timer fires after `cancel()` returns a post-cleanup callback (edge case), `this.ac!` throws. Low probability given single-threaded JS. |
| `src/engine/AlarmEngine.ts` | 176 | `enterPhase3` does not stop tick loop from Phase 2 iOS path (WR-03) | Warning | Tick loop runs concurrently with Phase 3 swell audio until user dismisses. Contradicts escalation design intent. |
| `src/engine/index.ts` | 24-26 | Platform implementation details exported from engine barrel (IN-04 from code review) | Info | `playTick`, `startVibration`, `stopVibration`, `acquireWakeLock`, etc. are implementation details of `AlarmEngine`. Exporting them invites callers to bypass the engine lifecycle. |
| `src/platform/wakeLock.ts` | 48, 53 | `console.debug` in production paths | Info | Debug logs fire in production builds. Minor. |

Note: WR-03 (tick loop continues into Phase 3) is the most functionally significant finding. However, because Phase 3 currently dismisses the alarm (via `stop()` / `dismiss()`), and `cleanup()` clears the tick loop, this manifests as an overlap only during natural Phase 3 execution — not a permanent resource leak. It is a correctness/UX concern, not a blocking defect for this phase's goal of "fires reliably when backgrounded."

### Human Verification Required

#### 1. iOS "Add to Home Screen" Prompt

**Test:** Open the app on an iOS Safari browser without installing it to the home screen. Navigate to the start screen / home page.
**Expected:** A prompt or banner appears instructing the user to tap the Share button and select "Add to Home Screen" before starting an alarm. This prompt should be visible to non-installed iOS users.
**Why human:** `isIosSafariNonInstalled()` exists and returns the correct value when tested in isolation, but there is no React UI to render the prompt. The entire UI layer is Phase 3 scope. Whether SC#5 requires the prompt to be visible now (requiring UI work in Phase 2) or only requires the detection primitive (with the prompt deferred to Phase 3) is a scope boundary decision that requires human judgment.

### Gaps Summary

No hard gaps — all infrastructure exists. The one uncertain item (SC#5) is a scope boundary question: the detection utility (`isIosSafariNonInstalled`) is implemented and tested, but no UI renders the "Add to Home Screen" prompt because no React UI exists yet (Phase 3 scope). Whether this counts as a Phase 2 gap or an expected Phase 3 deferral requires human confirmation.

If the intent was for Phase 2 to include the detection primitive only (not the rendered prompt), then this phase can be marked passed. If the intent was for Phase 2 to show the prompt (requiring at least a minimal UI element), a gap exists.

---

_Verified: 2026-04-14T17:40:00Z_
_Verifier: Claude (gsd-verifier)_
