# Architecture Patterns — v2.0 Custom Alarm Composer + Discoverability

**Domain:** Subsequent milestone — extending an existing React + Vite + Tailwind PWA
**Researched:** 2026-05-04
**Confidence:** HIGH for AlarmConfig schema decision and integration boundaries (verified against actual `src/engine/AlarmEngine.ts`, `src/hooks/useAlarm.ts`, `src/components/Countdown.tsx`). MEDIUM for landing-page routing decision (multi-page Vite is well-documented but interaction with vite-plugin-pwa `injectManifest` SPA fallback needs careful configuration). MEDIUM for React 19 JSON-LD hoisting (documented behavior; verify with Context7 before implementation).

---

## Executive Summary

The v2.0 work splits cleanly into two architecturally independent tracks:

1. **Alarm composer** — additive engine work. New `SegmentEngine` runs alongside the existing `AlarmEngine`; existing `AlarmConfig` is **untouched** (zero diff to v1 presets, sound files, and Phase 1/2/3 logic). The two engines share `getAudioContext()`, `keepalive`, `wakeLock`, and notifications. `useAlarm` is **superseded** (not modified) by a new `useSegmentAlarm` hook for Custom Mode; Quick Nap and Focus continue routing through the unmodified `useAlarm`. Countdown is **forked** into `Countdown.tsx` (continuous, untouched) and `SegmentCountdown.tsx` (segment-aware) — same visual language, different state shape. A higher-level `useActiveAlarm` selector chooses which hook is live.

2. **Discoverability** — a **multi-page Vite build** (option c). `index.html` becomes the static marketing landing page; the React app shell moves to `app.html` served at `/app/`. This avoids adding a router to a single-screen app, gives crawlers fully-rendered HTML at `/`, and keeps the existing `injectManifest` service worker in charge of `/app/` precaching. The landing page is precached too but uses NetworkFirst so updated marketing copy ships without an SW update.

**The integration risk to manage:** `vite-plugin-pwa` is currently configured with `base: '/Soundly/'` and a NavigationRoute fallback bound to `/Soundly/index.html`. Splitting into two entry points requires updating the SW navigation handler so `/Soundly/app/` falls back to `app.html` and `/Soundly/` falls back to `index.html` — otherwise the marketing page will be served when users deep-link to the app.

---

## Recommended Architecture

The existing v1 architecture has three runtime concerns: UI layer (React), orchestration engine (plain TS), hardware abstraction (Web Audio API + browser APIs). v2.0 adds a **fourth concern**: a **content/marketing surface** that is structurally separate from the alarm app.

```
┌────────────────────────────────────────────────────────────────────┐
│  Static marketing surface (NEW)                                    │
│  ─ index.html (build-time generated landing page)                  │
│  ─ FAQ, screenshots, install CTA, JSON-LD, OG tags                 │
│  ─ Deep link → /app/                                               │
└────────────────────────────────────────────────────────────────────┘
                                  ↓ user clicks "Open App"
┌────────────────────────────────────────────────────────────────────┐
│  React app shell (EXISTING + EXTENDED)                             │
│  ─ app.html (NEW: second Vite entry, mounts existing <App />)     │
│  ─ Dashboard (MODIFIED: 3 preset cards + Custom button)            │
│  ─ Countdown (UNCHANGED — used by continuous alarms)               │
│  ─ SegmentCountdown (NEW — used by Custom Mode + Wake Easy)        │
│  ─ CustomComposer (NEW — segment builder UI)                       │
└────────────────────────────────────────────────────────────────────┘
                                  ↓ start alarm
┌────────────────────────────────────────────────────────────────────┐
│  Orchestration layer                                               │
│  ┌──────────────────────────┐  ┌──────────────────────────────┐    │
│  │ AlarmEngine (UNCHANGED)  │  │ SegmentEngine (NEW)          │    │
│  │ phase1 → phase2 → phase3 │  │ segment[0] → segment[1] → …  │    │
│  └────────────┬─────────────┘  └────────────┬─────────────────┘    │
│               │                              │                      │
│               └──────────────┬───────────────┘                      │
│                              ↓                                      │
│  Shared services: getAudioContext, keepalive, wakeLock,             │
│  notifications, vibration                                           │
└────────────────────────────────────────────────────────────────────┘
                                  ↓
┌────────────────────────────────────────────────────────────────────┐
│  Hardware (UNCHANGED) — Web Audio API graph, Wake Lock, etc.       │
│  Sound files in src/engine/sounds/ stay zero-diff except           │
│  the new triangle.ts addition.                                     │
└────────────────────────────────────────────────────────────────────┘
```

**Invariant:** the existing AlarmEngine state machine, its three-phase scheduler, its pause/resume snapshot logic, and its sound files (`singingBowl.ts`, `phase3Tone.ts`, `keepalive.ts`, `tickPulse.ts`, `fadeOutGain.ts`) are **frozen** in v2.0. All segment behavior lives in the new SegmentEngine. This is the smallest-diff integration that keeps the v1 success criteria untouchable.

---

## Decision 1: AlarmConfig Schema Shape

The existing `AlarmConfig` (from `src/engine/AlarmState.ts` per Phase 1 work) is a flat record:

```typescript
interface AlarmConfig {
  phase1DurationMs: number;
  phase2DurationMs: number;
  phase2to3GapMs: number;
  phase3RampDurationMs: number;
}
```

Three options for representing segments:

### (a) Extend AlarmConfig with optional `segments`

```typescript
interface AlarmConfig {
  phase1DurationMs: number;
  phase2DurationMs: number;
  phase2to3GapMs: number;
  phase3RampDurationMs: number;
  segments?: Segment[]; // NEW — if present, takes precedence
}
```

**Tradeoffs:**
- **Pro:** Single config type, single hook (`useAlarm`), single Countdown component with branching.
- **Con:** Forces every consumer of AlarmConfig to handle "what if segments are present?" Branching infects `validateConfig`, the engine's `start()`, the Countdown's phase-progress math, and the hook's `phaseEndsAt` computation. The "if segments, ignore phase1/2/3 fields" rule is implicit and easy to violate. Type safety doesn't catch the misuse.
- **Con:** The Countdown has to encode two different timeline visualizations behind a single component — `ProgressRing` is hardcoded for three segments; a 5-segment Wake Easy alarm would require it to grow conditional layout.

### (b) Discriminated union

```typescript
type AlarmConfig =
  | { mode: 'continuous'; phase1DurationMs: number; phase2DurationMs: number; ... }
  | { mode: 'segments'; segments: Segment[] };
```

**Tradeoffs:**
- **Pro:** Type-safe — TypeScript forces every consumer to switch on `mode`.
- **Con:** **Breaks v1.** Every existing usage of `AlarmConfig` (Dashboard preset constants, useAlarm phaseEndsAt math, Countdown phase-duration lookup, validateConfig) needs an update. `QUICK_NAP_CONFIG` and `FOCUS_CONFIG` need `mode: 'continuous'` added. This violates the "Phase 1/2/3 sound files should stay zero-diff" project convention by extension — it forces churn into every file that imports the type.
- **Con:** AlarmEngine itself becomes a union dispatcher — it has to decide whether to run continuous logic or hand off. The existing AlarmEngine class is not the right place for that.

### (c) Separate SegmentConfig + SegmentEngine alongside AlarmEngine — RECOMMENDED

```typescript
// EXISTING — unchanged
interface AlarmConfig {
  phase1DurationMs: number;
  phase2DurationMs: number;
  phase2to3GapMs: number;
  phase3RampDurationMs: number;
}

// NEW — separate type
type EndSound = 'gentle' | 'triangle' | 'alarm';
interface Segment {
  durationMs: number;
  endSound: EndSound;
}
interface SegmentConfig {
  segments: Segment[];
  // Optional metadata — used by Wake Easy preset display, never read by engine
  presetLabel?: string;
}
```

**Tradeoffs:**
- **Pro:** Zero diff to v1. `AlarmConfig`, `validateConfig`, `AlarmEngine`, `useAlarm`, `Countdown`, `ProgressRing` all untouched.
- **Pro:** The segment runner is a separate module — its scheduling logic (sequential segments) is fundamentally different from the v1 model (escalating phases with overlapping audio). Trying to unify them is forced.
- **Pro:** `validateSegmentConfig` is independent — its rules differ (e.g., at least one segment, no negative durations, endSound must be a known literal).
- **Pro:** New behavior is added by composition, not by modifying existing surfaces.
- **Con:** Two engines, two hooks. The Dashboard has to know which to dispatch to (mitigated by a thin `useActiveAlarm` selector hook).
- **Con:** Some duplication of the keepalive / wake-lock / notification setup. Mitigation: extract a small `AlarmSession` helper module that both engines call into for the shared lifecycle (`startSession()`, `endSession()`).

**Decision: (c).** It's the smallest change that doesn't risk v1 regression and gives the cleanest long-term shape. Option (a) looks lightweight but spreads conditionals through every consumer; option (b) breaks the zero-diff guarantee. The duplication cost in (c) is small (~30 lines of session lifecycle code) and the boundary it establishes is real — segment alarms and continuous-escalation alarms are different products.

### Shared lifecycle module (refactor to support both engines)

```typescript
// src/engine/AlarmSession.ts — NEW
// Owns the shared startup/teardown that both engines need.
export async function startAlarmSession(): Promise<{
  ac: AudioContext;
  keepaliveOsc: OscillatorNode;
  visibilityCleanup: () => void;
}> {
  const ac = await getAudioContext();
  const keepaliveOsc = startKeepalive(ac);
  await acquireWakeLock();
  const visibilityCleanup = attachVisibilityReacquire();
  return { ac, keepaliveOsc, visibilityCleanup };
}

export function endAlarmSession(handle: { keepaliveOsc: OscillatorNode; visibilityCleanup: () => void }): void {
  stopKeepalive(handle.keepaliveOsc);
  releaseWakeLock();
  handle.visibilityCleanup();
  stopVibration();
}
```

This is a **light refactor** of `AlarmEngine.start()` and `AlarmEngine.cleanup()` — they call into `startAlarmSession`/`endAlarmSession` instead of inlining the calls. Acceptable because it's mechanical, doesn't change behavior, and the only test it could regress is "does the keepalive start and the wake lock acquire" — easily verified.

---

## Decision 2: SegmentEngine Design

```typescript
// src/engine/SegmentEngine.ts — NEW

import { Segment, SegmentConfig, validateSegmentConfig } from './SegmentState';
import { scheduleAt, TimerHandle } from './timer';
import { startAlarmSession, endAlarmSession } from './AlarmSession';
import { strikeBowl } from './sounds/singingBowl';
import { strikeTriangle } from './sounds/triangle'; // NEW
import { startPhase3Swell, createPhase3Ramp } from './sounds/phase3Tone';

export type SegmentPhase = 'idle' | 'segment' | 'dismissed';

export class SegmentEngine {
  private ac: AudioContext | null = null;
  private session: Awaited<ReturnType<typeof startAlarmSession>> | null = null;
  private phase: SegmentPhase = 'idle';
  private _running = false;
  private _paused = false;
  private timers: TimerHandle[] = [];

  // The active config is needed for pause/resume and progress display
  private activeConfig: SegmentConfig | null = null;
  private currentSegmentIndex: number = -1;
  private segmentEndsAt: number[] = []; // wall-clock fire time for each segment's end-sound

  // Pause snapshot — remaining ms for each segment yet to fire
  private pauseSnapshot: { remainingMs: number[] } | null = null;

  private phaseCallback: ((p: SegmentPhase, segmentIndex: number) => void) | null = null;

  onChange(cb: (p: SegmentPhase, segmentIndex: number) => void): void {
    this.phaseCallback = cb;
  }

  async start(config: SegmentConfig): Promise<void> {
    validateSegmentConfig(config);
    if (this._running) throw new Error('SegmentEngine already running');
    this._running = true;
    this.activeConfig = config;
    this.session = await startAlarmSession();
    this.ac = this.session.ac;

    // Schedule each segment's end-sound at cumulative wall-clock time
    let cumulative = Date.now();
    this.segmentEndsAt = config.segments.map((seg) => {
      cumulative += seg.durationMs;
      return cumulative;
    });

    config.segments.forEach((seg, i) => {
      this.timers.push(scheduleAt(this.segmentEndsAt[i], () => {
        this.currentSegmentIndex = i;
        this.fireEndSound(seg.endSound);
        this.phaseCallback?.('segment', i);
      }));
    });
  }

  private fireEndSound(sound: EndSound): void {
    if (!this.ac) return;
    switch (sound) {
      case 'gentle':
        strikeBowl(this.ac, 1.0);
        break;
      case 'triangle':
        strikeTriangle(this.ac, 1.0);
        break;
      case 'alarm':
        // Brief Phase-3-style swell — reuse existing module
        const ramp = createPhase3Ramp(this.ac, 0.5); // fast ramp for non-final segments
        startPhase3Swell(this.ac, ramp);
        break;
    }
  }

  pause(): void { /* analogous to AlarmEngine.pause — snapshot remainingMs */ }
  resume(): void { /* re-schedule remaining segments */ }
  stop(): void { this.cleanup(); this.phase = 'idle'; this.phaseCallback?.('idle', -1); }
  dismiss(): void { this.cleanup(); this.phase = 'dismissed'; this.phaseCallback?.('dismissed', -1); }

  private cleanup(): void {
    this.timers.forEach((t) => t.cancel());
    this.timers = [];
    if (this.session) endAlarmSession(this.session);
    this.session = null;
    this._running = false;
    this._paused = false;
    this.pauseSnapshot = null;
  }
}
```

**Key differences from AlarmEngine:**
- No three-phase state — phase is just `idle | segment | dismissed`. The "where am I?" data is the segment index, not the phase enum.
- No overlapping audio — segments are sequential. Each `endSound` is a discrete strike at the segment boundary.
- `validateSegmentConfig` enforces: `segments.length >= 1`, `every duration > 0`, total duration sane upper bound (e.g., 6 hours).

**Reuse:** `scheduleAt`, `getAudioContext`, the keepalive/wake-lock/vibration modules, `strikeBowl`, `createPhase3Ramp + startPhase3Swell` (for the 'alarm' end sound). Only `triangle.ts` is new.

---

## Decision 3: Triangle Sound File

**Option A — `src/engine/sounds/triangle.ts` (mirror existing pattern)**

This matches `singingBowl.ts`, `phase3Tone.ts`, `tickPulse.ts`, `fadeOutGain.ts` — each file exports a synthesis function for one sound type.

```typescript
// src/engine/sounds/triangle.ts — NEW
import { getAudioContext } from '../AudioContext';

/**
 * Triangle strike — bright single hit with quick decay (~1–2s).
 * Higher pitched than singing bowl, sharper attack, less harmonic content.
 *
 * Synthesis: 2 sine partials (fundamental ~2093Hz / C7 + octave) with
 * very short attack (5ms) and exponential decay over ~1.2s.
 */
export function strikeTriangle(ac: AudioContext, peakGain: number = 1.0): void {
  const fundamental = 2093; // C7
  const partials = [{ freq: fundamental, gain: 1.0 }, { freq: fundamental * 2, gain: 0.4 }];
  const now = ac.currentTime;
  const decaySec = 1.2;

  const masterGain = ac.createGain();
  masterGain.gain.setValueAtTime(0, now);
  masterGain.gain.linearRampToValueAtTime(peakGain, now + 0.005); // 5ms attack
  masterGain.gain.exponentialRampToValueAtTime(0.001, now + decaySec);
  masterGain.connect(ac.destination);

  partials.forEach((p) => {
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = p.freq;
    const partialGain = ac.createGain();
    partialGain.gain.value = p.gain;
    osc.connect(partialGain).connect(masterGain);
    osc.start(now);
    osc.stop(now + decaySec + 0.05);
  });
}
```

**Option B — shared "strike sounds" module**

Bundle triangle, bowl-strike, and any future strike sounds in `src/engine/sounds/strikes.ts`.

**Decision: Option A.** Project convention from Phase 1 is one sound = one file. Following that convention is cheaper than introducing a new abstraction. If a third or fourth strike sound emerges later, refactoring at that point is trivial. **Adding a triangle file is a zero-diff-risk addition** — no existing file changes.

---

## Decision 4: SegmentCountdown vs Reusing Countdown

The existing `Countdown.tsx`:
- Reads `alarm.phase` (`'idle' | 'phase1' | 'phase2' | 'phase3' | 'dismissed'`)
- Looks up phase duration from `config` via `getPhaseDuration(phase, config)` — a switch over phase enum
- Renders `<ProgressRing config={config} currentPhase={phase} phaseProgress={...} />` — ProgressRing is hardcoded to three segments
- Uses `PHASE_LABELS` map for phase names ("Gentle Sound", "Nudge", "Wake")

For Custom Mode and Wake Easy (5 segments), this component is structurally wrong — it can't render an N-segment timeline.

**Decision:** **Fork into `SegmentCountdown.tsx`** with a different ProgressRing strategy:
- Linear horizontal timeline OR a circular ring divided into N variable-width arcs (proportional to segment durations)
- `currentSegmentIndex` instead of phase enum
- Label = "Segment 3 of 5" or the user's preset label + remaining mm:ss
- Same pause/resume button layout, same color palette (zen aesthetic preserved)

**Rationale:**
- `Countdown.tsx` and `ProgressRing.tsx` were written to a specific data shape; trying to overload them costs more than forking.
- The fork keeps v1 unchanged — Quick Nap and Focus continue routing through `Countdown.tsx`.
- `SegmentCountdown.tsx` is small (~80 lines) and reuses `formatMmSs`, the button styling, and the layout container.

**Shared subcomponents** (no fork needed):
- `formatMmSs` — utility, used by both
- The `<button>` styling for Pause/Resume/Stop — extract to `<AlarmControls />` if you want to dedupe; otherwise leave inline (it's 12 lines per file)

---

## Decision 5: Hook Layering

```typescript
// src/hooks/useAlarm.ts — UNCHANGED (still wraps AlarmEngine, used by Quick Nap/Focus)

// src/hooks/useSegmentAlarm.ts — NEW (wraps SegmentEngine, used by Custom/Wake Easy)
export function useSegmentAlarm(): UseSegmentAlarmReturn {
  // Mirrors useAlarm shape but exposes segmentIndex, segmentEndsAt[], segments[]
}

// src/hooks/useActiveAlarm.ts — NEW (router-like selector)
export function useActiveAlarm(): {
  mode: 'continuous' | 'segments' | null;
  continuous: UseAlarmReturn;
  segments: UseSegmentAlarmReturn;
} {
  const continuous = useAlarm();
  const segments = useSegmentAlarm();
  const mode = continuous.isRunning ? 'continuous'
             : segments.isRunning   ? 'segments'
             : null;
  return { mode, continuous, segments };
}
```

`App.tsx` uses `useActiveAlarm()` and routes the rendering:
- `mode === null` → `<Dashboard />`
- `mode === 'continuous'` → `<Countdown alarm={continuous} />`
- `mode === 'segments'` → `<SegmentCountdown alarm={segments} />`

**Constraint:** Only one alarm runs at a time. Dashboard preset cards call `continuous.start(QUICK_NAP_CONFIG)`; the Custom button opens `<CustomComposer />` which on Start calls `segments.start(segmentConfig)`. Both engines guard with `_running` flags; if both are somehow started simultaneously, the engines themselves throw. UI prevents this by checking `mode === null` before allowing a new start.

---

## Decision 6: Custom Mode UI Placement

**Option A — New top-level page (`/custom`)**
Requires React Router. Forces the rest of the app to become routed too (or adopt a hybrid where one page is routed and the rest isn't).

**Option B — Modal over Dashboard**
Tap "Custom" → modal overlays Dashboard with the segment builder. On Start, modal closes and `<SegmentCountdown />` takes over.

**Option C — Inline expansion**
Tap "Custom" → Dashboard expands in place to show the builder. On Start, transitions to countdown.

**Decision: Option B (modal).** Reasons:
- App is single-screen by design; introducing routing for one new screen is overkill.
- Modal preserves the Dashboard's role as "alarm launcher" and keeps the user's mental model.
- Builder needs scrollable area for arbitrary segment count; a modal full-screen on mobile gives that naturally.
- Dismiss behavior is obvious (close = back to dashboard, no orphan state).
- The existing `useState` in `App` can hold `isComposerOpen: boolean`; no new dependency.

```typescript
// src/App.tsx — MODIFIED (existing file)
const [isComposerOpen, setIsComposerOpen] = useState(false);
const { mode, continuous, segments } = useActiveAlarm();

if (mode === 'continuous') return <Countdown alarm={continuous} />;
if (mode === 'segments') return <SegmentCountdown alarm={segments} />;

return (
  <>
    <Dashboard
      alarm={continuous}
      onOpenComposer={() => setIsComposerOpen(true)}
    />
    {isComposerOpen && (
      <CustomComposer
        onClose={() => setIsComposerOpen(false)}
        onStart={(cfg) => { setIsComposerOpen(false); segments.start(cfg); }}
      />
    )}
  </>
);
```

---

## Decision 7: Landing Page Routing

The marketing landing page must be indexed by search engines. Three options:

### (a) Static `index.html` + React app at `/app` via React Router

- Pure-static landing, max SEO. But requires a router for the app, which currently has no routing. React Router adds ~10KB and forces every component to know about routes.

### (b) React-rendered landing at `/` + SSG/prerender

- Use `vite-plugin-prerender-spa` or `vite-react-ssg`. Renders the landing page to static HTML at build time so crawlers see content. Keeps SPA architecture.
- **Risk:** Prerender plugins add a build-time Puppeteer/Playwright dependency, slow CI, and have edge cases with hydration mismatch. The app is currently small enough that this is overkill.

### (c) Multi-page Vite build — RECOMMENDED

Vite's `build.rollupOptions.input` accepts multiple HTML entry points. Two completely separate HTML files, each with its own JS bundle, served at different URLs.

```
/Soundly/             → index.html (landing page, hand-authored HTML + minimal JS)
/Soundly/app/         → app.html   (mounts existing <App />, full PWA shell)
```

**Tradeoffs:**
- **Pro:** Landing page is hand-authored static HTML — every word is crawlable, no SSG infrastructure needed.
- **Pro:** No router required. The "deep link" from landing to app is just an `<a href="/Soundly/app/">` — zero JS.
- **Pro:** Each page only ships the code it needs. Marketing doesn't load AlarmEngine; app doesn't load marketing.
- **Pro:** Native browser cache + HTTP semantics work. SEO crawlers, social card scrapers, and Lighthouse all see real HTML.
- **Con:** Two HTML files to maintain. Mitigation: landing is mostly static; ~one update per release.
- **Con:** Service worker needs reconfiguration to handle two roots. Mitigation: explicit, manageable — see SW section below.

**Decision: Option (c).** For a single-developer indie PWA already using `injectManifest`, multi-page Vite is the smallest-toolchain solution. SSG adds a Puppeteer-class dependency for one page; routing a single-screen app adds ~10KB and architectural debt.

### Vite multi-page configuration

```typescript
// vite.config.ts — MODIFIED
import { resolve } from 'path';

export default defineConfig({
  base: '/Soundly/',
  build: {
    rollupOptions: {
      input: {
        landing: resolve(__dirname, 'index.html'),
        app:     resolve(__dirname, 'app/index.html'),
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      manifest: { /* unchanged except start_url */
        start_url: '/Soundly/app/', // installed PWA opens the app, not the landing page
        scope: '/Soundly/app/',     // SW scope limited to the app
        // ... rest unchanged
      },
      injectManifest: {
        // Only precache app shell + assets, NOT the landing page
        globPatterns: ['app/**/*.{js,css,html,png,svg,webmanifest}'],
      },
      devOptions: { enabled: true, type: 'module' },
    }),
  ],
});
```

**Critical:** the manifest's `start_url` and `scope` must point to `/Soundly/app/` so the installed PWA bypasses the marketing page. Users who installed v1 will need to reinstall (or the SW update will refresh `start_url` on next launch — verify behavior with Context7 / vite-plugin-pwa docs before shipping).

### File layout after change

```
index.html              # Landing page (hand-authored marketing HTML)
app/
  index.html            # App shell (mounts <App />)
src/
  main.tsx              # UNCHANGED (the entry app/index.html references)
  ...
```

### Service worker reconfiguration

`src/sw.ts` currently has:

```typescript
const navHandler = createHandlerBoundToURL('/Soundly/index.html');
registerRoute(new NavigationRoute(navHandler));
```

This must become:

```typescript
// src/sw.ts — MODIFIED
const appNavHandler = createHandlerBoundToURL('/Soundly/app/index.html');
registerRoute(
  new NavigationRoute(appNavHandler, {
    // Only handle navigations under /app/
    allowlist: [/^\/Soundly\/app\//],
  })
);

// Landing page is NetworkFirst — always try to fetch fresh marketing copy,
// fall back to cache if offline. Don't precache it.
registerRoute(
  ({ url }) => url.pathname === '/Soundly/' || url.pathname === '/Soundly/index.html',
  new NetworkFirst({ cacheName: 'landing-page' })
);
```

**Why NetworkFirst for landing:**
- Marketing copy changes more often than the app. NetworkFirst means a fresh deploy is visible immediately without an SW update cycle (which can lag a session).
- Offline fallback still works for installed users who briefly hit the landing page.

**Why precache for app:**
- App shell must be available offline (existing v1 requirement). `injectManifest`'s `globPatterns` restricts the manifest to app assets only.

### Sitemap and robots

```
public/
  robots.txt            # Hand-authored, one line: Allow: / + Sitemap URL
  sitemap.xml           # Two URLs: /Soundly/ and /Soundly/app/
```

**Decision: hand-authored static files in `public/`.** A Vite plugin (`vite-plugin-sitemap`) is overkill for two URLs. If the site grows to dozens of pages later, switch to a plugin.

### JSON-LD injection

React 19 hoists `<title>`, `<meta>`, and `<link>` tags rendered inside components into `<head>` automatically. **For `<script type="application/ld+json">`, React 19's behavior:**
- React 19 supports rendering `<script>` tags in components and hoisting them to head when they have a `src` attribute (deduplicated by src).
- For inline JSON-LD (`<script type="application/ld+json">{json}</script>`) the hoisting behavior is less clear — verify with Context7 (`mcp__context7__resolve-library-id` for React, then docs query for "metadata script ld+json").

**Recommendation regardless of React 19 hoisting:**
- **Landing page:** JSON-LD goes directly in `index.html` as static markup. The landing page is hand-authored HTML with minimal JS — no React hoisting needed, and crawlers see it instantly without executing JS.
- **App page:** JSON-LD for the SoftwareApplication schema goes in `app/index.html` as static markup too. The app is a PWA — Google still benefits from the schema even if it requires JS to render the rest. No need to inject from React.

This makes JSON-LD purely a build-time concern, no runtime React work. Keeps the cleanest separation.

---

## Component Boundaries (v2.0 final state)

```
src/
├── App.tsx                     [MODIFIED] route between Dashboard / Countdown / SegmentCountdown / CustomComposer
├── main.tsx                    [UNCHANGED]
├── components/
│   ├── Dashboard.tsx           [MODIFIED] add 3rd preset card (Wake Easy) + Custom button
│   ├── PresetCard.tsx          [UNCHANGED]
│   ├── TestSoundButton.tsx     [UNCHANGED]
│   ├── IosInstallBanner.tsx    [UNCHANGED]
│   ├── Countdown.tsx           [UNCHANGED] continuous-phase countdown
│   ├── ProgressRing.tsx        [UNCHANGED] three-segment ring
│   ├── SegmentCountdown.tsx    [NEW]      N-segment countdown
│   ├── SegmentTimeline.tsx     [NEW]      visual timeline for SegmentCountdown
│   ├── CustomComposer.tsx      [NEW]      modal segment builder
│   └── SegmentRow.tsx          [NEW]      one row in CustomComposer (duration + endSound)
├── hooks/
│   ├── useAlarm.ts             [UNCHANGED]
│   ├── useSegmentAlarm.ts      [NEW]
│   └── useActiveAlarm.ts       [NEW]      mode selector
├── engine/
│   ├── AlarmEngine.ts          [LIGHT REFACTOR] start/cleanup call AlarmSession helpers
│   ├── AlarmState.ts           [UNCHANGED] AlarmConfig + presets
│   ├── AlarmSession.ts         [NEW]      shared session start/end (keepalive, wakelock)
│   ├── SegmentEngine.ts        [NEW]
│   ├── SegmentState.ts         [NEW]      Segment, SegmentConfig, EndSound, validateSegmentConfig
│   ├── AudioContext.ts         [UNCHANGED]
│   ├── timer.ts                [UNCHANGED]
│   ├── index.ts                [MODIFIED] export new types/engines
│   └── sounds/
│       ├── singingBowl.ts      [UNCHANGED]
│       ├── phase3Tone.ts       [UNCHANGED]
│       ├── keepalive.ts        [UNCHANGED]
│       ├── tickPulse.ts        [UNCHANGED]
│       ├── fadeOutGain.ts      [UNCHANGED]
│       ├── testSound.ts        [UNCHANGED]
│       └── triangle.ts         [NEW]
├── platform/
│   ├── notifications.ts        [UNCHANGED]
│   ├── vibration.ts            [UNCHANGED]
│   └── wakeLock.ts             [UNCHANGED]
├── presets/
│   └── wakeEasy.ts             [NEW] WAKE_EASY_CONFIG: SegmentConfig
└── sw.ts                       [MODIFIED] dual nav routing for /app/ and /

# Build / config
vite.config.ts                  [MODIFIED] multi-page input, scoped manifest, scoped SW
index.html                      [REWRITTEN] hand-authored marketing landing page + JSON-LD + OG tags
app/index.html                  [NEW] app shell (move existing index.html content here, update script src)

# Static
public/
├── robots.txt                  [NEW]
├── sitemap.xml                 [NEW]
└── og-image.png                [NEW] 1200x630 social card image
```

**Zero-diff guarantees:**
- All `src/engine/sounds/*.ts` files (except the new `triangle.ts`) are unchanged.
- `AlarmState.ts` unchanged — `AlarmConfig`, `validateConfig`, `QUICK_NAP_CONFIG`, `FOCUS_CONFIG` all preserved exactly.
- `Countdown.tsx`, `ProgressRing.tsx`, `useAlarm.ts` unchanged — the v1 user paths through the app are byte-identical.
- `AlarmEngine.ts` has a light refactor (extract session lifecycle into `AlarmSession.ts`) — behavior identical, but if even this is too risky, defer the extraction and let `SegmentEngine` duplicate the keepalive/wake-lock setup.

---

## Data Flow

### Continuous alarm (Quick Nap / Focus) — UNCHANGED
```
User taps PresetCard → Dashboard.onStart(QUICK_NAP_CONFIG)
  → useAlarm.start(config) → AlarmEngine.start(config)
  → schedules phase1/phase2/phase3 timers
  → state propagates via onPhaseChange → Countdown renders
```

### Segment alarm (Custom / Wake Easy) — NEW
```
User taps "Custom" → setIsComposerOpen(true)
  → CustomComposer renders modal with [SegmentRow, SegmentRow, ...]
  → User configures segments → onStart(segmentConfig)
  → useSegmentAlarm.start(config) → SegmentEngine.start(config)
  → schedules N timers, one per segment-end
  → onChange callback fires (phase, segmentIndex)
  → state propagates → SegmentCountdown renders SegmentTimeline + remaining time

User taps Wake Easy preset → Dashboard.onStartWakeEasy(WAKE_EASY_CONFIG)
  → same flow, just with prebuilt config
```

### Where segment data lives

```
WAKE_EASY_CONFIG (constant)        ─┐
or                                  ├─→  SegmentEngine.activeConfig (private)
CustomComposer modal local state ──┘     ↓
                                    ─→  useSegmentAlarm.activeConfig (state)
                                          ↓
                                    ─→  SegmentCountdown.props.alarm.activeConfig
                                          ↓
                                    ─→  SegmentTimeline reads segments[] for layout
```

The SegmentConfig is **owned** by the launcher (preset constant or composer state), **passed** to the engine on start, **mirrored** in the hook for UI consumption. Engine is the source of truth for *runtime* state (currentSegmentIndex, paused, remaining); config is read-only after start.

---

## Suggested Build Order

Phases ordered by dependency. Each phase is independently shippable.

### Phase 1: Foundations (engine layer, no UI)
**What:**
- Create `src/engine/AlarmSession.ts` (extract shared session lifecycle)
- Light refactor `AlarmEngine.start/cleanup` to use AlarmSession
- Verify v1 still works (Quick Nap + Focus regression test)

**Why first:** This is the only existing-file modification in the engine layer. Shipping it first isolates the regression risk window. If something breaks, it's caught before any new feature work piles on top.

**Why standalone:** No new user-visible behavior. Pure refactor.

### Phase 2: Triangle sound + SegmentEngine
**What:**
- New `src/engine/sounds/triangle.ts`
- New `src/engine/SegmentState.ts` (types + validateSegmentConfig)
- New `src/engine/SegmentEngine.ts`
- New `src/hooks/useSegmentAlarm.ts`
- Unit-test SegmentEngine end-to-end with a 2-segment config (gentle + alarm)
- No UI changes yet — verifiable via a temporary dev-only button or test harness

**Depends on:** Phase 1 (AlarmSession exists)

**Why before UI:** SegmentEngine must work in isolation before any composer is built. Same discipline as v1 Phase 1 (engine before UI).

### Phase 3: Wake Easy preset + 3rd preset card
**What:**
- New `src/presets/wakeEasy.ts` (`WAKE_EASY_CONFIG` — 4×4min gentle + 1×1min alarm)
- New `src/components/SegmentTimeline.tsx`
- New `src/components/SegmentCountdown.tsx`
- New `src/hooks/useActiveAlarm.ts` (mode selector)
- Modify `src/App.tsx` to dispatch on mode
- Modify `src/components/Dashboard.tsx` to add Wake Easy preset card
- Ship: user can launch Wake Easy from dashboard, see N-segment countdown, hear gentle chimes at each 4-min boundary, alarm at the end

**Depends on:** Phase 2 (SegmentEngine works)

**Why before Custom UI:** Wake Easy is a fixed preset — it exercises the entire segment runtime path end-to-end without needing the builder UI. Demonstrates the model is correct before investing in the composer.

### Phase 4: Custom Composer UI
**What:**
- New `src/components/CustomComposer.tsx` (modal)
- New `src/components/SegmentRow.tsx`
- Modify `src/components/Dashboard.tsx` to add Custom button + modal state
- "Pre-fill from Wake Easy preset" affordance in the composer
- Ship: user can compose arbitrary segments and launch them

**Depends on:** Phase 3 (SegmentCountdown exists; the composer needs somewhere to send the user)

### Phase 5: SEO meta tags (no routing changes yet)
**What:**
- Update `index.html` `<head>` with meta description, Open Graph, Twitter card, JSON-LD SoftwareApplication schema
- Add `public/og-image.png`
- Add `public/robots.txt` (single-URL allowed)
- Note: still single-page at this point; SEO improves but landing page is still the app shell

**Depends on:** Nothing (orthogonal track — can ship before, in parallel with, or after Phase 1–4)

**Why early in the SEO track:** Meta tags are a low-risk, no-architectural-change win. Can ship same day as Phase 1's refactor if desired.

### Phase 6: Multi-page split — landing page goes live
**What:**
- Create `app/index.html` (move app shell here, update `<script src>`)
- Rewrite `index.html` as hand-authored marketing landing page (hero, screenshots, install CTA, FAQ, "Open App" link to `/Soundly/app/`)
- Modify `vite.config.ts`: `rollupOptions.input` for two entries; manifest `start_url` and `scope` set to `/Soundly/app/`; `injectManifest.globPatterns` restricted to app/
- Modify `src/sw.ts`: NavigationRoute scoped to `/Soundly/app/`; NetworkFirst for landing
- Add `public/sitemap.xml` (two URLs)
- Update `public/robots.txt` to reference sitemap
- Test: installed PWA users — does start_url update propagate? Document migration if needed.

**Depends on:** Phase 5 (meta tags pattern established) and ideally after Phase 4 (avoid mixing landing-page launch with feature churn)

**Why last:** This is the highest-risk phase — touches `vite.config.ts`, `sw.ts`, and the URL structure. Deserves its own phase boundary so a regression here doesn't block feature shipping.

### Build order summary

```
1. AlarmSession refactor             (engine, low risk)
2. SegmentEngine + triangle          (engine, additive)
3. Wake Easy preset + SegmentCountdown (UI, validates segment runtime)
4. Custom Composer modal             (UI, depends on segment countdown)
─────────────── parallel track ───────────────
5. SEO meta tags                     (build, additive — can ship anytime)
6. Multi-page split + landing page   (build, highest risk — last)
```

Phases 1–4 deliver the alarm composer track end-to-end. Phases 5–6 deliver the discoverability track. Phase 5 can ship in parallel with any of Phase 1–4. Phase 6 should ship last.

---

## Patterns to Follow

### Pattern 1: Extend by composition, not by mutation

The v2 segment behavior is added as new modules (SegmentEngine, useSegmentAlarm, SegmentCountdown) that **compose with** the existing engine via shared services (AlarmSession). The temptation to "just add segments to AlarmConfig" is rejected because it spreads conditionals through every consumer.

### Pattern 2: Shared lifecycle, separate state machines

Both engines call `startAlarmSession()` / `endAlarmSession()` for the keepalive + wake lock + visibility handling. That's the *only* code that's shared. The state machines themselves remain distinct because their semantics differ (escalating phases vs. sequential segments).

### Pattern 3: Preset = constant + dispatch

Following the v1 pattern (`QUICK_NAP_CONFIG`, `FOCUS_CONFIG`), `WAKE_EASY_CONFIG` is a single exported constant. Dashboard cards are thin: `onStart={() => alarm.start(WAKE_EASY_CONFIG)}`. No factory functions, no preset registry.

### Pattern 4: Hand-authored static HTML for the landing page

The landing page is HTML, not React. JSON-LD, meta tags, and content live in the file directly. This is the "right tool" — search crawlers want HTML, and HTML is what they get without any rendering pipeline.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Modifying AlarmConfig to support segments

**What:** Add `segments?: Segment[]` to AlarmConfig and branch on its presence.

**Why bad:** Spreads the segment-or-not branch through every consumer. Breaks the type's clarity (it now means two things). Requires updating `validateConfig`, `useAlarm.computePhaseEndsAt`, `Countdown.getPhaseDuration`, and the Dashboard preset constants — all files that have nothing to do with segments.

**Instead:** SegmentConfig is its own type. AlarmConfig stays exactly as it is.

### Anti-Pattern 2: Reusing `Countdown.tsx` for segment alarms via conditionals

**What:** Add `if (alarm.activeConfig.segments) { ... }` branches inside Countdown.tsx and ProgressRing.tsx.

**Why bad:** Same problem one layer up. The ring is hardcoded for three segments; making it dynamic for N segments is a structural change that's easier in a fresh component than retrofitted into the existing one.

**Instead:** `SegmentCountdown.tsx` and `SegmentTimeline.tsx` are new components. They share styling tokens and utility functions with Countdown but are structurally independent.

### Anti-Pattern 3: Adding React Router for one new feature

**What:** Install `react-router-dom`, route the landing/composer/countdown.

**Why bad:** This app has one screen at a time. React Router is the wrong abstraction — it adds a dependency, a learning surface, and an architectural shift to solve a problem (modal placement, page split) that's better solved with `useState` (modal) and a multi-page Vite build (landing).

**Instead:** Modal for Custom Mode (state in App), multi-page Vite for landing/app split.

### Anti-Pattern 4: Generating the landing page from React via SSG

**What:** Build the landing page as a React component and prerender it with vite-plugin-prerender or vite-react-ssg.

**Why bad:** Adds a Puppeteer/Playwright build dependency, slow CI, hydration mismatch debugging, all to render one mostly-static page. The landing page changes infrequently and has no interactive logic that benefits from React.

**Instead:** Hand-author `index.html` as HTML. Tailwind classes work in plain HTML too (just include the CSS bundle). One file, no build pipeline complications.

### Anti-Pattern 5: Forgetting to scope service worker after multi-page split

**What:** Leave `NavigationRoute` matching all paths; both landing and app navigations get the same fallback.

**Why bad:** Either the landing page becomes uncacheable (if app fallback wins) or the app becomes unreachable offline (if landing wins). Worse: deep links from email/social to `/Soundly/` could land on the wrong shell.

**Instead:** NavigationRoute uses `allowlist: [/^\/Soundly\/app\//]` so only app navigations get the SPA fallback. Landing is handled by a separate NetworkFirst route.

### Anti-Pattern 6: Allowing both engines to run simultaneously

**What:** Custom Mode start while Quick Nap countdown is active.

**Why bad:** Two AudioContexts / two keepalive loops / two wake locks fighting each other. Nondeterministic audio behavior.

**Instead:** `useActiveAlarm` mode selector enforces "one mode at a time"; UI only renders Dashboard (with start affordances) when `mode === null`. Engines themselves throw on duplicate start as a backstop.

---

## Scalability Considerations

This is still a single-device, single-session app — "scalability" here is complexity management.

| Concern | Current (v2.0) approach | If complexity grows |
|---------|-------------------------|----------------------|
| More end-sound types (bell, gong, etc.) | Add files in `src/engine/sounds/`, extend `EndSound` literal type | Stays the same — the union type pattern scales linearly |
| More preset configs | Add constants in `src/presets/` | Static constants forever; no dynamic preset registry |
| Preset persistence (user-saved customs) | Out of scope per PROJECT.md | Would require a storage layer (IndexedDB) — add a `src/storage/` module; presets become user-owned |
| Marketing pages (FAQ, blog, etc.) | One landing page | Add more entries to `rollupOptions.input` — Vite multi-page scales to dozens of pages without restructuring |
| Analytics | Out of scope per PROJECT.md | Would land in `index.html` (landing) and `app/index.html` (app) as inline snippets, kept out of React |
| Multiple simultaneous alarms | Out of scope (PROJECT.md) | Would require an alarm registry replacing the singleton engine pattern — significant rework |

---

## Sources

- `src/engine/AlarmEngine.ts` (read 2026-05-04) — confirmed state machine shape, pause/resume snapshot pattern, cleanup contract
- `src/engine/index.ts` (read 2026-05-04) — confirmed AlarmConfig export surface, validateConfig presence
- `src/hooks/useAlarm.ts` (read 2026-05-04) — confirmed hook contract (phase, isPaused, isRunning, phaseEndsAt, activeConfig, start/stop/pause/resume)
- `src/components/Countdown.tsx` (read 2026-05-04) — confirmed hardcoded three-segment ProgressRing usage and phase-duration switch
- `src/components/Dashboard.tsx` (read 2026-05-04) — confirmed preset card pattern (PresetCard with onStart callback)
- `src/sw.ts` (read 2026-05-04) — confirmed NavigationRoute bound to `/Soundly/index.html`, must rewrite for multi-page split
- `vite.config.ts` (read 2026-05-04) — confirmed `injectManifest` mode, `base: '/Soundly/'`, current single-entry config
- `index.html` (read 2026-05-04) — confirmed minimal app shell, no SEO meta currently
- `.planning/PROJECT.md` (read 2026-05-04) — confirmed v2.0 scope: composer, Wake Easy, triangle sound, SEO + landing page; out of scope: persistence, analytics
- `.planning/research/v1.0/ARCHITECTURE.md` (read 2026-05-04) — confirmed v1 architectural philosophy (engine outside React render cycle, hardware abstraction layer, anti-patterns)
- React 19 metadata hoisting behavior — MEDIUM confidence from training data; explicit `<script type="application/ld+json">` hoisting should be verified with Context7 (`mcp__context7__resolve-library-id` "react" → docs query "metadata script") before relying on it. Mitigation: put JSON-LD directly in static HTML, sidestepping the question.
- vite-plugin-pwa multi-entry behavior with `injectManifest` — MEDIUM confidence; verify `injectManifest.globPatterns`, `manifest.start_url`, `manifest.scope` interactions with Context7 before Phase 6 implementation.
