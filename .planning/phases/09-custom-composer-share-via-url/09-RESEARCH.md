# Phase 9: Custom Composer + Share via URL — Research

**Researched:** 2026-05-10
**Domain:** React 19 modal UI + URL-hash routing + Web Share API + WAI-ARIA patterns
**Confidence:** HIGH overall (locked CONTEXT, well-trodden browser APIs); MEDIUM on iOS Safari standalone quirks for `location.hash`

---

## TL;DR (planner: read these 8 findings first)

1. **Use the native `<dialog>` element with `showModal()` — not `createPortal`, not focus-trap-react.** Safari 15.4+, all other browsers ≥ 2022. It gives free focus trap, free Escape-key handling, free scroll lock on body, free `aria-modal="true"` semantics, free backdrop pseudo-element. The Composer modal becomes ~20 fewer lines and zero new dependencies. Section "Pattern 1." [HIGH]
2. **Composer state belongs in a `useReducer` separate from `Composer.tsx`** — file at `src/components/composer/reducer.ts` (or `src/lib/composerReducer.ts`). 6 actions (`add | duplicate | delete | update_duration | update_sound | load`). Pure-function, unit-testable in isolation, decouples reducer tests from RTL setup. Section "Pattern 2." [HIGH]
3. **Stepper: native `<input type="number">` with `inputMode="none"` + visible `+/-` buttons** beats the `role="spinbutton"` div approach. The hidden-input pattern keeps screen-reader semantics intact while suppressing the mobile number-keypad. `aria-label` on the `+/-` buttons. Section "Pattern 3." [HIGH]
4. **SoundPicker: `role="radiogroup"` + three `role="radio"` children with roving tabindex.** Verbatim MDN canonical pattern. Picker labels are `Gentle / Triangle / Alarm` (per D-06). Selected pill = filled with `SOUND_COLORS[endSound]`. Section "Pattern 4." [HIGH]
5. **Share = `if (navigator.canShare?.({ url })) navigator.share(...) else navigator.clipboard.writeText(url)`.** Both rejection branches collapse to one toast: `Couldn't copy — try the address bar`. `navigator.canShare` is the correct gate, not `navigator.share` alone. Section "Pattern 5." [HIGH]
6. **URL-hash decode runs once in a `useHashComposition` hook at App.tsx mount.** Use `history.replaceState(null, '', location.pathname + location.search)` to clear the hash without reload. Returns `{ composition: SegmentConfig | null; error: 'wrong_version' | 'malformed' | ... | null }` — App.tsx routes both branches. Section "Pattern 6." [HIGH]
7. **Live total + per-row validity is `useMemo` derived from segments array, not separate state.** `validateSegmentConfig` runs on every change — it's O(N) and N ≤ 32. Per-row flags come from a second derivation that runs the same checks per segment. No manual revalidate calls. Section "Pattern 7." [HIGH]
8. **CustomCard.tsx is a parallel file to PresetCard.tsx — do NOT add a `variant` prop.** PresetCard is byte-identical-protected under SEG-05 (Phase 8 already proved this works for the 4×4 case using the existing `name`/`description` API). CustomCard's differences (dashed border, `+` glyph) are visual-only and don't share enough behavior to justify the extension risk. Section "Pattern 8." [HIGH]

---

## Summary

Phase 9 introduces three things the codebase has never had: a modal UI, URL-hash routing, and external-trigger user flows (Share API + clipboard). All three have canonical 2026-vintage browser-native solutions that avoid new dependencies. The biggest leverage is using `<dialog>` (HTMLDialogElement) instead of building a portal-based modal with manual focus trap — it eliminates ~80 lines of boilerplate plus the `react-focus-lock` dependency that was on the table.

The composer state machine is well-suited to `useReducer` because every edit is structural (add/delete/update by index), making testability of the reducer in isolation worth more than the modest line-count savings of inline `setSegments`. The reducer file becomes the single source of truth for "what can the user do to a composition," and the `composerValidation.ts` wrapper around the locked `validateSegmentConfig` becomes a pure derivation on the resulting array.

**Primary recommendation:** Native `<dialog>` + `useReducer` for composer state + roving-tabindex radio-group for the SoundPicker + native `<input type="number">` with hidden mobile-keypad for the StepperInput + a single `useHashComposition` hook for the share-decode entry point. Total new runtime dependencies: **zero**.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Composer modal UI | Browser/Client (React) | — | Pure client UI — no SSR, no backend |
| Segment editing state | Browser/Client (React `useReducer`) | — | Ephemeral session state per no-persistence rule |
| Encode/decode share URL | Browser/Client (pure TS lib) | — | `src/lib/shareUrl.ts` — pure functions, no DOM access |
| Hash detection at boot | Browser/Client (`useHashComposition`) | — | `location.hash` is browser API; no SSR concerns |
| Web Share API invocation | Browser/Client (`navigator.share`) | — | Platform API; feature-detect with `canShare` |
| Clipboard fallback | Browser/Client (`navigator.clipboard`) | — | Platform API; HTTPS-only, secure-context |
| Toast notifications | Browser/Client (React) | — | Pure visual — `role="status"` aria-live polite |
| Composer Start handoff | useActiveAlarm hook | SegmentEngine | Composer dispatches; engine runs |

---

## Standard Stack

### Core (already installed — no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19.x | Hooks (`useReducer`, `useState`, `useRef`, `useEffect`) | Already in package.json [VERIFIED: package.json:dependencies] |
| TypeScript | ~5.6.2 | Type safety for discriminated DecodeResult | Already in devDependencies [VERIFIED: package.json] |
| Vitest | 3.1.2 | Test runner | Already in devDependencies [VERIFIED: package.json] |
| @testing-library/react | 16.3.2 | Component tests | Already wired up (jsdom env from Phase 8 P01) [VERIFIED: package.json + STATE.md Phase 8 P01 note] |

### Browser-native APIs (no library wrapper)
| API | Baseline | Phase 9 Use | Confidence |
|-----|----------|-------------|------------|
| `<dialog>` element + `showModal()` / `close()` | All modern browsers; **Safari 15.4+** (Mar 2022); Firefox 98+; Chrome 37+ | Composer full-screen modal | HIGH [CITED: caniuse.com/dialog + webkit.org dialog announcement] |
| `navigator.share()` / `navigator.canShare()` | Android Chrome (yes), iOS Safari (yes — gesture-required), Desktop Chrome (Win/Mac), Desktop Safari (Mac); Firefox desktop (NO) | Share button primary path | HIGH [CITED: MDN docs above + WPP "How to share data" guide] |
| `navigator.clipboard.writeText()` | All modern browsers; HTTPS only; rejects in non-secure context | Share button fallback | HIGH [CITED: MDN Clipboard.writeText() docs] |
| `history.replaceState()` | All browsers, decade-old | Clear `#c=...` from URL bar after decode | HIGH [VERIFIED: existing Web Platform baseline] |
| `location.hash` / `URLSearchParams` | All browsers | Read shared composition at boot | HIGH [VERIFIED: existing Web Platform baseline] |
| WAI-ARIA `role="radiogroup"` + roving tabindex | All ATs | SoundPicker accessibility | HIGH [CITED: MDN radiogroup_role docs above] |

### Alternatives Considered (and rejected)
| Instead of | Could Use | Why rejected |
|------------|-----------|--------------|
| Native `<dialog>` | `createPortal` + manual focus trap | Adds ~80 lines, two responsibilities (focus management, scroll lock), Safari 15.4+ already universal in target market |
| Native `<dialog>` | `react-focus-lock` library (~5 KB gz) | Same — `<dialog>` is free and built-in |
| `useReducer` | `useState<SegmentConfig>` + scattered update helpers | Reducer is unit-testable as a pure function; six explicit actions are clearer than six closure helpers |
| `role="radiogroup"` for SoundPicker | Three `<button>`s with `aria-pressed` | Less semantic. The picker IS a mutually-exclusive single-value choice — that's literally what `radiogroup` is for |
| Native `<input type="number">` | Pure `role="spinbutton"` div | Native input keeps SR semantics for free; `inputMode="none"` suppresses the mobile keypad we don't want |
| `fast-check` property tests for shareUrl | Manual round-trip tests for 5-6 edge cases | Property-based is overkill for a 60-char string format; bundle weight not justified |

**Installation needed:** None. All recommended approaches use platform APIs and React 19 built-ins.

**Version verification:**
- React 19 verified at `package.json:dependencies` — `"react": "^19.0.0"`
- Tailwind v4 verified — `"tailwindcss": "^4.0.0"` and `@tailwindcss/vite: ^4.0.0`
- HTMLDialogElement availability: Safari 15.4 (Mar 2022) confirmed via caniuse.com [VERIFIED]

---

## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01 through D-21 — do not re-debate)

**Stepper (D-01..D-03):**
- D-01: Adaptive step size — below 5:00 = 30s, at/above 5:00 = 1min
- D-02: Keyboard — ArrowUp/Down = step; Shift+ArrowUp/Down + PageUp/Down = 5 min; min 5s; max 60 min
- D-03: 44 px min touch target per `+/-` button; circular icon buttons flanking duration display

**Sound picker (D-04..D-07):**
- D-04: 3-pill segmented control `Gentle | Triangle | Alarm`; selected pill filled with `SOUND_COLORS[endSound]`
- D-05: Unselected pills = stroked outline on `--color-bg`, text `--color-text-secondary`, hover preview at ~10% opacity
- D-06: Picker label is `Alarm` (not `Wake` — picker context is calmer); SegmentCountdown still says `Wake`
- D-07: ArrowLeft/Right moves between pills; Enter/Space selects

**Dashboard 4th card (D-08..D-10):**
- D-08: New `Custom` card at bottom of dashboard (after `4 x 4`)
- D-09: Dashed border + `+` glyph + label `Custom` + description `Compose your own alarm`; same 80 px min height
- D-10: Click opens Composer modal pre-loaded with Wake Easy template; Cancel returns; Start runs alarm + closes

**Validation + delete (D-11..D-12):**
- D-11: Red border on invalid rows; Start button disabled when any segment is invalid; tooltip `Fix invalid segments first`
- D-12: Delete is instant (no confirmation); last-remaining-segment Delete is disabled with `At least one segment required` tooltip

**Modal layout (D-13..D-15):**
- D-13: Sticky header (title + close-X), Total under header, scrollable row list, `+ Add segment` below, sticky footer `Cancel | Share | Start`
- D-14: Close on close-X, Cancel, Escape, browser-back — but NOT tap-outside (prevents accidental loss)
- D-15: 200 ms fade scrim + 240 ms ease-out upward 16 px slide on content; respect `prefers-reduced-motion: reduce` (skip slide, shorten fade to 100 ms)

**Share-URL (D-16..D-19):**
- D-16: Format `c=v1:<dur>-<sndIdx>,...`; gentle=0, triangle=1, alarm=2
- D-17: `decodeComposition` is Result type; `encodeComposition(config) => string`; size cap 32 segments / 1024 chars; reasons enumerated
- D-18: Read once at app mount, clear via `history.replaceState`; success auto-opens composer; failure shows toast `Couldn't load shared alarm — using default` (4 s)
- D-19: Share = `navigator.share({ url, title, text })` if available, else `navigator.clipboard.writeText(url)` + toast (3 s); rejection toast `Couldn't copy — try copying from the address bar`

**Alarm placement + defaults (D-20..D-21):**
- D-20: Composer does NOT enforce "alarm = last"; validateSegmentConfig is the source of truth (and it doesn't enforce this either — verified at SegmentState.ts:59-94)
- D-21: New-segment defaults: `durationMs: 60_000`, `endSound: 'gentle'`; Add-Segment appends; Duplicate clones and inserts below source

### Claude's Discretion
- Exact Tailwind class strings for SegmentRow grid (constraints: 44 px targets, tabular-nums on duration, gap-4 between rows)
- Modal scrim color/opacity (`bg-text-primary/40` recommended)
- Toast component: shared `Toast.tsx` for both decode-error + share-confirmation (recommended)
- Composer caching across Cancel→reopen: NO (zen friction-free philosophy)
- Stepper icon style: icon-only with `aria-label`
- Tooltip mechanism: native `title=` attribute (no tooltip component in project)

### Deferred Ideas (OUT OF SCOPE — do not address)
- Drag-and-drop reorder (v2.x)
- Per-segment volume (v2.x)
- localStorage persistence
- Composer "Save preset"
- Text-input edit of duration
- Composer keyboard shortcuts beyond arrow keys
- Share-link analytics
- Phase 10 (SEO meta) and Phase 11 (landing page split)
- Renaming format to `v2:` (decoder enumerates `'wrong_version'` — defer until needed)
- Web Share Target API (out of scope; couples with Phase 10 SW work)
- iOS AudioContext.resume() (deferred since Phase 6)
- Wake Lock sentinel bug (deferred since Phase 6)

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COMP-01 | Dashboard has "Custom" entry button that opens composer | Pattern 8 (CustomCard parallel file); Dashboard.tsx integration (Pattern 9) |
| COMP-02 | Composer pre-loads Wake Easy template (never blank) | Reducer `load_template` action seeded with `WAKE_EASY_CONFIG` from SegmentState.ts:104-112; useHashComposition fallback |
| COMP-03 | Each row: stepper duration + sound picker + Delete | Pattern 3 (StepperInput); Pattern 4 (SoundPicker); SegmentRow composition (Pattern 10) |
| COMP-04 | "Add segment" button appends new segment with defaults | Reducer `add` action with `{ durationMs: 60_000, endSound: 'gentle' }` |
| COMP-05 | Duplicate clones segment immediately below | Reducer `duplicate` action — splice at index+1 with new id |
| COMP-06 | Live total-duration display updates on every edit | Pattern 7 (`useMemo` derivation from segments array) |
| COMP-07 | Start launches alarm via existing pipeline; Cancel returns | `activeAlarm.start({ kind: 'segments', config })` from useActiveAlarm.ts:67; Cancel just calls `<dialog>.close()` |
| COMP-08 | Composer presented as full-screen modal | Pattern 1 (native `<dialog>` + `showModal`) |
| SHR-01 | Share button serializes + invokes `navigator.share`; falls back to clipboard | Pattern 5 (canShare-gated dispatch); Pattern 11 (Toast) |
| SHR-02 | Decoded compositions pass through SEG-04 validation | Pattern 6 (decodeComposition pipes through `validateSegmentConfig`) |
| SHR-03 | Invalid/tampered URLs fail gracefully with toast | Pattern 6 Result type; Pattern 11 (Toast) |
| SHR-04 | `v1:` version prefix; future versions break explicitly | Pattern 6 — version-token-first parse rejects unknown prefixes with `'wrong_version'` reason |

---

## Architecture Patterns

### System Architecture Diagram

```
                        App Mount
                            │
                            ▼
              ┌──────── useHashComposition() ──────────┐
              │  reads location.hash, runs decode,     │
              │  clears hash via replaceState          │
              └────────────┬───────────────────────────┘
                           │
              ┌────────────┴─────────────┐
              │                          │
        decoded ok                  decoded fail
        composition !== null        composition === null,
              │                     error !== null
              ▼                          │
       composerInitialConfig = ...       │
       composerOpen = true               │
              │                          ▼
              │                  toast.show('Couldn’t load...', 4s)
              │                  composerInitialConfig = WAKE_EASY_CONFIG
              │                  composerOpen = false
              │                          │
              └───────────┬──────────────┘
                          ▼
              ┌─── App.tsx render ───┐
              │  activeAlarm.mode    │
              │   === 'idle' ?       │
              └────────┬─────────────┘
                       │
        ┌──────────────┼───────────────────┐
        ▼              ▼                   ▼
   <Dashboard>   <Composer initialConfig={...}    {mode==='continuous' || 'segments'}
   (4 cards,    open={composerOpen}              → <Countdown> | <SegmentCountdown>
   incl.        onClose, onStart>
   CustomCard)
                          │
                          ▼
              ┌─── Composer (dialog) ───┐
              │  useReducer<SegmentConfig>
              │   actions: add | dup |   │
              │   delete | update_dur |  │
              │   update_snd | load      │
              └─────┬──────────┬─────────┘
                    │          │
        ┌───────────▼          ▼───────────┐
        │  SegmentRow[]    Footer buttons  │
        │  (1..N)          Cancel | Share  │
        │                  | Start         │
        └───┬────┬─────────────────┬───┬───┘
            │    │                 │   │
            ▼    ▼                 ▼   ▼
        Stepper SoundPicker    encodeComposition()
        Input   (radiogroup)   → navigator.share OR
        (input  + roving       navigator.clipboard.writeText
        type=   tabindex)      → Toast
        number)
```

**Data-flow legend.** Hash decoder gates initial config (Wake Easy or shared). Reducer is the single source of truth for editing. Validation memoized off the reducer state. Start dispatches through the already-wired `useActiveAlarm.start({ kind: 'segments', config })`. Share encodes then invokes platform API. Nothing in Phase 9 touches SegmentEngine directly — composer is purely a pre-launch authoring surface.

### Project Structure (additions only)

```
src/
├── components/
│   ├── Composer.tsx              ← NEW: full-screen <dialog> + reducer host
│   ├── SegmentRow.tsx            ← NEW: single editable row
│   ├── StepperInput.tsx          ← NEW: +/- + native input (hidden keypad)
│   ├── SoundPicker.tsx           ← NEW: 3-pill radiogroup
│   ├── Toast.tsx                 ← NEW: shared toast (decode-error + share-success)
│   ├── CustomCard.tsx            ← NEW: parallel to PresetCard (dashed border)
│   ├── Dashboard.tsx             ← MODIFIED: add 4th card + onCustomClick
│   └── __tests__/                ← Composer.test.tsx + SegmentRow + Stepper + SoundPicker
├── hooks/
│   └── useHashComposition.ts     ← NEW: app-mount hash decoder
│       __tests__/
│         useHashComposition.test.ts
├── lib/                          ← NEW DIRECTORY
│   ├── shareUrl.ts               ← encode + decode + DecodeResult type
│   ├── composerValidation.ts     ← wraps validateSegmentConfig with per-row flags
│   └── __tests__/
│       └── shareUrl.test.ts
└── App.tsx                       ← MODIFIED: mount Composer + useHashComposition wiring
```

**Why `src/lib/` is new:** existing code has `src/utils/formatTime.ts` (formatting helper) and `src/engine/`, `src/hooks/`, `src/platform/`. None of these fit pure-string-encoding logic. `src/lib/` is the conventional name for "no-DOM pure-TS utilities" in a Vite codebase; cleaner than expanding `src/utils/` which is already narrow in scope.

---

### Pattern 1: Native `<dialog>` for the Composer modal

**What:** Use the HTMLDialogElement directly via `useRef<HTMLDialogElement>(null)` + `dialogRef.current.showModal()` / `dialogRef.current.close()`.

**Why over createPortal + manual focus trap:**
- Free focus trap (focus stays in the dialog while it's open)
- Free Escape-key handling (`<dialog>.close()` fires on Escape by default — emit a `close` event you listen for)
- Free `aria-modal="true"` semantics
- Free top-layer stacking (`<dialog>` renders above all other content via the browser's top-layer; no `z-index` battles)
- Free `::backdrop` pseudo-element for the scrim
- Safari 15.4+ universal as of Mar 2022 — well beyond the install base of this PWA
- Eliminates `react-focus-lock` dependency that was on the table

**When to use:** Composer modal in Phase 9. Future install-prompt modals (Phase 10/11) would use the same pattern.

**Example:**
```tsx
// Source: MDN HTMLDialogElement docs + CSS :modal selector docs
import { useRef, useEffect } from 'react';

interface ComposerProps {
  open: boolean;
  initialConfig: SegmentConfig;
  onClose: () => void;
  onStart: (config: SegmentConfig) => Promise<void>;
}

export default function Composer({ open, initialConfig, onClose, onStart }: ComposerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Imperatively sync React's `open` prop with the dialog's native open state.
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  // The native <dialog>.close() fires a 'close' event — bind onClose to it
  // so Escape-key dismissal AND in-component close-X both flow through one path.
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    const handler = () => onClose();
    dlg.addEventListener('close', handler);
    return () => dlg.removeEventListener('close', handler);
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      className="bg-bg text-text-primary p-0 m-0 w-full h-full max-w-none max-h-none rounded-none"
      aria-labelledby="composer-title"
    >
      {/* Backdrop styled via the ::backdrop pseudo-element in index.css */}
      <div className="flex flex-col h-full">
        {/* Sticky header: title + close-X */}
        <header className="sticky top-0 bg-bg/95 backdrop-blur-sm flex justify-between items-center px-6 py-4 border-b border-border">
          <h2 id="composer-title" className="text-xl font-semibold text-text-primary">Custom alarm</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close composer"
            className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-white/40"
          >×</button>
        </header>
        {/* ... Total, scrollable list, + Add segment, footer ... */}
      </div>
    </dialog>
  );
}
```

**Required CSS addition to `src/index.css`:**
```css
/* Phase 9: Composer modal scrim + open animation (D-15) */
dialog::backdrop {
  background: rgba(61, 74, 56, 0.4); /* --color-text-primary at 40% */
  opacity: 0;
  animation: dialog-backdrop-in 200ms ease-out forwards;
}

dialog[open] {
  opacity: 0;
  transform: translateY(16px);
  animation: dialog-in 240ms ease-out forwards;
}

@keyframes dialog-backdrop-in {
  to { opacity: 1; }
}
@keyframes dialog-in {
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  dialog::backdrop {
    animation-duration: 100ms;
  }
  dialog[open] {
    transform: none;
    animation-duration: 100ms;
  }
  @keyframes dialog-in {
    to { opacity: 1; }  /* no transform on reduced-motion */
  }
}
```

**Pitfalls handled:** Backdrop click-outside-to-close is opt-in for `<dialog>` (not default), which satisfies D-14 "tap-outside does NOT close." Browser-back inside a PWA closes a modal `<dialog>` — verify on Android Chrome during integration testing. **Confidence: HIGH** for the pattern; **MEDIUM** for the iOS Safari `<dialog>` rendering details — recommend manual smoke-test during the integration plan.

---

### Pattern 2: `useReducer` for composer state

**Recommendation [HIGH]:** Use `useReducer<SegmentConfig, ComposerAction>` with the reducer file at `src/lib/composerReducer.ts` (pure function, no React imports — testable in isolation).

**Reasoning:**
- Six structural actions justify the reducer ceremony (`add | duplicate | delete | update_duration | update_sound | load`)
- Pure-function reducer is testable without RTL or React mounting
- Locks the surface so all edits go through one switch — easier to audit (e.g., new constraint "max 32 segments" lives in one place)
- Pattern: useReducer pairs naturally with useMemo derivations (total duration, validity flags)

**Shape:**
```ts
// src/lib/composerReducer.ts — NEW, pure TS, zero React imports
import type { Segment, SegmentConfig } from '../engine/SegmentState';

const MAX_SEGMENTS = 32; // Matches D-17 size cap

let nextId = 0;
function genSegmentId(): string {
  // Composer-owned IDs; engine treats them as opaque per Phase 7 D-18.
  return `composer-${Date.now()}-${++nextId}`;
}

export type ComposerAction =
  | { type: 'load'; config: SegmentConfig }
  | { type: 'add' }
  | { type: 'duplicate'; index: number }
  | { type: 'delete'; index: number }
  | { type: 'update_duration'; index: number; durationMs: number }
  | { type: 'update_sound'; index: number; endSound: Segment['endSound'] };

export function composerReducer(state: SegmentConfig, action: ComposerAction): SegmentConfig {
  switch (action.type) {
    case 'load':
      // Rewrite IDs so React keys are stable even if the same shared URL is decoded twice.
      return {
        segments: action.config.segments.map((s) => ({ ...s, id: genSegmentId() })),
      };
    case 'add':
      if (state.segments.length >= MAX_SEGMENTS) return state;
      return {
        segments: [...state.segments, { id: genSegmentId(), durationMs: 60_000, endSound: 'gentle' }],
      };
    case 'duplicate': {
      if (state.segments.length >= MAX_SEGMENTS) return state;
      const src = state.segments[action.index];
      if (!src) return state;
      const clone: Segment = { ...src, id: genSegmentId() };
      const next = [...state.segments];
      next.splice(action.index + 1, 0, clone);
      return { segments: next };
    }
    case 'delete':
      // D-12: last-remaining segment can't be deleted — guard here too.
      if (state.segments.length <= 1) return state;
      return { segments: state.segments.filter((_, i) => i !== action.index) };
    case 'update_duration':
      return {
        segments: state.segments.map((s, i) =>
          i === action.index ? { ...s, durationMs: action.durationMs } : s
        ),
      };
    case 'update_sound':
      return {
        segments: state.segments.map((s, i) =>
          i === action.index ? { ...s, endSound: action.endSound } : s
        ),
      };
  }
}
```

**Composer consumption:**
```tsx
const [config, dispatch] = useReducer(composerReducer, props.initialConfig, (init) =>
  composerReducer({ segments: [] }, { type: 'load', config: init })
);
```

The third argument to `useReducer` (lazy init) routes the initial config through the same `load` action so IDs are normalized on first mount.

---

### Pattern 3: Stepper input — native `<input type="number">` with `inputMode="none"`

**Recommendation [HIGH]:** Two `<button>` elements flanking a `<input type="number">` with `inputMode="none"` to suppress the mobile keypad while preserving native semantics for screen readers. Use a single component that owns its keyboard handling.

**Why not `role="spinbutton"` on a div:**
- Native `<input type="number">` *is* a spinbutton implicitly per MDN [CITED above].
- ARIA's first rule of thumb: prefer native semantics over `role="..."`.
- Setting `inputMode="none"` on iOS Safari + Android Chrome suppresses the soft keyboard — we don't want users typing because the steppers enforce the adaptive-step rule.
- We add `readOnly` + the visual `<button>`s for input; the keyboard events run on the input or buttons, and the input value updates via `dispatch({ type: 'update_duration', ... })`.

**Why not a bare `<button>` pair around a `<span>` value:**
- Loses screen-reader announcement of value changes (the `aria-live` would have to be hand-rolled).
- Loses the implicit `aria-valuenow` semantics that screen readers expect for "edit a numeric value" widgets.

**Shape:**
```tsx
// src/components/StepperInput.tsx
import { formatMmSs } from '../utils/formatTime';

interface StepperInputProps {
  valueMs: number;          // durationMs
  onChange: (next: number) => void;
  minMs?: number;           // default 5_000 (D-02)
  maxMs?: number;           // default 3_600_000 (D-02)
}

const SMALL_STEP_THRESHOLD_MS = 300_000;   // 5:00 boundary (D-01)
const SMALL_STEP_MS = 30_000;              // 30 s (D-01)
const LARGE_STEP_MS = 60_000;              // 1 min (D-01)
const SHIFT_STEP_MS = 300_000;             // 5 min (D-02 Shift+Arrow + PageUp/Down)
const DEFAULT_MIN = 5_000;
const DEFAULT_MAX = 3_600_000;

function stepFor(currentMs: number): number {
  return currentMs >= SMALL_STEP_THRESHOLD_MS ? LARGE_STEP_MS : SMALL_STEP_MS;
}

export default function StepperInput({ valueMs, onChange, minMs = DEFAULT_MIN, maxMs = DEFAULT_MAX }: StepperInputProps) {
  function clamp(ms: number): number {
    return Math.max(minMs, Math.min(maxMs, ms));
  }
  function increase(by: number = stepFor(valueMs)) {
    onChange(clamp(valueMs + by));
  }
  function decrease(by: number = stepFor(valueMs)) {
    // D-01 boundary case: at exactly 5:00, "-" steps down by 1 min (LARGE), not 30s.
    // by parameter already resolves this if caller respects stepFor — but for
    // the "minus at exactly 5:00" case we deliberately use LARGE_STEP_MS.
    const step = valueMs > SMALL_STEP_THRESHOLD_MS ? LARGE_STEP_MS
               : valueMs === SMALL_STEP_THRESHOLD_MS ? LARGE_STEP_MS  // boundary: drop by 1 min to 4:00
               : SMALL_STEP_MS;
    onChange(clamp(valueMs - (by === stepFor(valueMs) ? step : by)));
  }

  function onKeyDown(e: React.KeyboardEvent) {
    // Suppress page-scroll when user is steppering.
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault();
    }
    if (e.key === 'ArrowUp')   { e.shiftKey ? increase(SHIFT_STEP_MS) : increase(); }
    if (e.key === 'ArrowDown') { e.shiftKey ? decrease(SHIFT_STEP_MS) : decrease(); }
    if (e.key === 'PageUp')    { increase(SHIFT_STEP_MS); }
    if (e.key === 'PageDown')  { decrease(SHIFT_STEP_MS); }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => decrease()}
        disabled={valueMs <= minMs}
        aria-label="Decrease duration"
        className="w-11 h-11 rounded-full border border-border bg-white/60 text-text-primary text-xl active:scale-[0.95] disabled:opacity-40 disabled:cursor-not-allowed transition-transform"
      >−</button>
      <input
        type="number"
        inputMode="none"                 /* suppress mobile keypad */
        readOnly                         /* values change via +/- only */
        value={Math.floor(valueMs / 1000)} /* seconds for the implicit role */
        onKeyDown={onKeyDown}
        aria-valuetext={formatMmSs(valueMs)}  /* SR-friendly mm:ss readout */
        aria-label="Segment duration"
        className="w-20 bg-transparent text-center text-text-primary font-light text-xl"
        style={{ fontVariantNumeric: 'tabular-nums', appearance: 'textfield', MozAppearance: 'textfield' }}
      />
      <button
        type="button"
        onClick={() => increase()}
        disabled={valueMs >= maxMs}
        aria-label="Increase duration"
        className="w-11 h-11 rounded-full border border-border bg-white/60 text-text-primary text-xl active:scale-[0.95] disabled:opacity-40 disabled:cursor-not-allowed transition-transform"
      >+</button>
    </div>
  );
}
```

**Note on auto-repeat (hold-to-fast-step):** Recommended NO. Adds complexity (timeout management), and Shift+Arrow / PageUp/Down already covers fast scrubbing per D-02. Zen aesthetic favors deliberate single taps.

**WCAG contrast on disabled state:** `opacity-40` on `text-text-primary` (#3d4a38) over `--color-bg` (#f4f1eb). At 40% the foreground = `rgba(61, 74, 56, 0.4)` over #f4f1eb. Computed contrast ratio ≈ 1.8:1 — fails WCAG 1.4.3 (4.5:1 for text). **However**, the disabled stepper button's text content is `−` / `+` — these are interactive control glyphs, not informational text, and WCAG SC 1.4.11 "Non-text Contrast" allows 3:1 for inactive UI components which we still fail. **Recommend [MEDIUM]**: tighten to `opacity-50` (gives ~2.3:1) and add a `cursor-not-allowed` so the affordance also reads as "disabled" non-visually. Phase 8 uses `opacity-40` on the Pause button (UI-SPEC L141) — so this is an aesthetic-consistency vs WCAG tradeoff. Surface to discuss-phase if not already noted.

---

### Pattern 4: Sound picker — `role="radiogroup"` + roving tabindex

**Recommendation [HIGH]:** A `<div role="radiogroup">` containing three `<button>` elements with `role="radio"` and the WAI-ARIA Radio Group pattern (roving tabindex, ArrowLeft/Right moves both focus and selection).

**Why over `<button aria-pressed>`:**
- Radio group is the semantically correct primitive: three mutually exclusive options.
- Screen readers announce "Gentle, radio button, 1 of 3, checked" — the most useful announcement we can give.
- Roving tabindex pattern (one of the three is tab-focusable; ArrowLeft/Right both moves focus AND changes selection) is the locked behavior in D-07.

**Note on text-label vs color encoding:** Each pill shows both the text label (`Gentle` / `Triangle` / `Alarm`) AND the color of `SOUND_COLORS[endSound]`. Color is therefore not the only encoding — satisfies WCAG 1.4.1 Use of Color.

**Shape:**
```tsx
// src/components/SoundPicker.tsx
import { useRef } from 'react';
import type { Segment } from '../engine/SegmentState';

const PILL_OPTIONS: Array<{ value: Segment['endSound']; label: string; idx: number }> = [
  { value: 'gentle',   label: 'Gentle',   idx: 0 },
  { value: 'triangle', label: 'Triangle', idx: 1 },
  { value: 'alarm',    label: 'Alarm',    idx: 2 },  // D-06: 'Alarm' in picker, 'Wake' elsewhere
];

const SOUND_BG: Record<Segment['endSound'], string> = {
  gentle: 'bg-sage',
  triangle: 'bg-sand',
  alarm: 'bg-accent',
};

interface SoundPickerProps {
  value: Segment['endSound'];
  onChange: (next: Segment['endSound']) => void;
  rowIndex: number; /* used to derive unique aria-label for the group */
}

export default function SoundPicker({ value, onChange, rowIndex }: SoundPickerProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([null, null, null]);
  const currentIdx = PILL_OPTIONS.findIndex((p) => p.value === value);

  function onKeyDown(e: React.KeyboardEvent, idx: number) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (idx + 1) % PILL_OPTIONS.length;
      onChange(PILL_OPTIONS[next].value);
      refs.current[next]?.focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (idx - 1 + PILL_OPTIONS.length) % PILL_OPTIONS.length;
      onChange(PILL_OPTIONS[prev].value);
      refs.current[prev]?.focus();
    }
    // Space / Enter implicit on <button> — selects on click.
  }

  return (
    <div
      role="radiogroup"
      aria-label={`Segment ${rowIndex + 1} sound`}
      className="flex items-center gap-1 rounded-full border border-border p-1"
    >
      {PILL_OPTIONS.map((opt, i) => {
        const checked = opt.value === value;
        return (
          <button
            key={opt.value}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={i === currentIdx ? 0 : -1}            /* roving */
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`min-h-11 px-4 rounded-full text-sm transition-colors ${
              checked
                ? `${SOUND_BG[opt.value]} text-white`
                : 'text-text-secondary hover:bg-white/40 focus-visible:bg-white/40'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
```

**Hover preview (D-05 "~10% opacity tint"):** Skipped from the shape above for brevity. If implemented, would be a CSS rule that uses `:hover` + the corresponding `SOUND_BG` color at 10% opacity. **Confidence: MEDIUM** that this delivers the intended visual; recommend visual verification during UI implementation.

---

### Pattern 5: Web Share API + Clipboard fallback

**Recommendation [HIGH]:** Use `navigator.canShare?.({ url })` as the gate (not `'share' in navigator` alone — `canShare` returns `false` if the data is invalid OR if the permission policy is denied). Always wrap in `try/catch` and treat user-cancellation as silent success.

**Why `canShare` not `share` for the gate:**
- `navigator.share` is defined on more browsers than will *actually* share — Firefox desktop, e.g.
- `canShare({ url })` returns `false` if the implementation doesn't support shareable URL payloads or if `web-share` permission policy is denied [CITED: MDN canShare docs above].
- Pattern from MDN: `if (!navigator.share || !navigator.canShare) return false; return navigator.canShare(data);`

**Reference flow (recommended):**
```ts
// src/components/Composer.tsx (Share button handler)
async function onShareClick() {
  const fragment = encodeComposition(config);  // "v1:240000-0,60000-2"
  const url = `${location.origin}${location.pathname}#c=${fragment}`;
  const data = { url, title: 'My alarm composition', text: 'Open this gentle alarm in Soundly' };

  if (navigator.canShare?.(data)) {
    try {
      await navigator.share(data);
      // navigator.share resolves on success; user-cancel also rejects with AbortError.
      // Treat success as silent (no toast — the share sheet IS the feedback).
    } catch (err) {
      // AbortError = user cancelled; silent.
      // Anything else = surface the fallback message.
      if ((err as Error).name !== 'AbortError') {
        toast.show("Couldn't share — try copying from the address bar", 3000);
      }
    }
    return;
  }

  // Fallback: clipboard
  try {
    await navigator.clipboard.writeText(url);
    toast.show('Share link copied to clipboard', 3000);
  } catch {
    // NotAllowedError on non-HTTPS or denied permission.
    toast.show("Couldn't copy — try copying from the address bar", 4000);
  }
}
```

**Edge case table:**

| Browser | navigator.canShare | navigator.share | navigator.clipboard.writeText | Path taken |
|---------|--------------------|-----------------|--------------------------------|------------|
| Android Chrome | yes | yes (system share sheet) | yes | share |
| iOS Safari | yes | yes (system share sheet, user-gesture required) | yes | share |
| Desktop Chrome (Win/Mac/Linux) | yes | yes (OS share UI; limited targets on Linux) | yes | share |
| Desktop Safari (Mac) | yes | yes | yes | share |
| Desktop Firefox | no | no | yes (HTTPS) | clipboard |
| Old non-HTTPS context | n/a | n/a | rejects with NotAllowedError | toast: try address bar |

**GitHub Pages URL construction:** The deployed `base` is `/Soundly/` (verified at `vite.config.ts:7`). Phase 9 ships before the Phase 11 multi-page split; so the share URL is `${origin}/Soundly/#c=v1:...`. After Phase 11 lands, the URL becomes `${origin}/Soundly/app/#c=v1:...` — this is automatic from `location.pathname`. **No hardcoded paths in shareUrl.ts** — always derive from `location`.

---

### Pattern 6: URL-hash decoder + `useHashComposition` hook

**Recommendation [HIGH]:** Read hash exactly once at App.tsx mount via a custom hook. Use `history.replaceState(null, '', location.pathname + location.search)` (preserves any future query string) to clear the hash without a reload. Return both the decoded config and any error reason so App.tsx can route both branches.

**Encode format (per D-16, locked):**
```
c=v1:<durationMs>-<soundIdx>,<durationMs>-<soundIdx>,...
```
where `gentle=0`, `triangle=1`, `alarm=2`.

**Decode-result shape (per D-17, locked):**
```ts
// src/lib/shareUrl.ts
import { validateSegmentConfig, type SegmentConfig, type Segment } from '../engine/SegmentState';

const VERSION_PREFIX = 'v1:';
const MAX_HASH_LENGTH = 1024;
const MAX_SEGMENTS = 32;
const SOUND_BY_IDX: Record<string, Segment['endSound']> = {
  '0': 'gentle',
  '1': 'triangle',
  '2': 'alarm',
};
const IDX_BY_SOUND: Record<Segment['endSound'], string> = {
  gentle: '0',
  triangle: '1',
  alarm: '2',
};

export type DecodeResult =
  | { ok: true; config: SegmentConfig }
  | { ok: false; reason: 'wrong_version' | 'malformed' | 'too_long' | 'invalid_segment_data' | 'failed_validation' };

/**
 * Encode a SegmentConfig as the share-URL fragment value (without leading '#').
 *
 * Composer appends to `${location.origin}${location.pathname}#c=...`.
 * Pure function. Never throws on a validated SegmentConfig.
 */
export function encodeComposition(config: SegmentConfig): string {
  const body = config.segments
    .map((s) => `${s.durationMs}-${IDX_BY_SOUND[s.endSound]}`)
    .join(',');
  return `${VERSION_PREFIX}${body}`;
}

/**
 * Decode a `c=...` fragment value into a SegmentConfig. Pass the value AFTER
 * the `c=` prefix is stripped (or the full hash without leading '#' — the
 * function handles both for convenience).
 *
 * Discriminated Result; never throws. Reasons enumerate the failure mode for
 * future telemetry / logs.
 */
export function decodeComposition(input: string): DecodeResult {
  // Tolerate leading '#' and 'c=' prefixes
  let s = input;
  if (s.startsWith('#')) s = s.slice(1);
  if (s.startsWith('c=')) s = s.slice(2);

  if (s.length > MAX_HASH_LENGTH) return { ok: false, reason: 'too_long' };

  // Version prefix
  if (!s.startsWith(VERSION_PREFIX)) {
    // If it starts with `vN:` (N != 1) treat as wrong_version; anything else is malformed.
    if (/^v\d+:/.test(s)) return { ok: false, reason: 'wrong_version' };
    return { ok: false, reason: 'malformed' };
  }
  const body = s.slice(VERSION_PREFIX.length);
  if (body.length === 0) return { ok: false, reason: 'invalid_segment_data' };

  const pairs = body.split(',');
  if (pairs.length === 0 || pairs.length > MAX_SEGMENTS) {
    return { ok: false, reason: 'invalid_segment_data' };
  }

  const segments: Segment[] = [];
  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];
    const dashIdx = pair.indexOf('-');
    if (dashIdx < 1 || dashIdx === pair.length - 1) {
      return { ok: false, reason: 'malformed' };
    }
    const durStr = pair.slice(0, dashIdx);
    const sndStr = pair.slice(dashIdx + 1);

    // Strict integer parsing
    if (!/^\d+$/.test(durStr) || !/^\d+$/.test(sndStr)) {
      return { ok: false, reason: 'malformed' };
    }
    const durationMs = Number(durStr);
    const endSound = SOUND_BY_IDX[sndStr];
    if (!endSound) {
      return { ok: false, reason: 'invalid_segment_data' };
    }
    if (!Number.isFinite(durationMs) || durationMs <= 0) {
      return { ok: false, reason: 'invalid_segment_data' };
    }
    segments.push({ id: `shared-${i}`, durationMs, endSound });
  }

  // Final defence-in-depth: route through the engine's validator (SHR-02).
  const result = validateSegmentConfig({ segments });
  if (!result.ok) return { ok: false, reason: 'failed_validation' };
  return { ok: true, config: result.config };
}
```

**Error category table per D-17:**

| Input | Reason | Test rationale |
|-------|--------|----------------|
| `c=v2:240000-0` | `'wrong_version'` | Future version reject |
| `c=v1:abc-def` | `'malformed'` | Non-numeric digits |
| `c=v1:240000-0` (after a 1500-char garbage URL) | `'too_long'` | Length cap |
| `c=v1:240000-9` (sound idx 9) | `'invalid_segment_data'` | Unknown sound index |
| `c=v1:` (empty after prefix) | `'invalid_segment_data'` | Empty body |
| `c=v1:0-0,0-0` (zero durations) | `'invalid_segment_data'` | Caught at pair parse (duration <= 0) |
| `c=foo` (no v-prefix) | `'malformed'` | No version token |
| Single valid segment `c=v1:60000-0` | `{ ok: true }` | Smoke test |
| 32 valid segments | `{ ok: true }` | Max boundary |
| 33 segments | `'invalid_segment_data'` | Max+1 |

**Why no URL-encoding the body:** `0-9`, `-`, `,` are all in the RFC 3986 unreserved/reserved-but-safe-in-fragment set. No percent-encoding needed. Document this in shareUrl.ts code comment.

**Length math (D-17 / 1024-char cap):** Worst case 32 segments of `3600000-2` (max duration 60 min = 3,600,000 ms = 7 digits + `-` + 1 digit) = 9 chars per pair + 1 comma between pairs = ~320 chars body + `c=v1:` (5 chars) = ~325 chars. Well under 1024. Real worst-case at the validator ceiling of 14_400_000 ms (4 hours per SegmentState.ts:43) = 8 digits → ~330 chars. Cap of 1024 is generous and protects against tampering.

**`useHashComposition` hook:**
```ts
// src/hooks/useHashComposition.ts
import { useState, useEffect } from 'react';
import { decodeComposition, type DecodeResult } from '../lib/shareUrl';
import type { SegmentConfig } from '../engine/SegmentState';

interface HashCompositionState {
  /** Set if a valid composition was found in the URL hash at mount. */
  composition: SegmentConfig | null;
  /** Set if a hash was found but couldn't decode. Used to trigger the toast. */
  error: Exclude<DecodeResult, { ok: true }>['reason'] | null;
  /** Reset error to null after user dismisses or component re-runs. */
  clearError: () => void;
}

export function useHashComposition(): HashCompositionState {
  const [state, setState] = useState<{
    composition: SegmentConfig | null;
    error: HashCompositionState['error'];
  }>(() => {
    // Run ONCE at first render (useState initializer).
    // Guard against SSR by checking window — Vite SPA never SSRs but it's cheap.
    if (typeof window === 'undefined' || !window.location.hash) {
      return { composition: null, error: null };
    }
    const raw = window.location.hash; // includes leading '#'
    if (!raw.startsWith('#c=')) {
      return { composition: null, error: null };  // Hash present but not ours; ignore.
    }
    const result = decodeComposition(raw);
    if (result.ok) {
      return { composition: result.config, error: null };
    }
    return { composition: null, error: result.reason };
  });

  // Clear the hash from the URL bar exactly once after detection (D-18).
  // useEffect avoids touching history during render.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.location.hash.startsWith('#c=')) return;
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    // Intentional: empty dep array — runs once after first mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    ...state,
    clearError: () => setState((s) => ({ ...s, error: null })),
  };
}
```

**iOS Safari hash quirks:** [MEDIUM confidence] iOS Safari standalone-mode (Add to Home Screen) opens with `location.hash` intact in most cases, but a known historical bug stripped hashes during PWA cold-start on iOS 13. As of iOS 16.4+ (the floor for installed-PWA push features per the Phase 9 CLAUDE.md stack), this is no longer reported as an active issue. **Recommendation:** smoke-test once on iOS Safari standalone during integration to verify. If broken, fall back to encoding in a `?c=` query parameter instead of `#c=` (query params survive PWA installation reliably) — but this is a Phase 11 concern (URL routing changes more deeply there) and Phase 9 should stick with `#c=`.

---

### Pattern 7: Derived state via `useMemo` — total + per-row validity

**Recommendation [HIGH]:** Don't store derived data. Compute total duration and per-row validity flags via `useMemo([segments])`.

**Why:**
- Always fresh. No "I forgot to revalidate" bugs.
- O(N) for N ≤ 32 is sub-millisecond. React's reconciliation cost dwarfs the validator.
- Centralizes the validity contract — the same `validateSegmentConfig` runs for live editing, share-decode, and engine-start.

**Shape:**
```tsx
// inside Composer.tsx
import { useMemo } from 'react';
import { validateSegmentConfig } from '../engine/SegmentState';
import { formatMmSs } from '../utils/formatTime';

const totalMs = useMemo(
  () => config.segments.reduce((s, seg) => s + seg.durationMs, 0),
  [config.segments],
);

const validation = useMemo(() => validateSegmentConfig(config), [config]);
// validation: { ok: true; config } | { ok: false; error: string }

// Per-row validity for inline red border (D-11). Same checks the validator runs,
// but extracted so we know which row to highlight (validator returns first-fail).
const rowValid: boolean[] = useMemo(
  () => config.segments.map((seg) => {
    if (typeof seg.durationMs !== 'number' || !Number.isFinite(seg.durationMs)) return false;
    if (seg.durationMs <= 0 || seg.durationMs > 14_400_000) return false;
    if (!['gentle','triangle','alarm'].includes(seg.endSound)) return false;
    return true;
  }),
  [config.segments],
);

const startDisabled = !validation.ok || rowValid.some((v) => !v);
```

The `rowValid` derivation lives in `src/lib/composerValidation.ts` and is exported so the test suite can hit it directly.

**`composerValidation.ts` shape:**
```ts
// src/lib/composerValidation.ts
import type { SegmentConfig, Segment } from '../engine/SegmentState';

export function rowIsValid(seg: Segment): boolean {
  if (typeof seg.durationMs !== 'number' || !Number.isFinite(seg.durationMs)) return false;
  if (seg.durationMs <= 0 || seg.durationMs > 14_400_000) return false;
  if (!['gentle', 'triangle', 'alarm'].includes(seg.endSound)) return false;
  return true;
}

export function rowValidityArray(config: SegmentConfig): boolean[] {
  return config.segments.map(rowIsValid);
}
```

---

### Pattern 8: CustomCard.tsx — parallel file to PresetCard, NOT a variant prop

**Recommendation [HIGH]:** Create `src/components/CustomCard.tsx` as a parallel component. Do NOT add a `variant: 'preset' | 'custom'` prop to PresetCard.tsx.

**Why:**
- PresetCard is a v1 file but **not** in the SEG-05 protected list per `.planning/milestones/v1.0-ROADMAP.md` (PresetCard is NOT one of the 20 protected paths — I verified: protected paths are `AlarmEngine`, `AlarmState`, `AlarmSession`, `AudioContext`, `timer`, `useAlarm`, `Countdown`, `ProgressRing`, `engine/sounds/*` minus triangle/segmentSound, and `platform/*`). So extending PresetCard would not technically violate SEG-05. **However**, the v1 strict-floor posture established in STATE.md "Phase 6-8 byte-identical-floor preservation" treats PresetCard as effectively frozen.
- Parallel files preserve the Phase 8 P06 pattern (Dashboard already imports `PresetCard` three times without modification) and matches the strong-preference call in CONTEXT D-180.
- ~20 LoC duplication. Acceptable tradeoff for the structural isolation.

**Shape:**
```tsx
// src/components/CustomCard.tsx
interface CustomCardProps {
  onClick: () => void;
}

export default function CustomCard({ onClick }: CustomCardProps) {
  return (
    <button
      onClick={onClick}
      type="button"
      className="w-full p-6 rounded-2xl border-2 border-dashed border-border bg-white/60 text-left min-h-[80px] active:scale-[0.98] transition-transform duration-150 relative"
      aria-label="Open custom alarm composer"
    >
      <span
        aria-hidden="true"
        className="absolute top-4 right-4 text-2xl text-text-secondary font-light"
      >+</span>
      <p className="text-xl font-semibold text-text-primary">Custom</p>
      <p className="text-sm text-text-secondary mt-1">Compose your own alarm</p>
    </button>
  );
}
```

**Delta from PresetCard:**
- `border-2 border-dashed` (vs `border`)
- absolute-positioned `+` glyph top-right
- `aria-label="Open custom alarm composer"` (vs implicit accessible name from name+description content — needed because the `+` glyph might be read as part of the name otherwise)
- prop signature `onClick` (vs `onStart` — different semantic: opens composer, not starts an alarm)

---

### Pattern 9: Dashboard.tsx integration

**Modification footprint:** Add `composerOpen` state in App.tsx, pass an `onCustomClick` callback to Dashboard, then add the 4th `<CustomCard>` after the 3rd `<PresetCard>`.

```tsx
// Dashboard.tsx — modified
interface DashboardProps {
  activeAlarm: Extract<ActiveAlarmState, { mode: 'idle' }>;
  onCustomClick: () => void;   // NEW
}

export default function Dashboard({ activeAlarm, onCustomClick }: DashboardProps) {
  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto px-6 py-12">
      <h1 className="text-3xl font-semibold text-sage tracking-tight">Soundly</h1>
      <p className="text-text-secondary text-sm mt-1">gentle alarm</p>
      <div className="mt-10 w-full flex flex-col gap-4">
        <PresetCard name="Quick Nap" description="..." onStart={() => activeAlarm.start(...)} />
        <PresetCard name="Focus" description="..." onStart={() => activeAlarm.start(...)} />
        <PresetCard name="4 x 4" description="..." onStart={() => activeAlarm.start(...)} />
        <CustomCard onClick={onCustomClick} />   {/* NEW: 4th card at bottom per D-08 */}
      </div>
      <div className="mt-8"><TestSoundButton /></div>
      <div className="mt-6 w-full"><IosInstallBanner /></div>
    </div>
  );
}
```

**Diff size:** +1 prop, +1 component instance, +1 import. Very low risk to existing Dashboard.test.tsx (which tests the document order of three cards — the 4th card will need a new assertion).

---

### Pattern 10: SegmentRow.tsx composition

```tsx
// src/components/SegmentRow.tsx
import StepperInput from './StepperInput';
import SoundPicker from './SoundPicker';
import type { Segment } from '../engine/SegmentState';

interface SegmentRowProps {
  segment: Segment;
  index: number;
  isOnlyRow: boolean;       // disables delete when true (D-12)
  isInvalid: boolean;       // red border (D-11)
  onDurationChange: (ms: number) => void;
  onSoundChange: (s: Segment['endSound']) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export default function SegmentRow({
  segment, index, isOnlyRow, isInvalid,
  onDurationChange, onSoundChange, onDuplicate, onDelete,
}: SegmentRowProps) {
  return (
    <div
      className={`flex flex-wrap items-center gap-4 p-3 rounded-xl border ${
        isInvalid ? 'border-accent/50' : 'border-border'
      } bg-white/40`}
    >
      <StepperInput valueMs={segment.durationMs} onChange={onDurationChange} />
      <div className="flex-1 min-w-0">
        <SoundPicker value={segment.endSound} onChange={onSoundChange} rowIndex={index} />
      </div>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={onDuplicate}
          aria-label={`Duplicate segment ${index + 1}`}
          className="w-11 h-11 rounded-full hover:bg-white/60 active:scale-[0.95] transition-transform text-text-secondary"
        >⧉</button>
        <button
          type="button"
          onClick={onDelete}
          disabled={isOnlyRow}
          title={isOnlyRow ? 'At least one segment required' : undefined}
          aria-label={`Delete segment ${index + 1}`}
          className="w-11 h-11 rounded-full hover:bg-white/60 active:scale-[0.95] transition-transform text-text-secondary disabled:opacity-40 disabled:cursor-not-allowed"
        >×</button>
      </div>
    </div>
  );
}
```

**Responsive behavior:** `flex-wrap` lets the SoundPicker wrap below the stepper on narrow viewports (per D-205). The `flex-1 min-w-0` middle column ensures the picker takes the remaining width up to wrap.

---

### Pattern 11: Toast component

**Recommendation [HIGH]:** Single `<Toast>` component, single instance per use site, replaces (not queues) on new emit. ARIA `role="status"` + `aria-live="polite"`. Auto-dismiss via `setTimeout`. Owned at App.tsx level so both decode-error AND share-confirmation can address it.

**Why `aria-live="polite"` not `assertive`:**
- Polite waits for the user to pause speaking — doesn't interrupt
- Assertive interrupts immediately — too aggressive for a calm alarm app
- Both decode-error and share-confirmation are non-blocking informational toasts

**Why not queue:** Single-toast simpler; the realistic emit cases (share-success, decode-error, share-fail) all fire from explicit user actions and rarely overlap. If they do, the latest is the most relevant.

**Shape:**
```tsx
// src/components/Toast.tsx
import { useEffect } from 'react';

interface ToastProps {
  message: string | null;
  durationMs: number;
  onDismiss: () => void;
}

export default function Toast({ message, durationMs, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(id);
  }, [message, durationMs, onDismiss]);

  if (!message) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-8 left-1/2 -translate-x-1/2 px-4 py-3 bg-text-primary text-white rounded-xl text-sm shadow-lg z-50"
    >
      {message}
    </div>
  );
}
```

**App.tsx integration:**
```tsx
// App.tsx — modified
const [toast, setToast] = useState<{ msg: string; ms: number } | null>(null);
const hash = useHashComposition();
const [composerOpen, setComposerOpen] = useState(hash.composition !== null);
const initialConfig = hash.composition ?? WAKE_EASY_CONFIG;

// Surface decode error once
useEffect(() => {
  if (hash.error !== null) {
    setToast({ msg: "Couldn't load shared alarm — using default", ms: 4000 });
    hash.clearError();
  }
}, [hash.error]);
// ...
return (
  <>
    {activeAlarm.mode === 'idle' && (
      <>
        <Dashboard activeAlarm={activeAlarm} onCustomClick={() => setComposerOpen(true)} />
        <Composer
          open={composerOpen}
          initialConfig={initialConfig}
          onClose={() => setComposerOpen(false)}
          onStart={async (cfg) => {
            await activeAlarm.start({ kind: 'segments', config: cfg });
            setComposerOpen(false);
          }}
          onShareSuccess={(msg) => setToast({ msg, ms: 3000 })}
          onShareError={(msg) => setToast({ msg, ms: 4000 })}
        />
      </>
    )}
    {/* ...Countdown / SegmentCountdown branches unchanged... */}
    <Toast
      message={toast?.msg ?? null}
      durationMs={toast?.ms ?? 0}
      onDismiss={() => setToast(null)}
    />
  </>
);
```

**Toast-timing WCAG 2.2.1:** Both timings (3 s share-success, 4 s decode-error) are below the WCAG 5-second floor for unrestricted timing-adjustability, but the toasts are non-blocking informational — not "essential information that the user needs to act on." The 5-second rule doesn't apply because no action is required to proceed. Document this in the component comment to anticipate accessibility audit questions.

---

### Pattern 12: Test infrastructure (composer-specific)

**Existing test infra (consumed unchanged):**
- jsdom env wired by Phase 8 P01 [VERIFIED: STATE.md "Phase 08 P01: Vitest jsdom environment wired"]
- RTL + @testing-library/dom installed [VERIFIED: package.json]
- `cleanup()` pattern in afterEach [VERIFIED: STATE.md "Phase 08 P05: imported cleanup() and calling it in afterEach"]

**Composer-specific test patterns:**

1. **Reducer unit tests** (`src/lib/__tests__/composerReducer.test.ts`) — pure-function tests, no React mount needed. ~6 tests covering each action; fast.

2. **shareUrl encode/decode round-trip tests** (`src/lib/__tests__/shareUrl.test.ts`) — single-segment, max-segment, mixed-sound, every error category. ~10 tests; covers the table in Pattern 6.

3. **StepperInput keyboard tests** (`src/components/__tests__/StepperInput.test.tsx`) — fire `keyDown` ArrowUp / ArrowDown / Shift+ArrowUp / PageUp; assert value change + clamping. Use `fireEvent.keyDown(input, { key: 'ArrowUp' })`.

4. **SoundPicker roving-tabindex tests** — assert exactly one button has `tabindex="0"` per group; press ArrowRight; assert focus + aria-checked moved.

5. **Composer integration tests** — `useReducer` + actions. Use `userEvent.click` for Add/Duplicate/Delete; assert resulting DOM.

6. **useHashComposition tests** — mock `window.location.hash` and `window.history.replaceState` in beforeEach; assert decoded composition; assert hash cleared.

7. **Web Share / clipboard tests** — mock `navigator.share` + `navigator.canShare` + `navigator.clipboard.writeText` via `Object.defineProperty(navigator, 'share', { value: vi.fn() })` in beforeEach; restore in afterEach. Standard vitest pattern.

**No new test dependencies needed.**

---

### Anti-Patterns to Avoid

- **`createPortal` + manual focus trap:** rejected for `<dialog>` (Pattern 1). Adds 80 LoC and a dependency.
- **`new Date().toISOString()` for segment ids:** non-deterministic; tests will be flaky. Use the `composer-<timestamp>-<counter>` pattern with a module-local counter.
- **Storing total duration in reducer state:** stale-data risk. Derive via `useMemo`.
- **Calling `validateSegmentConfig` only on Start:** would let invalid rows persist invisibly. Run it on every reducer state (Pattern 7).
- **Hash decode in `useEffect`:** would briefly render Dashboard with Wake Easy config before the composer opens — visible flicker. Run in `useState` initializer (synchronous).
- **`window.alert(...)` for decode errors:** breaks zen aesthetic. Use the Toast (Pattern 11).
- **`role="dialog"` without `aria-modal="true"`:** ATs won't trap announcements within the dialog. The `<dialog>` element sets this automatically when opened via `showModal()` — but verify in tests.
- **Tab-outside-closes:** would conflict with D-14. Never bind a backdrop-click handler that closes the dialog.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal scroll lock | `document.body.style.overflow = 'hidden'` in useEffect | Native `<dialog>` (Pattern 1) | Free with `<dialog>` — body scroll locked automatically when shown via `showModal()` |
| Focus trap | `tabIndex` cycling logic + first/last sentinels | Native `<dialog>` | Free — focus stays within `<dialog>` automatically |
| Escape-key handler | `window.addEventListener('keydown', ...)` in App | Native `<dialog>` `close` event | Free — Escape closes a modal `<dialog>` and fires the `close` event |
| Backdrop scrim | Separate div with `bg-black/40 fixed inset-0 z-...` | `<dialog>::backdrop` CSS | Free — handles top-layer stacking too |
| Spinbutton ARIA | Custom `role="spinbutton"` div with manual `aria-valuenow` updates | Native `<input type="number">` with `inputMode="none"` | Native role is implicit; no manual ARIA updates needed |
| Roving tabindex for picker | Re-implement WAI-ARIA Radio Group pattern from scratch | Follow the MDN-documented pattern (Pattern 4) | The pattern is well-trodden; copy verbatim |
| URL-hash parsing | Build a generic router | `useHashComposition` reads `location.hash` once at mount | Single-purpose; no route table to maintain |
| Web Share feature detection | `if ('share' in navigator)` only | Both `navigator.share` + `navigator.canShare(data)` | `canShare` validates the *data*, not just API presence |
| Clipboard fallback | `document.execCommand('copy')` (deprecated) | `navigator.clipboard.writeText` | Modern path; deprecated path adds no value |
| Toast queue | Linked-list of pending toasts | Single-toast replace-on-emit (Pattern 11) | Realistic emit rate doesn't justify queue complexity |
| Property-based encode/decode tests | `fast-check` | 5-6 hand-written round-trip + error tests | 60-char format; manual cases enumerate the space exhaustively |
| Per-segment id generation | UUID library | `composer-<timestamp>-<counter>` module-local | Engine treats IDs as opaque per Phase 7 D-18; uniqueness within composer session is sufficient |

**Key insight:** The browser platform in 2026 has caught up to most of the modal/form-control complexity that historically required libraries. `<dialog>`, `inputMode="none"`, and `navigator.canShare` are 2022-vintage and well-supported. Adding `react-focus-lock`, `body-scroll-lock`, or `fast-check` is unnecessary bundle weight for an alarm PWA.

---

## Common Pitfalls

### Pitfall 1: `<dialog>` ref is null on first render
**What goes wrong:** `dialogRef.current.showModal()` throws "Cannot read properties of null."
**Why:** `useRef` returns `{ current: null }` on first render; the DOM node attaches AFTER the render commit.
**How to avoid:** Only call `.showModal()` inside `useEffect` or event handlers. Pattern 1 does this — guard with `if (!dlg) return;` in every effect.
**Warning signs:** Test console errors during `screen.findByRole('dialog')` if the synchronization effect runs in render path.

### Pitfall 2: Auto-opening composer flickers Dashboard first
**What goes wrong:** Shared URL is decoded successfully, but Dashboard renders for one frame with Wake Easy config before Composer opens.
**Why:** If `composerOpen` initial state derives from a `useEffect` rather than `useState` initializer, the first render happens with `composerOpen=false`.
**How to avoid:** Run hash decode in `useState` initializer (synchronous, executes before first render). Pattern 6's hook does this.
**Warning signs:** Visual flash in real-device testing; failed `screen.queryByRole('dialog')` on initial render in tests.

### Pitfall 3: Tampered URL causes runtime throw
**What goes wrong:** A user opens `#c=v1:abc-def` — naive `parseInt('abc')` returns `NaN`, gets passed to `Number()` checks that pass, gets fed to segment that fails validation upstream — silent data corruption.
**Why:** Loose parsing. SHR-03 mandates "runtime never throws on tampered URL input."
**How to avoid:** Strict regex (`/^\d+$/`) at decode (Pattern 6); validator runs as defence-in-depth. Test every error category from the table in Pattern 6.
**Warning signs:** Test "expect.toThrow()" inverted — the test passes by `expect(decodeComposition(garbage).ok).toBe(false)`.

### Pitfall 4: `navigator.share` cancellation triggers fallback path
**What goes wrong:** User taps Share, sees the share sheet, then taps "Cancel" — code interprets `AbortError` as a failure and tries clipboard fallback. User sees an unwanted "Link copied" toast.
**Why:** `navigator.share` rejects with `AbortError` on user-cancellation. Naive `try/catch` doesn't distinguish.
**How to avoid:** Check `err.name === 'AbortError'` and treat as silent. Pattern 5 does this.
**Warning signs:** Beta-tester report "I cancelled but got 'copied' toast."

### Pitfall 5: Hash cleared before composer reads it
**What goes wrong:** `history.replaceState` runs in render path before the `useState` initializer reads the hash. Composer opens with Wake Easy fallback.
**Why:** Side-effecting state mutation in render is forbidden by React's rules of hooks.
**How to avoid:** `replaceState` lives in `useEffect` (post-commit). Pattern 6 separates the read (useState initializer) from the clear (useEffect).
**Warning signs:** "Decoded successfully" branch never fires in tests; `location.hash` is empty on first read.

### Pitfall 6: Reducer changes ID on every render via inline function
**What goes wrong:** A `dispatch({ type: 'add' })` action inside a render path (not callback) creates a new id every render, generating thousands of useless segments.
**Why:** React `dispatch` is stable, but the action object can be constructed inside the action handler — if that handler runs on every render, the reducer runs on every render.
**How to avoid:** Action dispatch is only ever called from event handlers (`onClick`, `onKeyDown`). Never call `dispatch` in render or `useMemo`.
**Warning signs:** infinite loop / OOM in tests.

### Pitfall 7: Stepper boundary case at exactly 5:00 (D-01)
**What goes wrong:** Tapping `−` at 5:00 produces 4:30 (30-second step), but D-01 says it should produce 4:00 (1-minute step "from 5:00 down").
**Why:** The step is determined by current value; ambiguous at the boundary.
**How to avoid:** Pattern 3's `decrease()` function explicitly handles `valueMs === SMALL_STEP_THRESHOLD_MS` and uses LARGE_STEP_MS.
**Warning signs:** Manual smoke-test at 5:00 boundary; assertion `value 5:00 → press '−' → expect(value).toBe(4 * 60 * 1000)`.

### Pitfall 8: Modal close drops keyboard focus to body
**What goes wrong:** Composer closes → focus moves to `<body>`. User using only keyboard navigation is stranded.
**Why:** `<dialog>.close()` doesn't auto-restore focus to the triggering element.
**How to avoid:** Capture the triggering element ref before `showModal()`, restore focus to it on close.
```ts
const triggerRef = useRef<HTMLElement | null>(null);
function openComposer() {
  triggerRef.current = document.activeElement as HTMLElement;
  setComposerOpen(true);
}
function closeComposer() {
  setComposerOpen(false);
  setTimeout(() => triggerRef.current?.focus(), 0);
}
```
**Warning signs:** Tab-key behavior unexpected after closing modal in manual testing.

### Pitfall 9: GitHub Pages base path bug in encode
**What goes wrong:** Encoded URL produces `https://username.github.io/#c=...` instead of `https://username.github.io/Soundly/#c=...` because the encoder builds the URL from `location.origin` only.
**Why:** `vite.config.ts:7` sets `base: '/Soundly/'`; the deployed pathname is `/Soundly/`, not `/`.
**How to avoid:** Always derive from `location.origin + location.pathname`, not just `location.origin`. Pattern 5 does this.
**Warning signs:** Smoke-test on deployed build before phase-complete.

### Pitfall 10: Validator runs on every keystroke including invalid intermediate states
**What goes wrong:** User pastes invalid data, validator runs, shows error, user keeps typing, validator runs again, etc. — UI feedback flickers.
**Why:** Live derivation has no debounce.
**How to avoid:** For this composer, stepper-driven inputs are atomic (a tap = a valid value), so flicker isn't an issue. If a future text-input edit lands, then debounce. **Not a concern for Phase 9.**
**Warning signs:** N/A for Phase 9 (no text input). Document for future-phase planning.

---

## Code Examples

### Encode/decode round-trip
```ts
// Source: src/lib/shareUrl.ts (Pattern 6)
import { decodeComposition, encodeComposition } from '../lib/shareUrl';
import { WAKE_EASY_CONFIG } from '../engine/SegmentState';

const encoded = encodeComposition(WAKE_EASY_CONFIG);
// → "v1:240000-0,240000-0,240000-0,240000-0,60000-2"

const decoded = decodeComposition(`#c=${encoded}`);
// → { ok: true, config: { segments: [...] } }
// segment IDs are regenerated as 'shared-0', 'shared-1', etc.
```

### Composer modal open + close
```tsx
// App.tsx integration (Pattern 1 + Pattern 11)
const hash = useHashComposition();
const [composerOpen, setComposerOpen] = useState(hash.composition !== null);
const [initialConfig] = useState(hash.composition ?? WAKE_EASY_CONFIG);
// ...
<Composer
  open={composerOpen}
  initialConfig={initialConfig}
  onClose={() => setComposerOpen(false)}
  onStart={async (cfg) => {
    await activeAlarm.start({ kind: 'segments', config: cfg });
    setComposerOpen(false);  // close so the SegmentCountdown branch shows
  }}
/>
```

### Stepper keyboard handling
```ts
// Source: src/components/StepperInput.tsx (Pattern 3)
function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
  if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'].includes(e.key)) {
    e.preventDefault();  // Suppress page scroll
  }
  if (e.key === 'ArrowUp') {
    e.shiftKey ? increase(SHIFT_STEP_MS) : increase();
  }
  // ... etc
}
```

### SoundPicker roving tabindex
```tsx
// Source: src/components/SoundPicker.tsx (Pattern 4)
const currentIdx = PILL_OPTIONS.findIndex((p) => p.value === value);
// ...
<button
  role="radio"
  aria-checked={checked}
  tabIndex={i === currentIdx ? 0 : -1}   // Only ONE button is tab-focusable
  onClick={() => onChange(opt.value)}
  onKeyDown={onKeyDown}
>
  {opt.label}
</button>
```

### Web Share with fallback
```ts
// Source: pattern 5 (Composer's Share handler)
async function onShareClick() {
  const fragment = encodeComposition(config);
  const url = `${location.origin}${location.pathname}#c=${fragment}`;
  const data = { url, title: 'My alarm composition', text: 'Open this gentle alarm in Soundly' };

  if (navigator.canShare?.(data)) {
    try { await navigator.share(data); }
    catch (e) {
      if ((e as Error).name !== 'AbortError') {
        toast("Couldn't share — try copying from the address bar", 4000);
      }
    }
    return;
  }

  try {
    await navigator.clipboard.writeText(url);
    toast('Share link copied to clipboard', 3000);
  } catch {
    toast("Couldn't copy — try copying from the address bar", 4000);
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `createPortal` + focus-trap library for modals | Native `<dialog>` + `showModal()` | Safari 15.4 (Mar 2022) gave universal support | No-dep modals |
| `document.execCommand('copy')` for clipboard | `navigator.clipboard.writeText` | Deprecated in 2022 spec; replaced by clipboard API | Promise-based; HTTPS-required (acceptable) |
| `'share' in navigator` feature-detection alone | `navigator.canShare?.(data)` for data-aware detection | MDN guidance updated 2023+ | Catches "API present but data type unsupported" |
| `tabindex` cycling with sentinels for focus trap | `<dialog>` element with implicit trap | Browser-native since 2022 | No JS for focus management |
| `bg-black/40 fixed inset-0` div for scrim | `dialog::backdrop` CSS pseudo-element | CSS spec, supported alongside `<dialog>` | Free top-layer stacking |
| Custom router for URL state | `useState` initializer reading `location.hash` once + `history.replaceState` | Always available | No router runtime; matches v2.0 architectural decision (Vite multi-page) |

**Deprecated/outdated:**
- `document.execCommand('copy')` — replaced by `navigator.clipboard`
- `aria-hidden` + sibling-tree hiding patterns for modal — replaced by `aria-modal="true"` (set automatically by `<dialog>.showModal()`)
- `tabindex="-1"` everywhere outside modal for focus-trap — replaced by `<dialog>` semantics

---

## Project Constraints (from CLAUDE.md)

| Constraint | Source | How Phase 9 honors |
|------------|--------|--------------------|
| React + Vite + Tailwind CSS | CLAUDE.md "Tech stack" | Pure React 19 + Tailwind v4 utilities; no UI libraries |
| No copyrighted audio files | CLAUDE.md "Constraints" | Phase 9 adds zero audio; reuses Phase 7 synthesis unchanged |
| Browser APIs degrade gracefully | CLAUDE.md "Constraints" | Pattern 5 (Web Share fallback to clipboard fallback to copy-from-address-bar) |
| No persistence between sessions | CLAUDE.md "Constraints" | Composer state resets on reopen (D-122); share-via-URL is the portability path |
| GSD workflow enforcement | CLAUDE.md "GSD Workflow Enforcement" | Phase 9 work proceeds via `/gsd-execute-phase 9` after planning |
| Bespoke Tailwind v4 components | CLAUDE.md theme + Phase 8 UI-SPEC inheritance | No shadcn; no icon library; raw `+` / `×` / `⧉` text glyphs (or inline SVG if a designer asks) |
| Native dialog + modal pattern is "introduced by Phase 9" | CONTEXT code_context | Pattern 1 establishes the canonical idiom for future modals (Phase 10/11) |

---

## Runtime State Inventory

> **Greenfield UI-only phase** — no rename / refactor / migration concerns.

**Stored data:** None — no persistence per CLAUDE.md.
**Live service config:** None — no backend.
**OS-registered state:** None — no scheduled tasks, no daemons.
**Secrets and env vars:** None — no secrets needed.
**Build artifacts:** None — net-new files only; no rename or pyc-style cache concerns.

This section is included for completeness; Phase 9 does not introduce any of these categories.

---

## Environment Availability

> Phase 9 is a code-only change. No external runtimes, services, or CLI tools introduced beyond what's already installed.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Vite dev/build | ✓ (verified by existing v1-v8) | — | — |
| Vite | dev server | ✓ | 6.0.5 [VERIFIED: package.json] | — |
| Vitest | tests | ✓ | 3.1.2 [VERIFIED: package.json] | — |
| @testing-library/react | RTL tests | ✓ | 16.3.2 [VERIFIED: package.json] | — |
| jsdom | RTL env | ✓ | 26.1.0 [VERIFIED: package.json] | — |

No new dependencies. No missing dependencies.

---

## Security Domain

> `security_enforcement` is not explicitly set in `.planning/config.json`; treating as enabled per default. (Config absent the key → enabled.)

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | NO | No auth — no users, no accounts |
| V3 Session Management | NO | No sessions — no backend |
| V4 Access Control | NO | No protected resources |
| V5 Input Validation | YES | `validateSegmentConfig` (Phase 7 deliverable) + decoder strict regex (Pattern 6). All user input from URL hash and composer UI passes through `validateSegmentConfig` |
| V6 Cryptography | NO | No crypto operations — no signing, no tokens |
| V7 Error Handling | YES | Decoder returns Result type (never throws); SHR-03 mandates "runtime never throws on tampered URL input" — Pattern 6 enforces with strict regex + final validator pass |
| V14 Configuration | NO | No deployment config changes; reuses Phase 4 PWA build |

### Known Threat Patterns for React PWA with Share-via-URL

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious share-URL with garbage hash (DoS) | DoS / Tampering | Hash length cap (1024) + segment count cap (32) + Result-type decoder (Pattern 6) |
| XSS via decoded hash content | Tampering / Spoofing | Decoder produces strictly-typed `Segment[]` with numeric `durationMs` and enum `endSound` — no string concatenation into DOM; React's default escaping for `{...}` interpolation |
| Clickjacking on Share button | Tampering | `navigator.share` requires user gesture (browser-enforced); no opaque action chains |
| Reflected URL content (the hash itself is rendered) | Information disclosure | The hash is decoded and rendered as structured data (durations, sound names), not as raw text. No URL string is displayed in the UI |
| Clipboard injection of malicious URL | Tampering | Phase 9 only WRITES to clipboard; never reads. No injection vector. |
| Web Share Target hijack | Spoofing | Out of scope — not registering as a share target (deferred per CONTEXT) |
| `history.replaceState` allowing arbitrary URL injection | Tampering | Only replaces with `location.pathname + location.search` — no user-controlled string passed to `replaceState` |

**The threat surface is small because:** no backend, no auth, no DOM string concatenation, no eval, no innerHTML, no remote data fetch. The only ingestion point is `location.hash`, fully gated by Pattern 6.

---

## Validation Architecture

> `workflow.nyquist_validation` is explicitly `false` in `.planning/config.json` — SKIPPED.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | iOS Safari standalone-mode reliably preserves `location.hash` on cold-start in current iOS (16.4+ floor per CLAUDE.md) | Pattern 6 / iOS hash quirks | [ASSUMED] from training data + general PWA knowledge; not verified on real device this session. **Mitigation:** smoke-test during integration plan; fallback to `?c=` query param if broken |
| A2 | `<dialog>::backdrop` styles cooperate with React-driven `dialog[open]` opening animation in Safari 15.4+ | Pattern 1 CSS | [ASSUMED] — animation timings on Safari may need tweaking. **Mitigation:** visual verification during UI implementation; D-15 timings can be tuned without architectural rework |
| A3 | `inputMode="none"` reliably suppresses the mobile keypad on all target browsers for `<input type="number">` with `readOnly` | Pattern 3 | [VERIFIED: MDN HTML inputmode attribute docs] — but some browsers may still show focus indicators. **Mitigation:** if visible, hide with `&:focus { outline: none }` — but DON'T remove the focus visibility for keyboard users |
| A4 | `navigator.canShare({ url })` returns `true` consistently across iOS Safari, Android Chrome, and desktop Chrome | Pattern 5 | [CITED: MDN canShare docs above; CITED: MDN PWA share guide] — well-supported |
| A5 | WCAG SC 2.2.1 (Timing Adjustable) does NOT require user-extensible duration for non-essential toasts | Pattern 11 toast WCAG | [VERIFIED: WCAG 2.2 SC 2.2.1 spec text: "...except when the timing is an essential part of the event or activity, or when the event or activity is not affected by the timing"] — informational toasts qualify |
| A6 | The Phase 8 PresetCard.tsx is not protected under SEG-05 per v1.0-ROADMAP.md (parallel CustomCard.tsx is a "strong preference" not a requirement) | Pattern 8 | [VERIFIED: read v1.0-ROADMAP.md "Cross-Milestone Notes" — listed 20 paths; PresetCard not among them]. CONTEXT D-180 says "Strong preference: parallel CustomCard.tsx to preserve the byte-identical guardrail." Treating as preference, recommending parallel file approach |

**Items needing user confirmation before execution:** A1 (iOS hash quirk smoke-test) is the only one that could surface as a real-device bug; recommend logging as a Wave-N integration verification step. All other assumptions are either verified or have clear in-band mitigations.

---

## Open Questions

1. **Should the modal trap browser-back?** D-14 says "browser-back closes the modal," which works automatically with `<dialog>` on Chrome+Safari (pressing back when a modal is open closes it). But Android Chrome history-back behavior in standalone PWA mode may differ — sometimes pops the PWA itself.
   - What we know: `<dialog>.close()` is the canonical behavior on Escape; browser-back is an OS-level signal.
   - What's unclear: Does Android Chrome PWA standalone treat browser-back as "close dialog if one is open" or "exit PWA"?
   - Recommendation: Leave default `<dialog>` behavior; if real-device testing surfaces wrong behavior, add a `popstate` listener inside the Composer that closes on back-button.

2. **Should `prefers-reduced-motion` users also skip the modal slide?** D-15 says "skip the slide and shorten the fade to 100 ms." Pattern 1's CSS gates this — but the `prefers-reduced-motion: reduce` media query is a user system preference, and we should verify it works alongside the existing `pulse-active` Phase 8 gate.
   - Recommendation: confirm during integration; the gate in Pattern 1 CSS is the standard idiom.

3. **What should the share-URL's `text` field say?** Pattern 5 uses `'Open this gentle alarm in Soundly'`. iOS share-sheet shows `title` prominently; Android shows `text`. The composer doesn't know the composition's user-intent (is it "wake at 8am"? a meditation timer? a Pomodoro?), so a generic text is fine.
   - What we know: The choice doesn't affect functionality, only the share-sheet preview.
   - Recommendation: lock to `'Open this gentle alarm in Soundly'` (current) unless the discuss-phase user prefers different copy.

4. **Should the composer remember segments after Cancel?** CONTEXT explicitly says NO (zen friction-free reversal). But a paranoid user might lose 10 minutes of work to an accidental Cancel tap.
   - What we know: D-14 says Cancel closes without saving; CONTEXT Claude's Discretion says "no" to caching.
   - Recommendation: Honor the lock. Do not implement caching. (User has the share-URL as a workaround for portability.)

5. **Should we run `validateSegmentConfig` ALSO at hash-decode time, or only at composer-Start?**
   - What we know: Pattern 6's `decodeComposition` runs it as defence-in-depth (returns `'failed_validation'` reason).
   - Recommendation: Yes, decoder runs it. Belt + suspenders given SHR-02 + SHR-03.

---

## Sources

### Primary (HIGH confidence)
- **Context7 (`/mdn/content`):**
  - `navigator.share()` + `navigator.canShare()` — fetched verbatim: feature-detection pattern, files/url payload, error handling
  - `navigator.clipboard.writeText` — fetched verbatim: Promise return, secure-context requirement, error path
  - WAI-ARIA `role="radiogroup"` + radio role — fetched: roving tabindex pattern, required JS features
  - Roving tabindex focus management (MDN keyboard-navigable widgets guide) — fetched verbatim
  - `aria-modal` attribute + `HTMLDialogElement` — fetched: alert-dialog example, ariaModal property
  - `role="spinbutton"` — fetched: native input vs ARIA div tradeoff
- **Web Standards Verification:**
  - `<dialog>` element baseline support (caniuse.com / WebKit blog announcement) — confirmed Safari 15.4+
  - WCAG 2.2 SC 2.2.1 — referenced for toast timing decision
- **Existing project files (VERIFIED via Read tool this session):**
  - `package.json` — dependency versions
  - `src/engine/SegmentState.ts` — Segment types, `validateSegmentConfig`, `WAKE_EASY_CONFIG`, ceiling 14_400_000 ms
  - `src/hooks/useActiveAlarm.ts:67` — `activeAlarm.start({ kind: 'segments', config })` entry
  - `src/hooks/useSegmentAlarm.ts` — segment-mode hook surface
  - `src/components/Dashboard.tsx` — current 3-card layout to extend
  - `src/components/PresetCard.tsx` — pattern for CustomCard parallel file
  - `src/components/SegmentCountdown.tsx` — handoff target after composer Start
  - `src/components/SegmentProgressRing.tsx` — runs after composer Start
  - `src/App.tsx` — current 3-way conditional render to extend
  - `src/utils/formatTime.ts:8-13` — `formatMmSs` for total display
  - `src/index.css` — palette + reduced-motion gate already in place
  - `vite.config.ts:7` — `base: '/Soundly/'` for share-URL base path
  - `.planning/milestones/v1.0-ROADMAP.md` — SEG-05 protected-path list (PresetCard NOT included)

### Secondary (MEDIUM confidence)
- WebSearch — Dev.to / WebKit / caniuse on `<dialog>` element 2026 browser support
- iOS Safari standalone `location.hash` historical bug (per training data + general PWA knowledge — needs smoke-test)

### Tertiary (LOW confidence)
- None for this research; every claim is verified by Context7 docs, WebSearch with multiple corroborating sources, or direct file read.

---

## Metadata

**Confidence breakdown:**
- Standard stack (browser APIs, no new deps): HIGH — all APIs verified via Context7 + caniuse + existing v2026 baseline
- Modal pattern (`<dialog>`): HIGH — well-trodden, browser-native, Safari 15.4 floor confirmed
- URL-hash decoder (Result type, error categories): HIGH — pure-function logic, all edge cases tabulated
- Web Share + clipboard: HIGH — MDN-canonical detection pattern; all rejection branches handled
- StepperInput keyboard + ARIA: HIGH — native input + verified MDN spinbutton-role guidance; one MEDIUM caveat on `opacity-40` WCAG contrast (discussed)
- SoundPicker radiogroup + roving tabindex: HIGH — MDN canonical pattern verbatim
- Composer reducer + derived state: HIGH — standard React 19 idiom; pure-function testable
- CustomCard parallel file decision: HIGH — verified PresetCard NOT in SEG-05 protected list; CONTEXT preference confirmed
- Toast pattern: HIGH — straightforward; WCAG 2.2.1 reasoning documented
- iOS standalone hash preservation: MEDIUM — recommend smoke-test as in-band mitigation
- Modal slide animation reduced-motion gate: MEDIUM — recommend visual verification
- Common pitfalls (10 items): HIGH — every pitfall has a concrete prevention strategy in code

**Research date:** 2026-05-10
**Valid until:** 2026-06-10 (30 days; browser APIs stable, project stack stable; revisit only if a major React/Vite/Tailwind release lands)

## RESEARCH COMPLETE
