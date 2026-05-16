---
phase: 09-custom-composer-share-via-url
plan: 03
subsystem: ui-atomic-components
tags: [toast, custom-card, atomic-component, parallel-file, tdd, aria-live, useEffect]

# Dependency graph
requires:
  - phase: 03-react-ui
    provides: PresetCard.tsx (READ-ONLY analog — class-string idioms mirrored, NEVER imported, NEVER modified) + the Tailwind palette tokens (border, bg-bg, sage, text-primary, text-secondary)
provides:
  - "CustomCard({ onClick }): JSX — the 4th Dashboard card with D-09 LOCKED visual treatment (dashed border + sage '+' glyph + 'Custom' / 'Compose your own alarm' labels)"
  - "Toast({ message, durationMs, onDismiss }): JSX | null — shared live-region notification (role='status' + aria-live='polite') with auto-dismiss via useEffect+setTimeout and cleanup on unmount/message change"
  - "Default-export idiom for both components — consistent with PresetCard.tsx, ProgressRing.tsx, Countdown.tsx"
affects:
  - 09-04 Composer.tsx — consumes Toast for share-fail + decode-error messaging (one-shot fire via setMessage('...'); setMessage(null) onDismiss)
  - 09-05 ShareButton.tsx — consumes Toast for share-success messaging (D-18 'Share link copied to clipboard' / 3s)
  - 09-09 Dashboard.tsx — mounts CustomCard as the 4th card (after Quick Nap, Focus, 4 x 4) with onClick={() => setComposerOpen(true)}

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Parallel-file pattern (RESEARCH Pattern 8) — CustomCard.tsx is a sibling of PresetCard.tsx, NOT a variant prop on PresetCard. PresetCard.tsx is treated as frozen per CONTEXT.md `canonical_refs` strong preference; cloning the shell into a sibling file (~20 lines) is cleaner than threading a `variant` prop through the existing component"
    - "Live-region one-shot toast (RESEARCH Pattern 11) — single-instance, no queue, latest message replaces prior; useEffect+setTimeout for auto-dismiss with cleanup on unmount/message change; role='status' + aria-live='polite' announces AFTER current SR utterance finishes (NOT assertive — incompatible with zen calm aesthetic)"
    - "Verbatim class-string lock-in via tests — assertions like `expect(button.className).toContain('border-2')` pin the dashed-border treatment so any future refactor that drops the dashed border fails CI; same pattern for Toast's fixed-position class string"
    - "Decorative-glyph idiom — `aria-hidden='true'` on the '+' span + explicit aria-label on the button means SR users hear 'Open custom alarm composer' (button purpose), not 'Plus, Custom, Compose your own alarm' (3 utterances for one concept)"
    - "Fake-timer test idiom for setTimeout-driven UI — vi.useFakeTimers() + vi.advanceTimersByTime() lets the auto-dismiss test run in milliseconds, not seconds; cleanup test proves the useEffect return correctly clears the pending timeout (T-09-03-02 DoS mitigation evidence)"

key-files:
  created:
    - src/components/CustomCard.tsx (41 lines)
    - src/components/Toast.tsx (45 lines)
    - src/components/__tests__/CustomCard.test.tsx (50 lines, 5 tests)
    - src/components/__tests__/Toast.test.tsx (65 lines, 5 tests)
  modified: []

key-decisions:
  - "TDD gate sequence honored TWICE — Task 1: test(09-03) RED commit 882a01d -> feat(09-03) GREEN commit 07091c9; Task 2: test(09-03) RED commit 22f0c49 -> feat(09-03) GREEN commit 389d27a. Both REDs failed on vite resolve-import (file-doesn't-exist) — the cleanest possible failure signal for atomic-component plans"
  - "No refactor phase — both impls were verbatim from 09-UI-SPEC.md (lines 194-217 for CustomCard, 484-498 for Toast). With verbatim spec inputs and immediate GREEN, refactor would only invent diff for no behavioral change"
  - "Parallel-file integrity proven post-Task-1 AND post-Task-2 — `git hash-object src/components/PresetCard.tsx` returns 4328729671d76beff93247d5a0e46c24ff56dfd5 (baseline) at both checkpoints; T-09-03-01 (Tampering: accidentally modifying PresetCard) mitigation evidence captured"
  - "Toast useEffect dependency array includes [message, durationMs, onDismiss] — onDismiss IS included so that callers passing a fresh closure each render get the latest behavior; the message-change branch correctly clears + restarts the timer via the cleanup return + re-effect on every dep change"
  - "CustomCard onClick (not onStart) — semantically distinct from PresetCard.onStart, which fires alarm.start(config). CustomCard opens a modal; the actual alarm.start happens inside the modal once the user commits. Naming preserves the verb-noun pairing (onClick=user clicked button, onStart=we are starting an alarm)"

patterns-established:
  - "Parallel-file pattern documented + verified: when a canonical component is frozen, clone the shell (~20 lines) into a sibling file rather than thread a variant prop. Test the byte-identity of the canonical with `git diff --quiet` in acceptance criteria"
  - "Live-region toast pattern: single-instance, no queue, useEffect cleanup. Future notifications in this codebase should mount a Toast at the consumer level (not a global ToastProvider) since emit-callsites are rare and explicitly user-triggered"
  - "Verbatim-class-string acceptance via .toContain() — pin a handful of distinctive tokens (border-2, border-dashed, bg-bg, fixed, bottom-8, left-1/2, -translate-x-1/2, z-50) rather than the full class string; resilient to spacing/ordering tweaks while still catching token drops"

requirements-completed: [COMP-01]

# Metrics
duration: 2m 59s
completed: 2026-05-16
---

# Phase 9 Plan 3: Toast + CustomCard Summary

**Two atomic, parallel-safe leaf components ship: `src/components/CustomCard.tsx` (the 4th Dashboard card per D-08 with dashed border + sage '+' glyph + 'Custom' / 'Compose your own alarm' labels per D-09 LOCKED) and `src/components/Toast.tsx` (shared role='status' + aria-live='polite' live-region with useEffect+setTimeout auto-dismiss). Both built TDD-first with 5 tests each (10 new tests total). Verbatim class strings from 09-UI-SPEC.md. PresetCard.tsx remains BYTE-IDENTICAL (hash 4328729671...) — parallel-file pattern preserved per CONTEXT canonical_refs strong preference. Full suite 454/454 across 37 files, tsc clean, SEG-05 zero-diff floor intact. Unblocks Wave 4 (Composer.tsx consumes Toast) and Wave 5 (Dashboard.tsx mounts CustomCard).**

## What shipped

### CustomCard.tsx (41 lines)

The 4th Dashboard card. Renders a `<button type="button">` with `aria-label="Open custom alarm composer"`. Visual deltas from PresetCard (D-09 LOCKED):

- `border-2 border-dashed border-border` (PresetCard: `border border-border`)
- `bg-bg` (PresetCard: `bg-white/60`) — creative-space surface, not preset surface
- Top-left `<span aria-hidden="true" className="text-2xl text-sage font-light leading-none mt-0.5">+</span>` glyph
- `hover:border-text-secondary/60` deepens border tone instead of scaling
- Explicit `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40` (the dashed border weakens the default browser focus ring)
- Labels are baked-in props-free strings: `<p>Custom</p>` + `<p>Compose your own alarm</p>` (only one CustomCard exists in the app)

**Prop signature** (intentionally different from PresetCard):

```typescript
interface CustomCardProps {
  onClick: () => void;  // opens composer modal (NOT onStart — no alarm starts here)
}
```

### Toast.tsx (45 lines)

Shared live-region notification. Used by ShareButton (Plan 09-05, share-success "Share link copied to clipboard" / 3s per D-18) and Composer (Plan 09-04, decode-error + share-fail / 4s per D-19).

**Prop signature:**

```typescript
interface ToastProps {
  message: string | null;  // null = component renders nothing
  durationMs: number;      // auto-dismiss delay; D-18 = 3000, D-19 = 4000
  onDismiss: () => void;   // invoked once after durationMs via setTimeout
}
```

**ARIA contract:**

- `role="status"` — landmark for assistive tech
- `aria-live="polite"` — announces AFTER current SR utterance finishes (NOT assertive, which would interrupt mid-sentence and break the zen calm aesthetic)
- `aria-atomic="true"` — whole message read on each change, not incremental diff

**WCAG 2.2.1 (Timing Adjustable):** Locked 3s / 4s timings sit below the 5s floor but qualify for the "non-essential informational" exception (no action is required to proceed; messages are pure status indicators). See 09-RESEARCH.md:1174.

**Locked Tailwind class string:** `fixed left-1/2 -translate-x-1/2 bottom-8 z-50 px-4 py-3 rounded-xl bg-text-primary/95 text-bg text-sm shadow-lg max-w-[calc(100vw-2rem)] text-center transition-opacity duration-200 opacity-100`

**Lifecycle:** `useEffect([message, durationMs, onDismiss])` schedules `setTimeout(onDismiss, durationMs)`; the cleanup return calls `clearTimeout(id)`. This handles all three transitions correctly:
- Message-change before timer fires: prior timeout cleared, new one scheduled
- Unmount before timer fires: timeout cleared (T-09-03-02 DoS mitigation)
- Message → null: cleanup runs then early-return `null` skips the next render

## Test coverage

| File                                          | Tests | Coverage focus                                                                                                      |
| --------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------- |
| src/components/__tests__/CustomCard.test.tsx  | 5     | D-09 LOCKED labels, aria-label, dashed-border class string, onClick wiring, aria-hidden='+' glyph                   |
| src/components/__tests__/Toast.test.tsx       | 5     | null-message hides, role/aria-live/aria-atomic, auto-dismiss timing (fake timers), unmount cleanup, position class  |

**Full suite after this plan:** 454/454 across 37 files (up from 444/444 across 35 files — +10 tests, +2 files).

## TDD gate sequence

Both tasks honored the RED → GREEN sequence with separate commits.

| Task | RED commit | RED outcome                                              | GREEN commit | GREEN outcome                                |
| ---- | ---------- | -------------------------------------------------------- | ------------ | -------------------------------------------- |
| 1    | 882a01d    | vite resolve-import failure (`../CustomCard` not found)  | 07091c9      | 5/5 passing, tsc clean                       |
| 2    | 22f0c49    | vite resolve-import failure (`../Toast` not found)       | 389d27a      | 5/5 passing, tsc clean, full suite 454/454   |

No REFACTOR commits — both impls came verbatim from 09-UI-SPEC.md (lines 194-217 for CustomCard, 484-498 for Toast). With verbatim spec inputs and immediate GREEN, refactor would only invent diff for no behavioral change.

## Parallel-file integrity proof

The hard constraint from CONTEXT.md `<canonical_refs>` strong preference: PresetCard.tsx MUST remain byte-identical across this plan.

**Baseline hash (pre-plan):** `4328729671d76beff93247d5a0e46c24ff56dfd5` (captured from `git hash-object` before Task 1)
**Post-Task-1 hash:** `4328729671d76beff93247d5a0e46c24ff56dfd5` (identical)
**Post-Task-2 hash:** `4328729671d76beff93247d5a0e46c24ff56dfd5` (identical)
**`git diff --quiet src/components/PresetCard.tsx`:** exits 0 (no diff)

T-09-03-01 (Tampering: accidentally modifying PresetCard) mitigation verified.

## SEG-05 zero-diff floor

No engine, hook, or v1-protected component file touched. Zero modifications across all 26 SEG-05 protected paths.

## Deviations from Plan

None — plan executed exactly as written. Both tasks shipped verbatim from 09-UI-SPEC.md class strings + 09-PATTERNS.md guidance. No auto-fixes triggered (Rules 1-3 dormant); no architectural decisions surfaced (Rule 4 dormant). Tests passed on first GREEN run for both tasks.

## Known Stubs

None. Both components are fully wired:
- CustomCard's onClick is a required prop — consumers (Dashboard in Plan 09-09) supply the handler
- Toast's message/durationMs/onDismiss are all required props — consumers (Composer in Plan 09-04, ShareButton in Plan 09-05) own the state

## Commits

- `882a01d` test(09-03): add failing tests for CustomCard component (RED)
- `07091c9` feat(09-03): implement CustomCard (parallel-file 4th Dashboard card) (GREEN)
- `22f0c49` test(09-03): add failing tests for Toast component (RED)
- `389d27a` feat(09-03): implement Toast (shared live-region notification) (GREEN)

## Self-Check: PASSED

All claims verified:
- `src/components/CustomCard.tsx` exists (41 lines)
- `src/components/Toast.tsx` exists (45 lines)
- `src/components/__tests__/CustomCard.test.tsx` exists (50 lines, 5 tests)
- `src/components/__tests__/Toast.test.tsx` exists (65 lines, 5 tests)
- Commits 882a01d, 07091c9, 22f0c49, 389d27a all exist in git log
- PresetCard.tsx byte-identical (hash 4328729671d76beff93247d5a0e46c24ff56dfd5 unchanged)
- tsc --noEmit exits 0
- Full suite 454/454 passing across 37 files
