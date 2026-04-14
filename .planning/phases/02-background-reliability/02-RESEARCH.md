# Phase 2: Background Reliability - Research

**Researched:** 2026-04-14
**Domain:** Browser platform APIs — Wake Lock, Vibration, Notifications, Web Audio keepalive, PWA standalone detection
**Confidence:** HIGH (most claims verified via MDN official docs and live codebase inspection)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Vibration Pattern (Android)**
- D-01: Phase 2 uses a pulsing rhythm vibration pattern: 300ms vibrate, 200ms pause, repeating continuously until Phase 3 triggers or user dismisses.
- D-02: Pattern is gentle and persistent — matches the app's escalation philosophy of nudging before forcing.

**iOS Audio Fallback**
- D-03: On iOS (where `navigator.vibrate()` is not supported), Phase 2 plays a subtle ticking pulse instead of vibrating. Synthesized as a filtered noise burst (~50ms) through a bandpass filter, repeating on the same 300ms-on/200ms-pause rhythm.
- D-04: The ticking pulse gradually increases in volume over the Phase 2 duration — starts very soft, ramps up to improve wakeability before Phase 3 kicks in.
- D-05: The tick sound must be clearly distinct from both the singing bowl (Phase 1) and the rising sine swell (Phase 3).

**Presets**
- D-06: Quick Nap and Focus presets are defined exactly per requirements ALM-02 and ALM-03. These are just `AlarmConfig` objects with the specified durations — no ambiguity, implementation is mechanical.

### Claude's Discretion

- **Notification content and behavior:** What the system notification says when the alarm fires while backgrounded, whether tapping it dismisses the alarm or brings the app forward, and whether to show one notification or per-phase notifications. Recommendation: single notification on Phase 1 trigger with "Alarm ringing" message; tapping foregrounds the app (dismiss via in-app button only for safety).
- **iOS "Add to Home Screen" prompt:** When and how to show the prompt for non-installed iOS Safari users (PLT-04). Recommendation: non-blocking inline banner on the dashboard screen that appears once per session, dismissible, explaining that installing improves alarm reliability. Do not block alarm start.
- **Wake Lock loss handling:** What happens when Wake Lock is released (tab switch, low battery, OS override). Recommendation: silently re-acquire on `visibilitychange` when document becomes visible again. No user-facing warning — the keepalive oscillator and notification strategy cover the backgrounded case. Log Wake Lock state changes for debugging.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ALM-02 | Quick Nap preset: 5 min → Phase 1 → 5 min → Phase 2 → 10s → Phase 3 | Preset = `AlarmConfig` object with `phase1DurationMs: 300_000`, `phase2DurationMs: 300_000`, `phase2to3GapMs: 10_000`. `AlarmConfig` interface already exists in `AlarmState.ts`. |
| ALM-03 | Focus preset: 21 min → Phase 1 → 2 min → Phase 2 → 10s → Phase 3 | Preset = `AlarmConfig` object with `phase1DurationMs: 1_260_000`, `phase2DurationMs: 120_000`, `phase2to3GapMs: 10_000`. Same pattern as ALM-02. |
| ALM-05 | Phase 2 uses Vibration API with audio fallback on iOS | `'vibrate' in navigator` feature detect. Android: `navigator.vibrate([300, 200])` in loop. iOS: `AudioBufferSourceNode` + `BiquadFilterNode` (bandpass) tick pulse, volume ramping via `GainNode`. |
| PLT-02 | Wake Lock API keeps screen on during active timer; re-acquires on visibility change | `navigator.wakeLock.request('screen')` in `AlarmEngine.start()`. Listen `document.addEventListener('visibilitychange')` to re-acquire. `WakeLockSentinel.released` property and `release` event for state tracking. |
| PLT-03 | System notification fires when alarm triggers while backgrounded | `Notification.requestPermission()` from user gesture before start. On Phase 1 trigger: `navigator.serviceWorker.ready.then(r => r.showNotification(...))`. Service worker handles `notificationclick` with `clients.matchAll` + `focus()`/`openWindow()`. Requires `injectManifest` strategy in vite-plugin-pwa. |
| PLT-04 | iOS standalone detection with "Add to Home Screen" prompt for non-installed users | Detect iOS Safari non-installed: `navigator.standalone === false` (WebKit-only) combined with user-agent iOS check. Show dismissible inline banner. Do not block alarm start. |
</phase_requirements>

---

## Summary

Phase 2 adds four distinct capabilities on top of the existing engine: preset configs, a Phase 2 tactile/audio escalation layer, system notifications for backgrounded alarms, and screen keepalive with iOS install guidance.

The engine integration points are already stubbed. `AlarmEngine.start()` fires `setPhase('phase2')` via the scheduled timer, and `onPhaseChange()` callback is the entry point for all Phase 2 behavior. Vibration and tick logic hooks into this callback from outside the engine (from a React hook or utility module), keeping the engine pure. Wake Lock acquisition pairs with `AlarmEngine.start()` and cleanup. Notifications require a custom service worker (the project currently uses no SW at all — `vite-plugin-pwa` is installed in `package.json` but not yet configured in `vite.config.ts`).

The primary risk in this phase is the notification path: it requires adding `vite-plugin-pwa` to `vite.config.ts`, writing a custom SW with `notificationclick` handler, and requesting Notification permission from a user gesture before starting the alarm. If this permission is not granted, the app still works — notifications degrade gracefully.

**Primary recommendation:** Implement in this order — (1) presets, (2) vibration + tick, (3) Wake Lock, (4) notifications + SW, (5) iOS install prompt. Each is independently testable and independently releasable.

---

## Standard Stack

### Core (all already in package.json or browser-native)

| Library / API | Version | Purpose | Why Standard |
|---------------|---------|---------|--------------|
| Web Audio API (native) | — | Tick pulse synthesis (iOS fallback) | Already used in Phase 1. `AudioBufferSourceNode` + `BiquadFilterNode` is the canonical way to synthesize filtered noise bursts — no library needed. [VERIFIED: MDN docs] |
| Vibration API (native) | — | Android tactile escalation | Only browser API for device haptics. Feature-detect with `'vibrate' in navigator`. [VERIFIED: MDN Vibration API] |
| Screen Wake Lock API (native) | — | Prevent screen-off during active timer | Baseline 2025 (March 31, 2025). Supported in Chrome, Firefox, Safari 16.4+, iOS Safari 18.4+. [VERIFIED: web.dev blog, MDN] |
| Notifications API (native) | — | System notification when backgrounded | `ServiceWorkerRegistration.showNotification()` works without a push subscription — call from page context via `navigator.serviceWorker.ready`. [VERIFIED: MDN ServiceWorkerRegistration/showNotification] |
| vite-plugin-pwa | 0.21.1 (installed) | Service worker with custom `notificationclick` handler | Already in `package.json`. Requires `injectManifest` strategy and a custom `src/sw.ts` to handle notification clicks. [VERIFIED: codebase inspection + vite-pwa-org docs] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| workbox-precaching | bundled with vite-plugin-pwa | Precache manifest injection in custom SW | Required in custom SW: `import { precacheAndRoute } from 'workbox-precaching'` |

**No new npm installs required for this phase.** All dependencies are already installed or browser-native.

---

## Architecture Patterns

### Recommended New File Structure

```
src/
├── engine/
│   ├── AlarmEngine.ts          # Existing — add wakeLock property + acquisition
│   ├── AlarmState.ts           # Existing — add QUICK_NAP_CONFIG, FOCUS_CONFIG exports
│   ├── sounds/
│   │   ├── keepalive.ts        # Existing — untouched
│   │   └── tickPulse.ts        # NEW: iOS audio fallback tick synthesis
│   └── index.ts                # Existing — add new preset exports
├── platform/
│   ├── wakeLock.ts             # NEW: Wake Lock acquisition + visibilitychange listener
│   ├── vibration.ts            # NEW: Android vibration loop manager
│   ├── notifications.ts        # NEW: Permission request + showNotification wrapper
│   └── standalone.ts           # NEW: iOS standalone detection + prompt logic
├── sw.ts                       # NEW: Custom service worker (injectManifest)
└── ...
```

**Rationale for `src/platform/` module:** All Phase 2 behavior deals with browser platform APIs that are either unavailable or behave differently per platform. Grouping them in `platform/` separates pure engine concerns (state machine, audio synthesis) from platform integration concerns (haptics, OS APIs). This makes mocking in tests straightforward.

### Pattern 1: Preset AlarmConfig Objects

Presets are pure data — `AlarmConfig` objects exported from `AlarmState.ts` alongside `DEFAULT_CONFIG`.

```typescript
// src/engine/AlarmState.ts (additions)
// Source: ALM-02 and ALM-03 requirements

export const QUICK_NAP_CONFIG: AlarmConfig = {
  phase1DurationMs: 300_000,   // 5 min soft sound
  phase2DurationMs: 300_000,   // 5 min vibration
  phase2to3GapMs:   10_000,    // 10s gap
  phase3RampDurationMs: 60_000, // 1 min volume ramp
};

export const FOCUS_CONFIG: AlarmConfig = {
  phase1DurationMs: 1_260_000, // 21 min soft sound
  phase2DurationMs: 120_000,   // 2 min vibration
  phase2to3GapMs:   10_000,    // 10s gap
  phase3RampDurationMs: 60_000, // 1 min volume ramp
};
```

### Pattern 2: Wake Lock Acquisition + Re-acquisition

```typescript
// src/platform/wakeLock.ts
// Source: MDN Screen Wake Lock API

let _sentinel: WakeLockSentinel | null = null;
let _shouldHoldLock = false;

export async function acquireWakeLock(): Promise<void> {
  if (!('wakeLock' in navigator)) return; // degrade gracefully
  _shouldHoldLock = true;
  try {
    _sentinel = await navigator.wakeLock.request('screen');
    _sentinel.addEventListener('release', () => {
      // Lock was released by OS (tab hidden, battery low, etc.)
      // Re-acquisition is handled by the visibilitychange listener below
    });
  } catch (err) {
    // DOMException: NotAllowedError if document not visible at time of request
    // Safe to ignore — visibilitychange will re-acquire when document becomes visible
    console.debug('[WakeLock] acquisition failed:', err);
  }
}

export function releaseWakeLock(): void {
  _shouldHoldLock = false;
  _sentinel?.release();
  _sentinel = null;
}

// Must call once when engine starts; auto-removed when releaseWakeLock() is called
export function attachVisibilityReacquire(): () => void {
  const handler = async () => {
    if (_shouldHoldLock && document.visibilityState === 'visible') {
      await acquireWakeLock();
    }
  };
  document.addEventListener('visibilitychange', handler);
  return () => document.removeEventListener('visibilitychange', handler);
}
```

**Critical detail:** `navigator.wakeLock.request()` will throw `NotAllowedError` if the document is not visible at the time of call. Always wrap in try/catch. [VERIFIED: MDN WakeLock.request]

### Pattern 3: Vibration Loop (Android)

`navigator.vibrate([300, 200])` plays a single 300ms-on/200ms-pause cycle then stops. The loop requires `setInterval` to call it repeatedly.

```typescript
// src/platform/vibration.ts
// Source: MDN Vibration API, D-01 decision

const PATTERN: number[] = [300, 200]; // 300ms vibrate, 200ms pause
const CYCLE_MS = PATTERN.reduce((a, b) => a + b, 0); // 500ms total cycle

let _handle: ReturnType<typeof setInterval> | null = null;

export function startVibration(): void {
  if (!('vibrate' in navigator)) return; // iOS and desktop: no-op
  navigator.vibrate(PATTERN);           // first cycle immediately
  _handle = setInterval(() => navigator.vibrate(PATTERN), CYCLE_MS);
}

export function stopVibration(): void {
  if (_handle !== null) {
    clearInterval(_handle);
    _handle = null;
  }
  navigator.vibrate(0); // cancel any in-progress vibration
}
```

**Why setInterval and not a long pattern array:** A pre-computed long array (e.g., [300, 200, 300, 200, ...] repeated 600 times for 5 min) would be very large and Phase 3 cancellation would not truncate it gracefully. `setInterval` + `vibrate(0)` on stop is the clean approach. [VERIFIED: MDN docs pattern, reasoning from first principles]

### Pattern 4: iOS Tick Pulse Synthesis

Uses the same factory pattern as the rest of the audio engine (new `AudioBufferSourceNode` per tick — `AudioBufferSourceNode` cannot restart after `.start()`, same constraint as `OscillatorNode`).

```typescript
// src/engine/sounds/tickPulse.ts
// Source: MDN Advanced Techniques (noise burst pattern), D-03/D-04/D-05 decisions

const TICK_DURATION_SEC = 0.05; // 50ms — matches "~50ms" from D-03

export function playTick(
  ac: AudioContext,
  masterGain: GainNode, // caller manages volume envelope for D-04 ramp
  bandHz = 2000         // bandpass center frequency; higher = crisper tick
): void {
  const bufferSize = Math.ceil(ac.sampleRate * TICK_DURATION_SEC);
  const buf = new AudioBuffer({ length: bufferSize, sampleRate: ac.sampleRate });
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1; // white noise
  }

  const source = new AudioBufferSourceNode(ac, { buffer: buf });
  const filter = new BiquadFilterNode(ac, { type: 'bandpass', frequency: bandHz, Q: 2 });

  source.connect(filter).connect(masterGain);
  source.start();
  // source auto-stops when buffer is exhausted — no explicit .stop() needed
}
```

The `masterGain` for the tick pulse is a separate `GainNode` managed by the Phase 2 orchestrator, with its gain ramping from near-zero to ~0.7 over `phase2DurationMs` (implements D-04 gradual volume increase).

### Pattern 5: Notification from Page Context (No Push Subscription)

Notifications in this app are triggered by a wall-clock timer in the page context, not a push server. The pattern is:

```typescript
// src/platform/notifications.ts
// Source: MDN ServiceWorkerRegistration/showNotification

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  // Must be called from a user gesture — call before engine.start()
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export async function showAlarmNotification(): Promise<void> {
  if (Notification.permission !== 'granted') return;
  if (!navigator.serviceWorker) return;
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification('Soundly — Alarm ringing', {
    body: 'Tap to return to the app and dismiss.',
    icon: '/icons/icon-192x192.png',
    tag: 'soundly-alarm',           // replaces previous notification if called again
    renotify: false,                 // don't re-alert for replacement
    requireInteraction: true,        // keep notification until user dismisses
  });
}

export async function clearAlarmNotification(): Promise<void> {
  if (!navigator.serviceWorker) return;
  const reg = await navigator.serviceWorker.ready;
  const notifications = await reg.getNotifications({ tag: 'soundly-alarm' });
  notifications.forEach((n) => n.close());
}
```

### Pattern 6: Custom Service Worker (notificationclick handler)

The project needs `strategies: 'injectManifest'` in `vite.config.ts` and a `src/sw.ts` file. This is the minimal custom SW:

```typescript
// src/sw.ts
// Source: vite-pwa-org injectManifest docs, MDN ServiceWorkerGlobalScope notificationclick

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing app window if open
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            return (client as WindowClient).focus();
          }
        }
        // Otherwise open a new window
        return clients.openWindow('/');
      })
  );
});
```

**vite.config.ts additions required:**

```typescript
import { VitePWA } from 'vite-plugin-pwa';

// Add to plugins array:
VitePWA({
  strategies: 'injectManifest',
  srcDir: 'src',
  filename: 'sw.ts',
  manifest: {
    name: 'Soundly Gentle Alarm',
    short_name: 'Soundly',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#1a1a2e',
    theme_color: '#1a1a2e',
    start_url: '/',
    icons: [
      { src: 'icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: 'icons/icon-512x512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  devOptions: { enabled: true, type: 'module' },
})
```

**Note:** `workbox-precaching` must be added as a dev dependency since `src/sw.ts` imports from it directly.

### Pattern 7: iOS Standalone Detection

```typescript
// src/platform/standalone.ts
// Source: MDN, web.dev/learn/pwa/detection

/** True if running as an installed PWA on any platform */
export function isPwaInstalled(): boolean {
  // Standard display-mode media query (Chrome, Firefox, Safari 15.4+)
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  // iOS WebKit-proprietary property (all iOS versions)
  if ((navigator as Navigator & { standalone?: boolean }).standalone === true) return true;
  return false;
}

/** True if on iOS Safari and NOT installed to home screen */
export function isIosSafariNonInstalled(): boolean {
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (!isIos) return false;
  return !isPwaInstalled();
}
```

### Anti-Patterns to Avoid

- **One long vibration pattern array for the full Phase 2 duration:** The array would be enormous and cannot be cancelled cleanly mid-pattern. Use `setInterval` + `vibrate(0)` on stop instead.
- **Calling `navigator.wakeLock.request()` outside of a user gesture OR when document is hidden:** Both throw `NotAllowedError`. The correct time to acquire is immediately after the user taps "Start" (document is visible, user gesture just happened).
- **Requesting Notification permission on page load:** Browsers block permission dialogs on page load without a user gesture. Request permission from the "Start alarm" button handler.
- **Using `new Notification()` directly (not via ServiceWorkerRegistration):** `new Notification()` does not work reliably on mobile and is blocked in many mobile browsers. Always use `registration.showNotification()`. [VERIFIED: MDN guidance]
- **Assuming `navigator.serviceWorker.ready` resolves immediately:** It resolves only when a service worker is `active`. On first load (before SW is installed), it may take several seconds. The app must handle the case where SW is not yet active when Phase 1 fires.
- **Assuming Wake Lock persists through tab switches:** It does not. The OS releases it when the document becomes hidden. This is by design; the `visibilitychange` re-acquisition handles foreground resumption. The backgrounded case relies on the silent keepalive oscillator and notification.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Service worker precaching | Custom cache logic | `workbox-precaching` (bundled in vite-plugin-pwa) | Cache invalidation, versioning, and update flow are deeply subtle. Workbox handles all of it. |
| Push subscription for local alarms | Server-side push infra | `navigator.serviceWorker.ready` + `showNotification()` from page context | Push API requires a server, VAPID keys, and subscription management. For locally-triggered timers, the page can call `showNotification()` directly — no server needed. |
| Icon generation | Manual PNG export at multiple sizes | `@vite-pwa/assets-generator` CLI (run once from SVG) | PWA install requires specific sizes (192px, 512px, maskable). Manual export is error-prone; the generator ensures correct spec compliance. |

---

## Common Pitfalls

### Pitfall 1: Service Worker Not Active When Alarm Fires

**What goes wrong:** `navigator.serviceWorker.ready` resolves, but the app fires a notification on Phase 1 (which could be 5–21 minutes into the session). By that time, the SW is definitely active. However, on the very first ever load (before the SW has installed), a user could theoretically start the alarm before the SW activates. The `showNotification()` call will succeed anyway because `navigator.serviceWorker.ready` waits for activation — but it could delay by a few seconds.

**Why it happens:** `navigator.serviceWorker.ready` is a promise that resolves to the active service worker, waiting until registration and activation is complete.

**How to avoid:** Await `navigator.serviceWorker.ready` at app startup (not at alarm-fire time) to pre-warm the promise. Or simply accept the brief delay — for an alarm app with a 5+ minute countdown, this is not a problem in practice.

**Warning signs:** Notification never appears on first load. Check DevTools → Application → Service Workers to see if SW is active.

### Pitfall 2: Notification Permission Denied Silently

**What goes wrong:** On iOS Safari, if Notification permission was previously denied, `Notification.requestPermission()` immediately returns `'denied'` without showing a prompt. There is no way to re-prompt the user programmatically — they must go to Settings > Safari > Notifications.

**Why it happens:** Browsers remember permission decisions per origin.

**How to avoid:** After `requestPermission()` returns `'denied'`, show an inline explanation ("Notifications are blocked. To enable, go to Settings > Safari > Soundly"). Do not repeat the request.

### Pitfall 3: Wake Lock NotAllowedError on Hidden Document

**What goes wrong:** If the `acquireWakeLock()` call is deferred (e.g., inside an async chain after the user gesture), the document may no longer be the active visible document by the time `navigator.wakeLock.request()` is called, causing `NotAllowedError`.

**Why it happens:** Wake Lock requires a visible document. Async chains can yield between the gesture and the API call.

**How to avoid:** Call `navigator.wakeLock.request('screen')` synchronously from the user gesture handler, or as the very first `await` in the async handler before any other awaits that could yield the event loop.

### Pitfall 4: AudioContext Suspended on iOS Screen Lock

**What goes wrong:** On iOS Safari, when the screen locks, the AudioContext is suspended by the OS regardless of the silent keepalive oscillator. The tick pulse will stop playing during iOS Phase 2.

**Why it happens:** Multiple open WebKit bugs (bug 237878, bug 261554) confirm this is a structural iOS limitation, not a bug in the app. The OS suspends audio contexts for backgrounded non-media-session pages.

**How to avoid:** The tick pulse is a best-effort iOS enhancement, not a reliability guarantee. The notification (PLT-03) covers the backgrounded case. Document this in code comments so future developers don't try to "fix" it.

**Warning signs:** Tick stops when user locks iPhone screen. Expected behavior — not a bug.

### Pitfall 5: `workbox-precaching` Not Installed for Custom SW

**What goes wrong:** `src/sw.ts` imports from `workbox-precaching`, but this package is not automatically available unless installed. The build will fail with a module resolution error.

**Why it happens:** vite-plugin-pwa bundles Workbox for `generateSW` mode but not for `injectManifest` mode where you write your own SW.

**How to avoid:** Add `workbox-precaching` as a dev dependency: `npm install -D workbox-precaching`.

### Pitfall 6: iOS "Add to Home Screen" Prompt Blocking UX

**What goes wrong:** Showing a modal blocking the user from starting the alarm to encourage home screen installation would create friction and be ignored or dismissed. Worse, it could prevent the alarm from being set if dismissed incorrectly.

**Why it happens:** Common pattern to show install prompts on app open.

**How to avoid:** Per D in CONTEXT.md discretion: show as a non-blocking dismissible inline banner on the dashboard, once per session. Never block the "Start" action.

---

## Code Examples

### Verified Wake Lock Re-acquisition Pattern

```typescript
// Source: MDN Screen Wake Lock API (verified 2026-04-14)
document.addEventListener('visibilitychange', async () => {
  if (wakeLock !== null && document.visibilityState === 'visible') {
    wakeLock = await navigator.wakeLock.request('screen');
  }
});
```

### Verified Noise Burst for Tick Sound

```typescript
// Source: MDN Advanced Techniques — noise burst (verified 2026-04-14)
const bufferSize = audioCtx.sampleRate * 0.05; // 50ms
const noiseBuffer = new AudioBuffer({ length: bufferSize, sampleRate: audioCtx.sampleRate });
const data = noiseBuffer.getChannelData(0);
for (let i = 0; i < bufferSize; i++) {
  data[i] = Math.random() * 2 - 1; // bipolar white noise
}
const source = new AudioBufferSourceNode(audioCtx, { buffer: noiseBuffer });
const bandpass = new BiquadFilterNode(audioCtx, { type: 'bandpass', frequency: 2000, Q: 2 });
source.connect(bandpass).connect(destination);
source.start();
// AudioBufferSourceNode auto-stops when buffer exhausted — factory pattern, no restart
```

### Verified notificationclick Handler

```typescript
// Source: MDN ServiceWorkerGlobalScope/notificationclick (verified 2026-04-14)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return (client as WindowClient).focus();
        }
      }
      return clients.openWindow('/');
    })
  );
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `generateSW` mode for all vite-plugin-pwa setups | `injectManifest` mode when custom SW logic needed (e.g., `notificationclick`) | Always true — `injectManifest` has always existed | Phase 2 needs custom notificationclick handler, so `injectManifest` is required. Cannot add SW event listeners in `generateSW` mode. |
| Wake Lock not available on iOS | Wake Lock now Baseline 2025 (iOS Safari 18.4+, March 2025) | March 31, 2025 | Can now rely on Wake Lock on modern iOS in installed PWAs. Still needs graceful degradation for older iOS. |
| `new Notification()` for notifications | `ServiceWorkerRegistration.showNotification()` | Longstanding guidance | Mobile browsers suppress `new Notification()`. The SW-based approach is the only reliable mobile path. |

**Deprecated/outdated:**
- Using `new Notification()` directly: blocked on most mobile browsers, unreliable on desktop too for PWAs.
- PostCSS-based Tailwind integration: project correctly uses `@tailwindcss/vite` (already set up in `vite.config.ts`).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `workbox-precaching` must be installed separately for `injectManifest` mode | Don't Hand-Roll, Pattern 6, Pitfall 5 | If bundled by vite-plugin-pwa in 0.21.x, Wave 0 install step is unnecessary. Low risk — installing a redundant dep causes no harm. |
| A2 | iOS AudioContext suspended on screen lock is a persisting limitation in iOS 18 | Pitfall 4 | If Apple fixed AudioContext suspension in iOS 18.4 (same release that fixed Wake Lock), tick pulse may work longer than expected. Check bug 237878 status. |
| A3 | Single notification on Phase 1 trigger (not per-phase) is sufficient | Pattern 5 | If the user misses the notification and wants per-phase alerts, this design doesn't support it. Acceptable v1 tradeoff per CONTEXT.md discretion. |

---

## Open Questions

1. **Service Worker registration timing**
   - What we know: `navigator.serviceWorker.ready` resolves when SW is active. On first ever load this could take a few seconds.
   - What's unclear: Does this create a race condition if the user immediately starts an alarm on the very first visit, and Phase 1 fires before the SW activates?
   - Recommendation: Pre-warm `navigator.serviceWorker.ready` on app mount (store the promise, don't await it). When Phase 1 fires, await the stored promise — in practice it will already be resolved.

2. **Icons not yet generated**
   - What we know: `vite-plugin-pwa` manifest config references `icons/icon-192x192.png` etc., but no icons exist in the project yet.
   - What's unclear: Whether icon generation should be part of Phase 2 or Phase 4 (PWA installability phase).
   - Recommendation: Create placeholder icons in Phase 2 as part of the vite-plugin-pwa setup (required for SW registration to work in production). Full brand assets belong in Phase 4.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| vite-plugin-pwa | PLT-03 (SW for notifications) | Yes (package.json) | 0.21.1 | — |
| workbox-precaching | `src/sw.ts` import | Not confirmed — not in package.json | — | Add as dev dep: `npm install -D workbox-precaching` |
| Node / npm | Build tooling | Yes (project already running) | — | — |
| HTTPS in dev | Wake Lock, Notifications (require secure context) | Via `vite --https` or localhost exception | — | Chrome/Firefox allow both APIs on `localhost` without HTTPS [ASSUMED] |

**Missing dependencies with no fallback:**
- `workbox-precaching` — needed for `src/sw.ts`. Add: `npm install -D workbox-precaching`.

**Missing dependencies with fallback:**
- None beyond the above.

**Note on icon assets:** `vite-plugin-pwa` will warn at build time if manifest icons do not exist. Placeholder icons must be created before running `vite build`. The `@vite-pwa/assets-generator` can generate them from an SVG, but no SVG source exists yet — placeholder PNGs are an acceptable shortcut for Phase 2.

---

## Security Domain

> `security_enforcement` is not set to false in config.json — including this section.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Not applicable — no auth in this app |
| V3 Session Management | No | Not applicable — no sessions |
| V4 Access Control | No | Not applicable — single-user local app |
| V5 Input Validation | Minimal | Preset `AlarmConfig` objects are hardcoded — no user input to validate in this phase |
| V6 Cryptography | No | No crypto operations |

### Known Threat Patterns for this Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Notification permission abuse | Spoofing | Request permission once from explicit user gesture; never auto-request or re-request after denial |
| Service worker scope ovreach | Elevation of Privilege | SW scope defaults to `/` — acceptable for a single-page app. Do not expand scope unnecessarily. |
| AudioContext resource leak | Denial of Service (self-inflicted) | `AudioBufferSourceNode` auto-stops when buffer exhausts. Existing `cleanup()` in `AlarmEngine` handles GainNode/OscillatorNode lifecycle. Tick pulse `masterGain` must be added to cleanup list. |

---

## Sources

### Primary (HIGH confidence)
- [MDN Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API) — visibilitychange re-acquisition pattern, WakeLockSentinel release event, browser support
- [MDN Vibration API](https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API) — navigator.vibrate syntax, pattern arrays, stopping with vibrate(0), limited availability
- [MDN ServiceWorkerRegistration.showNotification()](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification) — full options object, page-context usage pattern
- [MDN Web Audio API Advanced Techniques](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Advanced_techniques) — AudioBuffer noise burst pattern, BiquadFilterNode bandpass connection
- [web.dev — Screen Wake Lock now supported in all browsers](https://web.dev/blog/screen-wake-lock-supported-in-all-browsers) — iOS Safari 18.4 support confirmation
- [vite-pwa-org injectManifest guide](https://vite-pwa-org.netlify.app/guide/inject-manifest) — srcDir/filename config, SW file location
- Codebase inspection: `src/engine/AlarmEngine.ts`, `src/engine/AlarmState.ts`, `src/engine/sounds/keepalive.ts`, `src/engine/AudioContext.ts`, `package.json`, `vite.config.ts`

### Secondary (MEDIUM confidence)
- [web.dev — learn/pwa/detection](https://web.dev/learn/pwa/detection) — display-mode media query + navigator.standalone combined detection pattern
- [cyberangles.org PWA detection guide](https://www.cyberangles.org/blog/can-i-detect-if-my-pwa-is-launched-as-an-app-or-visited-as-a-website/) — `isPwaLaunchedAsApp()` combined detection code
- WebKit Bugzilla bug 237878, 261554 — AudioContext suspension on iOS screen lock (open bugs, confirms ongoing limitation)

### Tertiary (LOW confidence)
- `localhost` HTTPS exception for Wake Lock / Notifications — commonly documented community knowledge, not found in single authoritative MDN source. [ASSUMED]

---

## Metadata

**Confidence breakdown:**
- Preset configs (ALM-02, ALM-03): HIGH — simple math from requirements text
- Vibration API (ALM-05): HIGH — MDN verified, pattern is well-documented
- Wake Lock (PLT-02): HIGH — MDN verified, Baseline 2025 confirmed
- Notifications + SW (PLT-03): HIGH — MDN verified; one ASSUMED claim about SW activation timing
- iOS standalone detection (PLT-04): HIGH — standard pattern, MDN + web.dev verified
- Tick pulse synthesis (ALM-05 iOS fallback): HIGH — same AudioBuffer/BiquadFilter pattern as MDN Advanced Techniques
- `workbox-precaching` install requirement: MEDIUM — not confirmed in vite-plugin-pwa 0.21.x release notes

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (stable APIs — 30 day window is appropriate)
