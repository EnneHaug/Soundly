# Phase 8: Wake Easy Preset + Segment Countdown UI — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `08-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-10
**Phase:** 08-wake-easy-preset-segment-countdown-ui
**Areas discussed:** SegmentCountdown visual, Time display semantics, Active-alarm dispatch, Wake Easy card framing

---

## Areas selected for discussion

| Area | Selected? |
|------|-----------|
| SegmentCountdown visual | ✓ |
| Time display semantics | ✓ |
| Active-alarm dispatch (architecture + concurrency) | ✓ |
| Wake Easy card framing (label + position) | ✓ |
| Hook shape for useSegmentAlarm | Claude's discretion (mirrors useAlarm) |
| Pause-state visual treatment | Claude's discretion (opacity 0.5 on active arc) |
| Pulse animation implementation | Claude's discretion (CSS keyframes) |

---

## SegmentCountdown visual

### Q1 — What shape should the SegmentCountdown progress visual take?

| Option | Description | Selected |
|--------|-------------|----------|
| Equal arcs, N segments | N equal-size arcs, single calm color | |
| Duration-proportional arcs | N arcs sized by `durationMs` (matches v1 ProgressRing shape) | ✓ |
| Single arc + dots | One continuous arc + N fire-point dots | |
| No ring — minimal | Drop ring; just big timer + linear progress bar | |

**User's choice:** Duration-proportional arcs
**Notes:** v1 ring shape preserved; arc widths reflect actual segment durations. Wake Easy's small alarm sliver (~6% ring) accepted as-is.

### Q2a — How should arc colors be assigned across segments?

| Option | Description | Selected |
|--------|-------------|----------|
| By endSound type | gentle=sage, triangle=sand, alarm=accent | ✓ |
| Single calm color, faded/active | All same tone, opacity-only state | |
| Sequential v1 palette cycle | Cycle sage/sand/accent across N segments | |
| Gentle vs alarm only | One calm color for non-alarm, accent for alarm | |

**User's choice:** By endSound type
**Notes:** Reuses v1 palette tokens semantically — color = sound type, not segment index.

### Q2b — Once the alarm segment starts firing, what does the ring show?

| Option | Description | Selected |
|--------|-------------|----------|
| Full ring + count-up timer | All arcs depleted, center switches to count-up | |
| Last arc pulses + count-up | Last arc pinned active, pulses ~1Hz, center count-up | ✓ |
| Full-screen Wake takeover | Ring replaced by large 'Wake' state | |

**User's choice:** Last arc pulses + count-up
**Notes:** Maintains ring continuity while signaling the sustained state. Pause is disabled (Phase 7 D-03 carries through).

---

## Time display semantics

### Q1 — What does the large mm:ss number show during normal segment progression?

| Option | Description | Selected |
|--------|-------------|----------|
| Time until next chime | Big = current segment remaining only | |
| Total time remaining | Big = whole composition remaining only | |
| Both: big current, small total | Big = current segment, small caption = total | ✓ |
| Both: big total, small current | Big = total, small caption = next chime | |

**User's choice:** Both: big current, small total
**Notes:** Mirrors v1's existing big-timer + small-label pattern at `Countdown.tsx:118-131`. Big number is the next-chime glance target; small caption answers "how long total."

---

## Active-alarm dispatch

### Q1 — How should useActiveAlarm expose continuous-mode vs segment-mode state?

| Option | Description | Selected |
|--------|-------------|----------|
| Discriminated union return | Type-safe `{ mode, ... }` narrowing | ✓ (Claude's discretion) |
| Single uniform interface | Hides mode behind one shape (lossy) | |
| Both hooks always live | Mounted unconditionally, dispatcher tracks active | |

**User's choice:** "you decide"
**Locked:** Discriminated union (Claude's discretion)
**Notes:** TS-strict idioms favor narrowing; child components keep native prop shapes; composer (Phase 9) gets clean `start({ kind, config })` entry. Internally still uses both-hooks-always-live (D-08) — that's the implementation detail underneath the union return.

### Q2 — If user taps a different preset card while one is already running?

| Option | Description | Selected |
|--------|-------------|----------|
| Hide other cards while running | Dashboard disappears; user must Stop first | ✓ |
| Cancel + start new (cross-mode) | Cards stay tappable; risk of accidental stop | |
| Reject + show running indicator | Cards visibly disabled + running chip | |

**User's choice:** Hide other cards while running
**Notes:** Matches v1 Dashboard→Countdown takeover exactly. Zero new logic, zero new UX surface, zero new failure modes.

---

## Wake Easy card framing

### Q1 — Card name + description?

| Option | Description | Selected |
|--------|-------------|----------|
| Wake Easy / 17 min gentle wake-up | "17 min gentle wake-up, 4 chimes" | |
| Wake Easy / 4 chimes then alarm | "4 chimes over 16 min, then alarm" | partially |
| Wake Easy / Soft 17-min wake | "Soft 17-min wake" | |
| Long Wake / 17 min, 4 gentle chimes | Different name angle | |

**User's freeform answer:** name: '4 x 4'. Description: "4 chimes over 16 min, then alarm"
**Notes:** User chose a custom name distinct from all four offered options. Description copy matches option B's body text but with the new name.

### Q2 — Where does the card sit on the dashboard?

| Option | Description | Selected |
|--------|-------------|----------|
| Bottom (Quick Nap, Focus, 4 x 4) | Conservative; preserves v1 muscle memory | ✓ |
| Middle (Quick Nap, 4 x 4, Focus) | Logical by duration; disrupts Focus position | |
| Top (4 x 4, Quick Nap, Focus) | Aggressive promotion; biggest disruption | |

**User's choice:** Bottom
**Notes:** Preserves v1 button positions; new (longest) preset is at the bottom.

### Q3 — Naming scope: replace 'Wake Easy' everywhere or only the UI label?

| Option | Description | Selected |
|--------|-------------|----------|
| UI label only | Internal `WAKE_EASY_CONFIG` + segment IDs + REQ + ROADMAP keep "Wake Easy"; only PresetCard displays "4 x 4" | ✓ |
| Rename everything | Cascade through constant, IDs, REQ, ROADMAP, PROJECT.md | |
| Rename UI artifacts only, keep req/roadmap names | Half-and-half — explicitly not recommended | |

**User's choice:** UI label only
**Notes:** Avoids cascading renames into Phase 7 deliverables. Internal identifier and user-facing label diverge by design.

---

## Claude's Discretion

Decided by Claude with rationale documented in `08-CONTEXT.md`:

- **Discriminated-union return shape** for `useActiveAlarm` — TS-strict idioms, type-safe narrowing, no lossy adapter layer
- **Both-hooks-always-mounted** internal architecture — single Wake Lock sentinel safe because only one engine ever calls `startAlarmSession()` at a time
- **`useSegmentAlarm` shape** mirrors `useAlarm.ts:65-137` exactly (lazy useRef engine, callback in body not effect, controlled methods)
- **Pause-state visual** — active arc opacity drops to 0.5, timer freezes at snapshot remaining time
- **Pulse animation** — CSS keyframes (1s ease-in-out, opacity 0.7↔1.0), not JS-driven
- **Count-up reference time** during firing-alarm — alarm-start (not segment-start), since the alarm continues past segment-end indefinitely
- **Test split** — one test file per new module (SegmentCountdown, SegmentProgressRing, useSegmentAlarm, useActiveAlarm)
- **SegmentProgressRing as a separate file** — `ProgressRing.tsx` is byte-identical-protected per SEG-05; can't refactor it in place
- **`onStart` failure handling** — simple try/catch in App.tsx with transient toast/alert; doesn't need elaborate UX in this phase

## Deferred Ideas

See `08-CONTEXT.md` `<deferred>` for the full list.
