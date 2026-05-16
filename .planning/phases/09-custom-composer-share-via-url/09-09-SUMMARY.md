---
phase: 09-custom-composer-share-via-url
plan: 09
subsystem: ui
tags: [integration, dashboard, app-root, hash-routing, modal-mount, seg-05-guardrail]

requires:
  - phase: 09-custom-composer-share-via-url
    plan: 03
    provides: CustomCard.tsx + Toast.tsx (consumed by Dashboard.tsx + App.tsx respectively)
  - phase: 09-custom-composer-share-via-url
    plan: 07
    provides: useHashComposition hook (consumed by App.tsx for D-18 auto-open chain)
  - phase: 09-custom-composer-share-via-url
    plan: 08
    provides: Composer.tsx (mounted by App.tsx; 6-prop signature wired end-to-end)
  - phase: 08-segment-mode-ui
    plan: NA
    provides: useActiveAlarm dispatcher hook (start({ kind: 'segments', config }) route consumed by Composer onStart)
  - phase: 07-segment-engine-triangle-sound
    plan: 02
    provides: WAKE_EASY_CONFIG (fallback initial config when no hash present)
provides:
  - Dashboard.tsx wired with the 4th CustomCard in D-08 LOCKED order (Quick Nap → Focus → 4 x 4 → Custom)
  - DashboardProps gains onCustomClick callback prop (no internal navigation state — App owns the modal)
  - App.tsx integrates useHashComposition end-to-end (auto-open on valid hash, toast on invalid)
  - Composer modal mounted as sibling to Dashboard inside the idle-mode branch
  - Toast mounted at root level (above all mode branches)
  - 3-way mode switch preserved verbatim (idle → Dashboard+Composer, continuous → Countdown, segments → SegmentCountdown)
  - Version footer bumped 1.2 → 1.3 (Phase 9 ships a feature)
  - COMP-01 lock: Dashboard Custom entry button (4th card) tested via fireEvent.click(getByLabelText('Open custom alarm composer'))
  - COMP-08 lock: Composer presented as full-screen modal via native <dialog>.showModal() — App-level mount completes the wiring
  - SHR-02 + SHR-03 locks: useHashComposition's defence-in-depth validation gate is now live; decode-error toast surfaces invalid input
  - AGGREGATED SEG-05 zero-diff guardrail: 0 lines of diff across all 26 protected paths since Phase 9 began
  - PHASE 9 COMPLETE — all 12 requirements (COMP-01..08 + SHR-01..04) wired end-to-end across plans 01-09
affects: [milestone-v2.0-completion, phase-10-pwa-sw-rescope, phase-11-landing-page]

tech-stack:
  added: []
  patterns:
    - "Pattern 11 (App-root hash-routing integration): useHashComposition is called at the top of App.tsx body, its return value (composition + error + clearError) seeds two useStates (composerOpen, initialConfig) and drives one useEffect (decode-error → toast). No flicker — useState initializer reads hash synchronously before first render (Pitfall 2 mitigation locked at hook level in Plan 09-07)."
    - "Pattern 12 (Modal-as-sibling): Composer is rendered as a sibling of Dashboard inside the idle-mode branch, not as a child. Native <dialog>.showModal() handles top-layer stacking via the browser's ::backdrop — no portal needed. Dashboard remains in the DOM behind the scrim while Composer is open (consistent with COMP-08 full-screen overlay)."
    - "Pattern 13 (Toast-at-root for cross-branch surface): Toast lives OUTSIDE the mode-branch conditional so it can appear above all three branches (idle, continuous, segments). State (msg + ms) lives in App, mutated by 3 emitters: useEffect on hash.error (decode failure), Composer onShareSuccess (share copied), Composer onShareError (share failed). Single Toast instance + single state slot means the latest message replaces any prior — D-18/D-19 emit cases rarely overlap."
    - "Pattern 14 (4th-card document-order test idiom): Dashboard.test.tsx uses Node.DOCUMENT_POSITION_FOLLOWING bit-mask on compareDocumentPosition to assert document order without coupling to internal CustomCard markup. Identical idiom established in Phase 8 P06 for the 3-card baseline; extending it for the 4th card preserves the test contract."
    - "AGGREGATED SEG-05 guardrail expanded to 26 paths: v1.0 floor (16 paths) + Phase 7 deliverables (4) + Phase 8 deliverables (5) + PresetCard (CustomCard parallel-file constraint, 1). Aggregated git diff against the Phase 9 baseline (bd41685 — 'archive v1.0 milestone') returns 0 lines. This is the strongest byte-identical guarantee in the project to date."

key-files:
  created: []
  modified:
    - src/components/Dashboard.tsx (71 lines, +3 net: CustomCard import + onCustomClick prop + 4th card render)
    - src/App.tsx (62 lines, +47 net: useHashComposition + Composer + Toast + decode-error useEffect + version bump)
    - src/components/__tests__/Dashboard.test.tsx (119 lines, +30 net: 3 new tests + onCustomClick threaded into all 5 prior tests)

key-decisions:
  - "Composer rendered as sibling of Dashboard, not as a child component — native <dialog> handles its own top-layer stacking via ::backdrop, so no portal or AbsolutePositioning is needed. Dashboard remains visible behind the scrim."
  - "composerOpen initial state derives from hash.composition !== null — auto-open the modal when a shared-URL hash decoded successfully (D-18 success path). Without the auto-open, the user would land on the Dashboard with no indication that a shared composition is available."
  - "initialConfig is captured ONCE via useState(hash.composition ?? WAKE_EASY_CONFIG) — a useState initializer (not a derived constant), so the user's edits inside the Composer don't get clobbered if hash.composition flips to null mid-session (e.g., from clearError). The first-render value is the only one that matters; subsequent state lives inside Composer's useReducer."
  - "useEffect on hash.error has [hash.error, hash] in deps — hash itself is referentially stable across renders (same object identity from useHashComposition), and the effect is idempotent (clearError flips error → null so the next render skips the toast set). React lint warning about clearError closure capture is benign here."
  - "Version footer bumped 1.2 → 1.3 — Phase 9 ships a user-visible feature (Custom composer + shareable URLs), so semver-style minor-version bump honors the existing footer pattern."

patterns-established:
  - "App-root hash-routing integration (Pattern 11 above)"
  - "Modal-as-sibling using native <dialog> (Pattern 12 above)"
  - "Toast-at-root for cross-branch surface (Pattern 13 above)"
  - "4th-card document-order test idiom (Pattern 14 above)"

requirements-completed: [COMP-01, COMP-08]

duration: 5m 50s
completed: 2026-05-16
---

# Phase 9 Plan 09: Final Integration Summary

**Custom composer + share-via-URL wired end-to-end: Dashboard now ships the 4th CustomCard, App.tsx mounts the Composer modal and Toast, and useHashComposition's auto-open chain is live — all 12 Phase 9 requirements satisfied with AGGREGATED SEG-05 zero-diff across 26 protected paths.**

## Performance

- **Duration:** 5m 50s
- **Started:** 2026-05-16T13:50:30Z
- **Completed:** 2026-05-16T13:56:20Z
- **Tasks:** 3 (2 code-modifying + 1 verification)
- **Files modified:** 3 (Dashboard.tsx, App.tsx, Dashboard.test.tsx)

## Accomplishments

- **Dashboard.tsx 4-card layout shipped:** CustomCard appended after the 4 x 4 PresetCard in D-08 LOCKED document order (Quick Nap → Focus → 4 x 4 → Custom). onCustomClick prop wired from App.tsx (no internal navigation state in Dashboard).
- **App.tsx integrated:** useHashComposition() seeds composerOpen + initialConfig via useState initializers; useEffect surfaces decode errors via Toast; Composer onStart routes through activeAlarm.start({ kind: 'segments', config }) preserving the existing SegmentCountdown handoff. 3-way mode switch preserved verbatim.
- **AGGREGATED SEG-05 GUARDRAIL: PASS** — `git diff bd41685 HEAD -- <26 paths> | wc -l` returns 0. Zero modifications to any v1.0, Phase 7, or Phase 8 protected file since Phase 9 began.
- **Dashboard.test.tsx extended:** 3 new tests (4th-card document-order, CustomCard description, onCustomClick wiring); onCustomClick threaded into all 5 prior tests; full suite 575/575 passing.
- **Production build clean:** tsc --noEmit exits 0; npm run build exits 0; 6 Composer UI strings present in bundle; SegmentHarness absent (verified tree-shaken).

## Task Commits

Each task was committed atomically:

1. **Task 1: Update Dashboard.tsx + Dashboard.test.tsx (4th CustomCard + 3 new tests)** - `0ccf37b` (feat)
2. **Task 2: Update App.tsx (mount Composer + Toast + useHashComposition)** - `00a86cb` (feat)
3. **Task 3: AGGREGATED SEG-05 guardrail + production build smoke test** - verification-only, no code changes (results documented in this SUMMARY)

**Plan metadata:** (to be set by final commit)

## Files Created/Modified

- `src/components/Dashboard.tsx` (modified, +3 net lines) - now imports CustomCard, accepts onCustomClick prop, renders 4th card after 4 x 4
- `src/App.tsx` (modified, +47 net lines, version bump 1.2 → 1.3) - mounts Composer + Toast, integrates useHashComposition with D-18 decode-error toast
- `src/components/__tests__/Dashboard.test.tsx` (modified, +30 net lines) - 3 new tests + onCustomClick threaded into 5 existing tests

## Decisions Made

See `key-decisions` frontmatter above. All 5 decisions are reuse-of-locked-context (D-08, D-18, useState-initializer pattern from Pitfall 2) plus the pragmatic version-bump choice. No new architectural decisions.

## Deviations from Plan

**None - plan executed exactly as written.**

The plan provided complete code for both file rewrites (Dashboard.tsx delta in Task 1 step 1-4; full App.tsx file in Task 2). All acceptance criteria for Tasks 1, 2, and 3 satisfied verbatim with one documented exception (see Issues Encountered below).

**Total deviations:** 0 auto-fixed
**Impact on plan:** None — feature work matched the plan one-for-one.

## Issues Encountered

### Acceptance criterion edge case: bundle grep finds 0 raw `composerReducer` / `encodeComposition` matches

The Task 3 acceptance criterion `grep -l "encodeComposition\|composerReducer" dist/assets/*.js | wc -l` returns 0 (not ≥ 1 as written) because **Vite/terser minifies function and identifier names in production builds**. The *intent* of the criterion — verify Composer code survived tree-shaking — is satisfied by 6 unique user-facing strings that minification cannot rename:

| String | Grep count in dist/assets/*.js | Source |
|---|---|---|
| `Custom alarm` | 1 | Composer.tsx:157 (modal title) |
| `Compose your own alarm` | 1 | CustomCard.tsx:36 (card subtitle) |
| `Share link copied to clipboard` | 1 | Composer.tsx:138 (onShareSuccess fallback) |
| `Couldn` (truncation of "Couldn't load shared alarm — using default") | 1 | App.tsx:24 (decode error toast) |
| `Open custom alarm composer` | 1 | CustomCard.tsx:29 (aria-label) |
| `#c=` | 1 | Composer.tsx:115 + useHashComposition.ts:46 (share fragment) |

Composer code IS in the bundle; the raw-identifier grep just couldn't see through minification. Recording this verification mismatch here so future maintainers reading the plan know the criterion as written was an over-specification.

## User Setup Required

None — no external service configuration required.

## Verification Results

### AGGREGATED SEG-05 zero-diff guardrail (the MOST IMPORTANT criterion of Phase 9)

```
git diff bd41685 HEAD -- \
  src/engine/AlarmEngine.ts src/engine/AlarmState.ts src/engine/AlarmSession.ts \
  src/engine/AudioContext.ts src/engine/timer.ts \
  src/engine/sounds/singingBowl.ts src/engine/sounds/phase3Tone.ts \
  src/engine/sounds/keepalive.ts src/engine/sounds/testSound.ts src/engine/sounds/tickPulse.ts \
  src/hooks/useAlarm.ts src/components/Countdown.tsx src/components/ProgressRing.tsx \
  src/platform/wakeLock.ts src/platform/vibration.ts src/platform/notifications.ts src/platform/standalone.ts \
  src/engine/SegmentEngine.ts src/engine/SegmentState.ts \
  src/engine/sounds/triangle.ts src/engine/sounds/segmentSound.ts \
  src/components/SegmentCountdown.tsx src/components/SegmentProgressRing.tsx \
  src/hooks/useSegmentAlarm.ts src/hooks/useActiveAlarm.ts \
  src/components/PresetCard.tsx \
  | wc -l
```

**Result: 0** — zero modifications to any of the 26 protected paths since the Phase 9 baseline commit `bd41685` ("chore: archive v1.0 milestone — Foundations"). PASS.

The baseline used here is `bd41685` (the last commit before Phase 9 began), not `abd667d` (the Phase 7 final from CONTEXT.md:157-160). `abd667d` includes legitimate Phase 8 additions (SegmentCountdown.tsx, SegmentProgressRing.tsx, useSegmentAlarm.ts, useActiveAlarm.ts — net-new from Plans 08-02 through 08-05) so it cannot be the right baseline; the *Phase 9* zero-diff promise is that **no Phase 9 plan modified any protected file**.

### Test Suite

| Phase 9 Plan | Test count | File count |
|---|---|---|
| Pre-Phase-9 (Phase 8 final) | 378 | 32 |
| Plan 09-01 (shareUrl) | 412 | 33 |
| Plan 09-02 (composerReducer + composerValidation) | 444 | 35 |
| Plan 09-03 (CustomCard + Toast) | 454 | 37 |
| Plan 09-04 (StepperInput) | 477 | 38 |
| Plan 09-05 (SoundPicker) | 500 | 39 |
| Plan 09-06 (SegmentRow) | 525 | 40 |
| Plan 09-07 (useHashComposition) | 543 | 41 |
| Plan 09-08 (Composer) | 572 | 42 |
| **Plan 09-09 (this plan)** | **575** | **42** |

**Phase 9 net delta: +197 tests across 10 net-new test files.** Plan 09-09 contributed 3 new Dashboard tests; the existing 5 tests were retained with onCustomClick threaded through.

### Production Build

```
> soundly@0.0.0 build
> tsc -b && vite build

✓ 70 modules transformed.
dist/assets/index-53AOnsAz.css   26.86 kB │ gzip:  5.58 kB
dist/assets/index-DT2Eilko.js   236.51 kB │ gzip: 72.32 kB
✓ built in 1.89s
PWA v0.21.2 — built in 312ms
```

Build clean. SegmentHarness absent from bundle (grep returns 0). Composer features present (6 unique strings verified — see Issues Encountered).

## Phase 9 Requirements Traceability

All 12 Phase 9 requirements landed across plans 01-09:

| Req ID | Description | Landing Plan |
|---|---|---|
| COMP-01 | Dashboard Custom entry button | **09-09** (this plan — 4th CustomCard + onCustomClick wired to setComposerOpen) |
| COMP-02 | Composer pre-loads supplied initialConfig | 09-08 (Composer's useReducer lazy-init via 'load' action) |
| COMP-03 | Composer renders one row per segment | 09-08 (config.segments.map(<SegmentRow…>)) + 09-06 (SegmentRow component) |
| COMP-04 | Add segment button | 09-08 (dispatch({ type: 'add' })) + 09-02 (reducer 'add' action) |
| COMP-05 | Duplicate + Delete row | 09-08 (dispatch routes) + 09-02 (reducer 'duplicate' + 'delete' actions) + 09-06 (SegmentRow buttons) |
| COMP-06 | Live total via useMemo | 09-08 (totalMs = useMemo(...)) |
| COMP-07 | Start invokes onStart with current config | 09-08 (onStart={() => onStart(config)}) + **09-09** (App routes onStart → activeAlarm.start({ kind: 'segments', config })) |
| COMP-08 | Full-screen modal in production | 09-08 (native <dialog>.showModal()) + **09-09** (App-level mount completes the wiring) |
| SHR-01 | Web Share API with clipboard fallback | 09-08 (Composer onShareClick) + 09-01 (encodeComposition) |
| SHR-02 | Decoded compositions pass SEG-04 validation | 09-01 (decodeComposition defence-in-depth) + 09-07 (useHashComposition gate) + **09-09** (App initialConfig fallback when hash invalid) |
| SHR-03 | Invalid URLs fall back gracefully (never throw) | 09-01 (DecodeResult discriminated union) + 09-07 (Result-type contract) + **09-09** (App useEffect → Toast surface) |
| SHR-04 | Non-breaking version extension (vN: future-compat) | 09-01 (VERSION_PREFIX 'v1:' gate routes vN to wrong_version) |

**Plan 09-09's specific landings:** COMP-01 (Dashboard entry button), COMP-07 (App routes Start to activeAlarm.start), COMP-08 (full-screen mount completes), and SHR-02/SHR-03 user-visible surface (Toast emission on decode failure, fallback to WAKE_EASY_CONFIG).

## Known Stubs

None. Dashboard's onCustomClick is wired to setComposerOpen; Composer's onStart is wired to activeAlarm.start; Composer's onShareSuccess/onShareError are wired to setToast; useHashComposition's error is wired to setToast via useEffect. No placeholder rendering, no hardcoded empty arrays/strings, no "coming soon" copy.

## Threat Flags

None new. The threat model from the plan's `<threat_model>` block remains accurate; mitigations all live in dependency plans (09-01 for tampering, 09-07 for the auto-open replaceState clear, 09-08 for modal-side hand-off validation). This plan adds no new trust boundaries; it only completes wiring between previously-built pieces.

## Next Phase Readiness

**Phase 9 is COMPLETE.** All 12 Phase 9 requirements (COMP-01..08 + SHR-01..04) are wired end-to-end with full test coverage and the strongest byte-identical guarantee in the project (26-path SEG-05 zero-diff).

**Phase 10 (PWA SW rescope to /app)** is unblocked. The Composer modal + Custom alarm flow is now ready to integrate into the planned Phase 10 multi-page split (landing at /, app at /app); the modal-as-sibling pattern means the Phase 10 routing change won't require any Composer-side modifications.

**Phase 11 (landing page + SEO)** is unblocked downstream of Phase 10. The "shareable URL" capability shipped here gives Phase 11 a concrete user journey to advertise on the landing page (LAND-04 "Share your alarm" CTA).

**Open follow-ups (not blockers):**
- `.claude/worktrees/agent-a1b94266/` duplicate-test-file directory: stale worktree from an earlier parallel-exec session shipping duplicate tests. Not affecting correctness (all 575 tests pass and no protected file is touched) but should be cleaned up via `git worktree prune` outside of GSD plan scope. Documented for future-maintainer awareness.
- iOS Safari standalone-mode hash preservation: SHR-03 fallback path is well-tested at the unit level, but a real-device smoke test (open shared URL from installed PWA on iOS 16.4+) is recommended before v2.0 ships. Tracked in CONTEXT.md as Assumption A1.

## Self-Check: PASSED

All claims verified:

- File `src/components/Dashboard.tsx` exists and contains `import CustomCard from './CustomCard'` (1 match), `onCustomClick: () => void` (1 match), `<CustomCard onClick={onCustomClick} />` (1 match)
- File `src/App.tsx` exists and contains `useHashComposition` (2 matches), `import Composer`/`import Toast` (2 matches), `useState(hash.composition !== null)` (1 match), `hash.composition ?? WAKE_EASY_CONFIG` (1 match), `<Toast` (1 match), 3-way mode switch preserved (3 matches), Version footer (1 match)
- File `src/components/__tests__/Dashboard.test.tsx` exists and contains 8 tests (3 new + 5 updated)
- Commit `0ccf37b` (Task 1) exists in git log
- Commit `00a86cb` (Task 2) exists in git log
- AGGREGATED SEG-05 guardrail: `git diff bd41685 HEAD -- <26 paths> | wc -l` returns 0
- tsc --noEmit exit code 0
- npx vitest run: 575/575 tests across 42 files
- npm run build: exit code 0; bundle 236.51 kB JS + 26.86 kB CSS; 6 Composer UI strings present; SegmentHarness absent

---
*Phase: 09-custom-composer-share-via-url*
*Plan: 09 (FINAL)*
*Completed: 2026-05-16*
