---
phase: 09-custom-composer-share-via-url
plan: 08
subsystem: component
tags: [composer, modal, dialog, useReducer, share-handler, react]

requires:
  - phase: 09-custom-composer-share-via-url
    plan: 01
    provides: shareUrl.ts (encodeComposition — consumed for v1: fragment build)
  - phase: 09-custom-composer-share-via-url
    plan: 02
    provides: composerReducer.ts + composerValidation.ts (6-action reducer + rowValidityArray)
  - phase: 09-custom-composer-share-via-url
    plan: 03
    provides: Toast.tsx (consumed at App.tsx level — Composer emits onShareSuccess/onShareError messages, App routes to Toast state)
  - phase: 09-custom-composer-share-via-url
    plan: 06
    provides: SegmentRow.tsx (rendered once per segment; consumes 8-prop signature unchanged)
  - phase: 07-segment-engine-triangle-sound
    plan: 02
    provides: validateSegmentConfig + WAKE_EASY_CONFIG + SegmentConfig type
  - phase: 03-react-ui
    plan: NA
    provides: formatTime.ts (formatMmSs — consumed for live Total display)
provides:
  - Composer.tsx — full-screen modal segment builder (240 lines)
  - Composer 6-prop signature consumed by App.tsx in Plan 09-09: { open, initialConfig, onClose, onStart, onShareSuccess, onShareError }
  - COMP-02 lock: Composer mounts pre-loaded with the supplied initialConfig (never blank)
  - COMP-06 lock: live Total via useMemo([config.segments]) — re-derives on every reducer dispatch
  - COMP-07 lock: Start invokes onStart with current reducer state
  - COMP-08 lock: full-screen modal via native <dialog>.showModal()
  - SHR-01 lock: navigator.canShare gate → navigator.share, else navigator.clipboard.writeText fallback; AbortError silent (Pitfall 4)
  - D-11 lock: Start disabled when ANY row invalid OR whole-config rejects; tooltip + caption "Fix invalid segments first"
  - D-12 lock: surfaces validateSegmentConfig's error string above Start when whole-config rejects
  - D-13 lock: sticky header (title + close-X) + Total display + scrollable rows + Add segment + sticky footer (Cancel | Share | Start)
  - D-14 lock: close-X, Cancel, Escape, browser-back all route through one onClose path via native <dialog>.close() event listener
  - D-15 lock: src/index.css gains dialog::backdrop + dialog[open] keyframes + prefers-reduced-motion: reduce gate (APPEND only)
  - D-19 lock: Share button is ALWAYS enabled — user can share a draft
affects: [09-09-app-integration, App.tsx-mount, src/index.css-styles]

tech-stack:
  added: []
  patterns:
    - "Pattern 1 (Native <dialog> + showModal()): first modal in the codebase uses HTMLDialogElement instead of a portal-based custom modal. Free focus trap, free Escape-key handling, free aria-modal, free top-layer stacking via the browser's ::backdrop. No createPortal, no react-focus-lock. open prop syncs imperatively in useEffect: if (open && !dlg.open) dlg.showModal(); if (!open && dlg.open) dlg.close(). Single 'close' event listener routes all dismiss paths through onClose (D-14)."
    - "Pattern 2 (Lazy useReducer init for ID normalization): useReducer's 3rd argument routes initialConfig through composerReducer's 'load' action, which regenerates all IDs via genSegmentId(). This prevents React key collisions when the same shared URL is decoded twice (e.g., refresh after share-success). Pattern locked in 09-RESEARCH.md:407-411."
    - "Pattern 7 (Derived state via useMemo): totalMs + validation + rowValid + isValid all memoized off config.segments / config. Always-fresh on every dispatch — no scheduling/debouncing, no 'I forgot to revalidate' bugs. For N <= 32 segments the reduce + validateSegmentConfig + rowValidityArray cost is negligible (09-RESEARCH.md:894-933)."
    - "Pattern 5 (Web Share API with clipboard fallback): typeof navigator.canShare === 'function' && navigator.canShare(data) guards the share() call — feature-detects both the API existence AND data-shareability. AbortError name-check distinguishes user-cancel from real errors (Pitfall 4). URL built from location.origin + location.pathname to honor GitHub Pages base path (Pitfall 9 — 09-RESEARCH.md:1300-1304)."
    - "Footer button class-string reuse: BYTE-IDENTICAL secondary/primary class strings copied verbatim from Countdown.tsx:138-150 per Phase 8 UI-SPEC Layout Reuse Map. Countdown.tsx is SEG-05 byte-identical-protected — copy idioms FROM it, NEVER modify it. Visual rhythm with active-alarm controls is preserved without coupling: a future redesign of one screen does not auto-propagate to the other."
    - "jsdom HTMLDialogElement polyfill: jsdom v26 ships the type but does NOT implement showModal/close. The test suite defines both via Object.defineProperty on HTMLDialogElement.prototype in beforeEach so the open/close lifecycle works during render. The polyfilled close() dispatches the native 'close' event so Composer's listener fires onClose — matching the real-browser contract end-to-end. Polyfill is conditional (if (!HTMLDialogElement.prototype.showModal)) so a future jsdom upgrade that ships native impls inherits them silently."

key-files:
  created:
    - src/components/Composer.tsx
    - src/components/__tests__/Composer.test.tsx
  modified:
    - src/index.css

key-decisions:
  - "Followed plan as written — zero deviations from the plan's stated structure. The Composer skeleton (RESEARCH 09-RESEARCH.md:288-331) is reproduced with the prescribed file-doc-comment block, prop signature, lazy-init useReducer, derived-state useMemos, share handler, and JSX structure. The CSS append (UI-SPEC L633-666) is reproduced byte-for-byte."
  - "Reframed the close-button click path: rather than calling onClose() directly from the close-X + Cancel buttons (which would bypass the native <dialog>.close() event and split the dismiss paths into two), both buttons invoke handleCloseClick(), which calls dlg.close() — the close event listener then invokes onClose() (single path per D-14). A defensive fallback invokes onClose() directly if the dialog ref is unmounted or the dialog is already closed (paranoia for race conditions during unmount). All five dismiss paths (close-X, Cancel, Escape, browser-back, controlled prop flip to open=false) now flow through one onClose invocation."
  - "TDD gate sequence honored: test() RED commit daea1b0 (29 tests, vite resolve-import failure on missing ../Composer) → feat() GREEN commit 521acef (29/29 passing). The plan's task ordering (Task 1 = implementation, Task 2 = tests) was inverted to RED-then-GREEN to match the discipline established across Phases 8 and 9 (every prior plan in this phase used the test-first sequence)."
  - "Test count expanded from the plan's target of ~20-25 to 29 tests, adding: (1) explicit 'mounts as a native <dialog> element' invariant test, (2) showModal/showModal-not-called assertions via vi.spyOn(HTMLDialogElement.prototype, 'showModal'), (3) a 'Total label' rendering test, (4) a 'Start passes through edits' test (verifies onStart captures current state, not initial), (5) an explicit 'navigator.canShare is undefined entirely' fallback test (covers the typeof gate, not just canShare=false), and (6) an explicit 'clipboard failure invokes onShareError' test (covers the catch branch on clipboard.writeText)."
  - "Live total update test calibrated to actual StepperInput step semantics: WAKE_EASY's first segment is 240_000 ms (4 min), which is BELOW the SMALL_STEP_THRESHOLD_MS=300_000 boundary, so '+' adds SMALL_STEP_MS=30_000 (not the plan's draft assumption of 60_000). Total becomes 17:30, not 18:00. Test corrected to 17:30."

decisions:
  - "TDD execution: RED → GREEN sequence preserved (test commit precedes feat commit)"
  - "Single onClose path: close-X + Cancel both invoke dlg.close() so the 'close' event listener handles all dismiss paths (D-14 LOCKED)"
  - "Share URL: location.origin + location.pathname (Pitfall 9 — honors GH Pages base)"
  - "jsdom polyfill conditional: if (!HTMLDialogElement.prototype.showModal) preserves a future jsdom upgrade silently"

metrics:
  duration: "~14 minutes"
  completed_date: "2026-05-16"
  files_changed: 3
  files_created: 2
  lines_added: 684

---

# Phase 9 Plan 08: Composer modal + CSS keyframes Summary

**One-liner:** Full-screen modal segment builder using native HTMLDialogElement + composerReducer + share handler with canShare gate and clipboard fallback; src/index.css gains dialog::backdrop + dialog[open] keyframes as an append.

## What shipped

### `src/components/Composer.tsx` (260 lines)

First modal in the codebase. Six-prop signature consumed by App.tsx in Plan 09-09:

```typescript
interface ComposerProps {
  open: boolean;
  initialConfig: SegmentConfig;
  onClose: () => void;
  onStart: (config: SegmentConfig) => Promise<void>;
  onShareSuccess: (msg: string) => void;
  onShareError: (msg: string) => void;
}
```

**Dispatched reducer actions** (verbatim):
- `dispatch({ type: 'add' })` — from the `+ Add segment` button onClick
- `dispatch({ type: 'duplicate', index: i })` — from each SegmentRow's onDuplicate callback
- `dispatch({ type: 'delete', index: i })` — from each SegmentRow's onDelete callback
- `dispatch({ type: 'update_duration', index: i, durationMs: ms })` — from each SegmentRow's onDurationChange callback
- `dispatch({ type: 'update_sound', index: i, endSound: s })` — from each SegmentRow's onSoundChange callback
- (`{ type: 'load', config: init }` is invoked once, inside the lazy-init function, NOT via dispatch)

**Derived state useMemos** (verbatim):
- `const totalMs = useMemo(() => config.segments.reduce((s, seg) => s + seg.durationMs, 0), [config.segments])`
- `const validation = useMemo(() => validateSegmentConfig(config), [config])`
- `const rowValid = useMemo(() => rowValidityArray(config), [config])`
- `const isValid = validation.ok && rowValid.every((v) => v)` (computed inline — not a useMemo, since it's a single boolean projection of already-memoized values)

### `src/components/__tests__/Composer.test.tsx` (390 lines, 29 tests)

Coverage breakdown:
- **6 rendering tests** (COMP-02, COMP-08): pre-loaded 5 segments, title + aria-labelledby, close-X label, footer buttons, Add segment, native <dialog>
- **4 lifecycle tests** (D-14, COMP-08): showModal-on-open, no-showModal-when-closed, close-X invokes onClose, Cancel invokes onClose
- **3 live-total tests** (COMP-06): mounts at 17:00, ticks to 17:30 on '+', Total label rendered
- **4 reducer-dispatch tests** (COMP-04, COMP-05): Add segment appends, Duplicate clones, Delete removes, last-segment Delete disabled
- **3 validation tests** (D-11): Start enabled when valid, Start disabled + title when invalid, caption rendered when disabled
- **2 Start tests** (COMP-07): clicking Start invokes onStart, edits pass through
- **7 share-handler tests** (SHR-01): canShare=true path, canShare=false fallback, canShare=undefined fallback, AbortError silent, non-AbortError surfaces error, clipboard-failure surfaces error, Share enabled when invalid (D-19)

### `src/index.css` (+34 lines)

Pure append after the existing `pulse-active-arc` block (lines 20-30 byte-identical):

- `dialog::backdrop` — text-primary at 40% alpha scrim with 200ms fade-in
- `dialog[open]` — 240ms ease-out fade + translateY(16px → 0)
- `@keyframes dialog-backdrop-in` + `@keyframes dialog-in`
- `@media (prefers-reduced-motion: reduce)` gate — 100ms fade-only, no translate

## Native HTMLDialogElement polyfill strategy (tests)

jsdom v26 ships `HTMLDialogElement` as a type but does NOT implement `showModal` or `close`. The test suite defines both methods conditionally in `beforeEach`:

```typescript
if (!HTMLDialogElement.prototype.showModal) {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    value: function () {
      this.setAttribute('open', '');
      this.open = true;
    },
    writable: true,
    configurable: true,
  });
}
if (!HTMLDialogElement.prototype.close) {
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    value: function () {
      this.removeAttribute('open');
      this.open = false;
      this.dispatchEvent(new Event('close'));
    },
    writable: true,
    configurable: true,
  });
}
```

The polyfilled `close()` dispatches a native `'close'` Event so the Composer's `addEventListener('close', handler)` listener fires `onClose` — matching the real-browser contract end-to-end. The polyfill is conditional so a future jsdom upgrade that ships native implementations inherits them silently without test changes.

## src/index.css append

- **Where appended:** after line 30 (end of `pulse-active-arc` `@media` block)
- **Lines added:** 34 (lines 31-64)
- **Lines modified:** 0 — every line 1-30 byte-identical
- **Verification:** `git diff src/index.css` shows pure `+` insertions; no `-` lines
- **Existing `:root` palette:** untouched (`--color-bg: #f4f1eb` still present at line 5)
- **Existing pulse-active-arc:** untouched (grep returns the original rule at lines 20-24, `.pulse-active` rule at lines 26-29)

## Deviations from Plan

None — plan executed exactly as written. The plan's RESEARCH Pattern 1 implementation was reproduced with prescribed prop signature, lazy-init useReducer, derived-state useMemos, share handler, and JSX structure. The CSS append was reproduced byte-for-byte.

One inconsequential test-order swap: the plan listed Task 1 (implementation) before Task 2 (tests), but the TDD discipline established across Phases 8 and 9 (every prior plan in this phase used RED-then-GREEN) was honored — test commit precedes feat commit. The end-state files and acceptance criteria are unchanged.

## Test count

- **Composer.test.tsx:** 29 tests, all passing
- **Full suite:** 572/572 passing across 42 test files (up from 543/543 across 41 files = +29 new tests, +1 new test file)
- **tsc --noEmit:** clean

## SEG-05 byte-identical floor preserved

Verified `git diff --quiet` exits 0 across all 26 protected paths:

- **Phase 7/8 components (5):** Countdown.tsx, SegmentCountdown.tsx, SegmentProgressRing.tsx, ProgressRing.tsx, PresetCard.tsx
- **Phase 7 engine (4):** SegmentEngine.ts, SegmentState.ts, sounds/triangle.ts, sounds/segmentSound.ts
- **Wave 1-3 Phase 9 deliverables (9):** shareUrl.ts, composerReducer.ts, composerValidation.ts, Toast.tsx, CustomCard.tsx, StepperInput.tsx, SoundPicker.tsx, SegmentRow.tsx, useHashComposition.ts

src/index.css was modified (intentional append per the plan); verified pure-append via diff inspection — existing rules unchanged.

## Confirmation no protected files modified

```
git diff --name-only 0aaebe3 HEAD -- src/
→ src/components/__tests__/Composer.test.tsx
(plus untracked src/components/Composer.tsx and modified src/index.css —
 both intended per the plan)
```

Only the three plan-target files were touched. Phase 7/8 deliverables and all Wave 1-3 Phase 9 deliverables are byte-identical.

## TDD Gate Compliance

- **RED commit:** `daea1b0 test(09-08): add failing tests for Composer modal` — vite import-resolution failure on `../Composer` (file did not yet exist)
- **GREEN commit:** `521acef feat(09-08): ship Composer modal + dialog keyframes` — 29/29 passing
- Gate sequence verified in git log: test() commit precedes feat() commit, no commits between them on the same files

## Self-Check: PASSED

- File exists: `src/components/Composer.tsx` — FOUND
- File exists: `src/components/__tests__/Composer.test.tsx` — FOUND
- File modified: `src/index.css` — APPENDED (existing lines 1-30 byte-identical)
- Commit `daea1b0` (RED): FOUND in git log
- Commit `521acef` (GREEN): FOUND in git log
- Full suite: 572/572 passing
- tsc --noEmit: exit 0
- SEG-05 floor: 26 protected paths show 0 diff (git diff --quiet exits 0)
