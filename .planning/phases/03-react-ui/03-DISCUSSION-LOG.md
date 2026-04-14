# Phase 3: React UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-14
**Phase:** 03-react-ui
**Areas discussed:** Screen flow & navigation, Visual identity & palette, Countdown screen layout, Preset card design

---

## Screen Flow & Navigation

| Option | Description | Selected |
|--------|-------------|----------|
| Simple state swap | No router. App renders dashboard or countdown based on alarm state. Crossfade between them. | ✓ |
| Client-side router | React Router with `/` and `/active`. Enables back button. | |
| You decide | Claude picks simplest approach | |

**User's choice:** Simple state swap
**Notes:** No router dependency for two screens.

| Option | Description | Selected |
|--------|-------------|----------|
| Snap back | Dismiss immediately returns to dashboard | ✓ |
| Brief "done" moment | 2-3 second "Alarm complete" screen before dashboard | |
| You decide | | |

**User's choice:** Snap back
**Notes:** No transition ceremony on dismiss.

---

## Visual Identity & Palette

| Option | Description | Selected |
|--------|-------------|----------|
| Dark and moody | Deep navy/charcoal, soft glowing accents. Bedside-at-night feel. | |
| Light and airy | Off-white/cream, soft earth tones. Calm morning feel. | ✓ |
| System-following | Dark at night, light during day. Both designed. | |
| You decide | | |

**User's choice:** Light and airy
**Notes:** "This is not a bedside app at night, more of a daytime use app. For a morning nap or a morning or mid day meditation." User requested manifest color update.

| Option | Description | Selected |
|--------|-------------|----------|
| Warm earth tones | Sage greens, warm sand, terracotta. Nature/meditation feel. | ✓ |
| Cool and serene | Soft blues, lavender, muted teal. Water/sky calm. | |
| Neutral minimal | Warm grays, off-white, single accent. Japanese zen garden. | |
| You decide | | |

**User's choice:** Warm earth tones
**Notes:** User requested a palette demo HTML page to compare visually. Created `.planning/phases/03-react-ui/palette-demo.html` with all three options. User selected Option 1 after viewing.

---

## Countdown Screen Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Large digital countdown | Big mm:ss center screen, phase label above, buttons below | |
| Circular progress ring | Time in center of depleting ring showing phase progress | ✓ |
| Minimal — time only | Just countdown number, full screen, phase via background color | |
| You decide | | |

**User's choice:** Circular progress ring (with custom specification)
**Notes:** User specified: "I would like a circular progress ring that shows all the phases, with time in the middle (mm:ss) showing what is left of the current phase." Multi-segment ring, not single-phase.

| Option | Description | Selected |
|--------|-------------|----------|
| Color-coded segments | Each phase gets its own palette color. Depleted segments fade. | ✓ |
| Single color, segmented | One accent color with gaps between phases. Glow on active. | |
| You decide | | |

**User's choice:** Color-coded segments

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle shift | Segment changes, label updates, time resets. No extra animation. | ✓ |
| Brief pulse | Gentle glow animation at transition plus label/time update. | |
| You decide | | |

**User's choice:** Subtle shift

---

## Preset Card Design

| Option | Description | Selected |
|--------|-------------|----------|
| Name + total duration | "Quick Nap" and "~11 min". Minimal. | |
| Name + phase breakdown | "Quick Nap" with "5 min gentle, 5 min nudge, wake". | ✓ |
| Name + breakdown + icon | Same with visual icon per preset. | |
| You decide | | |

**User's choice:** Name + phase breakdown

| Option | Description | Selected |
|--------|-------------|----------|
| Immediate start | Tap card, alarm begins. No friction. | ✓ |
| Quick confirm | "Start Quick Nap?" with Start button. One extra tap. | |
| You decide | | |

**User's choice:** Immediate start

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, on dashboard | Small "Test Sound" button below preset cards. | ✓ |
| On the cards | Each card has speaker icon for test sound. | |
| No | Test sound is dev-only, not user-facing. | |
| You decide | | |

**User's choice:** Yes, on the dashboard

---

## Claude's Discretion

- Tailwind utility classes and component decomposition
- Typography scale for countdown digits
- iOS install banner placement and dismissal
- Notification permission request timing
- Animation approach (CSS transitions first, Framer Motion if needed)
- App shell structure

## Deferred Ideas

None — discussion stayed within phase scope
