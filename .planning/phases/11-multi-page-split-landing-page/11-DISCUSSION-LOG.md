# Phase 11: Multi-page Split + Landing Page - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-21
**Phase:** 11-multi-page-split-landing-page
**Areas discussed:** Landing copy + tone, Install CTA UX, Visual layout + screenshots
**Skipped (user choice):** SW migration safety (delegated to Claude's discretion — D-LAND-14..16)

---

## Landing copy + tone

### Q: Hero line — the one statement above the fold

| Option | Description | Selected |
|--------|-------------|----------|
| A calmer alarm that alerts you gently | Mirrors the OG image tagline + Phase 10 meta title. Emphasizes the 'how it wakes you' core. Established voice, consistent with brand. | ✓ |
| Wake up calmly, on your own terms | Outcome-first + control angle. Implies customization. Slightly punchier. | |
| An alarm that doesn't jolt you awake | Negative framing (against the thing users hate). Strong differentiator. Might feel anti-something. | |
| Soundly — the alarm that wakes you gently | Brand-first, descriptive. Most SEO-friendly. Plain, low-poetry. | |

**User's choice:** A calmer alarm that alerts you gently

### Q: Value prop framing in the supporting paragraph

| Option | Description | Selected |
|--------|-------------|----------|
| Calm-first — then "and reliable when it matters" | Lead with the gentle wake-up; reliability is the safety net. Matches project core value. | ✓ |
| Trust-first — "reliable, but calmer than every other alarm" | Lead with reliability, then differentiate on calm. Better for skeptics. | |
| Both equally — two-column or paired-sentence | Side-by-side dual promise. More layout commitment. | |
| You decide | | |

**User's choice:** Calm-first — then "and reliable when it matters"

### Q: FAQ scope — how many questions and what topical depth?

| Option | Description | Selected |
|--------|-------------|----------|
| Lean: 4–5 core questions | Must-answer-or-they-bounce list. Skip 'why we built it'. | |
| Standard: 6–8 questions | Add: escalation, customization, sharing, no-account. Covers 'before I install' band. | ✓ |
| Comprehensive: 10+ questions | Add: who built this, privacy, paid version, native iOS. Reads as sales page — less zen. | |

**User's choice:** Standard: 6–8 questions

### Q: Tone for iOS honesty section

| Option | Description | Selected |
|--------|-------------|----------|
| Acknowledge + immediately lead with the workaround | Honest but solution-forward, single paragraph | |
| Plain factual — explain the platform limitation directly | Clinical, no spin | |
| Warm + apologetic | Empathetic, slightly longer | |
| You decide | | |

**User's choice:** Combine 3 and 1 — Warm/apologetic acknowledgment FIRST, then immediately lead with the workaround (two-paragraph structure)

---

## Install CTA UX

### Q: When should the Android install button appear?

| Option | Description | Selected |
|--------|-------------|----------|
| On beforeinstallprompt fire (recommended) | Only when install is actually possible. Less UI when unavailable. | ✓ |
| Always visible — disable if not installable | Predictable layout but invites failed clicks. | |
| Visible after a short delay | Shown after 3s or scroll, opens manual instructions otherwise. | |

**User's choice:** On beforeinstallprompt fire

### Q: iOS Safari instructions presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-detected card with 3-step visual | Compact icon row, no animation | |
| Click-to-expand instructions | Inline panel with steps + screenshots, lower visual weight | ✓ |
| Modal/sheet on click | Full Share-menu walkthrough; most discoverable, most code | |
| You decide | | |

**User's choice:** Click-to-expand instructions

### Q: Post-install behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Silent — button disappears, no toast | Matches D-18 silent-update lineage | |
| Small inline confirmation | Subtle 'Installed ✓' message | |
| Auto-navigate to /app | Aggressive — reduces 'where did it go?' friction | |

**User's choice:** 2 then 3 — Show inline confirmation briefly, then auto-navigate to /app (sequenced UX)

### Q: Already-installed (display-mode: standalone) view

| Option | Description | Selected |
|--------|-------------|----------|
| No install UI — 'Open App' button instead | Natural path for installed users | |
| No install UI — deep-link only, no button | Strip CTA section entirely; landing content only | ✓ |
| Same as everyone else | Don't special-case; show greyed button. Simpler code, slight UX cost. | |

**User's choice:** No install UI — deep-link only, no button

---

## Visual layout + screenshots

### Q: Overall landing page structure

| Option | Description | Selected |
|--------|-------------|----------|
| Long-scroll single page (Recommended) | All content in one continuous page; standard for product landings | |
| One-fold + 'learn more' expansion | Above-fold hero only; below-fold collapsed by default | |
| Sectioned with sticky nav | Hero + sticky top nav; more 'app website' feel | |
| Minimal one-fold only | Aggressively zen; risk of bouncing readers | ✓ |

**User's choice:** Minimal one-fold only — synthesized with section order answer as "compact one-page layout" (D-LAND-09)

### Q: Screenshot / hero visual strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse the OG image (ring + wordmark) | Zero new assets, perfect brand consistency; doesn't show actual product | ✓ |
| Flat screenshot of Composer or Countdown | Shows the product; needs maintenance | |
| Device-framed screenshot | More marketing-feel; fights zen tone | |
| Animated CSS demo | Shows behavior; most engineering work | |

**User's choice:** Reuse the OG image (ring + wordmark)

### Q: Section ordering after the hero

| Option | Description | Selected |
|--------|-------------|----------|
| Hero → value paragraph → screenshot → FAQ → iOS honesty → footer | Reasoning before showing; standard | ✓ |
| Hero → screenshot → value paragraph → FAQ → iOS honesty → footer | Visual second; more conversion-optimized | |
| Hero → value paragraph → iOS honesty (early!) → screenshot → FAQ → footer | Trust-first; distinctive in alarm space | |
| You decide | | |

**User's choice:** Hero → value paragraph → screenshot → FAQ → iOS honesty → footer

### Q: Footer scope

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal: GitHub link + 'Made by [name]' + year | Single-line. Matches no-account ethos. | ✓ |
| Standard: GitHub + about + privacy statement | Reinforces trust | |
| Full: links + privacy + license + brand mark | More product-site feel | |
| You decide | | |

**User's choice:** Minimal: GitHub link + 'Made by [name]' + year

### Q: Inline product screenshot — which app screen?

| Option | Description | Selected |
|--------|-------------|----------|
| Composer view with Wake Easy preset open | Most visually distinctive new feature; best 'customizable + calm' | ✓ |
| Countdown view mid-alarm | Beautiful but doesn't show customization | |
| Dashboard with preset cards | Familiar entry; lower visual interest | |
| Two side-by-side | Fuller story but breaks 'minimal' direction | |

**User's choice:** Composer view with Wake Easy preset open

---

## Claude's Discretion

User skipped one gray area entirely: **SW migration safety**. Captured as D-LAND-14..16 in CONTEXT.md — silent migration via existing `registerType: 'autoUpdate'` + `skipWaiting()` + `clientsClaim()` from Phase 10; deploy runbook gets a Phase 11 addendum for on-device verification.

Other Claude's-discretion items: specific FAQ question wording, footer attribution name (from git config), screenshot capture method, dark mode handling, CSS transitions, hero responsive scaling, Firefox/Edge fallbacks, iOS panel CSS (`<details>`/`<summary>`), Schema.org `Organization`/`WebSite` JSON-LD (Phase 10 D-15 deferred — revisit if low-effort).

## Deferred Ideas

- Additional static pages (`/privacy`, `/about`, `/changelog`) — single-landing for v2.0
- Newsletter / waitlist / email signup
- Analytics / telemetry
- Localization / i18n — English-only for v2.0
- Schema.org `Organization` / `WebSite` JSON-LD (deferred from Phase 10 D-15)
- Native iOS app for locked-screen audio
- Custom domain configuration
- First-load tour / onboarding flow on `/app/`
- Animated hero (CSS or JS)
- Sticky nav / scroll-to-section
- A/B testing infrastructure
- Open-source contributor guide on landing (repo README hosts this)
