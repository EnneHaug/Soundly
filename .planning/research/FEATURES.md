# Feature Landscape — v2.0 Custom Alarm Composer + Discoverability

**Domain:** Composable / segment-based alarm + meditation timer; PWA discoverability layer
**Researched:** 2026-05-04
**Scope:** NEW v2.0 features only. v1.0 features (Quick Nap, Focus, three-phase escalation, Test Sound, iOS install banner) are already shipped and intentionally out of scope here. See `.planning/research/v1.0/FEATURES.md` for prior research.
**Confidence:** MEDIUM-HIGH overall. Composer UX patterns are well-established in interval timer / meditation timer category (HIGH confidence). PWA SEO patterns have one important caveat (FAQ rich-result restriction) flagged below (MEDIUM-HIGH). Some claims rest on training-data plus a single web source — explicitly marked.

---

## Reference Apps Surveyed

| App | Category | Why relevant to v2.0 |
|-----|----------|----------------------|
| Seconds Pro (Runloop) | Interval timer (HIIT) | Canonical "build a timer one interval at a time" UX with templates + custom mode. Color-coded segments. |
| Insight Timer | Meditation timer | Interval bells = closest analogue to "segment ending in chime". Add-bell flow + "save as preset" pattern. |
| Cronologix | HIIT / Pomodoro / interval timer | Visual timer builder with mobile-first layout (2026 launch). |
| Loftie Clock | Hardware gentle alarm | Two-phase wake (soft sound → calm melody 3/6/9 min later). Direct precedent for Soundly's "Wake Easy" preset model. |
| Apple Clock — Bedtime / Wind Down | System sleep tooling | Pre-alarm wind-down concept. Supports the Soundly "long preset that demonstrates the model" framing. |
| Calm / Headspace (sleep flows) | Meditation + sleep | Sleep Stories pattern is *adjacent*, not direct competition — informs "no curated audio" anti-feature. |
| iOS Clock — Custom alarm | System alarm | Single-shot reference for what users already know about "alarm sound" pickers. Sets expectation that picking a sound per stage is a familiar mental model. |
| Pomofocus / Flow / FocusPomo | Pomodoro PWAs | PWA SEO and landing-page patterns for indie productivity tools. |

---

## Feature Area A — Alarm Composer

### A.1 Table Stakes

Features a user opening "Custom" will assume work. Missing any of these = the composer feels broken or half-built.

| # | Feature | Why expected | Complexity | v1.0 dependencies |
|---|---------|--------------|------------|-------------------|
| A1-1 | Add segment via persistent "+ Add segment" button at bottom of list | Universal pattern in interval timer apps (Seconds Pro, Insight Timer, Cronologix). Bottom-of-list button is more discoverable than a FAB for a focused single-purpose screen and stays out of the way of the segment cards. | Small | None — pure UI on new Composer screen |
| A1-2 | Per-segment duration input | A segment without a duration is meaningless. | Small | None |
| A1-3 | Per-segment end-of-segment sound picker (gentle / triangle / alarm) | Stated milestone scope. Three-option dropdown or pill selector. | Small | Reuses existing `singingBowl.ts` for "gentle"; reuses `phase3Tone.ts` (or a stripped variant) for "alarm"; new `triangle.ts` module for triangle sound |
| A1-4 | Delete a segment | Without delete the list grows unbounded and users must reload to recover. | Small | None |
| A1-5 | Visible total alarm duration ("17:00 total") computed from segments | Users cannot mentally sum 5+ segments at a glance and need feedback that the composed alarm matches their wake-time intent. Present in Seconds Pro ("Total time"). | Small | Pure render of a derived sum |
| A1-6 | Start the composed alarm | Wires the composed segment list into the existing alarm runtime. | Medium | Touches `AlarmEngine` — see "Engine integration" note below |
| A1-7 | Cancel / back out of composer without losing nothing-of-value | Standard navigation. Back arrow or a "Back" button. Since v1.0 is no-persistence, "lose composed work on back" is acceptable but should be silent (no scary confirm dialog for an ephemeral session). | Small | None |
| A1-8 | Triangle sound asset (synthesized, ~1–2s decay) | Stated milestone scope. Bright, single-strike percussive tone. | Medium | New file `src/engine/sounds/triangle.ts` following the `singingBowl.ts` pattern; reuses the shared `getAudioContext()` singleton |
| A1-9 | "Wake Easy" preset card on Dashboard alongside Quick Nap and Focus | Stated milestone scope. New third preset. | Small | New `WAKE_EASY_CONFIG` constant + new `PresetCard` instance in `Dashboard.tsx`. Requires the segment-based engine path (A1-6). |
| A1-10 | "Custom" entry point on Dashboard (button or fourth card) | Without this, the composer is unreachable. Should be visually distinct from preset cards (it's an action, not a one-tap start). | Small | New element in `Dashboard.tsx`; new route or conditional view in `App.tsx`. |
| A1-11 | Segment displays its position ("1", "2", "3" or just visual order) | Helps users mentally model the alarm sequence. Number prefix, not draggable handle (handle = differentiator, see A.2). | Small | Pure render |

**Engine integration note for A1-6 / A1-9:** v1.0's `AlarmEngine.start(config)` takes an `AlarmConfig` shaped around the *continuous* three-phase model (`phase1DurationMs`, `phase2DurationMs`, `phase2to3GapMs`, `phase3RampDurationMs`). The segment model is a different shape (an array of `{durationMs, sound}`). Two viable approaches:

- **(Recommended)** Add a parallel `startSegments(segments[])` method on `AlarmEngine` that uses the same `scheduleAt`/`getAudioContext()`/Wake Lock/keepalive plumbing but iterates segments. The v1.0 continuous-mode `start()` stays untouched. This contains risk to Quick Nap and Focus (which the milestone explicitly calls out as no-touch).
- **(Not recommended)** Refactor v1.0 presets into segment-shaped configs internally. Larger blast radius, no user-visible benefit, contradicts the milestone's "no risk to Phase 1/2/3 code" intent.

### A.2 Differentiators

Features that go beyond table stakes and would make Soundly feel polished — but the composer ships fine without them. Prioritize as v2.x follow-ups if v2.0 scope is tight.

| # | Feature | Value proposition | Complexity | v1.0 dependencies |
|---|---------|-------------------|------------|-------------------|
| A2-1 | Drag-handle reorder of segments | Lets users restructure a 5+ segment alarm without delete-and-re-add. Standard in Seconds Pro and Insight Timer custom-bell flows. Mobile drag patterns are well-supported by `@dnd-kit` (10 kB core, touch-native). | Medium | None for engine; adds `@dnd-kit/core` + `@dnd-kit/sortable` (~15 kB total) — first runtime dep beyond React/Framer that isn't React itself |
| A2-2 | Duplicate a segment | A user designing "4 × 4 min gentle" by hand without duplicate must add 4 separate segments. Common interval-timer affordance. | Small | None |
| A2-3 | "Pre-fill from preset" in the composer (open Wake Easy as starting point, then edit) | Lets users use Wake Easy as a *template* rather than a fixed preset. Stated as "optional preset pre-fill" in PROJECT.md. Bridges preset model and custom model. | Small | Reuses the same `WAKE_EASY_CONFIG` segment array |
| A2-4 | Per-segment preview ("play this sound now") | Trust-building: user wants to hear what "triangle" sounds like before committing. Insight Timer does this for bell selection. | Small | Reuses sound-synthesis modules; analogous to existing `TestSoundButton` |
| A2-5 | Inline duration editing via a stepper (+/- buttons in 30 s or 1 min increments) rather than a number text field | Steppers beat free-text on mobile for low-precision time values — fewer taps, no keyboard, no invalid input ([NN/g, Mobbin]). Aligns with zen ("fewer decisions") aesthetic. | Small-Medium | None |
| A2-6 | "Save as preset" / name and store a custom alarm | Insight Timer pattern. **However:** PROJECT.md explicitly out-of-scopes persistent storage. Listed here as a *flag* for v3+, not v2.0. | Medium (would require localStorage + schema) | **Conflicts with v1.0 "no persistence" decision — defer.** |
| A2-7 | Color-coded segment cards (subtle tint by sound type — sage/gentle, amber/triangle, terracotta/alarm) | Mirrors Seconds Pro's color-coded segments. Helps users visually parse a long alarm at a glance. Fits Soundly's earth palette (sage / amber / terracotta already present in v1.0). | Small | Pure CSS in the new SegmentCard component |
| A2-8 | Visual timeline preview (horizontal bar with proportional segment widths) | Powerful at-a-glance visualization for "what does my 17 min alarm look like?". Differentiator for Soundly vs. plain list-of-rows competitors. Risk: visual complexity could conflict with zen aesthetic — keep it subtle (thin bar, soft colors). | Medium | Pure render |

### A.3 Anti-Features (Composer)

Features Soundly should explicitly *not* build in v2.0 (or possibly ever). Reasoning required for each.

| # | Anti-feature | Why avoid | What to do instead |
|---|--------------|-----------|--------------------|
| AX-1 | Swipe-to-delete as the *only* way to remove a segment | Gesture-only patterns fail accessibility (motor impairment), are undiscoverable on first use, and require haptic feedback the web cannot reliably provide on iOS Safari. | Provide a visible delete affordance (× button or "Delete" in a per-row menu). Swipe-to-delete is OK as an *addition* but not as the only path. |
| AX-2 | Long-press context menu as the only edit/delete path | Same accessibility + discoverability issues as AX-1, plus long-press conflicts with iOS Safari text-selection long-press behavior on a phone. | Visible buttons. |
| AX-3 | Modal "edit segment" screen that hides the rest of the list | Editing one segment in isolation makes "is segment 3 longer than segment 2?" comparisons impossible. Insight Timer's bell-edit modal is widely criticized for this. | Inline editing on the segment card itself. Tap to expand a card, edit in place, tap elsewhere to commit. |
| AX-4 | Free-text duration input ("type minutes:seconds") | Triggers the mobile keyboard, slows entry, accepts invalid input ("99:99"), and breaks on locale-aware decimal separators. Numeric keyboard with `inputmode="numeric"` partially fixes but not fully. | Stepper or wheel picker. |
| AX-5 | Wheel/scroll picker (iOS-native time-picker style) | Visually heavy, occupies a large portion of the screen, requires precise scroll. iOS 17+ has been moving away from wheel pickers in their own apps for this reason. | Stepper (+/-) for typical durations; a numeric keyboard fallback for power users if needed (don't add until requested). |
| AX-6 | Unbounded segment count with no warning | A user can compose a 200-segment alarm; the engine will accept it but the UI will scroll forever and timing drift from `setTimeout` accumulates. Total alarm duration also has no logical max. | Soft cap at ~20 segments with a quiet inline note ("Most alarms work best with 5–10 segments"). Hard cap at 50 to bound timer registration. |
| AX-7 | Per-segment volume control | Multiplies the per-segment configuration space (duration × sound × volume) and contradicts the v1.0 phase-3 ramp design (volume is the *escalation* signal, not a per-segment parameter). | Sound type alone implies volume character (gentle = soft, alarm = loud). |
| AX-8 | "Random" segment generator / shuffle | Cute but contradicts the deliberate, zen, user-in-control aesthetic. Insight Timer has random interval bells; that's a meditation-specific affordance and doesn't translate. | Don't build. |
| AX-9 | Multi-alarm scheduling (compose alarm A, alarm B, alarm C) | v1.0 explicitly out-of-scoped multiple simultaneous alarms; the segment composer is not the place to relitigate this. | Single composed alarm at a time. |
| AX-10 | "Pro" / paid upgrade for more segments or more sounds | Antithetical to the indie-PWA model and to v1.0's "no monetization" implicit position. | Free, full-featured, forever. |

### A.4 Soundly-specific UX call-outs

These are not "features" but cross-cutting decisions the composer screen needs to make explicitly:

- **Zen aesthetic gate:** every composer affordance (add button, drag handle, delete X, color-coded cards) must pass a "does this raise the visual heart-rate?" check. The v1.0 dashboard achieves stillness via generous `mt-10` / `gap-4` spacing, soft `bg-white/60` surfaces, and minimal chrome (see `Dashboard.tsx`, `PresetCard.tsx`). Composer should match: rounded-2xl segment cards, soft dividers (or none — gap-based separation), no heavy borders, no hard shadows.
- **Sound naming:** "gentle / triangle / alarm" as enum values risks reading clinical. Consider human labels in the UI ("Soft chime", "Bright triangle", "Wake-up tone") with the enum staying in code. Aligns with Quick Nap and Focus naming style.
- **Empty state:** when the composer opens with zero segments, show a friendly call-to-action and a one-tap "Start with Wake Easy template" shortcut (this is A2-3 — bumped from differentiator to *strongly recommended* because the empty state is otherwise hostile).
- **Loud-tone risk:** the existing `phase3Tone.ts` is designed to be the *terminal escalation*. Letting a user place an "alarm" sound at the *start* of their composed alarm and then a "gentle" sound after would violate the gentle-first promise. **Recommendation:** allow it (user freedom, no nannying), but document in the FAQ that segment order matters and the recommended pattern is gentle → escalating. No code-side enforcement.

---

## Feature Area B — Discoverability

### B.1 Table Stakes

Without these the app is not findable in any meaningful sense and the install funnel cannot exist.

| # | Feature | Why expected | Complexity | v1.0 dependencies |
|---|---------|--------------|------------|-------------------|
| B1-1 | `<title>` and `<meta name="description">` per route | Absolute baseline. Without these the SERP card is empty/auto-generated and CTR is near zero. | Small | Touches `index.html` (root) and any new landing-page route |
| B1-2 | `<meta name="viewport" content="width=device-width, initial-scale=1">` and HTML lang | Already present in v1.0 (Vite default), but verify it survives the new landing-page split. | Small (verify) | Verify `index.html` |
| B1-3 | Open Graph minimum set: `og:title`, `og:description`, `og:image`, `og:type`, `og:url` | Required for any link-share card on iMessage, Slack, Discord, WhatsApp, LinkedIn, Facebook. Without `og:image` shares look broken. ([share-preview.com](https://share-preview.com/blog/og-tags-complete-guide)) | Small | One 1200×630 PNG asset (zen palette hero image) — needs to be designed |
| B1-4 | Twitter Card minimum: `twitter:card` only — rest falls back to OG ([Twitter docs](https://developer.twitter.com/en/docs/twitter-for-websites/cards/overview/markup)) | Without `twitter:card`, X collapses to a plain link. | Small | None beyond B1-3 |
| B1-5 | `robots.txt` allowing crawl, pointing at sitemap | Without explicit `Allow:` and a sitemap pointer, indexing is slower and less reliable. Stated in milestone scope. | Small | Static file in `public/` |
| B1-6 | `sitemap.xml` listing the canonical URLs | Stated in milestone scope. For a single-page indie PWA the URL list is genuinely small (see B.4 below). | Small | Static file or build-time generated |
| B1-7 | JSON-LD `WebApplication` (or `SoftwareApplication`) structured data | Standard schema for installable web apps. Even though Google's Rich Results Test does not show a special widget for `SoftwareApplication` PWAs ([Search Central docs](https://developers.google.com/search/docs/appearance/structured-data/software-app)), the schema *is* parsed by Google's NLU and AI Overviews, and gives crawlers definitive type + name + description signals. | Small | Inline `<script type="application/ld+json">` in landing-page `index.html` |
| B1-8 | Above-the-fold marketing landing page with: headline, one-line value prop, hero image/screenshot, primary CTA | Stated in milestone scope. Industry baseline. ([web.dev install patterns](https://web.dev/articles/promote-install)) | Medium | New route / page; new screenshot asset(s) |
| B1-9 | Install CTA that triggers the `beforeinstallprompt` event on Chrome/Edge and shows iOS Add-to-Home-Screen instructions on Safari | The CTA is the funnel terminus. iOS has no `beforeinstallprompt` so the iOS path must be a guided-instruction modal (v1.0 already has `IosInstallBanner.tsx` — reuse the pattern). | Small-Medium | Reuses `IosInstallBanner.tsx` logic; new `BeforeInstallPrompt` handler for non-iOS |
| B1-10 | Brief FAQ section on landing page | Stated in milestone scope. Useful for the install-decision moment ("does this work on iPhone?", "is it free?", "what does 'gentle' actually sound like?"). | Small | Static content; no schema *required* (see B.3 below) |
| B1-11 | Canonical URL (`<link rel="canonical">`) | Prevents duplicate-content penalties between `/`, `/app`, query-string variants. Trivial to add, costly to omit. | Small | One `<link>` per route |
| B1-12 | Theme color meta + favicon set | Already in v1.0 manifest; verify it survives the landing-page split. | Small | Verify |

### B.2 Differentiators

Beyond the minimum. Worth doing if v2.0 has the headroom; safe to defer if not.

| # | Feature | Value proposition | Complexity | v1.0 dependencies |
|---|---------|-------------------|------------|-------------------|
| B2-1 | Multiple landing screenshots (dashboard, custom composer, countdown) in a small carousel or grid | Increases install conviction. App-store-card-style proof. | Small | Needs 3–5 PNG asset captures from the production app |
| B2-2 | Trust signals on landing: "free", "no account", "works offline", "no tracking" as visual badges | Addresses the most common pre-install objections in the indie-PWA category. Each is a short truth, not marketing fluff. | Small | Pure copy + icons |
| B2-3 | iOS-specific section on landing page acknowledging the locked-screen limitation | Per `ios-alarm-feasibility.md` this is a known structural constraint. Setting expectation *before* install reduces "broken alarm" 1-star reviews / uninstalls. **High value despite feeling like a confession.** Frame positively: "On iPhone, keep the app open or installed for best results." | Small | Pure copy |
| B2-4 | JSON-LD `WebSite` schema with `SearchAction` (sitelinks searchbox) | Useful only if Soundly has internal search. v2.0 has no search. Skip. | Small (but unused) | N/A |
| B2-5 | JSON-LD `Organization` block with name + url + logo | Helps Google associate the brand. Tiny addition. | Small | One JSON block + logo URL |
| B2-6 | Two-tier landing: marketing page at `/`, app shell at `/app` (Phase 5 already created `App.tsx` shell that handles this if routing is added) | Lets the SEO landing page be heavy/marketing-y and the app shell stay fast. Search-result clicks land on the marketing page; the marketing page deep-links into the app. Stated in milestone scope. | Medium | Adds client-side routing — consider react-router (~7 kB) vs. a hash-based or query-string switch (no dep) |
| B2-7 | Pre-encoded sample audio clip (silent video or muted audio with caption) showing the gentle progression | "I want to hear what this sounds like before installing" is a real pre-install question. A 30 s silent screen-recording with synced waveform visualization could answer it. **Risk:** large asset, conflicts with offline-bundle weight. | Medium-Large | Asset production (one-time) + landing-page video player |
| B2-8 | Aggregate-rating block in JSON-LD (`aggregateRating` field) | Triggers star-ratings in some Google rich results. **Anti-feature unless you have honest review data — fabricating ratings is grounds for manual penalty.** v2.0 has no review system. Skip until earned. | N/A | N/A |
| B2-9 | `og:image:alt` and `twitter:image:alt` accessibility tags | Tiny accessibility win for screen-reader users on link previews. | Small | None |

### B.3 Anti-Features (Discoverability)

| # | Anti-feature | Why avoid | What to do instead |
|---|--------------|-----------|--------------------|
| BX-1 | Auto-prompt for notification permission on landing-page load | Universally hated, drives bounce, and Chrome explicitly down-ranks sites that do this. Notification permission has no value on the marketing page anyway — Soundly only needs it once the user starts an alarm. | Notification permission already lives in the alarm-start flow in v1.0 (Phase 2). Don't move it. |
| BX-2 | Auto-trigger PWA install prompt on first page view | Web.dev explicitly warns against this — install prompts must be tied to a user gesture for both UX and policy reasons. Browsers throttle/disable auto-prompts. ([web.dev install patterns](https://web.dev/articles/promote-install)) | CTA button → user clicks → `beforeinstallprompt.prompt()`. |
| BX-3 | Cookie / consent banner | Soundly has no analytics, no cookies, no third-party scripts (per milestone scope: "Out of scope: analytics"). A consent banner with nothing to consent to is dishonest noise. | No banner. If analytics is added later, revisit then. |
| BX-4 | Newsletter / email-capture interstitial | Antithetical to "no account, no friction" and PROJECT.md's stateless model. | Don't build. Maybe a footer "made by [link]" if the maintainer wants attribution. |
| BX-5 | FAQPage JSON-LD schema with the goal of getting expandable FAQ rich results in SERP | Google restricted FAQ rich results to government/health-authoritative sites in 2023 and discontinued the visual feature broadly in 2024 ([Greenserp 2026 schema guide](https://greenserp.com/high-impact-schema-seo-guide/)). The schema is still parsed and is not harmful, but the *visible* SERP feature most people add it for is gone for indie sites. | Optional: add lightweight FAQPage schema for AI-overview eligibility (which still benefits from it) but do not depend on it for a SERP feature. **Do not invest time tuning FAQ schema for rich results.** |
| BX-6 | Long-form SEO content / blog posts targeting "best gentle alarm app" keywords | Stated out of scope for v2.0 ("keyword research, long-tail content/articles, analytics — deferred"). | Defer to v3.x growth milestone. |
| BX-7 | Aggressive smart banner ("Open in App" iOS Safari banner) | Apple's `apple-itunes-app` smart banner is for iTunes-Connect apps. Soundly is a PWA — there's no native app to deep-link to. Faking it confuses users. | The existing `IosInstallBanner.tsx` is the right pattern. |
| BX-8 | Hidden text / keyword stuffing in the landing page | Classic spam pattern. Modern Google ignores or penalizes. | Honest copy. |
| BX-9 | Auto-playing audio on the landing page (so users "hear how gentle it is") | Browsers block this; users hate it; it contradicts the calm/quiet brand. | Tap-to-play preview button if any audio at all (and reuse `TestSoundButton` semantics — start in user gesture). |
| BX-10 | Dark-mode-only or light-mode-only landing page | Should follow `prefers-color-scheme` like the app does. v1.0 already uses Tailwind v4's system-following theming. | Match the app's system-following dark/light. |

### B.4 Sitemap and JSON-LD specifics for an indie PWA with no backend

**Sitemap content (recommended):**

```
https://soundly.app/                  ← marketing landing page
https://soundly.app/app                ← app shell (deep link target)
```

That's it. There is no logged-in dashboard, no per-user pages, no blog, no docs. A two-URL sitemap is honest — it tells Google "these are the index-worthy URLs". Adding `/?source=qr` or other query variants is anti-pattern (they're not separate pages). If a future v3 adds /faq or /privacy, append them then. ([2pointagency sitemap guide](https://www.2pointagency.com/blog/how-to-create-a-sitemap/))

**JSON-LD recommended type — `WebApplication` over `SoftwareApplication` or `MobileApplication`:**

- `SoftwareApplication` is the broadest type but is most associated with downloadable software in Google's interpretation.
- `MobileApplication` implies an App Store / Play Store listing (with `installUrl` typically pointing at a store).
- `WebApplication` is the precise fit for a browser-installable PWA.

`WebApplication` is a subtype of `SoftwareApplication` so all `SoftwareApplication` properties (name, applicationCategory, operatingSystem, offers, description) are valid on it. ([Schema.org SoftwareApplication](https://schema.org/SoftwareApplication))

**Minimum viable JSON-LD payload:**

```json
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "Soundly",
  "description": "A gentle Progressive Web App alarm that wakes you with soft sounds, vibration, and only escalates to full volume as a last resort.",
  "url": "https://soundly.app/",
  "applicationCategory": "LifestyleApplication",
  "operatingSystem": "Any",
  "browserRequirements": "Requires a modern web browser with Web Audio API.",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  }
}
```

The `offers` block with price 0 explicitly signals "free" (helpful for AI-overview "is it free?" answers). Skip `aggregateRating` until honest reviews exist (BX-8).

**Open Graph minimum viable payload:**

```html
<meta property="og:type" content="website">
<meta property="og:title" content="Soundly — gentle alarm">
<meta property="og:description" content="Wake gently. Soft sounds first, full volume only as a last resort.">
<meta property="og:image" content="https://soundly.app/og-image-1200x630.png">
<meta property="og:url" content="https://soundly.app/">
<meta name="twitter:card" content="summary_large_image">
```

`twitter:card` is the only Twitter-specific tag required — the rest falls back to OG ([Twitter docs](https://developer.twitter.com/en/docs/twitter-for-websites/cards/overview/markup), [share-preview.com 2026 guide](https://share-preview.com/blog/twitter-meta-tags)). One 1200×630 PNG, under 1 MB, satisfies all platforms.

---

## Cross-cutting Feature Dependencies

```
Composer screen (NEW)
  ├─→ "+ Add segment" button (A1-1)
  ├─→ Segment list rendering (A1-3 sound picker, A1-4 delete, A1-11 numbering)
  │     ├─→ stepper duration input (A2-5)
  │     └─→ optional drag-handle reorder (A2-1) — adds @dnd-kit dep
  ├─→ "Total: 17:00" derived display (A1-5)
  ├─→ "Start" button (A1-6)
  │     └─→ AlarmEngine.startSegments(segments[]) — NEW engine method
  │           └─→ Reuses: getAudioContext(), scheduleAt(), Wake Lock, keepalive (all v1.0)
  │           └─→ Per-segment terminal sound:
  │                 ├─→ "gentle" → strikeBowl()           [v1.0 module]
  │                 ├─→ "triangle" → strikeTriangle()     [NEW module]
  │                 └─→ "alarm" → startPhase3Swell() or a dedicated "alarm hit" [v1.0 module — may need a one-shot wrapper]
  └─→ Optional preview button per segment (A2-4) — same sound modules

Wake Easy preset (A1-9)
  └─→ WAKE_EASY_CONFIG (segment array literal)
        └─→ AlarmEngine.startSegments(segments[]) — same path as composer

Custom button on Dashboard (A1-10)
  └─→ Opens Composer screen
        └─→ Routing decision (react-router vs. hash vs. boolean state)

Marketing landing page (B1-8)
  ├─→ Hero copy + screenshot(s) (B2-1) + value prop
  ├─→ Install CTA (B1-9)
  │     ├─→ beforeinstallprompt handler (Chrome/Edge/Android)
  │     └─→ iOS Add-to-Home-Screen modal (reuses IosInstallBanner.tsx pattern)
  ├─→ FAQ section (B1-10)
  │     └─→ Optional FAQPage JSON-LD (low ROI per BX-5)
  └─→ Routing
        └─→ /  → landing
        └─→ /app → app shell (existing v1.0 Dashboard)

SEO baseline
  ├─→ <title>, meta description, canonical (B1-1, B1-11)
  ├─→ Open Graph + twitter:card (B1-3, B1-4)
  ├─→ JSON-LD WebApplication (B1-7)
  ├─→ robots.txt (B1-5)
  └─→ sitemap.xml (B1-6)
```

**v1.0 surfaces touched by v2.0 (for blast-radius scoping):**

| v1.0 file | v2.0 touch | Risk |
|-----------|------------|------|
| `src/engine/AlarmEngine.ts` | Add new `startSegments()` method; do not modify `start()` | Low if the existing method is left alone |
| `src/engine/index.ts` | Export `WAKE_EASY_CONFIG` and the new method/types | Low (additive) |
| `src/components/Dashboard.tsx` | Add Wake Easy `PresetCard` and Custom entry point | Low (additive) |
| `src/components/PresetCard.tsx` | Reusable as-is for Wake Easy | None |
| `src/components/IosInstallBanner.tsx` | Pattern reused on landing page CTA | None — pattern only, not a dep |
| `src/App.tsx` | Routing decision (composer screen + landing page split) | Medium — first multi-route change |
| `index.html` | Heavy SEO meta additions (OG, JSON-LD, canonical) | Low |
| `vite.config.ts` (`vite-plugin-pwa` config) | Verify the new `/app` route is in the SPA fallback if routing is added | Low if verified |

---

## Complexity Summary Table

For roadmap scoping, sized as Small (≤ ½ day), Medium (½–2 days), Large (> 2 days):

### Composer

| ID | Feature | Size | Group |
|----|---------|------|-------|
| A1-1 | "+ Add segment" button | S | Table stakes |
| A1-2 | Per-segment duration input | S | Table stakes |
| A1-3 | Per-segment sound picker | S | Table stakes |
| A1-4 | Delete segment | S | Table stakes |
| A1-5 | Total duration display | S | Table stakes |
| A1-6 | Start composed alarm | M | Table stakes |
| A1-7 | Cancel / back | S | Table stakes |
| A1-8 | Triangle sound asset | M | Table stakes |
| A1-9 | Wake Easy preset card | S | Table stakes |
| A1-10 | Custom entry on Dashboard | S | Table stakes |
| A1-11 | Segment numbering display | S | Table stakes |
| A2-1 | Drag reorder | M | Differentiator (defer if scope tight) |
| A2-2 | Duplicate segment | S | Differentiator |
| A2-3 | Pre-fill from preset | S | Differentiator (recommend bumping into MVP — fixes empty state) |
| A2-4 | Per-segment preview | S | Differentiator |
| A2-5 | Stepper duration input | S–M | Differentiator (recommend bumping into MVP — replaces hostile free-text) |
| A2-6 | Save as custom preset | M | **Defer — conflicts with v1.0 no-persistence** |
| A2-7 | Color-coded segments | S | Differentiator |
| A2-8 | Visual timeline preview | M | Differentiator |

**MVP for composer (recommended):** A1-1 through A1-11, plus A2-3 (pre-fill template) and A2-5 (stepper). Total: ~12 features, all S–M, fits a single phase.

### Discoverability

| ID | Feature | Size | Group |
|----|---------|------|-------|
| B1-1 | Title + description | S | Table stakes |
| B1-2 | Viewport + lang verify | S | Table stakes |
| B1-3 | Open Graph minimum | S (+ asset) | Table stakes |
| B1-4 | Twitter Card | S | Table stakes |
| B1-5 | robots.txt | S | Table stakes |
| B1-6 | sitemap.xml | S | Table stakes |
| B1-7 | WebApplication JSON-LD | S | Table stakes |
| B1-8 | Marketing landing page | M | Table stakes |
| B1-9 | Install CTA (chrome + iOS) | S–M | Table stakes |
| B1-10 | FAQ section | S | Table stakes |
| B1-11 | Canonical URL | S | Table stakes |
| B1-12 | Theme color + favicon verify | S | Table stakes |
| B2-1 | Multiple screenshots | S (+ assets) | Differentiator |
| B2-2 | Trust signals badges | S | Differentiator |
| B2-3 | iOS-specific copy section | S | Differentiator (recommend MVP — see ios-alarm-feasibility.md) |
| B2-5 | Organization JSON-LD | S | Differentiator |
| B2-6 | Two-tier routing | M | Differentiator (recommend MVP — milestone scope says deep-link) |
| B2-7 | Audio sample on landing | M–L | Differentiator (defer — high effort, low certainty) |
| B2-9 | OG image alt | S | Differentiator |

**MVP for discoverability (recommended):** B1-* plus B2-3 (iOS copy) and B2-6 (routing split, since milestone explicitly calls for deep link). Total: ~14 features, mostly S, plus 1 Medium asset (landing page itself) and 1 Medium engineering (routing).

---

## Cross-Domain MVP Recommendation

If v2.0 has to land tight:

**Phase 1 — Composer (the user-visible "wow"):**
A1-1 through A1-11 (11 features, all S–M)
A2-3 (template pre-fill — saves the empty state)
A2-5 (stepper — replaces hostile free-text)

**Phase 2 — Discoverability (the indexability layer):**
B1-1 through B1-12 (12 features, mostly S)
B2-3 (iOS honesty copy)
B2-6 (routing split — required for the marketing-page-vs-app-shell deep link)

**Defer to v2.x or v3:**
A2-1 (drag reorder — adds first new dependency)
A2-2 / A2-4 / A2-7 / A2-8 (composer polish)
A2-6 (custom preset persistence — explicitly conflicts with v1.0)
B2-1 / B2-7 (rich landing assets)
BX-5 (FAQ schema — low ROI for indie sites in 2026)

This shape keeps v2.0 to about 25 distinct features, all but two of which are Small. The two Mediums are the landing page itself (mostly content + design, not engineering) and the routing split (the one piece of architectural change).

---

## Zen-Aesthetic Conflict Flags

Per the quality gate, here are features whose "obvious" implementation would clash with Soundly's calm/minimalist identity:

| Feature | Conflict | Mitigation |
|---------|----------|------------|
| A1-1 "+ Add" button | Material FAB-style floating button feels app-like and intrusive | Use a soft bottom-of-list button matching `PresetCard`'s rounded-2xl + border + bg-white/60 style |
| A1-3 sound picker | Native `<select>` looks utilitarian | Custom pill selector or segmented control with smooth transition; reuse the warm-earth palette |
| A1-4 delete X | Red-on-white delete buttons are visually loud | Soft sage/text-secondary X icon, no red until tapped to confirm (or no confirm — see AX-1, just an undo toast) |
| A2-1 drag handle | Dotted-grip icons are visually noisy | If reorder ships, use a barely-visible 6-dot handle that fades up on hover/touch |
| A2-7 color-coded cards | Bright color blocks contradict zen | Subtle 5–10% tint, not saturated, against the existing warm-earth base |
| B1-9 install CTA | Big bright "INSTALL NOW!" buttons feel app-store-y | Match the existing `PresetCard` visual language — large soft-tappable card with calm copy |
| B1-10 FAQ | Accordion icons (chevrons, plus/minus) can read busy if overused | Limit to 4–6 questions max; soft typography; consider a vertical list rather than collapsible |
| B2-1 screenshots carousel | Auto-rotating carousels are distracting and hated by users | Static 2×2 or 3-up grid of screenshots; no auto-rotation |

---

## Open Questions for Roadmapper

1. **Routing approach for the landing/app split (B2-6).** Three viable paths: `react-router-dom` (~10 kB, full SPA routing), hash-based switching (no dep, ugly URLs but simple), or a query-string boolean (`?app=1`). The milestone scope statement implies real URLs (`/` and `/app`). Recommend `react-router-dom` for a clean `/app` URL — adds ~10 kB but matches user expectations and works with the existing `vite-plugin-pwa` `NavigationRoute` SPA fallback (already verified in Phase 4).

2. **Drag-and-drop dependency decision (A2-1).** `@dnd-kit/core` + `@dnd-kit/sortable` is ~15 kB combined. Currently Soundly has zero non-React runtime dependencies. Worth it if drag reorder ships in v2.0; otherwise defer.

3. **Sound naming convention.** Internal enum (`'gentle' | 'triangle' | 'alarm'`) vs. user-facing labels ("Soft chime", "Bright triangle", "Wake-up tone"). Recommend friendly labels. Roadmap should pin this early so copy doesn't churn.

4. **Empty composer policy.** Recommend opening with Wake Easy pre-loaded (A2-3 promoted to MVP) so the screen is never blank-and-confusing on first visit. Confirms with downstream UX work.

5. **Triangle sound design.** "Bright strike with ~1–2 s decay" — is the reference a meditation triangle (very high partials, ~3–4 kHz fundamental) or a percussion triangle (broader spectral content)? This affects synthesis: meditation triangle = a few high sine partials with exponential decay; percussion triangle = additive synthesis with more harmonic richness + short noise burst at attack. Phase research should resolve via prototype.

6. **Wake Easy 17 min total — is the engine drift acceptable across 5 segments?** v1.0's Phase 1 wall-clock scheduling holds tight at 5 min and 21 min. 17 min has 5 timers instead of 3, but each is wall-clock-anchored. Likely fine but worth a phase-check.

7. **iOS copy on landing page (B2-3).** What exact wording? Per `ios-alarm-feasibility.md` the honest copy is "On iPhone, Soundly works best when installed and kept open." Recommend roadmap delegates final wording to a copy-pass at the end of the discoverability phase.

---

## Sources

**Primary (authoritative)**

- [Insight Timer — How Do I Create Interval Bells?](https://help.insighttimer.com/support/solutions/articles/67000664993-wie-erstelle-ich-intervallglocken-) — confirms add-bell pattern + customization range (5 s to 30 min)
- [Insight Timer — How Can I Create a Meditation Preset?](https://help.insighttimer.com/support/solutions/articles/67000665012-how-can-i-create-a-meditation-preset-) — "Save as preset" pattern documentation
- [Seconds Pro / Runloop — Manual: Sharing Timers](https://manual.runloop.com/docs/guides/sharing-timers/) — confirms templates + custom timer + JSON import as the segment editing model
- [Seconds Interval Timer — Runloop site](https://www.runloop.com/seconds-interval-timer/) — color-coded segments + template UX
- [Loftie Clock](https://byloftie.com/products/loftie) — direct precedent for two-stage gentle wake (soft sound → calm melody at 3/6/9 min)
- [Google Search Central — SoftwareApplication structured data](https://developers.google.com/search/docs/appearance/structured-data/software-app) — confirms WebApplication / SoftwareApplication / MobileApplication subtypes
- [Schema.org — SoftwareApplication](https://schema.org/SoftwareApplication) — type definition and properties
- [Twitter Developer — Cards markup](https://developer.twitter.com/en/docs/twitter-for-websites/cards/overview/markup) — confirms Twitter falls back to OG; only `twitter:card` is required
- [web.dev — Patterns for promoting PWA installation](https://web.dev/articles/promote-install) — install CTA best practices, anti-patterns
- [Schema.org — FAQPage status update via Greenserp 2026 guide](https://greenserp.com/high-impact-schema-seo-guide/) — corroborates Google's 2023 restriction of FAQ rich results to authoritative gov/health sites

**Secondary (multiply-confirmed via web search 2026)**

- [share-preview.com — Twitter Card Meta Tags 2026 guide](https://share-preview.com/blog/twitter-meta-tags) — minimum viable Twitter Card markup
- [share-preview.com — Open Graph Tags Complete Guide 2026](https://share-preview.com/blog/og-tags-complete-guide) — OG image dimensions (1200×630, <1 MB)
- [2pointagency — How to Create a Sitemap 2026](https://www.2pointagency.com/blog/how-to-create-a-sitemap/) — index-worthy URLs only, lastmod accuracy
- [Mobbin — Stepper UI Design](https://mobbin.com/glossary/stepper) — stepper preferred for small ranges, mobile-first
- [NN/g — Design Guidelines for Input Steppers](https://www.nngroup.com/articles/input-steppers/) — stepper accuracy vs. slider on mobile
- [Mobbin — Time Picker UI Design](https://mobbin.com/glossary/time-picker) — wheel pickers being phased out for stepper-based duration inputs
- [Puck — Top 5 Drag-and-Drop Libraries for React 2026](https://puckeditor.com/blog/top-5-drag-and-drop-libraries-for-react) — `@dnd-kit` 10 kB, touch-native; pragmatic-drag-and-drop for Atlassian replacement
- [LogRocket — Designing swipe-to-delete and swipe-to-reveal](https://blog.logrocket.com/ux-design/accessible-swipe-contextual-action-triggers/) — accessibility requirement to pair gesture with visible affordance
- [Tensorblue — Mobile-First UX Patterns 2026](https://tensorblue.com/blog/mobile-first-ux-patterns-driving-engagement-design-strategies-for-2026) — both visible and gesture-based actions; haptic pairing
- [The Sleep Foundation — Best Sunrise Alarm Clock 2026](https://www.sleepfoundation.org/best-alarm-clocks/best-sunrise-alarm-clock) — gentle wake category framing

**Project context (internal)**

- `.planning/PROJECT.md` — v2.0 milestone scope (segment model, Wake Easy preset, discoverability split)
- `.planning/research/v1.0/FEATURES.md` — v1.0 feature analysis (do-not-redo)
- `.planning/research/ios-alarm-feasibility.md` — informs B2-3 honest iOS copy and AX-7 (per-segment volume conflict)
- `src/components/Dashboard.tsx`, `src/components/PresetCard.tsx`, `src/engine/AlarmEngine.ts` — existing v1.0 surfaces touched by v2.0

**Confidence note:** WebSearch was used as the primary discovery channel for current ecosystem patterns (2026); Context7 was not used because no specific library docs were in scope for this research (the JS dependencies under consideration — `@dnd-kit`, `react-router-dom` — are well-known and decision is library-choice not API-syntax; their Context7 lookup belongs in a phase-RESEARCH document, not a milestone-FEATURES document). Web sources are 2026-current per the search-result publication metadata. Most table-stakes / anti-feature claims are corroborated by 2+ independent sources.
