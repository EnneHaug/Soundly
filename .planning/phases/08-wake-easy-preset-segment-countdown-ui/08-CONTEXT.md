# Phase 8: Wake Easy Preset + Segment Countdown UI - Context

**Gathered:** 2026-05-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Put the Phase 7 SegmentEngine in front of real users for the first time via:
1. A new "4 x 4" preset card (internally still called Wake Easy) on the Dashboard
2. A new `SegmentCountdown` component with a duration-proportional N-arc ring
3. A new `useSegmentAlarm` hook (paired with `useAlarm`)
4. A new `useActiveAlarm` mode selector that dispatches via discriminated union
5. Removal of the dev-only `SegmentHarness.tsx` (per Phase 7 D-14 — superseded by `SegmentCountdown`)

No new audio. No composer modal. No share-via-URL. No segment editing. The user can only launch the fixed Wake Easy preset and watch it run.

**In scope:**
- New `src/components/SegmentCountdown.tsx` — segment-mode countdown UI
- New `src/components/SegmentProgressRing.tsx` — N-arc ring (duration-proportional, color by endSound) — extracted from refactor of `ProgressRing.tsx` if needed, or net-new (Claude's Discretion grounded in keeping `ProgressRing.tsx` byte-identical for SEG-05)
- New `src/hooks/useSegmentAlarm.ts` — paired with `useAlarm.ts` (SEG-05 zero-diff floor preserved)
- New `src/hooks/useActiveAlarm.ts` — mode selector with discriminated-union return
- Modified `src/components/Dashboard.tsx` — adds 3rd PresetCard at the bottom (single-line addition similar to existing two cards)
- Modified `src/App.tsx` — switches from `useAlarm` direct call to `useActiveAlarm`; routes to `SegmentCountdown` vs `Countdown` based on `mode`; removes `SegmentHarness` import + mount + URL flag handling
- Removed `src/dev/SegmentHarness.tsx` (per Phase 7 D-14)
- Tests for the new components + hooks following Phase 7 patterns (Vitest fake timers + AC mock + microtask flush)

**Explicitly out of scope (SEG-05 v1 byte-identical floor):**
- Any change to `src/components/Countdown.tsx` (v1 continuous-mode UI must stay byte-identical)
- Any change to `src/components/ProgressRing.tsx` (v1 ring stays byte-identical for Quick Nap + Focus)
- Any change to `src/hooks/useAlarm.ts`
- Any change to `src/engine/AlarmEngine.ts`, `src/engine/AlarmState.ts`, `src/engine/AlarmSession.ts`, or any existing engine module
- Any change to `src/engine/SegmentEngine.ts`, `src/engine/SegmentState.ts`, or `src/engine/sounds/triangle.ts` (Phase 7 deliverables — they should be consumed unchanged)
- Composer modal (Phase 9)
- Share-via-URL hash decode (Phase 9)
- SEO meta + JSON-LD + SW autoUpdate (Phase 10)
- Marketing landing page + multi-page split (Phase 11)

</domain>

<decisions>
## Implementation Decisions

### SegmentCountdown visual

- **D-01 (LOCKED):** The progress visual is a **duration-proportional N-arc ring** matching the shape of v1's `ProgressRing` but with one arc per segment, each arc width ∝ `segment.durationMs`. Wake Easy: 4 large gentle arcs (240_000ms each, ~23.5% of ring each) + 1 small alarm arc (60_000ms, ~5.9% of ring). Composer (Phase 9) gets the same layout for arbitrary N.

- **D-02 (LOCKED):** Arc colors are assigned **by `endSound` type** using v1's existing palette tokens:
  - `gentle` → `var(--color-sage)` (matches Phase 1 in v1)
  - `triangle` → `var(--color-sand)` (matches Phase 2 in v1)
  - `alarm` → `var(--color-accent)` (matches Phase 3 in v1)
  - Same opacity/state semantics as `ProgressRing`: past = faded, current = full, future = full.

- **D-03 (LOCKED):** When SegmentEngine state transitions to `'firing-alarm'` (i.e. the alarm segment starts ramping), the ring shows the segment-5-active visual state (last arc pinned at the start of segment 5) and the **active arc subtly pulses at ~1 Hz** to signal "still firing." The center display switches from per-segment countdown to **count-up elapsed time since alarm started** (mirrors v1 `Countdown.tsx:108` phase3 behavior). The Pause button is disabled per Phase 7 D-03 (`canPause()` returns false during `'firing-alarm'`); only Stop is enabled.

- **D-04:** Pulse implementation is Claude's Discretion grounded in CSS — keyframes on opacity 0.7 ↔ 1.0 over a 1000ms ease-in-out cycle, applied via a Tailwind `animate-*` utility or a single `<style>` block scoped to the active arc element. JS-driven animation is NOT preferred (perf, simplicity).

### Time display semantics

- **D-05 (LOCKED):** During normal segment progression (non-firing-alarm states), the center of the ring shows:
  - **Big mm:ss** = time remaining in the **current segment** (until the next chime/alarm fires). Primary glance target. Resets at each segment boundary.
  - **Small caption below** = total composition time remaining (e.g. "13:42 total"). Secondary info.
  - Below the timer: phase label = a friendly description of the current segment ("Gentle chime" / "Triangle ping" / "Wake"). Mirrors v1's `PHASE_LABELS` Record at `Countdown.tsx:25-31`.

- **D-06:** Number formatting reuses v1's `formatMmSs` from `src/utils/formatTime.ts` and `font-variant-numeric: tabular-nums` for stable width — same idiom as `Countdown.tsx:118-127`.

### Active-alarm dispatch

- **D-07 (LOCKED — Claude's Discretion picked):** `useActiveAlarm()` returns a **discriminated union**:
  ```ts
  type ActiveAlarmState =
    | { mode: 'idle'; start: (preset: PresetSelection) => Promise<void> }
    | { mode: 'continuous'; alarm: UseAlarmReturn }
    | { mode: 'segments'; alarm: UseSegmentAlarmReturn };
  ```
  where `PresetSelection = { kind: 'continuous'; config: AlarmConfig } | { kind: 'segments'; config: SegmentConfig }`. App.tsx narrows on `mode` and renders `<Countdown alarm={state.alarm} />` or `<SegmentCountdown alarm={state.alarm} />`. Each child component keeps its native prop shape — no lossy adapter layer. Reasoning: TS-strict idioms, type-safe rendering, minimal divergence from existing v1 patterns, composer (Phase 9) gets a clean `start({ kind: 'segments', config })` entry point.

- **D-08:** Internally, `useActiveAlarm` mounts both `useAlarm()` and `useSegmentAlarm()` unconditionally — always-both-mounted pattern. A small string state (`activeMode: 'continuous' | 'segments' | null`) tracks which is live. When `start()` is called, it sets the mode then calls the correct underlying hook's `start()`. When the underlying hook reports `isRunning: false` (e.g. after stop/dismiss/auto-stop), `activeMode` resets to `null`. Both engines stay in memory throughout the session; only one ever calls `startAlarmSession()` at a time, so no resource conflict (single Wake Lock sentinel, single keepalive osc).

- **D-09:** `useSegmentAlarm` mirrors `useAlarm.ts:65-137` shape exactly:
  - Lazy-initialize `SegmentEngine` via `useRef`
  - Register `onSegmentChange` callback in the hook body (not `useEffect`) — last-registration-wins per Phase 7 engine API
  - State shape: `{ state: SegmentEngineState, currentSegment: { index, total, segment } | null, isPaused, isRunning, segmentEndsAt, totalEndsAt, activeConfig, alarmStartedAt }` — `alarmStartedAt` populated on `firing-alarm` transition for the count-up display per D-03
  - Methods: `start(config)`, `stop`, `pause`, `resume` (no `dismiss` exposed at hook level — Stop maps to `engine.stop()` which transitions to `'dismissed'` per Phase 7 SegmentEngine semantics)
  - Pause is silent no-op when `engine.canPause()` returns false (matches AlarmEngine.pause T-03-02 idiom + Phase 7 D-03)

### Concurrency

- **D-10 (LOCKED):** **Hide other cards while running.** Once an alarm starts (continuous OR segments), App.tsx switches to the countdown view (Countdown OR SegmentCountdown) and the Dashboard is no longer visible. Concurrency is enforced by UI: user must Stop/Dismiss before they can see other preset cards. Matches v1 Dashboard→Countdown takeover exactly. No new logic, no confirmation dialogs, no disabled-card states.

### Dashboard preset card

- **D-11 (LOCKED):** New PresetCard appears at the **bottom** of the dashboard, after Quick Nap and Focus. Order: Quick Nap → Focus → 4 x 4. Conservative ordering preserves v1 muscle memory; the new (and longest) preset sits at the bottom where users scan to it deliberately.

- **D-12 (LOCKED):** Card display label = **"4 x 4"** (note the spaces around `x`). Card description = **"4 chimes over 16 min, then alarm"**.

- **D-13 (LOCKED):** **Internal symbols keep "Wake Easy" naming.** `WAKE_EASY_CONFIG`, segment IDs (`wake-easy-1` through `wake-easy-5`), REQUIREMENTS.md SEG-06 copy, ROADMAP.md Phase 8 title, PROJECT.md milestone copy all stay as-is. Only the PresetCard's user-facing display label diverges. Rationale: avoids cascading renames into Phase 7 deliverables (constant, segment IDs, tests) and keeps the doc-trail consistent. Implementation: pass the display string as the `name` prop to `PresetCard` — it's already a free-form string parameter at `PresetCard.tsx:11-13`.

### Dashboard wiring

- **D-14:** Dashboard.tsx prop changes from `{ alarm: UseAlarmReturn }` to `{ activeAlarm: ActiveAlarmState }`. Each `onStart` handler dispatches the right `PresetSelection` shape:
  - Quick Nap → `activeAlarm.start({ kind: 'continuous', config: QUICK_NAP_CONFIG })`
  - Focus → `activeAlarm.start({ kind: 'continuous', config: FOCUS_CONFIG })`
  - 4 x 4 → `activeAlarm.start({ kind: 'segments', config: WAKE_EASY_CONFIG })`
  - Dashboard only renders when `activeAlarm.mode === 'idle'` (else App.tsx routes to a Countdown variant), so the `start` method is always available at render time.

### App.tsx routing

- **D-15:** App.tsx switches from `const alarm = useAlarm();` to `const activeAlarm = useActiveAlarm();`. Render branches on `activeAlarm.mode`:
  - `'idle'` → `<Dashboard activeAlarm={activeAlarm} />`
  - `'continuous'` → `<Countdown alarm={activeAlarm.alarm} />` (existing v1 component, **unchanged**)
  - `'segments'` → `<SegmentCountdown alarm={activeAlarm.alarm} />` (new component)
  - Removes the `SegmentHarness` import, the `showSegmentHarness` const, and the `?dev=segments` URL handling per D-17.

### SegmentHarness removal (Phase 7 D-14 follow-through)

- **D-16:** Delete `src/dev/SegmentHarness.tsx` outright. Remove the import line in `src/App.tsx`. Remove the `import.meta.env.DEV && ?dev=segments` conditional. The harness was an interim verification artifact; the production `SegmentCountdown` UI replaces it.

- **D-17:** Pre-build sanity check after removal: `grep -r "SegmentHarness" src/` returns zero matches; `npm run build` succeeds; `grep -r "SegmentHarness" dist/` returns zero matches (it was already tree-shaken in Phase 7, so this is a regression sanity check, not a new constraint).

### Notification permission timing

- **D-18:** `useSegmentAlarm.start()` calls `requestNotificationPermission()` from the user-gesture context (the PresetCard tap), mirroring `useAlarm.ts:88-99`. The notification API is the same in both modes — segment alarms can also fire system notifications when backgrounded. No new permission flow.

### Pause-state visual treatment (Claude's Discretion)

- **D-19:** When `isPaused === true`, the SegmentCountdown ring's active arc opacity drops to 0.5 (visually de-emphasized but still tracking the snapshot position). The center timer freezes at the snapshot remaining time. The Pause button text swaps to "Resume" (mirrors `Countdown.tsx:142`). No additional visual chrome — the freeze itself is the affordance.

### Test/regression strategy

- **D-20:** Tests added:
  - `src/components/__tests__/SegmentCountdown.test.tsx` — render snapshot, mm:ss tick, segment-boundary transitions (current-segment update via the engine callback), pause freeze, alarm-firing pulse + count-up, Pause disabled in firing-alarm
  - `src/components/__tests__/SegmentProgressRing.test.tsx` (if extracted as separate component) — N-arc rendering, duration-proportional widths, color by endSound, pulse class on active arc during firing
  - `src/hooks/__tests__/useSegmentAlarm.test.ts` — start/pause/resume/stop, segment-change callback wiring, snapshot semantics, alarmStartedAt populated only during firing-alarm
  - `src/hooks/__tests__/useActiveAlarm.test.ts` — mode dispatch, discriminated union narrowing, mode resets to `null` after stop, both engines mounted but only one runs
- **D-21:** v1 byte-identical regression net: existing `Countdown.test.tsx`, `useAlarm.test.ts`, `Dashboard.test.tsx` (if it exists) continue to pass without modification. Run a `git diff --name-only` guardrail against the protected paths same as Phase 7 (Plan 07-05's aggregated check is the template).

### Barrel exports / engine surface

- **D-22:** `src/engine/index.ts` does not need changes — Phase 7 already added all required exports (`SegmentEngine`, `Segment`, `SegmentConfig`, `SegmentEngineState`, `SegmentChangeEvent`, `validateSegmentConfig`, `WAKE_EASY_CONFIG`, `strikeTriangle`). Phase 8 only consumes them.

### Claude's Discretion (further)

- Whether `SegmentProgressRing` is a separate file or a refactor inside a renamed/cloned `ProgressRing` (note: `ProgressRing.tsx` MUST stay byte-identical per SEG-05 — so a new file is the only safe path).
- Exact CSS for the 1Hz pulse animation (keyframes vs Tailwind utility vs inline `style`).
- Position of the "X of N" segment-index display: above the big timer, below the timer, or beside the phase label. Recommendation: replace v1's `PHASE_LABELS[alarm.phase]` slot with `"Segment X of N — gentle chime"` or similar.
- Whether the alarm-firing count-up uses elapsed time since alarm-start (most useful) or elapsed time since segment-start (matches v1 phase3 behavior). Recommendation: alarm-start, since the alarm continues past segment-end indefinitely.
- Whether `onStart` failures from `useSegmentAlarm.start()` (config validation throws, AC bring-up rejects) propagate as React error boundaries or as in-card error state. Recommendation: simple `try/catch` in App.tsx with a transient toast or alert; doesn't need elaborate UX in this phase.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project / milestone
- `.planning/PROJECT.md` — milestone v2.0 scope; v1 byte-identical posture
- `.planning/REQUIREMENTS.md` — SEG-06 (the only Phase 8 requirement)
- `.planning/ROADMAP.md` §"Phase 8: Wake Easy Preset + Segment Countdown UI" — goal + 5 success criteria
- `.planning/STATE.md` — accumulated decisions; Phase 7 P05 SegmentHarness removal + SegmentCountdown carry-over note
- `CLAUDE.md` — stack constraints (React 19 + Vite 6 + Tailwind v4 warm earth palette + raw Web Audio API)

### Prior-phase context
- `.planning/phases/03-react-ui/03-CONTEXT.md` — UI design conventions (D-06 ProgressRing three-segment arc, D-07 large mm:ss timer, D-08 phase labels, D-09 Pause/Stop control layout, D-10 transitions, D-11 dashboard preset cards, D-12 single-tap start, D-13 minimum 80px touch target). Phase 8 SegmentCountdown matches every one of these.
- `.planning/phases/07-segment-engine-triangle-sound/07-CONTEXT.md` — SegmentEngine API surface, alarm-segment semantics (D-01 ramps from segment-START; D-02 continues until manual dismiss; D-03 pause locked while firing; D-04 auto-stop window for non-alarm-tail compositions; D-09 onSegmentChange shape; D-10 getCurrentSegment shape; D-14 SegmentHarness removed in Phase 8)

### Files consumed unchanged by Phase 8
- `src/engine/SegmentEngine.ts` — start/pause/resume/stop/dismiss + state queries + onSegmentChange callback
- `src/engine/SegmentState.ts` — types + WAKE_EASY_CONFIG + validateSegmentConfig
- `src/engine/AlarmEngine.ts` — consumed via existing `useAlarm` (which is also unchanged)
- `src/engine/index.ts` — barrel; all exports already in place
- `src/components/PresetCard.tsx` — pattern for the new "4 x 4" card; 80px touch target preserved
- `src/components/ProgressRing.tsx` — read-only reference for the new SegmentProgressRing shape
- `src/components/Countdown.tsx` — read-only reference for the SegmentCountdown layout (must stay byte-identical for v1 path)
- `src/utils/formatTime.ts` — `formatMmSs` reused for the big timer
- `src/platform/notifications.ts` — `requestNotificationPermission` reused in `useSegmentAlarm.start`

### Files protected by SEG-05 v1 byte-identical floor
- `src/engine/AlarmEngine.ts`, `src/engine/AlarmState.ts`, `src/engine/AlarmSession.ts`, `src/engine/AudioContext.ts`, `src/engine/timer.ts`
- `src/hooks/useAlarm.ts`
- `src/components/Countdown.tsx`, `src/components/ProgressRing.tsx`
- All existing files under `src/engine/sounds/*.ts` (singingBowl, phase3Tone, keepalive, testSound, tickPulse, triangle, segmentSound)
- `src/platform/wakeLock.ts`, `src/platform/vibration.ts`, `src/platform/notifications.ts`

### Files created by this phase
- `src/components/SegmentCountdown.tsx`
- `src/components/SegmentProgressRing.tsx` (separate file — `ProgressRing.tsx` is byte-identical-protected)
- `src/hooks/useSegmentAlarm.ts`
- `src/hooks/useActiveAlarm.ts`
- `src/components/__tests__/SegmentCountdown.test.tsx`
- `src/components/__tests__/SegmentProgressRing.test.tsx` (if separate component)
- `src/hooks/__tests__/useSegmentAlarm.test.ts`
- `src/hooks/__tests__/useActiveAlarm.test.ts`

### Files modified by this phase
- `src/components/Dashboard.tsx` — prop signature change + new "4 x 4" card at bottom + dispatch routing per D-14
- `src/App.tsx` — replace direct `useAlarm` with `useActiveAlarm`, branch on `mode`, remove SegmentHarness wiring per D-15/D-16

### Files deleted by this phase
- `src/dev/SegmentHarness.tsx` (per Phase 7 D-14)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets (consumed unchanged)
- `SegmentEngine` (`src/engine/SegmentEngine.ts`) — class with `start/pause/resume/stop/dismiss`, `getState()`, `getCurrentSegment()`, `canPause()`, `isPaused()`, `onSegmentChange(cb)`. Exact mirror of AlarmEngine's idioms.
- `WAKE_EASY_CONFIG` (`src/engine/SegmentState.ts:104-112`) — pre-built segment-config used by both Phase 7 harness and Phase 8 preset card. 4×240_000ms gentle + 1×60_000ms alarm = 17 min total.
- `useAlarm` (`src/hooks/useAlarm.ts`) — the analog hook to mirror for `useSegmentAlarm`. Pattern: lazy `useRef` engine init, `onPhaseChange` registered in body (not effect), `useState`-backed reactive surface, controlled methods only exposed (T-03-01).
- `PresetCard` (`src/components/PresetCard.tsx`) — already supports the 3-card layout via repeated `<PresetCard ... />` usage in Dashboard.tsx; just add a third instance.
- `Countdown.tsx` (`src/components/Countdown.tsx`) — read-only reference for SegmentCountdown layout: ProgressRing wrapper + center children + control-button row at bottom.
- `formatMmSs` (`src/utils/formatTime.ts`) — number formatting; reused in segment mode unchanged.
- `requestNotificationPermission` — same call signature as v1; reused in `useSegmentAlarm.start`.

### Established patterns
- Lazy-init engine via `useRef` (prevents re-creation on re-render, lifetime = component lifetime)
- Single-callback last-wins for engine→React state bridging (`onPhaseChange` / `onSegmentChange`)
- Controlled methods only — never expose engine ref outside hook (T-03-01 in `useAlarm.ts:8-10`)
- Tailwind v4 warm earth palette via CSS variables (`var(--color-sage)`, `var(--color-sand)`, `var(--color-accent)`, `var(--color-faded)`, `var(--color-bg)`, `var(--color-text-primary)`, `var(--color-text-secondary)`, `var(--color-border)`)
- `font-variant-numeric: tabular-nums` for stable mm:ss width during ticking
- Touch target ≥80px on tappable cards (PresetCard.tsx:20 `min-h-[80px]`)
- Conditional rendering at App.tsx top level (`showCountdown ? <Countdown /> : <Dashboard />`) — Phase 8 extends to a 3-way switch on the discriminated `mode`

### Integration points (where the diff lands)
- `Dashboard.tsx:31-42` — three `<PresetCard />` calls; the third one (4 x 4) gets added after the Focus card per D-11
- `App.tsx:1-25` — replace `useAlarm` import + call + the `showCountdown` ternary with the discriminated-union branch on `useActiveAlarm`'s `mode`. SegmentHarness import + mount + URL flag block all deleted.
- New component files mirror existing component shape (`Countdown.tsx` for `SegmentCountdown`, `ProgressRing.tsx` for `SegmentProgressRing`).

### Pre-existing v1 quirks NOT addressed in Phase 8
- `acquireWakeLock` `_sentinel` overwrite (Phase 6 deferred) — still deferred. Both engines now potentially call `acquireWakeLock`, but `useActiveAlarm` enforces single-engine-active-at-a-time, so the singleton sentinel is safe in practice.
- iOS AudioContext resume on visibility change (Phase 6 deferred) — still deferred. Phase 8 inherits this gap; segment alarms on iOS Safari behave the same as v1 alarms (best-effort, screen-must-stay-foregrounded).

</code_context>

<specifics>
## Specific Ideas

- **Dashboard card sketch (D-11, D-12):**
  ```tsx
  <PresetCard
    name="4 x 4"
    description="4 chimes over 16 min, then alarm"
    onStart={() => activeAlarm.start({ kind: 'segments', config: WAKE_EASY_CONFIG })}
  />
  ```

- **App.tsx routing sketch (D-15):**
  ```tsx
  const activeAlarm = useActiveAlarm();
  return (
    <div className="min-h-dvh bg-bg text-text-primary flex flex-col items-center">
      {activeAlarm.mode === 'idle'        && <Dashboard activeAlarm={activeAlarm} />}
      {activeAlarm.mode === 'continuous'  && <Countdown alarm={activeAlarm.alarm} />}
      {activeAlarm.mode === 'segments'    && <SegmentCountdown alarm={activeAlarm.alarm} />}
      <p className="fixed bottom-3 right-4 text-text-secondary text-xs opacity-40">Version: 1.2</p>
    </div>
  );
  ```

- **useActiveAlarm return-shape sketch (D-07):**
  ```ts
  type PresetSelection =
    | { kind: 'continuous'; config: AlarmConfig }
    | { kind: 'segments';   config: SegmentConfig };

  type ActiveAlarmState =
    | { mode: 'idle';       start: (preset: PresetSelection) => Promise<void> }
    | { mode: 'continuous'; alarm: UseAlarmReturn }
    | { mode: 'segments';   alarm: UseSegmentAlarmReturn };
  ```

- **useSegmentAlarm return-shape sketch (D-09):**
  ```ts
  interface UseSegmentAlarmReturn {
    state: SegmentEngineState;
    isPaused: boolean;
    isRunning: boolean;
    currentSegment: { index: number; total: number; segment: Segment } | null;
    /** Epoch ms when current segment ends (for segment-remaining countdown). 0 when idle/dismissed. */
    segmentEndsAt: number;
    /** Epoch ms when whole composition ends (for total-remaining caption). 0 when idle/dismissed/firing-alarm. */
    totalEndsAt: number;
    /** Epoch ms when alarm-firing started (for count-up display). 0 when not firing. */
    alarmStartedAt: number;
    activeConfig: SegmentConfig | null;
    start: (config: SegmentConfig) => Promise<void>;
    stop: () => void;
    pause: () => void;  // silent no-op when canPause() is false
    resume: () => void;
  }
  ```

- **SegmentCountdown center-display logic sketch:**
  ```tsx
  // During normal segment progression
  <span className="big">{formatMmSs(segmentRemainingMs)}</span>           // big current
  <span className="small">{formatMmSs(totalRemainingMs)} total</span>     // small total
  <span className="phase-label">Segment {idx} of {total} — {soundLabel}</span>

  // During firing-alarm
  <span className="big">{formatMmSs(elapsedSinceAlarmMs)}</span>          // count-up
  <span className="phase-label">Wake</span>
  ```

- **Arc pulse CSS sketch (D-04):**
  ```css
  @keyframes pulse-active-arc {
    0%, 100% { opacity: 1; }
    50%      { opacity: 0.7; }
  }
  /* Apply to the SVG <path> only when state === 'firing-alarm' */
  .pulse-active { animation: pulse-active-arc 1s ease-in-out infinite; }
  ```

- **Wake Easy timing sanity-check (used in test assertion budget):** at t=0 segment 1 starts; at t=4:00 segment 1 ends + chime fires + segment 2 starts; ...; at t=16:00 segment 4 ends + chime fires + segment 5 starts (which is the alarm — ramp begins immediately); at t=17:00 segment 5's nominal end (ramp at 100%); audio continues until manual Stop. The "<2s drift" SEG-02 success criterion remains the responsibility of the SegmentEngine + its dev harness verification (Phase 7 territory) — Phase 8 adds the production UI but doesn't re-verify drift.

</specifics>

<deferred>
## Deferred Ideas

- **Composer modal + Custom button** — Phase 9. Phase 8 ships the segment runtime UI for one fixed preset; users cannot edit segments yet.
- **Share-via-URL hash decode that pre-loads the composer** — Phase 9.
- **Drag-and-drop segment reorder** — out of v2.0 scope per ROADMAP.
- **Visual segment timeline preview** — Phase 9 composer concern.
- **Per-segment volume control** — Future v2.x.
- **Marketing landing page + multi-page split** — Phase 11.
- **SEO meta + JSON-LD** — Phase 10.
- **iOS AudioContext.resume() on visibilitychange** — still deferred from Phase 6/7.
- **`acquireWakeLock` `_sentinel` overwrite fix** — still deferred from Phase 6/7.
- **Renaming `WAKE_EASY_CONFIG`/segment IDs to "4 x 4"** — explicitly chosen NOT to do per D-13. The internal name and the UI label are allowed to diverge; if a future cleanup wants to consolidate, it can do so as a focused refactor without milestone implications.
- **Arc-flash on segment-end (subtle bloom on the just-completed arc)** — could enhance the chime's visual feedback but adds animation complexity; out of scope for Phase 8.

</deferred>

---

*Phase: 08-wake-easy-preset-segment-countdown-ui*
*Context gathered: 2026-05-10*
