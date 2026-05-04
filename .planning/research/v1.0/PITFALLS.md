# Domain Pitfalls: PWA Alarm App (Soundly)

**Domain:** Progressive Web App — alarm/timer with multi-phase audio escalation
**Researched:** 2026-04-14
**Confidence:** HIGH for browser API behavior (MDN-verified); MEDIUM for iOS-specific notes (knowledge cutoff Aug 2025, webkit.org access blocked during research)

---

## Critical Pitfalls

Mistakes that cause the alarm to silently fail or require architectural rewrites.

---

### Pitfall 1: AudioContext Created Outside a User Gesture

**What goes wrong:** An `AudioContext` created at module load time or in a `useEffect` on mount starts in `suspended` state on all modern browsers. When the alarm fires — potentially minutes later with no intervening interaction — calling `.play()` or scheduling oscillator nodes does nothing audible. The alarm plays zero sound and the user sleeps through it.

**Why it happens:** The Autoplay Policy (enforced by Chrome since 2018, Safari since iOS 13, Firefox since ~2018) blocks audio that was not initiated by a direct user gesture (click, tap, keypress). A `suspended` AudioContext is the browser's signal that it was constructed without the user's blessing.

**Consequences:** Phase 1 audio (the critical soft-start that should wake gently) silently fails. Escalation never happens. The user oversleeps.

**Prevention:**
- Create the `AudioContext` inside the "Start Alarm" button click handler, OR
- Create it eagerly but call `audioCtx.resume()` inside that same click handler before scheduling anything
- Use the "Test Sound" button (already in spec) as the natural gesture gate — initialising and verifying the context there covers the real alarm path too
- Check `audioCtx.state` before every scheduled playback and call `.resume()` if `suspended`
- Never assume `audioCtx.state === 'running'` — always guard

**Detection (warning signs):**
- Audio works on first use after a fresh page load but fails after navigating away and back
- No errors in the console but waveform nodes produce no output
- Works on Chrome desktop, silent on iOS Safari

**Phase to address:** Phase 1 (core audio engine). The pattern must be established before any alarm logic is built on top of it.

---

### Pitfall 2: iOS Safari Kills Background Audio Without a Silent Keepalive

**What goes wrong:** When the user locks their iPhone or switches apps, iOS suspends all audio output from the web view after a short grace period. A synthesized alarm that was playing or scheduled to play is silently killed. There is no error. The timer in the JavaScript thread may still be running, but no sound reaches the speaker.

**Why it happens:** iOS applies the same background audio rules to mobile Safari and installed PWAs as it does to any suspended browser tab. Audio is considered "inactive" once the screen locks, and WebKit suspends the audio hardware for the process. Unlike a native app that holds an AVAudioSession, a web app has no persistent claim on the audio hardware.

**Consequences:** The entire alarm fails for the most critical use case — the user who sets an alarm and puts their phone down.

**Prevention (defense in depth — all three layers needed):**
1. **Silent audio loop:** Play a near-zero-volume (0.001 gain), looping `OscillatorNode` or a 1-second silent `AudioBuffer` in a loop immediately after the user starts the timer. This keeps the AudioContext "active" in the eyes of iOS and prevents hardware suspension. The loop must be audibly silent but not zero gain (some browsers clamp zero-gain nodes).
2. **Wake Lock API:** Acquire `navigator.wakeLock.request('screen')` when the alarm starts. This keeps the screen on and — as a side effect — keeps the page fully active on most Android browsers. Re-acquire on `visibilitychange` (the lock is automatically released when the page is hidden).
3. **Service worker notification:** When the timer fires (tracked via `Date.now()` comparison, not `setInterval` alone), dispatch a push notification via the service worker. The notification sound/vibration is OS-level and bypasses audio suspension.

**Detection (warning signs):**
- Alarm works when the screen stays on but fails after the screen locks
- Audio plays correctly on Android with screen off but not on iPhone

**Phase to address:** Phase 2 (background reliability). The silent loop should be scaffolded from Phase 1 as part of the audio engine.

---

### Pitfall 3: Wake Lock is Released Automatically and Never Re-acquired

**What goes wrong:** `navigator.wakeLock.request('screen')` returns a lock handle. That lock is silently released by the browser whenever the page becomes hidden — tab switch, screen lock, incoming call, notification tray pull-down. If the app does not listen for the release event and re-request the lock on `visibilitychange`, the screen will dim and sleep after the system idle timeout.

**Why it happens:** The Wake Lock spec intentionally releases locks on visibility change. This is correct behaviour to prevent battery drain, but alarms require continuous re-acquisition.

**Consequences:** The screen dims and locks, killing the active audio path on iOS (see Pitfall 2). The silent loop keepalive may not be sufficient without the Wake Lock in place.

**Prevention:**
```
wakeLockSentinel.addEventListener('release', () => {
  // Re-request when page becomes visible again
});

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && alarmIsActive) {
    wakeLockSentinel = await navigator.wakeLock.request('screen');
  }
});
```
- Always store the sentinel reference and add both a `release` listener and a `visibilitychange` handler
- Wrap in try/catch — low battery causes rejection

**Detection (warning signs):**
- Screen stays on for first minute of alarm then dims on subsequent tests
- Console logs show Wake Lock release but no re-acquisition

**iOS Safari note:** Wake Lock is listed as "Baseline 2025" (newly available as of March 2025). iOS Safari added Wake Lock in Safari 18.4 (shipping with iOS 18.4). Verify actual device support before relying on it as the primary keep-alive strategy. Confidence: MEDIUM — verify against current caniuse.com.

**Phase to address:** Phase 2 (background reliability).

---

### Pitfall 4: Timer Drift Makes the Alarm Fire at the Wrong Time

**What goes wrong:** A `setInterval(tick, 1000)` countdown loses real time because:
- Background throttling: Chrome throttles inactive-tab timers to once per minute after 5+ minutes hidden and 30 seconds of silence (Chrome 88+ "intensive throttling")
- Firefox Android: 15-minute minimum interval for background tabs
- Browser event loop delays compound: each 1ms of slippage per second becomes 1 minute of drift per hour
- Device sleep: when the CPU sleeps (screen locked), JavaScript execution pauses entirely

**Consequences:** The alarm fires 5–15 minutes late. A nap alarm becomes useless. The volume ramp phase (which depends on elapsed time precision) escalates at the wrong rate.

**Prevention:**
- Use `Date.now()` as the ground truth, never the interval counter
- Store the alarm target as an absolute timestamp: `const targetTime = Date.now() + durationMs`
- On each tick, compute `remaining = targetTime - Date.now()` — this self-corrects after any throttling gap
- Use `setInterval` only as a wake-up signal, not as a clock
- On `visibilitychange` when the page becomes visible again, immediately check elapsed time and jump the alarm state to wherever it should be

**Detection (warning signs):**
- 5-minute nap fires at 5:45 after leaving the phone face-down
- Volume ramp feels wrong — too slow or already at full when noticed

**Phase to address:** Phase 1 (core timer logic). This is foundational — build it correctly from the start.

---

### Pitfall 5: Notification Permission UX Destroys First Impressions

**What goes wrong:** Requesting notification permission on page load (before the user has done anything) produces an immediate browser-level deny rate of 60–80% across platforms. On iOS, once denied, the user must go to Settings > [App] > Notifications to re-enable — a flow almost no user completes.

**Why it happens:** The browser permission prompt is not styled or contextual — it looks system-level and users reflexively dismiss it. Showing it before the user understands the app's purpose is the worst possible moment.

**Consequences:** The notification-triggered alarm path is permanently broken for a majority of users. The service worker cannot show notifications. The background reliability strategy collapses.

**Prevention:**
- Never request notification permission on mount or page load
- Request permission inside the "Start Alarm" button handler, immediately preceded by a custom in-app explanation: "We'll send a notification to wake you if your screen turns off"
- If permission is denied, degrade gracefully — fall back to silent loop + Wake Lock, inform the user that background reliability is reduced
- On iOS: only request in an installed PWA context (home-screen app) — iOS does not support web push in the browser tab

**Detection (warning signs):**
- Permission state is `denied` in the Notification API before the user has interacted with the permission prompt in your UI
- Analytics show 0% notification opt-in

**iOS-specific note (MEDIUM confidence):** iOS 16.4+ added push notification support for installed PWAs (home screen apps only). In-browser Safari tabs still cannot receive push notifications. The permission prompt on iOS only appears after the app is added to the home screen. This is a major UX concern: users who open the app in Safari without installing it get no notification support at all.

**Phase to address:** Phase 2 (background reliability) — the permission request flow should be designed alongside the notification infrastructure.

---

### Pitfall 6: Service Worker Cannot Play Audio Directly

**What goes wrong:** Developers attempt to play alarm audio from inside a service worker `push` or `notificationclick` event handler, expecting the SW to control audio like a background process. This fails silently — service workers have no DOM access, no AudioContext, and no ability to produce audio output.

**Why it happens:** Service workers run in a separate, headless worker thread. They can post messages and show notifications, but all audio must come from the main browser context (the page's JavaScript thread).

**Consequences:** The "notification triggers audio" pattern is implemented incorrectly. When the service worker receives the push event, nothing plays.

**Prevention:**
- Use `clients.matchAll()` inside the service worker to find the active page client
- Use `client.postMessage({ type: 'ALARM_TRIGGER' })` to message the page
- The page's `navigator.serviceWorker.addEventListener('message', ...)` handler resumes the AudioContext and starts playback
- If no client is visible (app fully closed), rely on the notification sound and system vibration — do not try to play web audio

**Detection (warning signs):**
- `audio.play()` or `new AudioContext()` calls inside SW event handlers
- No audio plays when notification arrives but no runtime error is logged

**Phase to address:** Phase 2 (service worker + notification integration).

---

### Pitfall 7: Vibration API is Absent on iOS — Always

**What goes wrong:** The Vibration API (`navigator.vibrate()`) is not supported on iOS Safari and has never been supported. Calling it throws no error (the spec says to fail silently), but Phase 2 of the alarm — the tactile alert — does nothing on iPhones.

**Why it happens:** Apple does not expose vibration hardware to the web on iOS. There is no workaround. It is a deliberate platform restriction.

**Consequences:** Phase 2 of the alarm is completely silent on iOS. The multi-phase escalation model breaks for the primary target device (iPhone). If the soft audio (Phase 1) fails due to background suspension, Phase 2 provides no backup signal on iOS.

**Prevention:**
- Always use feature detection: `if ('vibrate' in navigator) { navigator.vibrate(pattern); }`
- Design Phase 2 as audio-plus-vibration, not vibration-only: increase audio volume or add a second, more prominent tone alongside vibration
- Communicate clearly in the UI that vibration is unavailable on iOS (a one-time dismissable notice, not repeated warnings)
- Test Phase 2 on both Android (vibration + audio) and iOS (audio only) from the start

**Detection (warning signs):**
- `navigator.vibrate` is `undefined` on the device under test
- Phase 2 appears to work on Android but has no perceptible difference from Phase 1 on iPhone

**Phase to address:** Phase 1 (architecture decision: Phase 2 must be audio-led, not vibration-led).

---

## Moderate Pitfalls

### Pitfall 8: vite-plugin-pwa Caches a Stale Service Worker

**What goes wrong:** After deploying an update, users with the PWA installed continue running the old service worker (and therefore old JavaScript) because the new SW is waiting in `waiting` state. The update never activates unless the user closes all tabs and reopens. In development, this causes confusion when code changes are invisible.

**Prevention:**
- Configure `vite-plugin-pwa` with `registerType: 'autoUpdate'` or provide a user-visible "Update available — tap to refresh" banner
- In the Vite dev server, add `devOptions: { enabled: true }` only for testing SW-specific behaviour — leave it off during normal development to avoid stale cache confusion
- Use `workbox-window`'s `waiting` event to show the update prompt
- Call `skipWaiting()` in the new SW after showing the banner and getting user confirmation

**Phase to address:** Phase 3 (PWA shell and offline support).

---

### Pitfall 9: AudioContext is Created Multiple Times

**What goes wrong:** React's component lifecycle — especially in `StrictMode` (double-invocation in development) — can cause `useEffect` hooks or event handlers to run more than once. Each call to `new AudioContext()` creates a new context. Most browsers cap the number of simultaneous AudioContext instances (Chrome caps at ~6). When the cap is hit, the constructor throws or returns a broken context.

**Prevention:**
- Create the `AudioContext` as a singleton — store it in a `useRef` or a module-level variable, never in component state
- Before creating, check if one already exists: `if (!audioCtxRef.current) { audioCtxRef.current = new AudioContext(); }`
- In `StrictMode`, use the cleanup function of `useEffect` to close the context if it was created: return `() => audioCtx.close()`
- Prefer a dedicated audio manager module outside React's rendering lifecycle

**Phase to address:** Phase 1 (audio engine design).

---

### Pitfall 10: Oscillator Nodes Cannot Be Restarted

**What goes wrong:** `OscillatorNode.stop()` permanently destroys the node — it cannot be restarted with `.start()`. Attempting to call `.start()` again throws `InvalidStateError`. This breaks the "Test Sound" button if the user taps it more than once, and breaks multi-phase escalation if the audio architecture reuses nodes.

**Prevention:**
- Create a new `OscillatorNode` from the existing `AudioContext` each time a sound is needed — they are cheap to instantiate
- Never cache oscillator nodes as long-lived objects; cache only the `AudioContext` and `GainNode` graph
- Wrap sound creation in a factory function: `createBowlTone(ctx, frequency, gainValue) => OscillatorNode`

**Phase to address:** Phase 1 (audio engine design).

---

### Pitfall 11: Volume Ramp Implemented with setInterval Instead of AudioParam Scheduling

**What goes wrong:** Phase 3 (volume ramp from 0 to 100% over 1 minute) is implemented with a `setInterval` that calls `gainNode.gain.value = currentVolume` every second. Due to background throttling (Pitfall 4), the ramp stalls, jumps, or completes in one large step when the tab is foregrounded.

**Prevention:**
- Use the Web Audio API's built-in scheduling: `gainNode.gain.linearRampToValueAtTime(1.0, audioCtx.currentTime + rampDurationSeconds)`
- This runs on the audio thread, is not subject to JavaScript timer throttling, and is sample-accurate
- The ramp continues correctly even when the tab is backgrounded, as long as the AudioContext is still active

**Phase to address:** Phase 1 (audio engine design).

---

### Pitfall 12: Page Visibility Change Pauses AudioContext on Some Browsers

**What goes wrong:** Some browsers (particularly Chrome on Android) automatically call `audioCtx.suspend()` when the page becomes hidden and `audioCtx.resume()` when visible again. If the alarm fires while the page is hidden, audio resumes only when the user opens the app — which defeats the purpose.

**Why it happens:** Chrome's media policy considers an audio context without an active media session to be low-priority and suspends it aggressively on mobile to save battery.

**Prevention:**
- Register a `MediaSession` with `navigator.mediaSession.metadata = new MediaMetadata(...)` and set `navigator.mediaSession.playbackState = 'playing'` when the alarm starts. This signals to the OS that audio is intentional and should not be suspended.
- The MediaSession also puts a notification-style media control on the lock screen on Android, giving the user a visible "alarm is running" indicator.
- Listen for `audioCtx.onstatechange` and call `.resume()` if the state drops to `suspended` during an active alarm.

**Phase to address:** Phase 2 (background reliability).

---

## Minor Pitfalls

### Pitfall 13: Notification Permission is Not Checked on Reopen

**What goes wrong:** The user grants notification permission, closes the app, and the OS revokes it (rare but happens, especially on iOS after restoring the device). On reopen, the app assumes permission is still granted and skips the request flow. Notifications are never sent.

**Prevention:**
- Always check `Notification.permission` at alarm start time, not at app mount time
- If `Notification.permission === 'denied'`, show a degraded-mode banner

**Phase to address:** Phase 2 (notification infrastructure).

---

### Pitfall 14: PWA "Add to Home Screen" is Required for iOS Notifications but Not Communicated

**What goes wrong:** Users open the app in Safari and wonder why the notification permission prompt never appears. It is because iOS only allows PWA push notifications for apps installed to the home screen. In-browser Safari cannot receive push.

**Prevention:**
- Detect if the app is running as a standalone PWA: `window.matchMedia('(display-mode: standalone)').matches`
- If not standalone and on iOS (detect via `navigator.userAgent`), show a prominent install prompt: "Add Soundly to your Home Screen to enable background alarms"
- This should appear before the user sets their first alarm, not after it fires silently

**Phase to address:** Phase 2 (background reliability / onboarding).

---

### Pitfall 15: Tailwind Dark/Light Mode Flash Before Hydration

**What goes wrong:** When using Tailwind's `dark:` classes with `prefers-color-scheme`, there is a brief flash of the wrong theme on initial render if the CSS is not inlined or the class is set too late.

**Prevention:**
- Use `@media (prefers-color-scheme: dark)` directly in Tailwind config — this applies at CSS parse time, before any JavaScript runs
- Avoid dynamically toggling a `dark` class via JavaScript unless necessary

**Phase to address:** Phase 1 (UI shell setup).

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Audio engine (Phase 1) | AudioContext in suspended state at alarm time | Create context on Start tap; always check + resume state |
| Audio engine (Phase 1) | Oscillator nodes reused after `.stop()` | Factory pattern — new node per sound |
| Volume ramp (Phase 1) | setInterval drift during ramp | Use `linearRampToValueAtTime` — audio thread scheduled |
| Timer logic (Phase 1) | Countdown clock drifts 1–15 min | Absolute timestamp (`Date.now()`) as ground truth |
| Background reliability (Phase 2) | iOS screen lock kills audio | Silent loop keepalive + re-acquired Wake Lock + MediaSession |
| Background reliability (Phase 2) | Wake Lock silently released | `visibilitychange` handler re-requests lock |
| Notifications (Phase 2) | Permission denied due to premature prompt | Request inline with Start Alarm, preceded by in-app explanation |
| Notifications (Phase 2) | Service worker tries to play audio | SW posts message to page; page plays audio |
| Vibration (Phase 2) | Phase 2 has no effect on iOS | Design Phase 2 as louder audio + optional vibration, never vibration-only |
| iOS PWA install (Phase 2) | Notifications never appear in browser tab | Detect standalone mode; prompt for Home Screen install |
| PWA caching (Phase 3) | Stale service worker blocks updates | `autoUpdate` strategy + user-visible update banner |

---

## Sources

- MDN Web Docs — Web Audio API Best Practices (verified 2026-04-14): https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices
- MDN Web Docs — WakeLock API (verified 2026-04-14): https://developer.mozilla.org/en-US/docs/Web/API/WakeLock
- MDN Web Docs — Vibration API (verified 2026-04-14): https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API
- MDN Web Docs — Page Visibility API (verified 2026-04-14): https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API
- MDN Web Docs — setTimeout background throttling (verified 2026-04-14): https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout#reasons_for_longer_delays_than_specified
- MDN Web Docs — Using Service Workers (verified 2026-04-14): https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers
- MDN Web Docs — PWA Offline and Background Operation (verified 2026-04-14): https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation
- MDN Web Docs — Using the Notifications API (verified 2026-04-14): https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API
- iOS push notification support (MEDIUM confidence — training data, WebKit blog access blocked): Safari 16.4 / iOS 16.4, March 2023
- Chrome intensive timer throttling (HIGH confidence — MDN-verified): Chrome 88+, January 2021
