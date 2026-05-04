# Research Summary — v2.0 Custom Alarm Composer + Discoverability

**Synthesized:** 2026-05-04
**Overall confidence:** MEDIUM-HIGH. Stack additions and SEO mechanics are well-evidenced; architecture has one genuinely open routing decision; segment runtime risks are well-mapped.

**Inputs:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md (all in `.planning/research/`).

---

## 1. What This Milestone Adds

**Alarm Composer (primary track).** v2.0 introduces a parallel alarm shape — a sequence of arbitrary segments, each ending with one chosen sound (`gentle | triangle | alarm`) — alongside the existing v1.0 three-phase escalation model. The user surfaces are: (1) a third dashboard preset card "Wake Easy" (4 × 4 min gentle + 1 × 1 min alarm = 17 min total), (2) a "Custom" entry point that opens a segment builder, and (3) a new synthesized triangle sound. Critically, all v1.0 sound files, `AlarmEngine`, `AlarmConfig`, `useAlarm`, and `Countdown` stay byte-identical — Quick Nap and Focus continue running the unmodified continuous-phase path. The new segment runtime is composed alongside, not woven into, the v1 engine.

**Discoverability (secondary track).** v2.0 makes Soundly findable: SEO meta tags, Open Graph + Twitter cards, JSON-LD `WebApplication` schema, `robots.txt`, `sitemap.xml`, and a marketing landing page with hero copy, screenshots, install CTA, and an FAQ. The marketing page is the new entry surface for first-time visitors; the installed PWA's `start_url` updates to land returning users directly in the alarm app shell. Content/articles, keyword research, and analytics are explicitly deferred.

---

## 2. Stack Additions

Only deltas from v1.0. Everything else (React 19, Vite 6, TypeScript 5, Tailwind v4, vite-plugin-pwa, Web Audio API) is unchanged.

| Need | Pick | Version | Bundle (gz) | Confidence |
|------|------|---------|-------------|-----------|
| Routing landing ↔ app | **react-router (library mode)** OR **multi-page Vite (no router)** — see Open Decision #1 | `^7.14` (if router) | ~14 KB / 0 KB | MEDIUM (genuine fork) |
| Per-page `<title>`, `<meta>`, JSON-LD | **React 19 native metadata hoisting** | built-in | 0 KB | HIGH |
| `sitemap.xml` + `robots.txt` at build | **vite-plugin-sitemap** (or hand-authored static) | `^0.8` | dev-only | MEDIUM-HIGH |
| Drag-and-drop segment reorder | **`motion` Reorder** OR **`@dnd-kit/core` + `@dnd-kit/sortable`** — see Open Decision #2 | Motion `^12` / dnd-kit `^6.3` | ~15 KB / ~10 KB | MEDIUM |
| Triangle sound | None — Web Audio API native | — | 0 KB | HIGH |
| Static landing assets (OG image, screenshots) | `public/` directory, no plugin | — | — | HIGH |
| Typed JSON-LD (optional) | **schema-dts** as devDep | `^1.1` | 0 KB runtime | HIGH |

**Explicitly NOT adopted:** `react-helmet-async` (abandoned for React 19), `@tanstack/react-router` (codegen overkill for two routes), `react-dnd` / `react-beautiful-dnd` (touch/maintenance issues), Astro / Next.js / vite-ssg (one indexable URL doesn't justify SSG), any CMS, `react-schemaorg`.

**Open architectural decision flagged:** STACK §1 recommends `react-router` v7 single-bundle SPA. ARCHITECTURE Decision 7 recommends Vite multi-page build with no router. Both defensible; roadmapper or first phase plan must pick.

---

## 3. Features — Table Stakes vs Differentiators vs Anti-Features

### Composer (Feature Area A)

**Table stakes (11 features, S–M sized):** Add-segment button, per-segment duration input, sound picker (gentle/triangle/alarm), delete, total duration display, Start, Cancel/back, triangle sound asset, Wake Easy preset card, Custom entry on Dashboard, segment numbering.

**Bump into MVP:** Pre-fill from Wake Easy preset (A2-3, fixes hostile empty state), stepper duration input (A2-5, replaces error-prone free-text).

**Defer to v2.x:** Drag reorder (adds first runtime dep), duplicate segment, per-segment preview, color-coded cards, visual timeline preview.

**Hard anti-features:** Save-as-custom-preset (conflicts with no-persistence), per-segment volume, swipe-to-delete-only (a11y), long-press-only (iOS conflict), modal edit screens, free-text duration, wheel pickers, unbounded segment count, random shuffle, multi-alarm scheduling, paid tiers.

### Discoverability (Feature Area B)

**Table stakes (12 features, mostly S):** title + meta description, viewport + lang verify, OG minimum (og:title/description/image/type/url), Twitter Card, robots.txt, sitemap.xml, JSON-LD `WebApplication`, marketing landing page, install CTA (chrome `beforeinstallprompt` + iOS instructions), FAQ section, canonical URL, theme color + favicon verify.

**Bump into MVP:** iOS-specific honest-limitation copy (B2-3), two-tier routing (B2-6, milestone explicitly calls for deep link).

**Hard anti-features:** Auto-prompt notifications, auto-trigger install prompt, cookie banner (no analytics), newsletter capture, FAQPage rich-result schema (Google restricted in 2023), long-form SEO blog posts, smart banner, keyword stuffing, auto-playing audio, dark/light-only landing.

---

## 4. Integration Map

**Zero-diff guarantees (v1 byte-identical floor):**
- All `src/engine/sounds/*.ts` — unchanged except new `triangle.ts` added
- `src/engine/AlarmState.ts` — `AlarmConfig`, `validateConfig`, `QUICK_NAP_CONFIG`, `FOCUS_CONFIG` unchanged
- `src/components/Countdown.tsx`, `ProgressRing.tsx` — unchanged (continuous-phase path)
- `src/hooks/useAlarm.ts` — unchanged (Quick Nap + Focus path)
- `src/components/PresetCard.tsx`, `TestSoundButton.tsx`, `IosInstallBanner.tsx` — unchanged

**New files:**
```
src/engine/sounds/triangle.ts           Triangle synthesis (mirrors singingBowl pattern)
src/engine/AlarmSession.ts              Shared session lifecycle (light refactor extract)
src/engine/SegmentEngine.ts             N-segment runtime alongside AlarmEngine
src/engine/SegmentState.ts              Segment, SegmentConfig, EndSound, validateSegmentConfig
src/hooks/useSegmentAlarm.ts            Hook wrapping SegmentEngine
src/hooks/useActiveAlarm.ts             Mode selector (continuous | segments | null)
src/components/SegmentCountdown.tsx     N-segment countdown UI
src/components/SegmentTimeline.tsx      Visual timeline for SegmentCountdown
src/components/CustomComposer.tsx       Modal segment builder
src/components/SegmentRow.tsx           One row inside CustomComposer
src/presets/wakeEasy.ts                 WAKE_EASY_CONFIG constant
public/og-image.png                     1200x630 social card asset
public/robots.txt                       Permissive Allow + Sitemap reference
public/sitemap.xml                      Two-URL sitemap (or build-generated)
```

**Modified files (small additive changes):**
```
src/App.tsx                  Dispatch on useActiveAlarm mode + composer modal state
src/components/Dashboard.tsx Add Wake Easy preset card + Custom entry button
src/engine/AlarmEngine.ts    Light refactor: start/cleanup call AlarmSession helpers
src/engine/index.ts          Export new types/engines
src/sw.ts                    Add skipWaiting/clientsClaim; route scoping if multi-page
vite.config.ts               registerType: 'autoUpdate'; vite-plugin-sitemap; start_url -> /Soundly/app
index.html                   SEO meta + JSON-LD as static markup (NOT React-rendered)
```

**Cross-cutting infra changes (Pitfall #6) — must land BEFORE the SEO Meta phase delivers value:**
- `vite.config.ts`: add `registerType: 'autoUpdate'`
- `src/sw.ts`: add `self.skipWaiting()` + `self.clients.claim()`

Sequence these as the first slice of the discoverability track, otherwise installed PWA users keep seeing stale meta indefinitely after deploy.

---

## 5. Watch Out For (Top 7 Critical Pitfalls)

1. **Segment-chain timer drift over 17 min Wake Easy (Pitfall #1).** Naive `setTimeout(next, segment.duration)` chaining accumulates drift on backgrounded mobile — alarm can fire 30+ seconds late. **Fix:** Compute all segment fire times absolutely at `start()` time using v1's `scheduleAt` pattern; schedule audio strikes via `AudioContext.currentTime`. Owner: Segment Runner phase.

2. **Segment pause/resume semantics (Pitfall #2).** Three plausible interpretations exist (resume mid-segment / restart segment / skip segment); implementer will pick the easiest. **Fix:** Specify "resume mid-segment" in the phase plan, mirror v1 snapshot pattern, disable Pause during the final alarm segment. Owner: Segment Runner phase.

3. **Triangle attack click transient (Pitfall #3).** Setting `gain.value = 1.0` instantaneously creates a broadband click — product-killing on a zen alarm. **Fix:** 5ms `linearRampToValueAtTime` on attack, 50ms on release, multi-oscillator stack, fundamental ≥ 1 octave above singing-bowl partials. Owner: Triangle Sound phase.

4. **Segment validation surface much wider than v1's (Pitfall #4).** Empty list, single-segment-no-sound, zero/negative/NaN duration, unknown sound key, ridiculous totals all silently produce a broken alarm. **Fix:** Extend `validateConfig`, sanitize at the input layer, error-return rather than throw, test the empty-segment-list case explicitly. Owner: Segment Composer UI + Segment Runner phases.

5. **JS-rendered SEO meta is invisible to OG/Twitter crawlers (Pitfall #5).** OG/iMessage/Slack/WhatsApp scrapers do not execute JavaScript at all. Any `useEffect` meta-injection results in empty link previews. **Fix:** Embed all meta + JSON-LD directly in static `index.html` at build time. Do not use react-helmet. Owner: SEO Meta phase.

6. **vite-plugin-pwa serves stale meta forever to installed users (Pitfall #6).** Without `registerType: 'autoUpdate'` + `skipWaiting/clientsClaim`, PWA users keep seeing old meta after deploy. OG image cached at Facebook for 7–30 days. **Fix:** Add SW config flags; version OG image filenames when content changes; force-refresh via Facebook Sharing Debugger after deploy. Owner: SEO Meta phase + deploy runbook.

7. **JSON-LD silent validation failures (Pitfall #7).** Typo in `@context`, wrong `@type`, or missing required fields — Google silently drops the schema; no error visible for weeks. **Fix:** Run Google Rich Results Test + Schema.org Validator before commit. Use `WebApplication` (or `SoftwareApplication`) with all required fields, omit `aggregateRating`. Owner: SEO Meta phase.

**Honorable mentions (moderate severity):** Stale closures in segment list ops (#8 — key by UUID not index), drag-and-drop touch + a11y conflicts (#9), Wake Easy "17 min" label drifting from actual segment sum (#10), iOS install nudge anti-patterns (#11), robots.txt blocking critical assets (#12), bundle bloat from non-lazy alarm engine on landing (#13), iOS reality buried under marketing polish (#17), triangle/bowl frequency clash (#18).

---

## 6. Suggested Phase Shape

Two valid groupings emerge from research; roadmapper picks based on team preference.

### Option A — 6 Phases (ARCHITECTURE.md, finer-grained)

```
1. AlarmSession refactor              (engine, low risk; isolates regression window)
2. Triangle sound + SegmentEngine     (engine, additive; no UI yet)
3. Wake Easy preset + SegmentCountdown UI  (validates segment runtime end-to-end)
4. Custom Composer modal              (depends on segment countdown existing)
─── parallel discoverability track ───
5. SEO meta tags + JSON-LD            (orthogonal, can ship anytime; static HTML only)
6. Multi-page split + landing page    (highest risk; touches vite.config.ts + sw.ts)
```

### Option B — 2 High-Level Phases (FEATURES.md, coarser)

```
1. Composer track    A1-* + A2-3 + A2-5 (~13 features, mostly Small)
2. Discoverability   B1-* + B2-3 + B2-6 (~14 features, mostly Small + 1 design + 1 routing M)
```

### Sequencing guidance both options agree on

- **Wake Easy ships before the Custom UI.** A fixed preset exercises the entire segment runtime (engine, hook, countdown UI, dashboard wiring) end-to-end without committing to the composer's design.
- **SEO Meta phase can ship in parallel with the composer track** — the two tracks are architecturally independent.
- **Multi-page split / landing page lands LAST** in the discoverability track. Highest-risk phase deserves an isolated boundary.
- **The two cross-cutting SW infra changes** (`registerType: 'autoUpdate'`, `skipWaiting/clientsClaim`) should land at the start of the SEO Meta phase, not the landing page phase.

### Research depth needed per phase

| Phase | Needs deeper /gsd-research-phase? | Why |
|-------|-----------------------------------|-----|
| AlarmSession refactor | NO | Mechanical extract |
| SegmentEngine + triangle | YES (light) | Verify drift-correction; prototype triangle on hardware |
| Wake Easy + SegmentCountdown | NO | Standard UI work using established patterns |
| Custom Composer | YES if drag reorder ships — pick DnD lib + verify touch/a11y on iOS | Otherwise NO |
| SEO Meta + JSON-LD | NO | Patterns well-documented; verification gates clear |
| Multi-page split / landing | YES | vite-plugin-pwa multi-entry interaction is biggest unknown; verify with Context7 |

---

## 7. Open Decisions for Roadmapper

1. **Routing approach: `react-router` v7 (single SPA) vs Vite multi-page (two HTML entries).**
   - STACK §1 argues for react-router: one bundle, code-split per route, one Tailwind config, one SW with unchanged NavigationRoute, ~14 KB cost.
   - ARCHITECTURE Decision 7 argues for multi-page: hand-authored marketing HTML at `/`, app shell at `/app/`, no router dep, crawlers see real HTML, each page ships only its code.
   - **Trade-off:** react-router keeps design system uniform and avoids touching SW; multi-page gives landing page max SEO purity and zero JS for static content. Decide at start of discoverability track.

2. **Drag-and-drop library: `motion` Reorder vs `@dnd-kit/core` + `@dnd-kit/sortable`.**
   - STACK §4 leans Motion if Motion is also adopted for animations elsewhere.
   - PITFALLS #9 leans dnd-kit for first-class keyboard + screen-reader + touch support.
   - **Or defer drag entirely** — composer ships fine without it. Decision deferrable to Custom Composer phase plan.

3. **Phase granularity: 6 phases vs 2 phases.** 6 give cleaner regression isolation; 2 reduce planning overhead.

4. **Hosting: GitHub Pages vs custom domain.** PITFALLS #12 — on GitHub Pages, `robots.txt` lives at the origin root which the project does not control. Either accept manual sitemap submission via Search Console, or move to a custom domain. Affects SEO Meta phase.

5. **Sound naming convention.** Internal enum vs user-facing labels. FEATURES §A.4 recommends friendly labels in UI ("Soft chime", "Bright triangle", "Wake-up tone"), enums in code. Pin early so copy doesn't churn.

6. **Empty composer policy.** FEATURES §A.4 strongly recommends opening composer with Wake Easy pre-loaded (A2-3) so screen is never blank. Confirm before Custom Composer phase begins.

---

## 8. Out of Scope Reminders

These are explicitly deferred per PROJECT.md, FEATURES.md, and ARCHITECTURE.md. Do NOT fold into v2.0:

- **Capacitor / native iOS shell for locked-screen alarm reliability.** Per `ios-alarm-feasibility.md`, locked-screen alarms in pure PWA on iOS are structurally impossible. Honest framing: be transparent on landing page (Pitfall #17), recommend home-screen install, defer native bridge to possible v3.x.
- **Persistent custom presets / "Save as preset" / localStorage of compositions.** Conflicts with v1.0 no-persistence decision (anti-feature AX-6 / A2-6).
- **Long-form SEO content / blog posts / keyword research.** Anti-feature BX-6, explicitly out-of-scoped in PROJECT.md.
- **Analytics / tracking / cookies.** Anti-features BX-3 and BX-4. A consent banner with nothing to consent to would be dishonest noise.
- **Multi-alarm scheduling / multiple simultaneous alarms.** Anti-feature AX-9; v1.0 already out-scoped.
- **Aggregate rating in JSON-LD.** Anti-feature B2-8 / Pitfall #7 — fabricating ratings triggers Google manual penalty.
- **Auto-rotating screenshot carousel, auto-playing audio on landing.** Anti-features BX-9 and B2-1 sub-flag.
- **Bumping vite-plugin-pwa from 0.21.x to 1.2.x.** Per STACK §package.json deltas — orthogonal to v2.0 features, defer to separate maintenance task.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack additions (versions, fitness) | HIGH | react-router v7 verified; React 19 metadata native verified; vite-plugin-sitemap version needs `npm show` check |
| Routing approach (single vs multi-page) | MEDIUM | Both options defensible; research did not converge — flagged as open decision |
| DnD library pick | MEDIUM | Both work; depends on whether drag ships at all and whether a11y is hard gate |
| Composer feature set | HIGH | Reference apps (Seconds Pro, Insight Timer, Cronologix, Loftie) corroborate split |
| SEO mechanics + JSON-LD | HIGH | MDN, Google Search Central, Schema.org primary sources |
| Triangle synthesis details | MEDIUM | Standard patterns; exact partials/decay should be A/B tested on hardware |
| Segment runtime drift mitigation | HIGH | v1.0 already proved pattern at 5/21 min; extends linearly to N segments |
| iOS locked-screen reality | HIGH | Already documented in `.planning/research/ios-alarm-feasibility.md` |
| vite-plugin-pwa multi-entry interaction | MEDIUM | Documented but not verified end-to-end; Context7 verification before Phase 6 |

**Gaps to address during phase planning:**
- Triangle exact synthesis parameters (fundamental Hz, partial mix, attack/decay times)
- Wake Easy exact segment durations confirmation (4 × 4 + 1 × 1 = 17 min vs alternative shapes)
- Final sound naming labels (UI strings)
- Final landing-page copy including iOS honesty section (B2-3)
- Custom domain decision (impacts SEO Meta phase robots.txt strategy)
- Whether installed v1 PWA users get auto-migrated to new `start_url` or need to reinstall — verify with vite-plugin-pwa Context7 docs before Phase 6 ships
