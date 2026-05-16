# Phase 9: Custom Composer + Share via URL — Pattern Map

**Mapped:** 2026-05-16
**Files analyzed:** 16 (14 new + 2 modified)
**Analogs found:** 11 / 16 (5 are net-new patterns to the codebase — modal, reducer, radiogroup, role=status toast, URL hash decode)

> **Reading instructions for planner.** Every Phase 9 file falls into one of three categories:
>
> 1. **Direct analog** — copy idioms/class strings from a named existing file (e.g. CustomCard mirrors PresetCard). The planner's `<read_first>` block should list the analog file with line ranges.
> 2. **No analog (NEW pattern)** — the codebase has no precedent. Cite the line-anchored excerpt in `09-RESEARCH.md` + verbatim contract in `09-UI-SPEC.md`. The planner's `<read_first>` block must point at those.
> 3. **Self-analog (modification)** — `Dashboard.tsx` / `App.tsx`. Read the current file and apply a minimal diff.
>
> **SEG-05 / byte-identical floor**: Phase 7/8 deliverables (`SegmentEngine`, `SegmentState`, `SegmentCountdown`, `SegmentProgressRing`, `useSegmentAlarm`, `useActiveAlarm`, `triangle`, `segmentSound`) and v1 protected paths (`Countdown`, `ProgressRing`, `useAlarm`, `AlarmEngine`, `AlarmState`, `AlarmSession`, `AudioContext`, `timer`, `engine/sounds/*` minus phase-7 additions, `platform/*`) are **READ-ONLY**. They appear in `<read_first>` to copy idioms FROM, never in `<action>` to modify. `PresetCard.tsx` is not formally SEG-05 protected but is treated as frozen per CONTEXT D-180 (strong preference: parallel file).

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/Composer.tsx` | component (modal host) | event-driven (reducer dispatch) | `src/components/SegmentCountdown.tsx` (layout idioms only) | **partial** — no modal precedent; NEW pattern |
| `src/components/SegmentRow.tsx` | component (composite row) | event-driven | `src/components/PresetCard.tsx` (button-card shell) + RESEARCH Pattern 10 | partial — composition is NEW |
| `src/components/StepperInput.tsx` | component (form control) | event-driven (keyboard + click) | none — **NEW** (native `<input type="number">` + +/− buttons per RESEARCH Pattern 3) | **NEW pattern** |
| `src/components/SoundPicker.tsx` | component (radiogroup) | event-driven | none — **NEW** (ARIA radiogroup + roving tabindex per RESEARCH Pattern 4) | **NEW pattern** |
| `src/components/Toast.tsx` | component (live region) | event-driven (timer-dismissed) | none — **NEW** (`role="status"` aria-live="polite" per RESEARCH Pattern 11) | **NEW pattern** |
| `src/components/CustomCard.tsx` | component (card button) | event-driven (onClick) | `src/components/PresetCard.tsx` | **exact** — direct mirror with visual deltas |
| `src/lib/shareUrl.ts` | lib (pure functions) | transform (encode/decode) | `src/engine/SegmentState.ts` (`validateSegmentConfig` Result-type idiom) | role-match |
| `src/lib/composerValidation.ts` | lib (pure functions) | transform (per-row flags) | `src/engine/SegmentState.ts` `validateSegmentConfig` (wraps it) | role-match |
| `src/lib/composerReducer.ts` | lib (pure reducer) | transform (state → state) | none — **NEW** (first useReducer in codebase per RESEARCH Pattern 2) | **NEW pattern** |
| `src/hooks/useHashComposition.ts` | hook | request-response (read URL once at mount) | `src/hooks/useActiveAlarm.ts` (hook surface idiom) | partial — no URL-routing precedent |
| `src/components/__tests__/Composer.test.tsx` | test (RTL integration) | request-response | `src/components/__tests__/Dashboard.test.tsx` (RTL + cleanup) + `SegmentCountdown.test.tsx` (fixture pattern) | role-match |
| `src/components/__tests__/SegmentRow.test.tsx` | test (RTL integration) | request-response | `src/components/__tests__/Dashboard.test.tsx` | role-match |
| `src/components/__tests__/StepperInput.test.tsx` | test (RTL + fireEvent.keyDown) | request-response | `src/components/__tests__/Dashboard.test.tsx` | role-match |
| `src/components/__tests__/SoundPicker.test.tsx` | test (RTL + keyboard) | request-response | `src/components/__tests__/Dashboard.test.tsx` | role-match |
| `src/lib/__tests__/shareUrl.test.ts` | test (pure unit) | transform | `src/engine/__tests__/validateSegmentConfig.test.ts` | **exact** |
| `src/hooks/__tests__/useHashComposition.test.ts` | test (renderHook + window mock) | request-response | `src/hooks/__tests__/useActiveAlarm.test.ts` (renderHook idiom) + `src/platform/__tests__/standalone.test.ts` (window/navigator mocking) | role-match |
| `src/components/Dashboard.tsx` (modify) | component | event-driven | **self-analog** — current shape at `src/components/Dashboard.tsx:30-68` | exact |
| `src/App.tsx` (modify) | composition root | event-driven | **self-analog** — current shape at `src/App.tsx:1-17` | exact |
| `src/index.css` (append) | CSS | n/a | self-analog at `src/index.css:20-30` (pulse-active-arc block) | exact |

---

## Pattern Assignments

### `src/components/CustomCard.tsx` (NEW — component, event-driven)

**Match quality:** EXACT MIRROR. The cleanest copy job in the phase.

**Analog (READ-ONLY):** `src/components/PresetCard.tsx` (entire file, 27 lines).

**What to copy verbatim from PresetCard.tsx:**
- Lines 16-26: the entire `<button>` shell — `w-full p-6 rounded-2xl ... text-left min-h-[80px] active:scale-[0.98] transition-transform duration-150` + `type="button"`.
- Lines 23-24: inner `<p>` typography — `text-xl font-semibold text-text-primary` (title) + `text-sm text-text-secondary mt-1` (description).

**Deltas locked by UI-SPEC `09-UI-SPEC.md:194-217` (verbatim Tailwind class string for CustomCard.tsx):**

| Property | PresetCard (analog) | CustomCard (new) |
|----------|---------------------|------------------|
| Border | `border border-border` | `border-2 border-dashed border-border` (D-09: dashed signals "create") |
| Background | `bg-white/60` | `bg-bg` (creative space, not preset surface) |
| Inner layout | two `<p>` stacked | `flex items-start gap-3` with `+` glyph column + text column |
| `+` glyph | none | `<span aria-hidden="true" className="text-2xl text-sage font-light leading-none mt-0.5">+</span>` |
| Hover | none | `hover:border-text-secondary/60` |
| Focus ring | browser default | `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40` (dashed border weakens default ring) |
| Prop signature | `name: string; description: string; onStart: () => void` | `onClick: () => void` (literals `Custom` / `Compose your own alarm` baked in, per D-09) |
| `aria-label` | implicit from text | `aria-label="Open custom alarm composer"` (UI-SPEC L257 — disambiguates the short `Custom` label) |

**Verbatim class string (from UI-SPEC L194-217):**
```tsx
<button
  onClick={onClick}
  type="button"
  aria-label="Open custom alarm composer"
  className="
    w-full p-6 rounded-2xl
    border-2 border-dashed border-border
    bg-bg
    text-left min-h-[80px]
    active:scale-[0.98] transition-transform duration-150
    hover:border-text-secondary/60
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage/40
  "
>
  <div className="flex items-start gap-3">
    <span aria-hidden="true" className="text-2xl text-sage font-light leading-none mt-0.5">+</span>
    <div className="flex-1">
      <p className="text-xl font-semibold text-text-primary">Custom</p>
      <p className="text-sm text-text-secondary mt-1">Compose your own alarm</p>
    </div>
  </div>
</button>
```

**SEG-05 status:** CustomCard is NEW (not protected). PresetCard is NOT formally SEG-05 protected per `.planning/milestones/v1.0-ROADMAP.md` (verified via RESEARCH Assumption A6 at `09-RESEARCH.md:1516`), but is treated as frozen per CONTEXT D-180 — **strong preference: parallel file, do NOT extend PresetCard with a `variant` prop**.

---

### `src/components/Composer.tsx` (NEW — component, event-driven)

**Match quality:** PARTIAL. No modal precedent in codebase. Composer is the first `<dialog>` element.

**Analogs (READ-ONLY):**
- **Layout idioms:** `src/components/SegmentCountdown.tsx:91-92` (page-wrapper `flex flex-col items-center w-full max-w-md mx-auto px-6 py-12` — also at `Countdown.tsx:111`).
- **Footer button class strings:** `src/components/Countdown.tsx:138-150` (Cancel/Stop secondary + primary button pair; **byte-identical inheritance** mandated by `09-UI-SPEC.md:597-614`).
- **Disabled-state pattern:** `src/components/SegmentCountdown.tsx:138` (`disabled:opacity-40 disabled:cursor-not-allowed`).
- **State hook composition:** `src/hooks/useActiveAlarm.ts:44-76` (idiom for hook surface return shape — not the reducer, but the discriminated-union return that App.tsx already narrows on).

**NEW pattern citations (no analog exists):**
- **Native `<dialog>` modal:** `09-RESEARCH.md:261-371` (Pattern 1) — full `useRef<HTMLDialogElement>` + `showModal()` / `close()` + `'close'` event binding lifecycle.
- **`useReducer` consumption:** `09-RESEARCH.md:374-453` (Pattern 2) — 6-action union (`load | add | duplicate | delete | update_duration | update_sound`); lazy init via 3rd `useReducer` arg.
- **Derived state via `useMemo`:** `09-RESEARCH.md:894-933` (Pattern 7) — `totalMs` + `validation` + `rowValid[]` all memoized off `config.segments`.
- **Share handler:** `09-RESEARCH.md:651-705` (Pattern 5) — `navigator.canShare?.(data)` gate, AbortError silence, clipboard fallback.

**Verbatim contract from `09-UI-SPEC.md`:**
- Modal frame layout (sticky header / Total / scrollable list / footer): UI-SPEC L79-96.
- Copywriting (every user-visible string): UI-SPEC L249-322. Critical literals:
  - Modal title `<h2 id="composer-title">Custom alarm</h2>`
  - Close-X `aria-label="Close composer"`, glyph `×` (U+00D7)
  - Total `Total: {mm:ss}` with `tabular-nums`
  - Add Segment label `+ Add segment`, `aria-label="Add segment"`
  - Footer buttons: `Cancel`, `Share`, `Start`
  - Disabled Start tooltip `Fix invalid segments first` (D-11 LOCKED)
- Animation CSS (append to `src/index.css`): UI-SPEC L633-666 (verbatim).
- Footer button class strings (byte-identical from `Countdown.tsx`): UI-SPEC L600-614.
- Visual hierarchy (Title → Total → rows → footer): UI-SPEC L331-351.

**`activeAlarm.start` integration on Start tap (consumed unchanged):**
```ts
// Composer's onStart prop is called by App.tsx in App.tsx; the inner handler is:
await activeAlarm.start({ kind: 'segments', config: composedConfig });
```
Source surface: `src/hooks/useActiveAlarm.ts:35-37` (PresetSelection union) + `src/hooks/useActiveAlarm.ts:62-74` (idle.start signature). **This surface is consumed verbatim — do NOT modify `useActiveAlarm.ts`.**

**Default config seeding (D-21):** Reducer's `load` action is dispatched with either `props.initialConfig` (provided by App.tsx; either `hash.composition` or `WAKE_EASY_CONFIG` from `src/engine/SegmentState.ts:104-112`). The 3rd `useReducer` argument (lazy init) routes the initial config through the same `load` action so IDs are normalized on first mount.

**SEG-05 status:** Composer is NEW (not protected). `SegmentCountdown.tsx` and `Countdown.tsx` are **READ-ONLY analogs** — copy idioms FROM them, do NOT modify them.

---

### `src/components/SegmentRow.tsx` (NEW — component, event-driven)

**Match quality:** PARTIAL. No row-composition precedent; assembled from new building blocks.

**Analogs (READ-ONLY):**
- **Card-shell idiom:** `src/components/PresetCard.tsx:16-26` (`w-full p-6 rounded-2xl border ... bg-...` pattern — adapt for row-shape).
- **Disabled icon button (for Delete-when-last-segment):** `src/components/SegmentCountdown.tsx:135-141` (Pause button: `disabled` attribute + `disabled:opacity-40 disabled:cursor-not-allowed` + `title=`).

**NEW pattern citations:**
- **Row composition (stepper | sound | duplicate | delete):** `09-RESEARCH.md:1031-1085` (Pattern 10).
- **Grid layout with responsive wrap:** `09-UI-SPEC.md:354-391` (verbatim CSS Grid declaration for desktop 4-column + mobile 2-row stack).
- **Invalid-row border (D-11):** `09-UI-SPEC.md:172-191` (`border border-accent/50 rounded-lg` when invalid; `transition-colors duration-200`).

**Verbatim contract from UI-SPEC L354-391:**
```tsx
<div
  className={
    'grid gap-4 px-6 py-4 border-b border-border ' +
    (isInvalid ? 'border border-accent/50 rounded-lg' : '') +
    ' grid-cols-[auto_1fr_auto_auto] ' +
    'max-[480px]:grid-cols-[1fr_auto_auto] ' +
    'max-[480px]:grid-rows-[auto_auto]'
  }
>
  <StepperInput ... aria-invalid={isInvalid} />
  <SoundPicker ... className="max-[480px]:col-span-3" />
  <button onClick={onDuplicate} aria-label="Duplicate segment" className="w-11 h-11 rounded-full hover:bg-white/40 active:scale-[0.95] transition-transform text-text-secondary">⧉</button>
  <button onClick={onDelete} disabled={isLastSegment} aria-label="Delete segment" className="w-11 h-11 rounded-full hover:bg-white/40 active:scale-[0.95] transition-transform text-text-secondary disabled:opacity-40 disabled:cursor-not-allowed" title={isLastSegment ? 'At least one segment required' : undefined}>×</button>
</div>
```

**Copywriting (UI-SPEC L268-285):**
- Duplicate glyph `⧉` (U+29C9), `aria-label="Duplicate segment"`
- Delete glyph `×` (U+00D7), `aria-label="Delete segment"`
- Delete disabled tooltip `At least one segment required` (D-12 LOCKED)

**Prop signature (from RESEARCH Pattern 10 at `09-RESEARCH.md:1037-1047`):**
```ts
interface SegmentRowProps {
  segment: Segment;
  index: number;
  isOnlyRow: boolean;       // disables delete when true (D-12)
  isInvalid: boolean;       // accent border (D-11)
  onDurationChange: (ms: number) => void;
  onSoundChange: (s: Segment['endSound']) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}
```

**SEG-05 status:** SegmentRow is NEW.

---

### `src/components/StepperInput.tsx` (NEW — component, event-driven)

**Match quality:** NEW. No form-control precedent in the codebase.

**Analog (READ-ONLY):** none. Closest in vibe is `src/components/IosInstallBanner.tsx:36-44` (a `<button>` with `aria-label` + Tailwind utility chain) but the structural needs are unrelated.

**NEW pattern citations:**
- **Component shape (button + native `<input type="number">` + button):** `09-RESEARCH.md:472-552` (Pattern 3 — full implementation).
- **Adaptive step + boundary case at 5:00:** `09-RESEARCH.md:482-510` (constants + `stepFor()` + `decrease()` boundary handling).
- **Keyboard map (Arrow / Shift+Arrow / PageUp-Down):** `09-RESEARCH.md:511-520` + UI-SPEC L545-555 (D-02 LOCKED).
- **Min/max clamp (5 s / 60 min):** `09-RESEARCH.md:494-496`.
- **`inputMode="none"` + `readOnly` mobile-keypad suppression:** `09-RESEARCH.md:457-470` (Pattern 3 rationale).
- **Verbatim Tailwind layout:** `09-UI-SPEC.md:398-422`.

**Verbatim constants (D-01 / D-02 — copy from `09-RESEARCH.md:483-489`):**
```ts
const SMALL_STEP_THRESHOLD_MS = 300_000;   // 5:00 boundary (D-01)
const SMALL_STEP_MS = 30_000;              // 30 s (D-01)
const LARGE_STEP_MS = 60_000;              // 1 min (D-01)
const SHIFT_STEP_MS = 300_000;             // 5 min (D-02 Shift+Arrow + PageUp/Down)
const DEFAULT_MIN = 5_000;                 // 5 s floor (D-02 + SEG-04)
const DEFAULT_MAX = 3_600_000;             // 60 min ceiling (D-02)
```

**Boundary case (D-01 at exactly 5:00): RESEARCH `09-RESEARCH.md:503-509`:**
```ts
const step = valueMs > SMALL_STEP_THRESHOLD_MS ? LARGE_STEP_MS
           : valueMs === SMALL_STEP_THRESHOLD_MS ? LARGE_STEP_MS  // boundary: drop by 1 min to 4:00
           : SMALL_STEP_MS;
```

**Copywriting (UI-SPEC L272-275):**
- `−` aria-label `Decrease duration`, `+` aria-label `Increase duration`
- Visible glyphs: `−` (U+2212), `+` (U+002B)
- Input `aria-label="Segment duration"`; SR readout via `aria-valuetext={formatMmSs(valueMs)}` (RESEARCH `09-RESEARCH.md:537`)

**Reuse:** `formatMmSs(valueMs)` from `src/utils/formatTime.ts:8-13` for display. **Do NOT reformat**.

**SEG-05 status:** StepperInput is NEW.

---

### `src/components/SoundPicker.tsx` (NEW — component, event-driven)

**Match quality:** NEW. First ARIA radiogroup in the codebase.

**Analog (READ-ONLY):** none. Closest analog is the SOUND_LABELS pattern at `src/components/SegmentCountdown.tsx:30-35` — a `Record<Segment['endSound'], string>` map. SoundPicker has its own picker-specific labels per D-06.

**NEW pattern citations:**
- **`role="radiogroup"` + roving tabindex:** `09-RESEARCH.md:560-647` (Pattern 4 — full implementation).
- **Keyboard map (ArrowLeft/Right wraps; Enter/Space selects):** D-07 LOCKED + UI-SPEC L571-579 + `09-RESEARCH.md:599-612`.
- **Pill color contract (selected: `bg-sage` / `bg-sand` / `bg-accent`; unselected: outlined):** UI-SPEC L146-168.

**Critical D-06 label divergence:**
| endSound key | Picker label (SoundPicker) | Phase label (SegmentCountdown — UNCHANGED) |
|--------------|----------------------------|--------------------------------------------|
| `gentle` | `Gentle` | `Gentle chime` |
| `triangle` | `Triangle` | `Triangle ping` |
| `alarm` | `Alarm` | `Wake` |

SoundPicker uses `Alarm`; the running-alarm screen still says `Wake`. **Do NOT consolidate the two label maps.** See `src/components/SegmentCountdown.tsx:30-35` for the unchanged SOUND_LABELS — protected, do not modify.

**Verbatim contract from UI-SPEC L436-473 (per-pill class string with `text-text-primary` override for sand pill — contrast rationale at UI-SPEC L165-171):**
```ts
// Selected pill background per endSound:
const PILL_SELECTED_BG: Record<'gentle' | 'triangle' | 'alarm', string> = {
  gentle:   'bg-sage text-white',
  triangle: 'bg-sand text-text-primary',  // sand is light — primary text reads better than white
  alarm:    'bg-accent text-white',
};

// Unselected pill: bg-transparent text-text-secondary, hover/focus at 10% tint
```

**Container class string (UI-SPEC L440):**
```tsx
<div
  role="radiogroup"
  aria-label="End-of-segment sound"
  className="inline-flex items-stretch rounded-xl border border-border bg-bg p-1 gap-1"
>
```

**Per-pill button (UI-SPEC L447-466):**
```tsx
<button
  key={sound}
  type="button"
  role="radio"
  aria-checked={isSelected}
  tabIndex={isSelected ? 0 : -1}   // roving tabindex (only selected is tab-focusable)
  onClick={() => onChange(sound)}
  onKeyDown={handlePickerKeyDown}
  className="flex-1 min-h-[44px] px-4 py-2 rounded-lg text-sm transition-colors ..."
>
  {label}
</button>
```

**Prop signature (RESEARCH `09-RESEARCH.md:589-593`):**
```ts
interface SoundPickerProps {
  value: Segment['endSound'];
  onChange: (next: Segment['endSound']) => void;
  rowIndex?: number;  // optional, used to derive unique aria-label if multiple groups
}
```

**Reuse:** `Segment['endSound']` type from `src/engine/SegmentState.ts:17`. Import via `src/engine/index.ts:35-39` barrel (`import type { Segment } from '../engine'`).

**SEG-05 status:** SoundPicker is NEW. SegmentCountdown SOUND_LABELS is READ-ONLY (do not modify; do not consolidate).

---

### `src/components/Toast.tsx` (NEW — component, event-driven)

**Match quality:** NEW. First toast in the codebase.

**Analog (READ-ONLY):** none. Closest structural cousin is `src/components/IosInstallBanner.tsx:31-45` (a fixed/positioned div with action button + Tailwind utilities) but the ARIA semantic is unrelated.

**NEW pattern citations:**
- **Component shape (single instance, replaces-on-emit):** `09-RESEARCH.md:1088-1128` (Pattern 11).
- **`role="status"` + `aria-live="polite"` (NOT assertive — calm zen aesthetic):** `09-RESEARCH.md:1090-1097` + UI-SPEC L505-510.
- **Auto-dismiss via `setTimeout` in `useEffect`:** `09-RESEARCH.md:1111-1115`.

**Verbatim contract from UI-SPEC L484-498:**
```tsx
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
  className={
    'fixed left-1/2 -translate-x-1/2 bottom-8 z-50 ' +
    'px-4 py-3 rounded-xl bg-text-primary/95 text-bg text-sm shadow-lg ' +
    'max-w-[calc(100vw-2rem)] text-center ' +
    'transition-opacity duration-200 ' +
    (visible ? 'opacity-100' : 'opacity-0 pointer-events-none')
  }
>
  {message}
</div>
```

**Auto-dismiss timings (LOCKED — UI-SPEC L500-502):**
- Share success: 3 s (D-19)
- Share rejection: 4 s
- Decode failure: 4 s (D-18)

**Copywriting (UI-SPEC L299-303):**
- `Share link copied to clipboard` (clipboard success — 3 s)
- `Couldn't copy — try copying from the address bar` (share/clipboard rejection — 4 s)
- `Couldn't load shared alarm — using default` (decode failure at mount — 4 s)

**Prop signature (RESEARCH `09-RESEARCH.md:1104-1108`):**
```ts
interface ToastProps {
  message: string | null;
  durationMs: number;
  onDismiss: () => void;
}
```

**WCAG 2.2.1 note:** Toast timings (3 s / 4 s) are below the 5-second floor but qualify for the "non-essential informational" exception. Add a code comment per RESEARCH `09-RESEARCH.md:1174`.

**SEG-05 status:** Toast is NEW.

---

### `src/lib/shareUrl.ts` (NEW — lib, transform)

**Match quality:** ROLE-MATCH. The encode/decode Result-type idiom mirrors `validateSegmentConfig`.

**Analog (READ-ONLY — copy idioms from):** `src/engine/SegmentState.ts:39-94`.

**Idioms to copy from validateSegmentConfig (`src/engine/SegmentState.ts:39-94`):**
- Discriminated-union Result type (lines 39-41):
  ```ts
  export type SegmentValidationResult =
    | { ok: true; config: SegmentConfig }
    | { ok: false; error: string };
  ```
  → shareUrl's `DecodeResult` follows the same shape per `09-RESEARCH.md:738-740`:
  ```ts
  export type DecodeResult =
    | { ok: true; config: SegmentConfig }
    | { ok: false; reason: 'wrong_version' | 'malformed' | 'too_long' | 'invalid_segment_data' | 'failed_validation' };
  ```
- **NEVER THROW** contract (SegmentState.ts line 6-7 doc comment): "MUST return a discriminated union, NEVER throw". shareUrl decoder inherits this — see SHR-03 + RESEARCH Pattern 6.
- Defence-in-depth gating: decoder runs `validateSegmentConfig` as final check (SegmentState.ts:59 import; RESEARCH `09-RESEARCH.md:810-813`):
  ```ts
  const result = validateSegmentConfig({ segments });
  if (!result.ok) return { ok: false, reason: 'failed_validation' };
  return { ok: true, config: result.config };
  ```

**NEW pattern citations:**
- **Full encode/decode implementation:** `09-RESEARCH.md:712-832` (Pattern 6).
- **Format spec (`c=v1:<durationMs>-<soundIdx>,...`):** D-16 LOCKED + `09-RESEARCH.md:713-717`.
- **Sound idx mapping (`gentle=0`, `triangle=1`, `alarm=2`):** `09-RESEARCH.md:727-736`.
- **Size cap (1024 chars / 32 segments):** D-17 + `09-RESEARCH.md:769`.
- **Strict integer parse (`/^\d+$/`):** `09-RESEARCH.md:796-798`.
- **Tolerance for leading `#` and `c=`:** `09-RESEARCH.md:764-767`.
- **Error category table:** `09-RESEARCH.md:817-830`.
- **GitHub Pages base-path safety:** `09-RESEARCH.md:705` — always derive from `location.origin + location.pathname`, NOT `location.origin` alone (avoids `Pitfall 9` at `09-RESEARCH.md:1300-1304`).

**Reuse imports:**
- `import { validateSegmentConfig, type SegmentConfig, type Segment } from '../engine/SegmentState';` (or via barrel at `src/engine/index.ts:40`)

**SEG-05 status:** shareUrl is NEW. `SegmentState.ts` is READ-ONLY (consumed via existing exports).

---

### `src/lib/composerValidation.ts` (NEW — lib, transform)

**Match quality:** ROLE-MATCH. Wraps `validateSegmentConfig` for per-row UI feedback.

**Analog (READ-ONLY — wraps):** `src/engine/SegmentState.ts:59-94` (`validateSegmentConfig`).

**Function signature (from RESEARCH `09-RESEARCH.md:937-950`):**
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

**Why both row-level + whole-config validation:** D-11 requires the per-row border (red outline on invalid rows) AND the Start-button disabled-state (whole-config rejection). `validateSegmentConfig` returns first-fail only — `rowValidityArray` runs the same checks per-segment so the composer knows WHICH rows to highlight.

**The 14_400_000 ceiling** mirrors `MAX_DURATION_MS` at `src/engine/SegmentState.ts:43`. **Do NOT redefine** — for now duplicating 14_400_000 inline (RESEARCH says the validator is the source of truth) is acceptable; a future plan could export it from `SegmentState.ts` but that touches a frozen file.

**SEG-05 status:** composerValidation is NEW. `SegmentState.ts` is READ-ONLY.

---

### `src/lib/composerReducer.ts` (NEW — lib, transform)

**Match quality:** NEW. First useReducer reducer in the codebase.

**Analog (READ-ONLY):** none. Closest cousin is the segment-state machine in `src/engine/SegmentEngine.ts` (event-driven state transitions) — but that's a class-based engine, not a pure reducer.

**NEW pattern citations:**
- **Full reducer implementation:** `09-RESEARCH.md:386-443` (Pattern 2) — verbatim.
- **6-action union (`load | add | duplicate | delete | update_duration | update_sound`):** `09-RESEARCH.md:397-403`.
- **ID generation (`composer-<timestamp>-<counter>`):** `09-RESEARCH.md:391-395`. **Do NOT use `Date.now().toString()` alone** — tests will be flaky. **Do NOT add a UUID lib** — engine treats IDs as opaque per Phase 7 D-18.
- **MAX_SEGMENTS = 32** (matches D-17 size cap): `09-RESEARCH.md:390`.
- **`load` action regenerates IDs** to stabilize React keys: `09-RESEARCH.md:407-411`.
- **`delete` guard for last-remaining segment** (D-12 enforcement at reducer level — belt-and-suspenders with UI disabled state): `09-RESEARCH.md:427-429`.

**Critical: NEVER call dispatch in render path** — `09-RESEARCH.md:1272-1275` (Pitfall 6). All dispatches happen from event handlers.

**SEG-05 status:** composerReducer is NEW. The `Segment` / `SegmentConfig` types it imports from `src/engine/SegmentState.ts:14-22` are READ-ONLY (consume; do not redefine).

---

### `src/hooks/useHashComposition.ts` (NEW — hook, request-response)

**Match quality:** PARTIAL. No URL-routing precedent.

**Analog (READ-ONLY — hook surface idiom):** `src/hooks/useActiveAlarm.ts:44-76`.

**Idioms to copy from useActiveAlarm:**
- File-level doc comment style (`useActiveAlarm.ts:1-27`).
- Single hook function exported as named export, with explicit return type interface.
- React import surface: `import { useState, useEffect } from 'react';` — same idiom as `useActiveAlarm.ts:29`.

**NEW pattern citations:**
- **Full hook implementation:** `09-RESEARCH.md:838-887` (Pattern 6).
- **Synchronous read via `useState` initializer** (NOT `useEffect`, to avoid Dashboard-flicker — Pitfall 2 at `09-RESEARCH.md:1247-1251`): `09-RESEARCH.md:854-871`.
- **`history.replaceState` clear in `useEffect`** (post-commit, never in render — Pitfall 5 at `09-RESEARCH.md:1265-1269`): `09-RESEARCH.md:874-881`.
- **SSR guard (`typeof window === 'undefined'`):** `09-RESEARCH.md:859`.
- **Hash discriminator (`#c=` prefix check):** `09-RESEARCH.md:862-865` — non-`c=` hashes are ignored (not treated as errors).

**Return shape (`09-RESEARCH.md:843-849`):**
```ts
interface HashCompositionState {
  composition: SegmentConfig | null;
  error: Exclude<DecodeResult, { ok: true }>['reason'] | null;
  clearError: () => void;
}
```

**Reuse:**
- `decodeComposition` from `../lib/shareUrl`
- `SegmentConfig` type from `../engine/SegmentState`

**iOS Safari hash quirk (RESEARCH Assumption A1 + `09-RESEARCH.md:890`):** MEDIUM confidence that iOS standalone-mode preserves `location.hash` on cold-start. Document in code comment; smoke-test during integration.

**SEG-05 status:** useHashComposition is NEW. `useActiveAlarm.ts` is READ-ONLY analog (consumed via exports, NOT modified).

---

### `src/components/Dashboard.tsx` (MODIFY — component, event-driven)

**Match quality:** SELF-ANALOG. Tiny diff.

**Read first:** `src/components/Dashboard.tsx` (current shape lines 1-68).

**Diff specification (from RESEARCH Pattern 9 at `09-RESEARCH.md:998-1024`):**

1. **Add prop** to `DashboardProps` (line 26-28):
   ```ts
   interface DashboardProps {
     activeAlarm: Extract<ActiveAlarmState, { mode: 'idle' }>;
     onCustomClick: () => void;   // NEW
   }
   ```
2. **Destructure** new prop in the function signature (line 30):
   ```ts
   export default function Dashboard({ activeAlarm, onCustomClick }: DashboardProps) {
   ```
3. **Add import** (after line 23):
   ```ts
   import CustomCard from './CustomCard';
   ```
4. **Append 4th card** inside the `<div className="mt-10 w-full flex flex-col gap-4">` block AFTER the `4 x 4` PresetCard (after line 53):
   ```tsx
   <CustomCard onClick={onCustomClick} />
   ```

**Order locked by D-08:** `Quick Nap → Focus → 4 x 4 → Custom`. The new card sits AT THE BOTTOM, after `4 x 4`.

**Test fallout:** `src/components/__tests__/Dashboard.test.tsx` will need:
- `makeIdleActiveAlarm()` updated to include `onCustomClick: vi.fn()` (or test fixture passes it as a separate prop).
- New test: `clicking the Custom card invokes onCustomClick`.
- Existing document-order test (`src/components/__tests__/Dashboard.test.tsx:34-51`) extended with the 4th card.

**SEG-05 status:** Dashboard is NOT formally SEG-05 protected (verified via RESEARCH Assumption A6 + scoped to v1 paths). Per Phase 8 STATE.md, Dashboard was already extended once in Phase 8 P03 (added the 4 x 4 card). Extending it again here is the established pattern.

---

### `src/App.tsx` (MODIFY — composition root, event-driven)

**Match quality:** SELF-ANALOG. Modest diff (composer mount + toast + hook wiring).

**Read first:** `src/App.tsx` (current shape lines 1-17).

**Diff specification (from RESEARCH `09-RESEARCH.md:1131-1172`):**

1. **Add imports:**
   ```ts
   import { useState, useEffect } from 'react';
   import Composer from './components/Composer';
   import Toast from './components/Toast';
   import { useHashComposition } from './hooks/useHashComposition';
   import { WAKE_EASY_CONFIG } from './engine';   // already-exported per src/engine/index.ts:40
   ```

2. **Add state + hook calls** at the top of `App()`:
   ```ts
   const activeAlarm = useActiveAlarm();
   const hash = useHashComposition();
   const [composerOpen, setComposerOpen] = useState(hash.composition !== null);
   const [initialConfig] = useState(hash.composition ?? WAKE_EASY_CONFIG);
   const [toast, setToast] = useState<{ msg: string; ms: number } | null>(null);

   useEffect(() => {
     if (hash.error !== null) {
       setToast({ msg: "Couldn't load shared alarm — using default", ms: 4000 });
       hash.clearError();
     }
   }, [hash.error]);
   ```

3. **Wire `onCustomClick` to Dashboard:**
   ```tsx
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
   ```

4. **Mount Toast at root level (outside the mode branches):**
   ```tsx
   <Toast
     message={toast?.msg ?? null}
     durationMs={toast?.ms ?? 0}
     onDismiss={() => setToast(null)}
   />
   ```

5. **Keep existing Countdown / SegmentCountdown branches unchanged** (`src/App.tsx:12-13`). The version footer at `src/App.tsx:14` also stays.

**Critical: composer mounts as a SIBLING to Dashboard inside the `mode === 'idle'` branch** (so it lives in the same render tree but the `<dialog>` element's top-layer stacking handles visual layering). Do NOT use createPortal — RESEARCH `09-RESEARCH.md:1220-1224` ("Don't Build" list).

**SEG-05 status:** App.tsx is NOT formally SEG-05 protected. Extending the mode switch is the Phase 8-established pattern (already extended once for SegmentCountdown).

---

### `src/index.css` (APPEND — CSS)

**Match quality:** SELF-ANALOG (append-only, after existing keyframe block).

**Read first:** `src/index.css` (current shape lines 1-30 — palette + `pulse-active-arc` block).

**Diff specification:** APPEND verbatim from UI-SPEC L633-666 / RESEARCH `09-RESEARCH.md:336-368` after line 30:

```css
/* Phase 9: Composer modal scrim + open animation (D-15) */
dialog::backdrop {
  background: rgba(61, 74, 56, 0.4);   /* --color-text-primary at 40% alpha */
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
    animation: dialog-in-reduced 100ms ease-out forwards;
  }
  @keyframes dialog-in-reduced {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
}
```

**No other CSS edits.** All component styling lives in Tailwind utilities.

**SEG-05 status:** `src/index.css` palette + existing keyframes are READ-ONLY. Append only.

---

### Test Files

#### `src/lib/__tests__/shareUrl.test.ts` (NEW — pure unit test)

**Analog (READ-ONLY — direct copy of test structure):** `src/engine/__tests__/validateSegmentConfig.test.ts` (entire file).

**Idioms to copy:**
- `import { describe, it, expect } from 'vitest';` (line 1 of analog)
- Nested `describe(...)` per category: `'valid inputs'`, `'rejects malformed input shape'`, `'rejects invalid duration values'` (mirror lines 9, 33, 63 of analog).
- Direct comparison `expect(result.ok).toBe(true/false)` + narrowed `if (result.ok) { expect(result.config).toEqual(...) }` (mirror lines 12-16).
- No mocking; no React; no jsdom needed (pure-function tests run fastest).

**Test cases to cover (from RESEARCH error category table at `09-RESEARCH.md:817-830`):**
| Input | Expected reason |
|-------|------------------|
| `c=v2:240000-0` | `'wrong_version'` |
| `c=v1:abc-def` | `'malformed'` |
| 1500-char garbage | `'too_long'` |
| `c=v1:240000-9` | `'invalid_segment_data'` |
| `c=v1:` | `'invalid_segment_data'` |
| `c=v1:0-0,0-0` | `'invalid_segment_data'` |
| `c=foo` | `'malformed'` |
| `c=v1:60000-0` | `{ ok: true }` (single segment smoke test) |
| Encode → decode round-trip on WAKE_EASY_CONFIG | `{ ok: true }` with same segments |

#### `src/components/__tests__/Composer.test.tsx` + `SegmentRow.test.tsx` + `StepperInput.test.tsx` + `SoundPicker.test.tsx` (NEW — RTL integration)

**Analog (READ-ONLY — RTL idiom):** `src/components/__tests__/Dashboard.test.tsx` (entire file).

**Idioms to copy:**
- `import { describe, it, expect, vi, afterEach } from 'vitest';` + `import { render, screen, fireEvent, cleanup } from '@testing-library/react';` (analog lines 12-13).
- `afterEach(() => cleanup());` pattern (analog lines 26-31) — critical because `vitest globals: false` doesn't auto-cleanup.
- `screen.getByText(...)` for visible labels; `compareDocumentPosition` for document-order assertions (analog lines 39-50).
- `fireEvent.click(...)` for click assertions (analog line 66).
- Fixture-builder pattern: `function makeIdleActiveAlarm(): ...` (analog lines 19-24) — adapt to `makeProps()` for each component.

**Additional idiom for keyboard tests (StepperInput / SoundPicker):**
- `fireEvent.keyDown(element, { key: 'ArrowUp', shiftKey: true })` per RESEARCH `09-RESEARCH.md:1191`.
- Roving-tabindex assertion: `expect(button.getAttribute('tabindex')).toBe('0')` per RESEARCH `09-RESEARCH.md:1193`.

**Fixture pattern for SegmentRow / Composer (analog: `src/components/__tests__/SegmentCountdown.test.tsx:16-37`):** `makeAlarm(overrides)` helper builds a default config + lets each test mutate the field under exam.

#### `src/hooks/__tests__/useHashComposition.test.ts` (NEW — hook unit + window mock)

**Analogs (READ-ONLY):**
- **Hook test idiom:** `src/hooks/__tests__/useActiveAlarm.test.ts:1-80` — `renderHook(() => useFoo())` from `@testing-library/react`.
- **Window/navigator mocking:** `src/platform/__tests__/standalone.test.ts:5-31` — `Object.defineProperty(globalThis.navigator, '...', { value, writable: true, configurable: true })`.

**Idioms to copy:**
- `import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';` (useActiveAlarm analog line 1).
- `import { renderHook, act } from '@testing-library/react';` (useActiveAlarm analog line 2).
- Mock `window.location.hash` via `Object.defineProperty(window, 'location', { value: { ...window.location, hash: '#c=v1:60000-0' }, writable: true, configurable: true })` — adapt the standalone.test.ts idiom (lines 7-14).
- Mock `window.history.replaceState` with `vi.fn()` — assert it was called with `(null, '', '/path/...')`.

**Test cases:**
- No hash present → `composition === null && error === null`
- Hash `#c=v1:60000-0` → `composition !== null && error === null`
- Hash `#c=v2:60000-0` → `composition === null && error === 'wrong_version'`
- Hash `#unrelated` (no `c=` prefix) → `composition === null && error === null` (ignored, not error)
- `history.replaceState` is called after detection (success OR failure).

---

## Shared Patterns

### Authentication / Authorization
**Not applicable.** No auth, no users, no protected resources. Skip.

### Error Handling — Result type idiom (NEVER THROW)
**Source:** `src/engine/SegmentState.ts:39-94` (`validateSegmentConfig`).

**Apply to:**
- `src/lib/shareUrl.ts` `decodeComposition()` — must return `DecodeResult` discriminated union; never throw on tampered input (SHR-03 contract).
- `src/lib/composerReducer.ts` actions — invalid actions become no-ops (return current state unchanged); never throw (RESEARCH `09-RESEARCH.md:412-413, 419, 427-428`).

**Concrete excerpt (idiom to mirror):**
```ts
// From src/engine/SegmentState.ts:39-41
export type SegmentValidationResult =
  | { ok: true; config: SegmentConfig }
  | { ok: false; error: string };
```

### Validation
**Source:** `src/engine/SegmentState.ts:59-94` (`validateSegmentConfig`).

**Apply to:**
- `src/lib/shareUrl.ts` — runs `validateSegmentConfig` as defence-in-depth at end of `decodeComposition`.
- `src/lib/composerValidation.ts` — wraps it for per-row flags.
- `src/components/Composer.tsx` — calls it via `useMemo([config])` to derive `validation.ok` for the Start button disabled state.

### Tailwind class-string inheritance
**Source:** `src/components/Countdown.tsx:138-150` + `src/components/PresetCard.tsx:16-26`.

**Apply to:**
- **Composer footer buttons** (Cancel/Share = secondary; Start = primary): copy BYTE-IDENTICAL from `Countdown.tsx:138-143` and `Countdown.tsx:145-150`. UI-SPEC L597-614 mandates this.
- **CustomCard outer button:** mirror `PresetCard.tsx:16-26` with the deltas listed above.
- **SegmentRow icon buttons (Duplicate/Delete):** mirror the 44 px circular icon idiom established in StepperInput's +/− buttons (UI-SPEC L398-422).

### tabular-nums for numeric stability
**Source:** `src/components/Countdown.tsx:123` + `src/components/SegmentCountdown.tsx:106, 116`.

**Apply to:**
- Composer **Total display** — `Total: {mm:ss}` with `tabular-nums` (UI-SPEC L110-119, mandatory).
- StepperInput **duration display** — `text-lg` numeric with `tabular-nums` (UI-SPEC L111-119, mandatory).

**Concrete idiom:**
```tsx
style={{ fontVariantNumeric: 'tabular-nums' }}
```

### `disabled:opacity-40 disabled:cursor-not-allowed`
**Source:** `src/components/SegmentCountdown.tsx:138` (Pause button).

**Apply to:**
- Composer **Start** button when invalid (D-11).
- SegmentRow **Delete** button when last-remaining segment (D-12).
- StepperInput **+/−** buttons at min/max bounds (UI-SPEC L537-540).

### `cleanup()` in `afterEach` for RTL tests
**Source:** `src/components/__tests__/Dashboard.test.tsx:26-31` (verbatim comment explains why).

**Apply to:** Every new RTL test (`Composer.test.tsx`, `SegmentRow.test.tsx`, `StepperInput.test.tsx`, `SoundPicker.test.tsx`).

### `formatMmSs` reuse
**Source:** `src/utils/formatTime.ts:8-13`.

**Apply to:**
- Composer **Total display** (`formatMmSs(totalMs)`).
- StepperInput **duration display** (`formatMmSs(valueMs)`).
- StepperInput's `aria-valuetext={formatMmSs(valueMs)}` for SR readout.

**Do NOT reimplement.** Already exported.

---

## No Analog Found

These files have no close analog in the codebase. Planner should rely on `09-RESEARCH.md` Pattern N excerpts + `09-UI-SPEC.md` verbatim contracts instead.

| File | Role | Data Flow | Reason | Primary reference |
|------|------|-----------|--------|-------------------|
| `src/components/Composer.tsx` | modal host | event-driven | First modal in codebase | RESEARCH Pattern 1 + UI-SPEC L79-96 |
| `src/components/StepperInput.tsx` | form control | event-driven | First number stepper | RESEARCH Pattern 3 + UI-SPEC L398-422 |
| `src/components/SoundPicker.tsx` | radiogroup | event-driven | First ARIA radiogroup | RESEARCH Pattern 4 + UI-SPEC L436-473 |
| `src/components/Toast.tsx` | live region | event-driven | First toast / snackbar | RESEARCH Pattern 11 + UI-SPEC L484-498 |
| `src/lib/composerReducer.ts` | pure reducer | transform | First useReducer | RESEARCH Pattern 2 |
| `src/hooks/useHashComposition.ts` | hook | request-response | First URL-routing hook | RESEARCH Pattern 6 (sub-section "useHashComposition hook" at `09-RESEARCH.md:838-887`) |
| `src/lib/shareUrl.ts` | pure lib | transform | First URL encode/decode | RESEARCH Pattern 6 |

For each of these, the planner's `<read_first>` block must include:
1. The RESEARCH Pattern excerpt line range.
2. The UI-SPEC verbatim class string / ARIA contract line range.
3. Any READ-ONLY analog file cited for sub-idioms (e.g., useHashComposition borrows the hook surface idiom from useActiveAlarm.ts even though the responsibility differs).

---

## SEG-05 / Read-Only Files Cited as Analogs

These files appear in this PATTERNS.md as analogs to COPY FROM. They MUST NOT appear in any plan's `<action>` block — only in `<read_first>`.

| File | Cited as analog for | Reason it's READ-ONLY |
|------|---------------------|------------------------|
| `src/components/PresetCard.tsx` | CustomCard.tsx (mirror), SegmentRow.tsx (shell idiom) | Treated as frozen per CONTEXT D-180 (strong preference) |
| `src/components/Countdown.tsx` | Composer footer buttons (byte-identical class strings) | v1 SEG-05 byte-identical protected (line 1, line 138-150 verbatim) |
| `src/components/SegmentCountdown.tsx` | Composer page wrapper, disabled-button idiom, tabular-nums | Phase 8 deliverable; consumed unchanged |
| `src/components/SegmentProgressRing.tsx` | (not cited — only mentioned as downstream consumer) | Phase 8 deliverable; consumed unchanged |
| `src/hooks/useActiveAlarm.ts` | useHashComposition (hook idiom); Composer.tsx (Start handoff) | Phase 8 deliverable; consumed unchanged via `start({ kind: 'segments', config })` |
| `src/hooks/useSegmentAlarm.ts` | (not cited directly — consumed transitively via useActiveAlarm) | Phase 8 deliverable; consumed unchanged |
| `src/hooks/useAlarm.ts` | (not cited) | v1 SEG-05 byte-identical protected |
| `src/engine/SegmentState.ts` | shareUrl.ts (Result type idiom), composerValidation.ts (wraps it) | Phase 7 deliverable; consumed unchanged |
| `src/engine/SegmentEngine.ts` | (not cited directly — runs the composer's output) | Phase 7 deliverable; consumed unchanged |
| `src/engine/index.ts` | barrel-import source for `WAKE_EASY_CONFIG`, types | Stable export surface |
| `src/utils/formatTime.ts` | Composer Total display, StepperInput duration display | Stable utility |

---

## Metadata

**Analog search scope:** `src/components/`, `src/hooks/`, `src/engine/`, `src/lib/` (new), `src/utils/`, `src/platform/__tests__/` (for window-mock idioms).
**Files scanned:** 47 source files (via Glob `src/**/*.{ts,tsx}`) + 4 analog `.test.tsx`/.test.ts` files read.
**Files read in full:** `PresetCard.tsx`, `Dashboard.tsx`, `App.tsx`, `Countdown.tsx`, `SegmentCountdown.tsx`, `IosInstallBanner.tsx`, `useActiveAlarm.ts`, `formatTime.ts`, `index.css`, `engine/index.ts`, partial `SegmentState.ts` (lines 1-120), partial `Dashboard.test.tsx`, partial `SegmentCountdown.test.tsx`, partial `useActiveAlarm.test.ts`, partial `useSegmentAlarm.test.ts`, partial `validateSegmentConfig.test.ts`, partial `standalone.test.ts`.
**Pattern extraction date:** 2026-05-16.

## PATTERN MAPPING COMPLETE
