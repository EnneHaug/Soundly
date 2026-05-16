# Phase 9: Custom Composer + Share via URL — Context

**Gathered:** 2026-05-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship a full-screen modal composer that lets users build arbitrary segment alarms (pre-loaded with Wake Easy as a template, never blank), edit segments via stepper inputs + a sound picker, add/duplicate/delete rows, see a live total duration, start the composed alarm into `SegmentCountdown`, and share via a versioned URL hash that recipients can paste-and-open to pre-load the composer.

**In scope:**
- New `src/components/Composer.tsx` — full-screen modal segment builder
- New `src/components/SegmentRow.tsx` — single editable segment row (stepper + sound picker + delete)
- New `src/components/StepperInput.tsx` — `+/−` button pair with arrow-key support and adaptive step size
- New `src/components/SoundPicker.tsx` — 3-pill segmented control (gentle / triangle / alarm)
- New `src/lib/shareUrl.ts` — encode/decode segment compositions to/from `c=v1:...` URL hash
- New `src/lib/composerValidation.ts` — wrap `validateSegmentConfig` with row-level validity flags for inline UI feedback
- Modified `src/components/Dashboard.tsx` — add 4th "Custom" preset card at the bottom (after the "4 x 4" card)
- Modified `src/App.tsx` — route hash-decoded shared compositions into the composer; mount Composer modal when activated
- Tests for all new files (RTL component tests; encode/decode round-trip tests; tampered-URL fallback tests)

**Explicitly out of scope (v2.0 byte-identical floor + future-phase scope):**
- Any change to v1.0 byte-identical-protected paths (`Countdown.tsx`, `ProgressRing.tsx`, `useAlarm.ts`, `AlarmEngine.ts`, `engine/sounds/*`, `platform/*`)
- Any change to Phase 7 engine layer (`SegmentEngine.ts`, `SegmentState.ts`, `segmentSound.ts`, `triangle.ts`)
- Any change to Phase 8 components (`SegmentCountdown.tsx`, `SegmentProgressRing.tsx`, `useSegmentAlarm.ts`, `useActiveAlarm.ts`) — composer hands off to existing SegmentCountdown unchanged
- Drag-and-drop segment reorder (deferred to v2.x per ROADMAP locked decision)
- Per-segment volume control (future v2.x)
- localStorage persistence of compositions (no-persistence design — share-via-URL is the portability story)
- Per-segment alarm-placement enforcement (composer allows arbitrary placement of the alarm endSound; downstream `validateSegmentConfig` may still reject some configs and we surface that as inline validation)
- Multi-page split + landing page + SEO meta (Phases 10 + 11)

</domain>

<decisions>
## Implementation Decisions

### Stepper input — Mixed-step granularity

- **D-01 (LOCKED):** Stepper +/− buttons use **adaptive step size**:
  - Below 5:00 (300_000 ms): step = 30 seconds (30_000 ms)
  - At 5:00 or above: step = 1 minute (60_000 ms)
  - Boundary case: at exactly 5:00, "−" steps down by 1 min (to 4:00, which then uses 30s steps on the way further down); "+" steps up by 1 min (to 6:00)
- **D-02 (LOCKED):** Keyboard support:
  - `ArrowUp` / `ArrowDown` = same step as `+` / `−`
  - `Shift+ArrowUp` / `Shift+ArrowDown` = 5 minutes (300_000 ms) regardless of current value
  - `PageUp` / `PageDown` = same as Shift+arrow (5 min)
  - Min duration clamp: 5 s (5_000 ms) — matches SEG-04 validator floor
  - Max duration clamp: 60 min (3_600_000 ms) per segment — prevents accidental hour-long taps; user can still type a value if a future text-input edit is added (out of scope this phase)
- **D-03:** Touch target ≥44 px for each `+/−` button (matches Phase 8 accessibility floor); visually, buttons are circular icon buttons positioned to the left and right of the duration display.

### Sound picker — Segmented control

- **D-04 (LOCKED):** Per-row sound picker is a **3-pill segmented control**: `Gentle | Triangle | Alarm`. The currently-selected pill is filled with that endSound's color from the existing palette:
  - Gentle → `var(--color-sage)`
  - Triangle → `var(--color-sand)`
  - Alarm → `var(--color-accent)` (terracotta)
- **D-05 (LOCKED):** Unselected pills render at low contrast: stroked outline (`--color-border`) on `--color-bg`, text `--color-text-secondary`. On hover/focus, a faint background tint of the corresponding endSound color appears at ~10% opacity so users can preview the pill before committing.
- **D-06:** Pill labels are the locked SOUND_LABELS vocabulary from Phase 8's UI-SPEC (`Gentle chime`, `Triangle ping`, `Wake` — but for the composer picker context, `Wake` reads as too imperative on a calm form; use `Alarm` as the label in the picker only). The display label is `Alarm` for `endSound: 'alarm'` in this picker; everywhere else (SegmentCountdown phase label) it remains `Wake`. Trade-off accepted: form labels feel calmer with `Alarm`, but the running-alarm screen still says `Wake` consistent with v1 phase 3.
- **D-07:** Keyboard support: `ArrowLeft` / `ArrowRight` move between pills when the segmented control has focus; `Enter` / `Space` selects.

### Dashboard entry — 4th preset card

- **D-08 (LOCKED):** A new `Custom` preset card appears at the **bottom** of the Dashboard, after the "4 x 4" card. Order: `Quick Nap → Focus → 4 x 4 → Custom`. Matches the conservative-ordering pattern from Phase 8 D-11 — the new card sits at the bottom where the user's eye scans deliberately, not displacing v1 muscle memory.
- **D-09 (LOCKED):** Visual treatment of the Custom card diverges from the 3 preset cards so users perceive that it does something different:
  - Border: **dashed** instead of solid (signals "create / build" semantics)
  - Background: same warm-earth surface as preset cards (`--color-bg` with subtle border) — no new background token
  - Label: `Custom`
  - Description: `Compose your own alarm`
  - Touch target: same 80 px min height as the other PresetCard instances; same width
  - Icon: a small `+` glyph in the top-right corner of the card (or before the label) reinforcing the "create new" affordance. Implementation: simple inline SVG or text `+` character with the existing card typography.
- **D-10:** Card click behavior: opens the Composer modal pre-loaded with the Wake Easy template (per COMP-02). The modal mounts as an overlay over the Dashboard with the dashboard still visible behind a scrim, then closes back to the dashboard on Cancel or runs the segment alarm and routes to `SegmentCountdown` on Start.

### Validation + delete behavior

- **D-11 (LOCKED):** **Subtle inline error + disabled Start.**
  - When a segment row's duration is `0` or fails the `validateSegmentConfig` per-segment check, the row gets a soft red border: `border: 1px solid var(--color-accent); border-opacity: 0.5` (or equivalent Tailwind: `border border-accent/50`).
  - The Start button at the bottom of the modal is disabled (`disabled:opacity-40 disabled:cursor-not-allowed`) when ANY segment is invalid OR when the composition fails the whole-config validation (e.g. zero segments).
  - When Start is disabled, hovering reveals a tooltip / native title attribute: `Fix invalid segments first`. Mobile: a small caption below the Start button reads the same text.
- **D-12 (LOCKED):** **Delete behavior:**
  - Delete is **instant** — no confirmation modal. The user can re-add the segment via "Add segment" + Duplicate if they regret it (zen UX — friction-free reversal preferred over confirmation gates).
  - The Delete button on the **last remaining segment** is **disabled** (`opacity-40 cursor-not-allowed`, tooltip `At least one segment required`). The composer never reaches a zero-segment state.
  - When `validateSegmentConfig` rejects the live composition during editing, the row(s) responsible for the rejection get the red border. The whole-config rejection (e.g. "no alarm segment present" if the validator requires one) is surfaced as a single-line message above the Start button.

### Composer modal layout

- **D-13:** Full-screen modal over the Dashboard with a scrim. Layout (top to bottom):
  1. Sticky header: title `"Custom alarm"` (h2, calm typography), close-X icon button top-right (same as Cancel)
  2. Total duration display directly under the header: `"Total: MM:SS"` in larger text, `tabular-nums` for stable width
  3. Scrollable list of `SegmentRow` components (vertical, full-width)
  4. `+ Add segment` button below the list (text + plus icon)
  5. Sticky footer with three buttons: `Cancel | Share | Start`. Start is the primary (filled accent); Cancel + Share are secondary (outlined / text).
- **D-14:** Modal close — tap close-X, tap Cancel, press Escape, or browser-back all close the modal back to Dashboard without starting. **Tap-outside the modal does NOT close it** (prevents accidental loss of composition mid-edit).
- **D-15:** Animation on open/close: fade scrim in 200 ms + slight upward slide (16 px) on the modal content (`transition: transform 240ms ease-out, opacity 200ms`); reverse on close. Respect `prefers-reduced-motion: reduce` — skip the slide and shorten the fade to 100 ms.

### Share-via-URL encoding

- **D-16 (LOCKED — per SHR-04):** URL hash format: `c=v1:<segments>` where each segment is `<durationMs>-<soundIdx>` separated by commas. Sound indices: `gentle=0`, `triangle=1`, `alarm=2`. Example for Wake Easy: `c=v1:240000-0,240000-0,240000-0,240000-0,60000-2`.
- **D-17:** Encoding rules:
  - `encodeComposition(config: SegmentConfig): string` returns the fragment value (without the leading `#`). The composer appends it to `window.location.origin + window.location.pathname` for the full share URL.
  - `decodeComposition(fragment: string): { ok: true; config: SegmentConfig } | { ok: false; reason: string }` returns a Result type, never throws. Reasons enumerate the failure mode (`'wrong_version'`, `'malformed'`, `'too_long'`, `'invalid_segment_data'`, `'failed_validation'`) for logging / future telemetry.
  - Size cap: reject decoded URLs that produce > 32 segments OR > 1024-character hash. Rationale: protects against tampering and accidental copy-paste of garbage; well above any realistic composition size (Wake Easy is 5 segments / ~60 chars).
- **D-18:** Hash decode timing:
  - Hash is read **once at app mount** (in `App.tsx` or a small `useHashComposition` hook) before the Dashboard renders.
  - If decode succeeds → composer opens automatically pre-loaded with the decoded segments, AND the hash is cleared from the URL bar via `history.replaceState(null, '', window.location.pathname)` so the user doesn't re-trigger it on refresh.
  - If decode fails → composer does NOT open automatically; the Dashboard renders normally, AND an unobtrusive toast appears: `Couldn't load shared alarm — using default` (auto-dismiss after 4 s). Hash is still cleared from URL bar.
- **D-19:** Share button behavior:
  - Always visible in the modal footer, even when composition is invalid (the user might be sharing a draft).
  - Click invokes `navigator.share({ url, title: "My alarm composition", text: "Open this gentle alarm in Soundly" })` on browsers that support Web Share API.
  - On browsers without Web Share API (most desktops): copy the share URL to clipboard via `navigator.clipboard.writeText(url)` and show a toast: `Share link copied to clipboard` (auto-dismiss after 3 s).
  - On either path, if the call rejects (user-cancelled share, clipboard permission denied), show: `Couldn't copy — try copying from the address bar`.

### Alarm-segment placement

- **D-20:** The composer does NOT enforce "alarm must be the last segment." Users can place an alarm-endSound segment anywhere in the sequence. The engine's `validateSegmentConfig` is the source of truth — if Phase 7's validator allows arbitrary alarm placement, the composer allows it. (If validator rejects, we surface the row error inline per D-11.)
- **D-21:** Default new-segment values: `durationMs: 60_000` (1 min), `endSound: 'gentle'`. Add-Segment button appends at the end of the list. Duplicate clones the source segment's values and inserts immediately below the source.

### Claude's Discretion (further)

- Exact Tailwind class strings for the SegmentRow grid layout (stepper / duration display / sound picker / delete column arrangement) — researcher + planner pick; constraints: 44 px min touch targets, tabular-nums on duration display, gap-4 between rows.
- Modal scrim color/opacity — `bg-text-primary/40` or similar dark wash; should let dashboard remain visibly behind to anchor the user.
- Toast component implementation — new `Toast.tsx` if shared between share-confirmation and decode-error use cases; or inline `<div>` per use site. Recommend new shared component since both feature areas need it.
- Whether the composer caches an "unsaved changes" state across Cancel → reopen (no, per zen friction-free reversal philosophy — opening always resets to Wake Easy default unless hash-decode supplied a composition).
- Per-row stepper visual style (icon-only vs labeled `+ / −` characters) — recommend icon-only with explicit `aria-label="Increase duration"` / `Decrease duration` per WCAG.
- Exact tooltip mechanism for "Fix invalid segments first" — native `title=` attribute (zero-CSS) recommended for the form-y context; project doesn't yet have a tooltip component and adding one is out of scope.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project / milestone
- `.planning/PROJECT.md` — milestone v2.0 scope; warm-earth aesthetic; no-persistence design
- `.planning/REQUIREMENTS.md` — COMP-01..08 + SHR-01..04 (the 12 Phase 9 requirements)
- `.planning/ROADMAP.md` §"Phase 9: Custom Composer + Share via URL" — goal + 5 success criteria + locked dependency on Phase 8
- `.planning/STATE.md` — accumulated decisions; v2.0 in-progress, phases 6-8 shipped
- `CLAUDE.md` — stack constraints (React 19 + Vite 6 + Tailwind v4 warm earth palette + raw Web Audio API)
- `.planning/milestones/v1.0-ROADMAP.md` — SEG-05 byte-identical floor (20 protected paths NEVER modified)

### Prior-phase context
- `.planning/phases/08-wake-easy-preset-segment-countdown-ui/08-CONTEXT.md` — Wake Easy preset shape, segment-engine API consumption pattern, dashboard-card ordering convention (D-11), UI takeover concurrency (D-10), color-by-endSound mapping (D-02)
- `.planning/phases/08-wake-easy-preset-segment-countdown-ui/08-UI-SPEC.md` — locked palette tokens, font sizes, button class strings, accessibility floor (80 px touch targets, prefers-reduced-motion gate)
- `.planning/phases/07-segment-engine-triangle-sound/07-CONTEXT.md` — SegmentEngine API surface, validateSegmentConfig contract (SEG-04), Segment + SegmentConfig types

### Files consumed unchanged by Phase 9
- `src/engine/SegmentEngine.ts` — runs the composed alarm after Start (consumed via `useSegmentAlarm`)
- `src/engine/SegmentState.ts` — types + `validateSegmentConfig` + `WAKE_EASY_CONFIG` (used as the composer's default template)
- `src/engine/index.ts` — barrel; provides all engine exports
- `src/hooks/useSegmentAlarm.ts` — composer Start handler calls this via `useActiveAlarm.start({ kind: 'segments', config })`
- `src/hooks/useActiveAlarm.ts` — composer dispatches through this hook
- `src/components/SegmentCountdown.tsx` — runs after composer Start (no change required)
- `src/components/SegmentProgressRing.tsx` — runs after composer Start (no change)
- `src/components/PresetCard.tsx` — pattern for the new Custom card (may need slight extension if dashed-border variant needs new prop)
- `src/utils/formatTime.ts` — `formatMmSs` reused for the total-duration display

### Files protected by SEG-05 v1 byte-identical floor (NEVER modified)
- All 20 paths listed in `.planning/milestones/v1.0-ROADMAP.md` § "Cross-Milestone Notes"
- Plus Phase 7 + Phase 8 deliverables: `SegmentEngine.ts`, `SegmentState.ts`, `triangle.ts`, `segmentSound.ts`, `SegmentCountdown.tsx`, `SegmentProgressRing.tsx`, `useSegmentAlarm.ts`, `useActiveAlarm.ts`

### Files created by this phase
- `src/components/Composer.tsx`
- `src/components/SegmentRow.tsx`
- `src/components/StepperInput.tsx`
- `src/components/SoundPicker.tsx`
- `src/components/Toast.tsx` (shared — share-confirmation + decode-error)
- `src/lib/shareUrl.ts` (encode + decode + Result type)
- `src/lib/composerValidation.ts` (row-level validity flags wrapping `validateSegmentConfig`)
- `src/hooks/useHashComposition.ts` (decodes location.hash at app mount, clears it)
- `src/components/__tests__/Composer.test.tsx`
- `src/components/__tests__/SegmentRow.test.tsx`
- `src/components/__tests__/StepperInput.test.tsx`
- `src/components/__tests__/SoundPicker.test.tsx`
- `src/lib/__tests__/shareUrl.test.ts` (encode/decode round-trip + tampered-URL fallback)
- `src/hooks/__tests__/useHashComposition.test.ts`

### Files modified by this phase
- `src/components/Dashboard.tsx` — append the 4th "Custom" preset card; pass `onCustomClick` handler from App.tsx
- `src/App.tsx` — mount Composer modal when activated; integrate useHashComposition for shared-URL pre-load; wire onCustomClick on Dashboard
- `src/components/PresetCard.tsx` — (POSSIBLY) extend with optional `variant: 'preset' | 'custom'` prop if the dashed-border treatment requires it. Note: this is a v1 byte-identical-protected file under SEG-05; if extension is needed, the planner must call this out as a controlled exception that requires explicit user approval. Alternative: create a parallel `CustomCard.tsx` that mirrors PresetCard's API. **Strong preference: parallel `CustomCard.tsx` to preserve the byte-identical guardrail.**

</canonical_refs>

<specifics>
## Specific Ideas

### Stepper layout sketch (per row)
```
[−]  04:00  [+]                            // 30s steps below 5:00; 1min steps at or above
```
Two circular icon buttons flanking a tabular-nums duration display. Width budget per stepper: ~140 px. Each button 44×44 px.

### Sound picker sketch (per row)
```
[ Gentle | Triangle | Alarm ]            // segmented control, 3 equal-width pills
                                          // selected pill filled with endSound color
```

### Segment row layout sketch
```
─────────────────────────────────────────────────────────
[−] 04:00 [+]    [ Gentle | Triangle | Alarm ]    [⧉] [×]
─────────────────────────────────────────────────────────
```
Columns: stepper (left), sound picker (center, flex-grow), duplicate (⧉) + delete (×) icons (right). Each icon button 44×44 with `aria-label`. On narrow viewports (≤480 px), the sound picker wraps below the stepper.

### Composer modal frame sketch
```
┌───────────────────────────────────────┐
│  Custom alarm                       × │
│                                       │
│  Total: 17:00                         │
│                                       │
│  ─ row 1 ────────────────────────     │
│  ─ row 2 ────────────────────────     │
│  ─ row 3 ────────────────────────     │
│  ─ row 4 ────────────────────────     │
│  ─ row 5 (alarm) ────────────────     │
│                                       │
│  [ + Add segment ]                    │
│                                       │
│  ─────────────────────────────────     │
│  [Cancel]  [Share]            [Start] │
└───────────────────────────────────────┘
```

### Dashboard card order (D-08)
```
┌─────────────┐
│  Quick Nap  │
└─────────────┘
┌─────────────┐
│  Focus      │
└─────────────┘
┌─────────────┐
│  4 x 4      │
└─────────────┘
┌╌╌╌╌╌╌╌╌╌╌╌╌╌┐     ← dashed border (D-09)
╎  + Custom   ╎
╎  Compose…   ╎
└╌╌╌╌╌╌╌╌╌╌╌╌╌┘
```

### Share-URL example for Wake Easy
```
https://username.github.io/Soundly/app#c=v1:240000-0,240000-0,240000-0,240000-0,60000-2
                                       ^ ^^ ^                                        ^
                                       │ │  └── duration_ms - sound_idx              │
                                       │ └── version prefix                          │
                                       └── composition key                           │
                                                                                     │
                                       Sound indices: 0=gentle, 1=triangle, 2=alarm ─┘
```

### Sound picker color-state contract
```tsx
const PILL_BG: Record<SegmentEndSound | 'unselected', string> = {
  gentle:     'bg-sage',        // when selected
  triangle:   'bg-sand',
  alarm:      'bg-accent',
  unselected: 'bg-bg border border-border text-text-secondary',
};
```

### Live total-duration computation
```ts
const total = useMemo(
  () => segments.reduce((sum, s) => sum + s.durationMs, 0),
  [segments],
);
return <span className="tabular-nums">Total: {formatMmSs(total)}</span>;
```

### Tampered-URL decode handling
```ts
type DecodeResult =
  | { ok: true; config: SegmentConfig }
  | { ok: false; reason: 'wrong_version' | 'malformed' | 'too_long' | 'invalid_segment_data' | 'failed_validation' };

function decodeComposition(hash: string): DecodeResult {
  // Strip leading '#', extract c=v1:... pattern, parse, run validateSegmentConfig.
  // Never throw — always return Result.
}
```

</specifics>

<code_context>
## Existing Code Insights

### Reusable assets (consumed unchanged)
- `useActiveAlarm` (`src/hooks/useActiveAlarm.ts`) — composer Start handler calls `activeAlarm.start({ kind: 'segments', config })`. Already accepts arbitrary SegmentConfig per its D-07 discriminated union.
- `useSegmentAlarm` (`src/hooks/useSegmentAlarm.ts`) — consumed via useActiveAlarm; runs the composed alarm.
- `validateSegmentConfig` (`src/engine/SegmentState.ts`) — single source of truth for segment validity. Composer wraps it for per-row inline validation feedback.
- `WAKE_EASY_CONFIG` (`src/engine/SegmentState.ts`) — composer's default starting state when no shared composition is supplied.
- `formatMmSs` (`src/utils/formatTime.ts`) — reused for the total-duration display + per-row duration display in the stepper.
- `PresetCard` (`src/components/PresetCard.tsx`) — pattern for the 4th Custom card. **Byte-identical-protected** — if a `variant` prop is needed for the dashed-border treatment, create a parallel `CustomCard.tsx` instead.

### Established patterns
- Tailwind v4 warm earth palette via CSS variables (`var(--color-sage)`, `var(--color-sand)`, `var(--color-accent)`, `var(--color-faded)`, `var(--color-bg)`, `--color-text-primary/secondary`, `--color-border`)
- `font-variant-numeric: tabular-nums` for stable mm:ss width during ticking (used in v1 Countdown.tsx + Phase 8 SegmentCountdown)
- Touch target ≥80 px on tappable cards; ≥44 px on icon buttons within forms (accessibility floor inherited from v1 PresetCard)
- Modal-style overlays: not used in the codebase yet — Phase 9 introduces the pattern. Recommend a small reusable `<Modal>` component that handles scrim + escape-key + scroll lock, used by Composer; document the pattern for future modals (Phase 10/11 may need one for install-prompt UX).
- Toast pattern: not used yet — Phase 9 introduces the pattern via a shared `<Toast>` component (decode-error + share-confirmation use cases).
- Conditional rendering at App.tsx top level (`activeAlarm.mode === 'idle'` shows Dashboard; otherwise shows Countdown/SegmentCountdown). Composer mounts as an additional overlay on top of Dashboard when `activeAlarm.mode === 'idle' && composerOpen`.

### Integration points (where the diff lands)
- `Dashboard.tsx` — currently 3 PresetCards (Quick Nap, Focus, 4 x 4). Add a 4th `<CustomCard>` (or extended `<PresetCard>`) at the bottom; pass `onCustomClick={() => setComposerOpen(true)}` from App.tsx.
- `App.tsx` — currently conditional on `activeAlarm.mode` (3-way switch from Phase 8). Add a Composer modal mount: `{activeAlarm.mode === 'idle' && composerOpen && <Composer ... />}`. Wire `useHashComposition()` near the top of App.tsx body — if it returns a decoded config, auto-open composer with that config; else default to WAKE_EASY_CONFIG.
- New `Composer.tsx` mounts as portal-style overlay (or just rendered inside App.tsx since the dashboard route is the only host). On Start, calls `activeAlarm.start({ kind: 'segments', config: composedConfig })` then closes itself — the existing 3-way mode branch in App.tsx automatically routes to `<SegmentCountdown>`.

### Pre-existing v1 quirks NOT addressed in Phase 9
- `acquireWakeLock` `_sentinel` overwrite (deferred since Phase 6) — composer doesn't change concurrency, still single-engine-active per useActiveAlarm.
- iOS AudioContext.resume() on visibilitychange (deferred since Phase 6) — composer doesn't add new audio paths.
- Composer Start tap is a user gesture, so notification permission + audio bring-up follow the existing useSegmentAlarm pattern unchanged.

</code_context>

<deferred>
## Deferred Ideas

- **Drag-and-drop segment reorder** — explicitly out of v2.0 per ROADMAP locked decision. Reorder requires an entirely separate interaction pattern (long-press, drag handles, accessibility considerations for keyboard reorder). Defer to v2.x.
- **Per-segment volume control** — would require new audio plumbing (per-segment gain, UI affordance). Future v2.x.
- **Composer "Save preset"** — adding to localStorage so users can name and reuse custom compositions. Conflicts with the no-persistence design principle; defer indefinitely unless principle is revisited.
- **Text-input edit of duration** — direct numeric input alongside the stepper. Adds keyboard friction on mobile (number-keypad triggers). Defer; revisit if user-testing surfaces strong demand.
- **Composer keyboard shortcuts beyond arrow keys** — e.g. `D` to duplicate focused row, `Delete` to delete. Power-user feature; defer until power users surface.
- **Share-link analytics / telemetry** — counting how often shared links are opened. No backend, no analytics in this app; defer.
- **Multi-page split + landing page** — Phase 11.
- **SEO meta + JSON-LD + SW autoUpdate** — Phase 10.
- **Renaming the share-URL format to v2** — D-16 versions it `v1:`; if a future format change is needed, the decoder already enumerates `'wrong_version'` as a Result reason. Defer the v2 design until a concrete need emerges.
- **Web Share Target API** (registering Soundly as a target for incoming shared text from other apps) — out of scope; would require service-worker changes coupled with Phase 10's SW work. Defer.

</deferred>

---

*Phase: 09-custom-composer-share-via-url*
*Context gathered: 2026-05-16*
