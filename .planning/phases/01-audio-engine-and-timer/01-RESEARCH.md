# Phase 1: Audio Engine and Timer - Research

**Researched:** 2026-04-14
**Domain:** Web Audio API synthesis, drift-free alarm timing, headless state machine
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Singing bowl: warm and deep character — low fundamental (~220Hz), rich inharmonic overtones (partials at ~2.76x, 4.72x, 6.83x), slow exponential decay.
- **D-02:** Slight detuning between oscillators for natural beating/shimmer effect.
- **D-03:** Sound character customization (bright, layered options) deferred to v2.
- **D-04:** Phase 1→2 transition uses overlap-then-fade: singing bowl continues into Phase 2 and fades out; vibration starts immediately.
- **D-05:** Phase 3 introduces a different, more urgent tone (not the singing bowl) to clearly signal final escalation. Exact tone is Claude's discretion — must contrast with the bowl while staying within the zen aesthetic.
- **D-06:** Phase 3 sound choice customization deferred to v2.
- **D-07:** Test Sound plays the singing bowl only at comfortable mid-range volume. Duration ~3 seconds (strike + initial decay, then fade out).
- **D-08:** Per-phase test buttons deferred to v2.

### Claude's Discretion
- Phase 3 urgent tone selection — must contrast with singing bowl, stay zen, be synthesizable via Web Audio API
- AlarmEngine API shape (callback-based, event emitter, or other pattern) — whatever integrates cleanly with React in Phase 3
- Timer drift correction implementation details

### Deferred Ideas (OUT OF SCOPE)
- v2 Customization: Sound character selection (warm/deep, bright/clear, layered options)
- v2 Customization: Phase 3 tone selection
- v2 Customization: Per-phase test buttons
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUD-01 | Phase 1 plays a synthesized singing bowl sound via Web Audio API | Warm bowl synthesis code from bowl-demo.html; OscillatorNode factory pattern; partial ratios confirmed |
| AUD-02 | Phase 3 ramps volume from 0% to 100% over configurable duration (default 1 min) using `linearRampToValueAtTime` | linearRampToValueAtTime requires prior setValueAtTime; pattern documented below |
| AUD-03 | Test Sound button plays Phase 3 sound at mid-range volume to verify audio works | Requires AudioContext to be resumed from user gesture; gain capped to ~0.4 for mid-range. Note: D-07 (locked decision) specifies singing bowl for Test Sound, superseding AUD-03's "Phase 3 sound" wording. Requirement intent is verified audio works; singing bowl satisfies this. |
| AUD-04 | Silent audio keepalive loop runs during active timer to prevent OS from killing the app | Oscillator → GainNode(gain=0) → destination; must restart on visibilitychange |
| ALM-01 | Three-phase escalation: soft sound → vibration → volume ramp | State machine with idle/phase1/phase2/phase3/dismissed; transitions driven by wall-clock timer |
| ALM-04 | Wall-clock timer with drift correction (no setInterval tick counting) | Date.now() delta comparison approach; setTimeout reschedule pattern from web.dev |
</phase_requirements>

---

## Summary

This phase builds a headless audio engine and drift-free alarm timer in TypeScript. The engine must synthesize a tibetan singing bowl, a contrasting Phase 3 tone, and a silent keepalive oscillator — all via raw Web Audio API with no external audio libraries. The three-phase escalation state machine (idle → phase1 → phase2 → phase3 → dismissed) drives these audio behaviors on a wall-clock-accurate timer.

The primary technical challenge is the OscillatorNode single-use constraint: every strike of the bowl requires a freshly created set of nodes. The factory pattern (a function that creates, connects, schedules, and returns a set of nodes) is the correct solution. Secondary challenges are preventing AudioContext autoplay policy blocks (context must be created or resumed from a user gesture) and implementing volume ramping without audible click artifacts.

The AlarmEngine should expose a simple API (start, stop, dismiss, onPhaseChange callback) that is React-friendly without React dependencies. Phase 3 will wire this engine into React state via a custom hook. The silent keepalive oscillator (gain = 0) runs throughout the active timer to keep AudioContext alive on mobile browsers.

**Primary recommendation:** Build AlarmEngine as a plain TypeScript class with callback registration. Use `Date.now()` delta comparison (not tick counting) for the timer. Use the OscillatorNode factory pattern for all sound strikes. Implement the Phase 3 tone as a slow sine swell (frequency sweep 80→220Hz over 2–3 seconds, looping) — contrasts with the sharp bowl strike while remaining zen.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Web Audio API | Browser native | All sound synthesis and scheduling | Specified in CLAUDE.md. Zero dependencies, offline-native, no copyright risk. OscillatorNode + GainNode cover all synthesis needs. |
| TypeScript | 5.x | Type safety on audio nodes and state machine | Already specified in CLAUDE.md. Catches Hz-vs-seconds errors. AudioContext, OscillatorNode, GainNode all have complete TypeScript types in `lib.dom.d.ts`. |

### Supporting
None required — raw Web Audio API with TypeScript types covers the full domain.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw Web Audio API | Tone.js | Tone.js is 200KB+, abstracts away the exact PeriodicWave/exponential-decay primitives needed for bowl synthesis. Explicitly rejected in CLAUDE.md. |
| Raw Web Audio API | Howler.js | File-based playback only; wrong tool for synthesis. |
| Date.now() delta timer | setInterval tick counting | Tick counting drifts because setTimeout/setInterval are subject to main-thread delays (GC, layout, rendering). Delta comparison against wall clock is drift-free. |

**Installation:** No additional packages required for this phase. TypeScript types for Web Audio API are included in `lib.dom.d.ts` (standard TypeScript DOM types). Ensure `tsconfig.json` includes `"lib": ["ESNext", "DOM"]`.

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── engine/
│   ├── AlarmEngine.ts        # Main engine class — state machine + timer
│   ├── AlarmState.ts         # State enum and action types
│   ├── AudioContext.ts       # Shared AudioContext singleton + resume helper
│   ├── sounds/
│   │   ├── singingBowl.ts    # Bowl factory function
│   │   ├── phase3Tone.ts     # Phase 3 swell factory function
│   │   └── keepalive.ts      # Silent oscillator keepalive
│   └── timer.ts              # Wall-clock drift-free timer
└── index.ts                  # Public API re-exports
```

### Pattern 1: OscillatorNode Factory

OscillatorNode (and all `AudioScheduledSourceNode` subclasses) can only be started once. Calling `.start()` a second time throws an `InvalidStateError`. After `.stop()` the node is finalized and cannot be restarted.

**Solution:** Create a fresh set of nodes on every sound event. A factory function encapsulates construction, connection, scheduling, and cleanup.

```typescript
// Source: bowl-demo.html (project reference) + MDN AudioScheduledSourceNode
function createPartial(
  ac: AudioContext,
  freq: number,
  gain: number,
  attackTime: number,
  decayTime: number,
  startTime: number
): OscillatorNode {
  const osc = new OscillatorNode(ac, { type: 'sine', frequency: freq });
  const gainNode = new GainNode(ac, { gain: 0 });

  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(gain, startTime + attackTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + attackTime + decayTime);

  osc.connect(gainNode).connect(ac.destination);
  osc.start(startTime);
  osc.stop(startTime + attackTime + decayTime + 0.1);
  return osc;
}

export function strikeBowl(ac: AudioContext): void {
  const now = ac.currentTime;
  const fund = 220;
  createPartial(ac, fund,           0.35, 0.08, 6.0, now);   // fundamental
  createPartial(ac, fund * 2.76,    0.20, 0.05, 4.5, now);   // 1st partial
  createPartial(ac, fund * 4.72,    0.12, 0.03, 3.5, now);   // 2nd partial
  createPartial(ac, fund * 6.83,    0.06, 0.02, 2.5, now);   // 3rd partial
  createPartial(ac, fund * 1.003,   0.15, 0.08, 5.5, now);   // detuned shimmer
}
```

[VERIFIED: bowl-demo.html — exact partial ratios and gain values used during decision session]
[CITED: https://developer.mozilla.org/en-US/docs/Web/API/OscillatorNode — cannot restart after stop]

### Pattern 2: Drift-Free Wall-Clock Timer

`setInterval` and `setTimeout` are unreliable for long durations. On background tabs, Chrome throttles timers to 1Hz. The fix: record `Date.now()` at start, calculate absolute fire times, and reschedule using `setTimeout` with a corrected delay on each tick.

```typescript
// Source: adapted from https://web.dev/articles/audio-scheduling (Chris Wilson pattern)
// and general wall-clock correction technique

export interface TimerHandle {
  cancel: () => void;
}

export function scheduleAt(
  targetEpochMs: number,
  callback: () => void,
  checkIntervalMs = 250
): TimerHandle {
  let handle: ReturnType<typeof setTimeout>;

  function tick() {
    const remaining = targetEpochMs - Date.now();
    if (remaining <= 0) {
      callback();
      return;
    }
    // Re-check frequently near the target to avoid overshoot
    const nextCheck = Math.min(remaining, checkIntervalMs);
    handle = setTimeout(tick, nextCheck);
  }

  handle = setTimeout(tick, Math.min(targetEpochMs - Date.now(), checkIntervalMs));

  return { cancel: () => clearTimeout(handle) };
}
```

**Key properties:**
- `targetEpochMs` is an absolute wall-clock timestamp (`Date.now() + delayMs`), not a relative interval
- Each tick recalculates remaining time from `Date.now()` — drift is reset every 250ms
- A 21-minute timer fires within ~250ms of wall time (well within the 2-second success criterion)

[CITED: https://web.dev/articles/audio-scheduling — "A Tale of Two Clocks", Chris Wilson]

### Pattern 3: AlarmEngine State Machine

```typescript
// Source: [ASSUMED] — design based on CONTEXT.md decisions and React integration requirements

type AlarmPhase = 'idle' | 'phase1' | 'phase2' | 'phase3' | 'dismissed';

interface AlarmConfig {
  phase1DurationMs: number;
  phase2DurationMs: number;
  phase3RampDurationMs: number;  // default: 60_000
  phase2to3GapMs: number;        // default: 10_000 — configurable for Phase 2 presets
}

type PhaseChangeCallback = (phase: AlarmPhase) => void;

class AlarmEngine {
  private ac: AudioContext | null = null;
  private phase: AlarmPhase = 'idle';
  private timers: TimerHandle[] = [];
  private keepaliveOsc: OscillatorNode | null = null;
  private rampGain: GainNode | null = null;
  private phaseCallback: PhaseChangeCallback | null = null;

  onPhaseChange(cb: PhaseChangeCallback): void { this.phaseCallback = cb; }

  start(config: AlarmConfig): void { /* ... */ }
  stop(): void { /* ... */ }   // cancel all timers, stop audio, go to idle
  dismiss(): void { /* ... */ } // go to dismissed state
}
```

**API design rationale:** Callback-based (not EventEmitter, not RxJS) to keep zero external dependencies. React can wire `onPhaseChange` to a `useRef` + `useState` pattern. [ASSUMED]

### Pattern 4: AudioContext Singleton with Autoplay Guard

AudioContext must be created or resumed inside a user gesture. A shared singleton avoids creating multiple contexts.

```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices

let sharedContext: AudioContext | null = null;

export async function getAudioContext(): Promise<AudioContext> {
  if (!sharedContext || sharedContext.state === 'closed') {
    sharedContext = new AudioContext();
  }
  if (sharedContext.state === 'suspended') {
    await sharedContext.resume();
  }
  return sharedContext;
}
```

This must be called from a click handler (the "Start Timer" or "Test Sound" button). Calling it on page load will result in a suspended context that won't play audio.

[CITED: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices]

### Pattern 5: Silent Keepalive Oscillator (AUD-04)

A sine oscillator running at low frequency through a GainNode with `gain = 0` keeps the AudioContext active on mobile without audible output. Must be started when the alarm starts and stopped when dismissed.

```typescript
// Source: [ASSUMED] — widely documented community technique; not in official browser docs

export function startKeepalive(ac: AudioContext): OscillatorNode {
  const osc = new OscillatorNode(ac, { type: 'sine', frequency: 1 });
  const gain = new GainNode(ac, { gain: 0 });
  osc.connect(gain).connect(ac.destination);
  osc.start();
  return osc; // caller must call osc.stop() on dismiss
}
```

**Caveat:** Effectiveness varies by browser/OS. iOS Safari may still suspend AudioContext on screen lock regardless of active oscillators. Phase 2 (Background Reliability) will extend this with notification-triggered audio and visibilitychange re-acquisition. [ASSUMED — confirmed as known limitation in STATE.md]

### Pattern 6: Volume Ramp Without Click Artifacts (AUD-02)

Phase 3 requires a smooth ramp from silence (0) to full volume (1) over 60 seconds. Two rules prevent audible clicks:

1. Always call `setValueAtTime()` before `linearRampToValueAtTime()` to anchor the starting point.
2. When fading out (end of Test Sound), use `setTargetAtTime()` with a 15ms time constant rather than an abrupt stop.

```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/linearRampToValueAtTime
// Source: http://alemangui.github.io/ramp-to-value

export function startPhase3Ramp(ac: AudioContext, durationSec: number): GainNode {
  const gain = new GainNode(ac, { gain: 0 });
  // Anchor required before any ramp
  gain.gain.setValueAtTime(0, ac.currentTime);
  gain.gain.linearRampToValueAtTime(1.0, ac.currentTime + durationSec);
  return gain;
}

export function fadeOutGain(gain: GainNode, ac: AudioContext): void {
  // Exponential fade to avoid click on stop; setTargetAtTime never reaches 0
  gain.gain.setTargetAtTime(0.0001, ac.currentTime, 0.015);
}
```

[CITED: https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/linearRampToValueAtTime]
[CITED: http://alemangui.github.io/ramp-to-value]

### Pattern 7: Phase 3 Urgent Tone Design

Decision D-05 grants Claude discretion. Research and aesthetic reasoning:

**Recommendation: Rising sine swell (80Hz → 220Hz sweep, looping)**

- Contrasts with the bowl's sharp attack + slow decay: the swell has a slow attack + sustained sweep
- Sits in the same low-frequency zen register but with continuous upward momentum creating urgency
- Synthesizable entirely from OscillatorNode + GainNode
- Looping creates the required "must dismiss" presence without being jarring

```typescript
// [ASSUMED] — synthesized recommendation from Web Audio API capabilities + zen aesthetic requirement

export function startPhase3Swell(ac: AudioContext, masterGain: GainNode): OscillatorNode {
  const osc = new OscillatorNode(ac, { type: 'sine', frequency: 80 });
  const oscGain = new GainNode(ac, { gain: 0 });

  // Sweep frequency upward over 3 seconds, then restart (external loop handles this)
  osc.frequency.setValueAtTime(80, ac.currentTime);
  osc.frequency.linearRampToValueAtTime(220, ac.currentTime + 3.0);

  // Soft attack on the swell tone itself
  oscGain.gain.setValueAtTime(0, ac.currentTime);
  oscGain.gain.linearRampToValueAtTime(1.0, ac.currentTime + 0.5);

  osc.connect(oscGain).connect(masterGain);
  osc.start();
  return osc;
}
```

The swell is fed through the Phase 3 master GainNode (which handles the 0→100% ramp per AUD-02). The frequency sweep restarts every 3–4 seconds by stopping the old oscillator and creating a new one (factory pattern).

**Alternative considered:** Bell/chime cluster (higher frequency, sharp attack). Rejected because it overlaps perceptually with the singing bowl's partial frequencies and may not signal "urgency" relative to the bowl.

[ASSUMED — aesthetic judgment based on synthesis constraints]

### Anti-Patterns to Avoid

- **Reusing OscillatorNode:** `osc.stop()` → `osc.start()` throws `InvalidStateError`. Always create new nodes. [VERIFIED: MDN OscillatorNode]
- **Setting `.gain.value` then immediately scheduling a ramp:** AudioParam method calls override direct value assignments. Always use `setValueAtTime()` to anchor before ramping. [CITED: MDN AudioParam]
- **Using setInterval for drift-sensitive timing:** setTimeout/setInterval drift by 10–100ms per minute on background tabs. Use wall-clock delta comparison. [CITED: web.dev/articles/audio-scheduling]
- **Creating AudioContext before user gesture:** Results in `suspended` state; audio plays silently. Gate `new AudioContext()` or `.resume()` behind a button click handler. [CITED: MDN Best Practices]
- **Exponential ramp to zero:** `exponentialRampToValueAtTime(0, t)` is illegal — the spec forbids it. Ramp to 0.001 or use `setTargetAtTime` instead. [CITED: MDN exponentialRampToValueAtTime]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Audio synthesis | File-based playback system | Web Audio API OscillatorNode | Files have copyright risk, require download, can't be parametric |
| Timing drift | Tick-counting scheduler | Date.now() delta + setTimeout reschedule | Tick counting accumulates error; wall-clock comparison self-corrects |
| AudioContext state | Multi-instance management | Singleton + autoplay guard | Multiple contexts consume hardware resources and complicate state |

**Key insight:** The Web Audio API provides all necessary primitives. The only custom code needed is the factory pattern wrapping node creation and the state machine orchestrating phase transitions.

---

## Runtime State Inventory

Step 2.5 SKIPPED — This is a greenfield implementation phase, not a rename/refactor/migration phase. No runtime state to inventory.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / npm | Vite dev server, TypeScript compilation | Must verify at setup | — | — |
| Web Audio API | All audio synthesis | Browser-native; no install needed | — | — |
| TypeScript DOM lib | `AudioContext` types | Included in TypeScript stdlib | `lib.dom.d.ts` | — |

**Note:** This phase is pure source code — no external services, CLIs, or databases. Environment setup (Node.js, Vite project scaffold) is a Wave 0 task, not a blocking dependency.

---

## Common Pitfalls

### Pitfall 1: AudioContext Suspended at Timer Start
**What goes wrong:** User presses "Start" but no audio plays. Console shows `AudioContext state: suspended`.
**Why it happens:** AudioContext was created at module load time (outside user gesture), not inside the button handler.
**How to avoid:** Call `getAudioContext()` (which calls `.resume()` if needed) inside the click handler that starts the alarm.
**Warning signs:** `audioCtx.state === 'suspended'` after calling `start()`.

### Pitfall 2: OscillatorNode Restart Error
**What goes wrong:** `DOMException: Failed to execute 'start' on 'OscillatorNode': cannot call start more than once`.
**Why it happens:** Attempting to reuse a stopped oscillator (e.g., storing the node and calling `.start()` again for the next bowl strike).
**How to avoid:** Never store oscillator references for reuse. `strikeBowl()` creates brand-new nodes every call.
**Warning signs:** Error thrown on the second alarm trigger or after Test Sound.

### Pitfall 3: Timer Fires Late Due to Tab Throttling
**What goes wrong:** Phase 1→2 transition fires 30+ seconds late when the tab is backgrounded.
**Why it happens:** Chrome throttles background timers to 1Hz or 1-per-minute depending on context.
**How to avoid:** Use the wall-clock delta timer (Pattern 2). The keepalive oscillator (AUD-04) may help maintain tab activity, but is not a guaranteed fix for timer throttling — this is acknowledged in STATE.md as a Phase 2 concern.
**Warning signs:** Transition fires correctly in foreground but drifts significantly in background.

### Pitfall 4: Audible Click on Sound Stop
**What goes wrong:** Stopping audio mid-waveform produces an audible "pop" or "click".
**Why it happens:** Abrupt amplitude discontinuity (waveform cut at non-zero crossing).
**How to avoid:** Use `gainNode.gain.setTargetAtTime(0.0001, ac.currentTime, 0.015)` before disconnecting nodes. Never set gain to 0 instantly.
**Warning signs:** Click sound when Test Sound ends or when alarm is dismissed.

### Pitfall 5: Exponential Ramp to Exactly Zero
**What goes wrong:** `TypeError: Failed to execute 'exponentialRampToValueAtTime': The float target value provided (0) should not be in the range (−1.40130e-45, 1.40130e-45)`.
**Why it happens:** The Web Audio spec prohibits exponential ramps to zero (mathematically undefined).
**How to avoid:** Ramp to `0.001` or use `setTargetAtTime(0, t, timeConstant)` which asymptotically approaches zero.
**Warning signs:** Exception thrown when scheduling decay envelope.

### Pitfall 6: linearRampToValueAtTime Without Prior Anchor
**What goes wrong:** Ramp starts from an unexpected value — often the last scheduled value or the param's default.
**Why it happens:** `linearRampToValueAtTime` starts from "the previous scheduled event". If no event exists, behavior is implementation-defined.
**How to avoid:** Always call `gain.gain.setValueAtTime(currentValue, ac.currentTime)` immediately before any ramp.
**Warning signs:** Phase 3 volume jumps to mid-value rather than starting from silence.

---

## Code Examples

### Singing Bowl Strike (full pattern)
```typescript
// Source: bowl-demo.html (project reference — selected as Option A "Warm and Deep")

function createPartial(
  ac: AudioContext,
  freq: number,
  peakGain: number,
  attackTime: number,
  decayTime: number,
  startTime: number
): void {
  const osc = new OscillatorNode(ac, { type: 'sine', frequency: freq });
  const gainNode = new GainNode(ac, { gain: 0 });

  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(peakGain, startTime + attackTime);
  // exponentialRampToValueAtTime cannot ramp to 0 — use 0.001
  gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + attackTime + decayTime);

  osc.connect(gainNode).connect(ac.destination);
  osc.start(startTime);
  osc.stop(startTime + attackTime + decayTime + 0.1);
}

export function strikeBowl(ac: AudioContext, masterGain = 1.0): void {
  const now = ac.currentTime;
  const fund = 220;
  // Scale peak gains by masterGain for Test Sound mid-range (~0.4)
  createPartial(ac, fund,         0.35 * masterGain, 0.08, 6.0, now);
  createPartial(ac, fund * 2.76,  0.20 * masterGain, 0.05, 4.5, now);
  createPartial(ac, fund * 4.72,  0.12 * masterGain, 0.03, 3.5, now);
  createPartial(ac, fund * 6.83,  0.06 * masterGain, 0.02, 2.5, now);
  createPartial(ac, fund * 1.003, 0.15 * masterGain, 0.08, 5.5, now); // shimmer
}
```

### Wall-Clock Timer
```typescript
// Source: technique adapted from https://web.dev/articles/audio-scheduling

export interface TimerHandle {
  cancel: () => void;
}

export function scheduleAt(targetEpochMs: number, callback: () => void): TimerHandle {
  let timeoutId: ReturnType<typeof setTimeout>;

  function tick() {
    const remaining = targetEpochMs - Date.now();
    if (remaining <= 10) {
      callback();
      return;
    }
    timeoutId = setTimeout(tick, Math.min(remaining, 250));
  }

  timeoutId = setTimeout(tick, Math.min(targetEpochMs - Date.now(), 250));
  return { cancel: () => clearTimeout(timeoutId) };
}
```

### Phase 3 Volume Ramp
```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/linearRampToValueAtTime

export function createPhase3Ramp(ac: AudioContext, durationSec: number): GainNode {
  const masterGain = new GainNode(ac, { gain: 0 });
  masterGain.gain.setValueAtTime(0, ac.currentTime); // anchor required
  masterGain.gain.linearRampToValueAtTime(1.0, ac.currentTime + durationSec);
  masterGain.connect(ac.destination);
  return masterGain;
}
```

### AudioContext Singleton + Resume Guard
```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices

let _ctx: AudioContext | null = null;

export async function getAudioContext(): Promise<AudioContext> {
  if (!_ctx || _ctx.state === 'closed') {
    _ctx = new AudioContext();
  }
  if (_ctx.state === 'suspended') {
    await _ctx.resume();
  }
  return _ctx;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `ScriptProcessorNode` for custom audio | `AudioWorkletNode` | Chrome 66 (2018), now standard | `ScriptProcessorNode` is deprecated; but this phase doesn't need custom DSP — not relevant here |
| `webkitAudioContext` prefix | `AudioContext` | All modern browsers | Never use the prefixed version |
| Manual exponential decay | `setTargetAtTime()` | Web Audio API Level 1 | Use `setTargetAtTime` for smooth fades; cleaner than manual scheduling |

**Deprecated/outdated:**
- `createOscillator()`, `createGain()`, `createBuffer()`: These factory methods on AudioContext still work but are superseded by the constructor syntax (`new OscillatorNode(ac, options)`). Either works; constructor syntax is more explicit. [ASSUMED]
- `ScriptProcessorNode`: Deprecated. Not relevant to this phase (no custom DSP needed).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | AlarmEngine callback-based API integrates cleanly with React in Phase 3 | Architecture Patterns — Pattern 3 | If React state model requires a different integration, API shape may need adjustment in Phase 3 |
| A2 | Silent keepalive oscillator (gain=0) prevents AudioContext suspension on mobile during active timer | Pattern 5 | May not be effective on iOS — acknowledged; Phase 2 extends with visibilitychange + notification audio |
| A3 | Phase 3 rising sine swell (80→220Hz) provides adequate urgency contrast with the singing bowl | Pattern 7 | Aesthetic judgment — may need iteration during implementation |
| A4 | Constructor syntax `new OscillatorNode(ac, options)` is preferred over `ac.createOscillator()` | State of the Art | Both work; this is a style choice with no functional risk |
| A5 | Phase 3 swell loop implemented by creating new OscillatorNode every ~3s | Pattern 7 | This requires a looping timer; alternative (PeriodicWave with scheduled frequency events) might be smoother |

---

## Open Questions (RESOLVED)

1. **iOS AudioContext behavior during screen lock**
   - What we know: iOS Safari suspends AudioContext when screen locks regardless of active audio
   - What's unclear: Whether the keepalive oscillator buys any additional time before suspension
   - RESOLVED: Implement keepalive as designed (AUD-04); document iOS limitation in code comment; defer robust solution to Phase 2 (Background Reliability). The keepalive is a best-effort measure for this phase.

2. **Phase 3 swell looping granularity**
   - What we know: OscillatorNode cannot be restarted; each swell cycle needs a new node
   - What's unclear: Whether frequency scheduling within a single long-running OscillatorNode (using multiple `linearRampToValueAtTime` calls) is smoother than factory-pattern looping
   - RESOLVED: Start with factory-pattern looping (consistent with rest of engine; 3.2s interval). If a perceptible gap exists at the loop point, refine during implementation by adjusting the overlap timing or switching to scheduled frequency events on a single long-running oscillator.

3. **Test Sound volume calibration**
   - What we know: D-07 specifies "comfortable mid-range volume"; `masterGain = 0.4` is a reasonable starting value
   - What's unclear: Whether 0.4 maps to "comfortable" across device types
   - RESOLVED: Use 0.4 as initial value, exported as `TEST_SOUND_GAIN` constant for easy tuning. The constant is exposed in the barrel export so it can be adjusted without modifying internal modules.

---

## Security Domain

This phase has no network requests, no user input processing, no authentication, no data persistence, and no external API calls. It is pure in-browser audio synthesis.

ASVS categories V2 (Authentication), V3 (Session), V4 (Access Control), V6 (Cryptography): not applicable.
V5 (Input Validation): The only inputs are numeric config values (phase durations in ms). These should be validated as positive integers with reasonable maximums (e.g., max 4 hours) to prevent nonsensical timer values. [ASSUMED — low risk]

---

## Sources

### Primary (HIGH confidence)
- `bowl-demo.html` (project file) — exact synthesis parameters for Option A (Warm and Deep): fundamental 220Hz, partials at 2.76x/4.72x/6.83x, gain values, attack/decay times
- [MDN OscillatorNode](https://developer.mozilla.org/en-US/docs/Web/API/OscillatorNode) — cannot restart after stop; single-use constraint
- [MDN AudioParam.linearRampToValueAtTime](https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/linearRampToValueAtTime) — requires prior setValueAtTime anchor; method signature
- [MDN Web Audio API Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices) — autoplay policy, AudioContext state lifecycle
- [web.dev: A Tale of Two Clocks](https://web.dev/articles/audio-scheduling) — lookahead scheduler pattern, drift-free timing approach

### Secondary (MEDIUM confidence)
- [MDN Advanced Techniques](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Advanced_techniques) — scheduler implementation details, `while (nextNoteTime < audioCtx.currentTime + scheduleAheadTime)` pattern
- [alemangui.github.io: Web Audio click artifacts](http://alemangui.github.io/ramp-to-value) — setTargetAtTime for click-free fades, 15ms time constant recommendation
- [MDN AudioContext.suspend issue #317](https://github.com/WebAudio/web-audio-api/issues/317) — iOS AudioContext suspension behavior

### Tertiary (LOW confidence — marked [ASSUMED] in text)
- AlarmEngine API shape (callback-based) — design recommendation from training knowledge
- Silent keepalive effectiveness — community-documented technique, no official browser docs
- Phase 3 swell aesthetic fit — synthesized recommendation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Raw Web Audio API is the only tool; confirmed in CLAUDE.md
- Singing bowl synthesis: HIGH — Exact code from bowl-demo.html, ratios from discussion session
- Timer drift correction: HIGH — Verified via web.dev canonical article
- Click artifact prevention: HIGH — Verified via MDN + alemangui article
- Silent keepalive: MEDIUM — Community technique, no official source; iOS caveats noted
- Phase 3 tone design: MEDIUM — Aesthetic judgment within confirmed synthesis constraints

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (Web Audio API is stable; no expected breaking changes)
