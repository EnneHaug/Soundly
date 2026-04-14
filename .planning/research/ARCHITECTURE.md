# Architecture Patterns

**Domain:** Gentle alarm PWA (React + Vite + Web Audio API)
**Researched:** 2026-04-14
**Confidence:** HIGH for component structure and Web Audio API graph design (verified against MDN). MEDIUM for background reliability strategy (browser behavior is documented but varies by platform/version).

---

## Recommended Architecture

The app has three distinct runtime concerns that must be isolated from each other:

1. **UI layer** — React component tree, view routing, user interaction
2. **Timer/orchestration engine** — phase state machine, scheduling logic, countdown
3. **Hardware abstraction layer** — Web Audio API synthesis, Wake Lock, Vibration, Notification

These three layers communicate top-down (UI → engine → hardware) for control and bottom-up (hardware events → engine → UI) for state updates. They must never be tangled: React render cycles cannot be allowed to interrupt audio scheduling, and audio state must not be stored in React state.

---

## Component Boundaries

### UI Layer (React)

```
App
├── HomeScreen
│   ├── PresetCard (Quick Nap)
│   ├── PresetCard (Focus)
│   └── CustomSetupForm
│       ├── PhaseDurationSlider (phase 1 delay)
│       ├── PhaseDurationSlider (phase 2 delay)
│       └── RampDurationSlider (phase 3 length)
├── CountdownScreen
│   ├── PhaseIndicator
│   ├── CountdownDisplay
│   ├── StopButton
│   └── PauseButton
└── TestSoundButton (lives on HomeScreen, uses AudioEngine directly)
```

**HomeScreen** owns session configuration. It holds the ephemeral form state (duration, phase delays, ramp time) and passes a resolved `SessionConfig` object to the engine when the user starts. It never touches audio or timers.

**CountdownScreen** is a display-only component. It reads timer state from a shared store/context and renders it. It issues stop/pause commands to the engine but does not run any timing logic itself.

**PresetCard** is a pure display component that, on tap, populates the form and immediately starts the session (one-tap start is a requirement for the zen UX).

### Timer / Orchestration Engine (plain TypeScript module, not React)

This is the critical layer. It must live outside React's render cycle.

```
AlarmEngine (singleton class or module)
├── state: AlarmState (idle | running | paused | ringing | stopped)
├── phase: AlarmPhase (phase1 | phase2 | phase3 | done)
├── countdown: number (seconds remaining)
│
├── start(config: SessionConfig): void
├── pause(): void
├── resume(): void
├── stop(): void
│
├── — internally schedules —
│   ├── Phase 1 trigger: setTimeout → audioEngine.startPhase1()
│   ├── Phase 2 trigger: setTimeout → audioEngine.startPhase2() + vibrationEngine.start()
│   ├── Phase 3 trigger: setTimeout → audioEngine.startPhase3Ramp()
│   └── Countdown tick: setInterval (1s) → emit state update
│
└── — emits updates via —
    └── callback / EventEmitter / Zustand action
```

The engine uses `setTimeout` and `setInterval` for phase scheduling, not Web Audio's scheduler. Web Audio's clock (`audioCtx.currentTime`) is used only within the AudioEngine for sample-accurate sound scheduling. Phase transitions happen on human-perceptible timescales (minutes), so `setTimeout` drift is acceptable.

**SessionConfig shape:**

```typescript
interface SessionConfig {
  phase1DelayMs: number;   // time from start until alarm begins (countdown duration)
  phase2DelayMs: number;   // time after phase 1 until vibration starts
  phase3DelayMs: number;   // time after phase 2 until volume ramp starts
  rampDurationMs: number;  // how long phase 3 takes to reach 100% volume
}
```

### Audio Engine (plain TypeScript module)

Owns the `AudioContext` and all audio node graphs. Never touched by React directly — only called by the AlarmEngine.

```
AudioEngine
├── ctx: AudioContext (singleton, created on first user gesture)
├── masterGain: GainNode (master volume, used for phase 3 ramp)
│
├── silentLoop: AudioBufferSourceNode (keepalive — looping silence)
│
├── startPhase1(): void
│   └── creates: OscillatorNode (sine, ~432Hz fundamental)
│              + OscillatorNode (sine, 2x frequency, 3x frequency — harmonics)
│              + GainNode per oscillator (for harmonic balance)
│              + shared GainNode (envelope: fade in slowly from 0)
│              all routed → masterGain → ctx.destination
│
├── startPhase2(): void
│   └── continues phase 1 audio (no change)
│       (vibration is handled by VibrationEngine separately)
│
├── startPhase3Ramp(): void
│   └── masterGain.gain.linearRampToValueAtTime(1.0, ctx.currentTime + rampDurationSec)
│       (phase 1 audio continues; volume increases to full)
│
├── startSilentLoop(): void
│   └── creates looping AudioBufferSourceNode with a tiny silent buffer
│       (prevents iOS from suspending AudioContext when screen locks)
│
├── playTestSound(): void
│   └── triggers phase 1 synthesis at mid volume for 3 seconds
│
├── suspend(): void   (pause support)
├── resume(): void
└── stop(): void
    └── masterGain.gain.setValueAtTime(0, ctx.currentTime)
        + disconnect all nodes
        + reset gain to 0
```

**Critical audio graph layout:**

```
OscillatorNode (fundamental, sine ~432Hz)  ──→ GainNode (harmonic balance) ──┐
OscillatorNode (2nd harmonic, sine ~864Hz) ──→ GainNode (harmonic balance) ──┤
OscillatorNode (3rd harmonic, sine ~1296Hz)──→ GainNode (harmonic balance) ──┤
                                                                               ↓
                                                              GainNode (attack envelope)
                                                                               ↓
                                                              GainNode (masterGain, 0.0 → 1.0 over ramp)
                                                                               ↓
                                                              AudioDestinationNode (speakers)

SilentLoop:
AudioBufferSourceNode (1-second silent buffer, loop: true) ──→ GainNode (gain: 0) ──→ AudioDestinationNode
```

**Why masterGain is separate from the envelope GainNode:** The envelope GainNode controls per-phase fade-in shape (start soft). The masterGain controls the overall output level for phase 3 ramping. Keeping them separate allows the phase 1 fade-in envelope to run its full curve at a low overall volume, then phase 3 ramps the masterGain from wherever it is to 1.0, independently.

### Wake Lock Manager (plain TypeScript module)

```
WakeLockManager
├── sentinel: WakeLockSentinel | null
├── acquire(): Promise<void>
│   └── calls navigator.wakeLock.request("screen")
│       re-acquires on visibilitychange (required by spec — lock releases on page hide)
├── release(): void
└── isSupported(): boolean
```

The Wake Lock Manager listens to `document.visibilitychange` and re-acquires the lock when the page becomes visible again. This is required behavior because the spec mandates automatic release on page hide.

**Important limitation:** Wake Lock prevents the *screen* from dimming but does NOT prevent the AudioContext from being suspended. On iOS Safari, screen lock suspends the AudioContext regardless of Wake Lock. This is why the silent audio loop is essential as a complementary strategy.

### Vibration Engine (plain TypeScript module)

```
VibrationEngine
├── start(): void
│   └── navigator.vibrate([400, 200, 400, 200, 400]) → setInterval to repeat
├── stop(): void
│   └── navigator.vibrate(0) + clearInterval
└── isSupported(): boolean
    └── "vibrate" in navigator
```

Vibration is fire-and-forget. The pattern repeats on an interval while phase 2 is active. When the engine moves to phase 3, vibration continues (it does not harm the ramp-up) until Stop is hit.

### Notification Manager (plain TypeScript module)

```
NotificationManager
├── requestPermission(): Promise<boolean>
├── show(title: string, body: string): void
│   └── uses ServiceWorkerRegistration.showNotification() (persistent, works on mobile)
│       falls back to new Notification() if SW not registered
└── isSupported(): boolean
```

Notifications fire when phase 1 begins — this is the user's signal that the alarm is ringing. On screen-off scenarios on Android, the notification banner is the primary wake stimulus when audio and vibration may be suppressed.

### Service Worker (vite-plugin-pwa managed)

The service worker for Soundly has one job: **offline caching**. It does NOT run alarm logic, schedule timers, or interact with Web Audio. The browser's service worker sandbox has no DOM access and cannot meaningfully interact with the alarm engine.

```
Service Worker responsibilities:
├── Cache app shell on install (HTML, JS bundles, CSS)
├── Cache synthesized via Workbox CacheFirst strategy (JS/CSS)
├── Serve cached assets when offline
└── Handle notification click events (bring app to foreground)
```

Use `vite-plugin-pwa` in `generateSW` mode (not `injectManifest`) — the app does not need custom service worker logic, only Workbox's built-in caching strategies. The manifest is configured via `vite-plugin-pwa`'s options object.

---

## Data Flow

### Session Start Flow

```
User taps preset card
  → HomeScreen reads preset values → builds SessionConfig
  → calls AlarmEngine.start(config)
  → AlarmEngine:
      - calls AudioEngine.startSilentLoop()    (immediate — before anything else)
      - calls WakeLockManager.acquire()
      - calls NotificationManager.requestPermission()
      - starts setInterval countdown ticker
      - sets setTimeout for phase 1 trigger (config.phase1DelayMs)
      → navigates React router to CountdownScreen
```

### Phase Transition Flow

```
setTimeout fires (phase 1 trigger)
  → AlarmEngine updates phase state → "phase1"
  → calls AudioEngine.startPhase1()
  → calls NotificationManager.show("Soundly", "Your alarm is starting gently")
  → state update propagates to CountdownScreen → PhaseIndicator updates

setTimeout fires (phase 2 trigger)
  → AlarmEngine updates phase state → "phase2"
  → calls VibrationEngine.start()
  → AudioEngine continues unchanged (no audio transition needed)
  → state update propagates to CountdownScreen → PhaseIndicator updates

setTimeout fires (phase 3 trigger)
  → AlarmEngine updates phase state → "phase3"
  → calls AudioEngine.startPhase3Ramp()
  → state update propagates to CountdownScreen → PhaseIndicator updates
```

### Stop Flow

```
User taps Stop
  → CountdownScreen calls AlarmEngine.stop()
  → AlarmEngine:
      - clearTimeout / clearInterval on all pending timers
      - calls AudioEngine.stop()        → gain to 0, disconnect nodes
      - calls VibrationEngine.stop()    → navigator.vibrate(0)
      - calls WakeLockManager.release()
      - updates state to "idle"
      → React router navigates to HomeScreen
```

### Background / Screen-Off Flow

```
User locks phone screen (during active timer, countdown phase)
  → visibilitychange event fires (hidden)
  → WakeLockManager detects release (spec behavior) — records for re-acquire
  → AudioContext may transition to "interrupted" (iOS) or remain "running" (Chrome Android)
  → Silent audio loop continues (Chrome Android respects active audio context)
  → iOS: AudioContext enters "interrupted" state — silent loop must be resumed
      AudioContext.onstatechange → if "interrupted", call audioCtx.resume()

User unlocks phone screen
  → visibilitychange event fires (visible)
  → WakeLockManager.acquire() called again
  → AudioContext checked: if "interrupted", resume()
  → Timer continues from where it was (setInterval was throttled but not killed)
```

**Timer drift on backgrounding:** Browser timer throttling means `setInterval` may drift by seconds when backgrounded. Mitigation: record `Date.now()` at session start and compute elapsed time as `Date.now() - startTime` rather than counting ticks. Phase transitions are then `startTime + phase1DelayMs > Date.now()`.

---

## State Management

**Use Zustand** (single small store, no persistence, no middleware needed).

```typescript
interface AlarmStore {
  // Timer state
  status: "idle" | "running" | "paused" | "stopped";
  phase: "none" | "phase1" | "phase2" | "phase3";
  secondsRemaining: number;
  config: SessionConfig | null;

  // Actions (called by AlarmEngine, not directly by UI)
  setStatus: (s: AlarmStore["status"]) => void;
  setPhase: (p: AlarmStore["phase"]) => void;
  setSecondsRemaining: (n: number) => void;
  setConfig: (c: SessionConfig | null) => void;
}
```

The AlarmEngine holds all the authoritative timing logic. It writes into the Zustand store as a side effect (not the other way around). React components read from the store. This keeps the render cycle decoupled from the timing loop.

**No React state for timer values.** Using `useState` for a countdown ticker causes a re-render every second, which is fine, but the *authoritative* elapsed-time calculation must happen in the engine, not derived from state tick counts.

---

## Suggested Build Order

Build in this order. Each layer is a prerequisite for the next.

```
Phase 1: AudioEngine (foundation)
  └── AudioContext lifecycle + OscillatorNode graph
  └── GainNode chain (harmonic balance + envelope + master)
  └── playTestSound()
  └── silentLoop keepalive
  └── Reason: All alarm behavior depends on this. Test it in isolation first.
      Build it as a pure TypeScript class with no React dependency.

Phase 2: AlarmEngine state machine
  └── SessionConfig type
  └── Phase state machine (idle → running → phase1 → phase2 → phase3 → stopped)
  └── setTimeout scheduling with wall-clock correction
  └── setInterval countdown ticker with elapsed-time arithmetic
  └── Calls into AudioEngine (injected as dependency, not imported directly)
  └── Reason: Engine must be testable without UI. Stub AudioEngine for unit tests.

Phase 3: Hardware managers
  └── WakeLockManager (acquire, release, visibilitychange handler)
  └── VibrationEngine (pattern start/stop, isSupported guard)
  └── NotificationManager (permission request, showNotification via SW)
  └── Reason: These are side-effect modules. Wire them into AlarmEngine after
      the core state machine works.

Phase 4: Zustand store
  └── AlarmStore definition
  └── AlarmEngine writes to store on each state transition
  └── Reason: Connect engine output to React after engine is verified to work.

Phase 5: React UI
  └── HomeScreen + PresetCard + CustomSetupForm
  └── CountdownScreen + PhaseIndicator + CountdownDisplay
  └── StopButton + PauseButton
  └── TestSoundButton (calls AudioEngine.playTestSound() directly)
  └── React Router for Home ↔ Countdown navigation
  └── Tailwind dark/light mode
  └── Reason: UI is the last layer. By this point, all behavior is tested
      independently of rendering.

Phase 6: PWA shell
  └── vite-plugin-pwa configuration (generateSW mode)
  └── Web app manifest (name, icons, display: standalone, theme_color)
  └── Service worker offline caching strategy (CacheFirst for app shell)
  └── Reason: PWA layer is a wrapper around a working app. Do not attempt to
      configure it before the app functions.
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Timer logic inside a React component

**What:** `useEffect` with `setInterval` inside `CountdownScreen` that drives both countdown display and phase transitions.

**Why bad:** React's render cycle can cancel and restart effects unpredictably (Strict Mode double-fires effects). If the user navigates briefly (unlikely in this app, but possible) the effect is torn down and the timer is lost. Phase transitions wired to component lifecycle will misfire.

**Instead:** AlarmEngine is a singleton module that lives outside React's component tree. React components only observe its output via Zustand. The engine's timers survive unmounts.

---

### Anti-Pattern 2: Creating a new AudioContext on every alarm start

**What:** `const ctx = new AudioContext()` inside `AlarmEngine.start()`.

**Why bad:** AudioContext creation requires a user gesture. If start() is called after a delay (the engine is initialized lazily), the context will be suspended. Browsers also limit the number of AudioContext instances; creating multiple is a resource leak.

**Instead:** Create the AudioContext once on the first user interaction (tap of Start or Test Sound) and keep it for the session. Resume it if interrupted; never close and recreate it.

---

### Anti-Pattern 3: Using `setInterval` for audio timing

**What:** Scheduling oscillator starts and stops via `setInterval`.

**Why bad:** `setInterval` has millisecond-level jitter and is throttled when the page is backgrounded. Audio that depends on interval timing will click, stutter, or skip.

**Instead:** Use `audioCtx.currentTime` for all sample-level audio scheduling (fade-in envelopes, ramp timing). Use `setTimeout`/`setInterval` only for human-perceptible phase transitions (minutes apart), where sub-second drift is imperceptible.

---

### Anti-Pattern 4: Firing the silent audio loop only at alarm trigger

**What:** Starting the silent keepalive loop at the moment the alarm fires, not at session start.

**Why bad:** On iOS Safari, the AudioContext is suspended when the screen locks. If the silent loop is not already running *before* the screen locks, it cannot be started after the lock (no user gesture available). The alarm will be silent on iOS.

**Instead:** Start the silent loop immediately when the user taps Start (a user gesture is present). The loop costs no audible output and minimal CPU. It must be running throughout the entire countdown.

---

### Anti-Pattern 5: Storing `SessionConfig` in a React form and passing it as props

**What:** `<AlarmEngine config={formState} />` where the engine is a React component.

**Why bad:** The engine must not be subject to React's render lifecycle. Props changes cause re-renders; re-renders cause effect teardown; effect teardown kills timers.

**Instead:** The form owns the `SessionConfig` as local state. On submit (Start tap), it calls `alarmEngine.start(config)` — a plain function call into the engine module. The engine takes the config as a snapshot and runs independently.

---

## Scalability Considerations

This is a single-device, single-session, single-user app. "Scalability" here means complexity management, not load.

| Concern | Current approach | If complexity grows |
|---------|-----------------|-------------------|
| Multiple sound designs | Single OscillatorNode graph in AudioEngine | Extract a `SoundPreset` abstraction; AudioEngine accepts a preset object that defines frequencies, envelope shape, harmonic ratios |
| Additional presets | Hardcoded `PRESETS` constant | Presets stay as a static array; never dynamic/user-created |
| Additional phases | AlarmPhase enum + ordered array of phase configs | Phase sequence is data-driven already — add items to the config |
| Different ramp curves | `linearRampToValueAtTime` hardcoded | Expose `rampCurve: "linear" | "exponential"` in SessionConfig |
| Sound testing iteration | `playTestSound()` in AudioEngine | No change needed; test sound just calls the same synthesis path |

---

## Platform Behavior Reference

These are confirmed behaviors (HIGH confidence from MDN) that affect architecture decisions.

| Platform | Audio context on screen lock | Wake Lock | Vibration |
|----------|------------------------------|-----------|-----------|
| Chrome Android | Continues if audio is actively playing (silent loop works) | Supported | Supported |
| iOS Safari | Suspends AudioContext on screen lock regardless | Supported (Baseline 2025) | Not supported |
| Firefox Android | Continues if audio active | Supported | Supported |
| Desktop Chrome | N/A (screen lock rare) | Supported | Not supported |
| Desktop Safari | N/A | Supported | Not supported |

The silent loop keepalive strategy works on Chrome Android but NOT on iOS. For iOS, the AudioContext will enter `interrupted` state on screen lock. The mitigation is to listen to `audioCtx.onstatechange` and call `audioCtx.resume()` on the next user interaction (the notification tap or the screen unlock). This means iOS users may miss phase 1 and part of phase 2 if the screen was locked — acceptable degradation, must be documented in the UI ("For best results, keep screen on or plug in").

---

## Sources

- MDN Web Audio API — AudioContext states, GainNode, OscillatorNode, AudioParam scheduling: HIGH confidence (official spec documentation, fetched 2026-04-14)
- MDN Screen Wake Lock API — automatic release on visibility change, re-acquire pattern: HIGH confidence (official spec documentation, fetched 2026-04-14)
- MDN Vibration API — pattern syntax, `navigator.vibrate(0)` cancel: HIGH confidence (official spec documentation, fetched 2026-04-14)
- MDN Page Visibility API — timer throttling behavior, visibilitychange event: HIGH confidence (official spec documentation, fetched 2026-04-14)
- MDN Autoplay policy — AudioContext autoplay blocking rules, `getAutoplayPolicy()`: HIGH confidence (official documentation, fetched 2026-04-14)
- MDN Media Session API — background audio session integration: MEDIUM confidence (API noted as "limited availability" / not Baseline in fetched docs)
- MDN Notifications API — ServiceWorkerRegistration.showNotification() for persistent mobile notifications: HIGH confidence (official documentation, fetched 2026-04-14)
- iOS AudioContext suspension on screen lock — training data, confirmed as a long-standing WebKit behavior: MEDIUM confidence (not fetched from current source; well-known but should be verified against current iOS Safari release notes)
- vite-plugin-pwa generateSW mode recommendation — training data (WebFetch to vite-pwa-org was denied): MEDIUM confidence; verify against current vite-plugin-pwa docs before implementation
