# Roadmap: Soundly Gentle Alarm

## Overview

Soundly is being built milestone by milestone. Phases continue numbering across milestones — v1.0 shipped Phases 1–5; v2.0 begins at Phase 6. Each phase delivers a coherent, independently verifiable capability.

**Phase Numbering:**
- Integer phases (1, 2, 3, ...): Planned milestone work
- Decimal phases (e.g. 2.1, 9.1): Urgent insertions (marked with INSERTED) executed between their surrounding integers

---

## Milestone v1.0 — Foundations (Shipped)

The original v1.0 alarm engine, three-phase escalation, presets, PWA shell, and iOS audio loudness fixes. All requirements (AUD-01..04, ALM-01..05, PLT-01..04, UX-01..04) are validated and live. See REQUIREMENTS.md v1.0 traceability table.

- [x] **Phase 1: Audio Engine and Timer** — Synthesized alarm sounds, wall-clock timer, AlarmEngine state machine
- [x] **Phase 2: Background Reliability** — Silent keepalive loop, Wake Lock, notifications, vibration, iOS handling
- [x] **Phase 3: React UI** — Dashboard, countdown screen, stop/pause controls, zen aesthetic
- [x] **Phase 4: PWA Shell** — Installable PWA with offline support and service worker
- [x] **Phase 5: iOS Audio Loudness Fixes** — Software-only Phase 3 loudness improvements on iPhone (audioSession, compressor, frequency shift, amplitude modulation)

---

## Milestone v2.0 — Custom Alarm Composer + Discoverability

**Goal:** Let users compose alarms from arbitrary segments with a chosen end-of-segment sound, ship a long-form gentle preset that demonstrates the model, and make the app discoverable from search engines.

**Locked architectural decisions (do not re-debate during phase planning):**
- **Routing:** Vite multi-page build — two HTML entries (`index.html` for landing, `app/index.html` for app shell). No router runtime dependency. SW scope rescoped to `/app` only.
- **Hosting:** GitHub Pages at `username.github.io/Soundly/`. robots.txt is best-effort at the subpath; primary discoverability path is Search Console manual sitemap submission.
- **Drag-and-drop:** NOT in v2.0. Reorder is deferred to v2.x.

**Open decisions deferred to phase planning:**
- Triangle exact synthesis parameters (Hz, partial mix, attack/decay)
- Final sound naming labels (UI strings)
- Final landing-page copy (incl. iOS honesty section wording)

## Phases

- [x] **Phase 6: AlarmSession Refactor + v1 Regression Guard** — Extract shared session lifecycle from `AlarmEngine`; preserve byte-identical v1 behavior (SEG-05 zero-diff guarantee)
- [x] **Phase 7: Segment Engine + Triangle Sound** — Additive engine + new sound; no UI changes; runtime validated by tests
- [x] **Phase 8: Wake Easy Preset + Segment Countdown UI** — Third dashboard preset card + N-segment countdown UI; validates segment runtime end-to-end
- [x] **Phase 9: Custom Composer + Share via URL** — Modal segment builder with stepper inputs and duplicate; share link round-trip
- [x] **Phase 10: SEO Meta + JSON-LD + Service Worker Update Infra** — Static-HTML meta, OG, Twitter, JSON-LD; SW autoUpdate + skipWaiting + clientsClaim
- [ ] **Phase 11: Multi-page Split + Landing Page** — Two HTML entries; hand-authored marketing landing; SW scope rescoped to `/app`; sitemap.xml; robots.txt; install CTA

## Phase Details

### Phase 6: AlarmSession Refactor + v1 Regression Guard
**Goal**: The shared alarm session lifecycle (AudioContext bring-up, keepalive, Wake Lock, visibility re-acquire, teardown) is extracted from `AlarmEngine` into a small reusable module — without changing any v1 user-visible behavior. This unlocks Phase 7 by giving the new SegmentEngine a place to share lifecycle code instead of duplicating it.
**Depends on**: Nothing (first v2.0 phase; sits on top of shipped v1.0)
**Requirements**: SEG-05
**Success Criteria** (what must be TRUE):
  1. A new `src/engine/AlarmSession.ts` exposes `startAlarmSession()` / `endAlarmSession()` and is the single owner of keepalive + Wake Lock + visibility re-acquire setup
  2. `AlarmEngine.start()` and `AlarmEngine.cleanup()` call into AlarmSession; behavior of Quick Nap and Focus is byte-identical (timing, audio, vibration, notifications, Wake Lock, pause/resume snapshot semantics) to pre-refactor
  3. v1.0 paths carry zero diff: `src/engine/AlarmState.ts` (AlarmConfig, validateConfig, QUICK_NAP_CONFIG, FOCUS_CONFIG), `src/hooks/useAlarm.ts`, `src/components/Countdown.tsx`, `src/components/ProgressRing.tsx`, and every existing `src/engine/sounds/*.ts` file are unchanged this phase
  4. A documented v1 regression check passes: Quick Nap launches, fires Phase 1 → 2 → 3 in correct order with correct durations and audio, Wake Lock is acquired and released; Focus repeats the same regression matrix at its longer cadence
**Plans:** 3 plans
  - [x] 06-01-PLAN.md — Create AlarmSession.ts (function pair + SessionHandle + WeakMap internals) + standalone unit tests + barrel exports
  - [x] 06-02-PLAN.md — Rewire AlarmEngine.start()/cleanup() to call AlarmSession + extend AlarmEngine.test.ts with QUICK_NAP/FOCUS regression assertions
  - [x] 06-03-PLAN.md — Author 06-REGRESSION-CHECKLIST.md (on-device manual verification matrix)
**UI hint**: no

### Phase 7: Segment Engine + Triangle Sound
**Goal**: A SegmentEngine running alongside AlarmEngine can schedule N segments with absolute-fire-time accuracy, fire one of three end-of-segment sounds (gentle / triangle / alarm), validate ill-formed segment configs before they reach the runtime, and pause/resume mid-segment. The triangle sound is synthesized click-free and is sonically distinct from the singing bowl. No UI is added; the runtime is verified via tests and a temporary dev-only harness.
**Depends on**: Phase 6 (AlarmSession exists)
**Requirements**: SEG-01, SEG-02, SEG-03, SEG-04, AUD-05
**Success Criteria** (what must be TRUE):
  1. `Segment = { id, durationMs, endSound: 'gentle' | 'triangle' | 'alarm' }` and `SegmentConfig = { segments: Segment[] }` are exported from the engine; `validateSegmentConfig` rejects empty lists, NaN/zero/negative durations, and unknown sound keys with user-readable error returns (never thrown into the runtime)
  2. SegmentEngine schedules every segment-end fire time absolutely at `start()` (no chained `setTimeout`); audio strikes are scheduled against `AudioContext.currentTime`; a 17-minute, 5-segment harness run drifts < 2 s end-to-end on foreground desktop and Android
  3. Pause mid-segment snapshots remaining-ms in the current segment plus the rest of the chain; resume restores from that snapshot and total elapsed time extends by the pause duration; pause is disabled while the final alarm-sound segment is firing
  4. The triangle sound (`src/engine/sounds/triangle.ts`) plays a single bright strike with a click-free attack (≥5 ms `linearRampToValueAtTime`), exponential decay over ~1–2 s, and a fundamental at least one octave above the singing-bowl partials; on headphones at 50% volume the attack is inaudible as a separate event from the tone
  5. v1 paths still carry zero diff: AlarmEngine, AlarmConfig, useAlarm, Countdown, ProgressRing, and every existing sound file (other than the new `triangle.ts`) are unchanged this phase
**Plans:** 5 plans
  - [x] 07-01-PLAN.md — Triangle sound (strikeTriangle at F7 = 2793.83 Hz with click-free 8 ms attack + 2.0 s exp decay) + envelope unit tests
  - [x] 07-02-PLAN.md — SegmentState (types + validateSegmentConfig discriminated-union + WAKE_EASY_CONFIG) + validator coverage tests
  - [x] 07-03-PLAN.md — segmentSound dispatcher (gentle/triangle keys; alarm carve-out) + routing tests
  - [x] 07-04-PLAN.md — SegmentEngine class (mirrors AlarmEngine shape; absolute scheduling; alarm-segment ramp+swell; pause snapshot; per-key auto-stop) + ~22-test regression net
  - [x] 07-05-PLAN.md — SegmentHarness (Vite-DEV-gated) + barrel exports (D-24 append-only) + App.tsx mount line + AGGREGATED SEG-05 zero-diff guardrail
**UI hint**: no

### Phase 8: Wake Easy Preset + Segment Countdown UI
**Goal**: Users can launch the new Wake Easy preset from the Dashboard and watch a calm N-segment countdown UI fire 4 gentle chimes at 4-minute boundaries followed by an alarm at 17 minutes. This phase puts the Phase 7 segment runtime in front of real users for the first time, via a fixed preset, before the Custom composer ships.
**Depends on**: Phase 7 (SegmentEngine + triangle exist)
**Requirements**: SEG-06
**Success Criteria** (what must be TRUE):
  1. A "Wake Easy" preset card appears on the Dashboard alongside Quick Nap and Focus; tapping it starts the alarm in a single tap with the displayed total label matching the actual segment sum exactly (4 × 4 min gentle + 1 × 1 min alarm = 17 min)
  2. A new `SegmentCountdown` UI replaces `Countdown` for segment-mode alarms, shows current-segment index out of N, remaining time in mm:ss, and reachable Stop / Pause / Resume controls in the same zen visual language as v1
  3. A `useActiveAlarm` mode selector dispatches Quick Nap and Focus through the unchanged `useAlarm` (continuous mode) and Wake Easy through the new `useSegmentAlarm` (segments mode); only one mode runs at a time
  4. End-to-end run on desktop with the screen visible: Wake Easy fires the gentle chime at exactly t = 4:00, 8:00, 12:00, 16:00 (± 2 s) and the final alarm sound at t = 17:00 (± 2 s); pause-resume integrity test extends total duration by the pause length
  5. v1 byte-identical guarantee still holds: Quick Nap and Focus continue running through the unmodified `Countdown.tsx` + `useAlarm.ts` + `AlarmEngine.ts` paths
**Plans:** 6/6 plans complete
  - [x] 08-01-PLAN.md — Wave 1 test infrastructure (RTL + jsdom + vitest jsdom env) + index.css @keyframes pulse-active-arc append
  - [x] 08-02-PLAN.md — useSegmentAlarm hook (mirror useAlarm; D-09 surface) + tests (Wave 2 leaf, parallel-safe with 08-03)
  - [x] 08-03-PLAN.md — SegmentProgressRing.tsx N-arc duration-proportional ring + tests (Wave 2 leaf, parallel-safe with 08-02)
  - [x] 08-04-PLAN.md — useActiveAlarm dispatcher hook (D-07 discriminated union; both-mounted) + tests (Wave 3, depends on 08-02)
  - [x] 08-05-PLAN.md — SegmentCountdown.tsx component + tests (Wave 3, depends on 08-02 + 08-03)
  - [x] 08-06-PLAN.md — Dashboard 4 x 4 card + App.tsx 3-way routing + SegmentHarness deletion + AGGREGATED SEG-05 byte-identical guardrail (Wave 4)
**UI hint**: yes

### Phase 9: Custom Composer + Share via URL
**Goal**: Users can compose arbitrary segment alarms in a full-screen modal (pre-loaded with the Wake Easy template, never blank), edit per-segment durations via stepper inputs, pick per-segment sounds, add / delete / duplicate segments, see a live total-duration display, and share their composition via a versioned URL hash that recipients open to pre-load the composer. Invalid or tampered URLs fail gracefully with no runtime exceptions.
**Depends on**: Phase 8 (SegmentCountdown exists; composer must hand off to it on Start)
**Requirements**: COMP-01, COMP-02, COMP-03, COMP-04, COMP-05, COMP-06, COMP-07, COMP-08, SHR-01, SHR-02, SHR-03, SHR-04
**Success Criteria** (what must be TRUE):
  1. A "Custom" entry button on the Dashboard opens the composer as a full-screen modal pre-loaded with the Wake Easy template (5 editable segments) — never a blank screen; Cancel returns to Dashboard without starting; Start launches the segment alarm and hands off to SegmentCountdown
  2. Each segment row shows a stepper duration input (+/− buttons + arrow-key support), a sound picker (gentle / triangle / alarm), an inline Delete button, and a Duplicate action that clones the row immediately below it; an "Add segment" button appends a new segment (default duration + gentle sound); a live total-duration display updates on every edit
  3. The composer's "Share" button serializes the current segment list into a versioned URL hash (e.g. `/app#c=v1:240000-0,240000-0,240000-0,240000-0,60000-2`) and invokes `navigator.share(...)`; on browsers without Web Share API support it falls back to copy-to-clipboard with a confirmation toast
  4. When the app loads with a shared composition in `location.hash`, the composer mounts pre-loaded with the decoded segments (instead of the Wake Easy default); decoded configs pass through the same SEG-04 validation gate before being accepted
  5. Invalid, malformed, oversized, or unknown-version (`v2:` etc) shared URLs fall back silently to the Wake Easy default with an unobtrusive "couldn't load shared alarm" notice; the runtime never throws on tampered URL input; the encoding format and `v1:` version prefix are documented in source so future versions can break or extend explicitly
**Plans:** 9/9 plans complete
  - [x] 09-01-PLAN.md — shareUrl.ts encode/decode + DecodeResult Result type + tests (SHR-01..04) — Wave 1 leaf, pure lib
  - [x] 09-02-PLAN.md — composerReducer.ts (6-action useReducer) + composerValidation.ts + tests (COMP-04, COMP-05) — Wave 1 leaf, pure lib
  - [x] 09-03-PLAN.md — CustomCard.tsx (parallel-file PresetCard clone) + Toast.tsx (role=status) + tests (COMP-01 visual) — Wave 1 leaf
  - [x] 09-04-PLAN.md — StepperInput.tsx (D-01 adaptive step + boundary at 5:00; D-02 keyboard map) + tests (COMP-03 stepper) — Wave 2 atomic
  - [x] 09-05-PLAN.md — SoundPicker.tsx (role=radiogroup + roving tabindex; D-06 Alarm vs Wake label divergence; D-07 keyboard) + tests (COMP-03 picker) — Wave 2 atomic
  - [x] 09-06-PLAN.md — SegmentRow.tsx (Stepper + SoundPicker + Duplicate + Delete in CSS Grid; D-11 invalid border; D-12 last-segment guard) + tests (COMP-03, COMP-05) — Wave 3 composition
  - [x] 09-07-PLAN.md — useHashComposition.ts (synchronous hash read; post-commit replaceState clear) + tests (SHR-02, SHR-03) — Wave 3 hook
  - [x] 09-08-PLAN.md — Composer.tsx (native <dialog> + useReducer + share handler) + src/index.css APPEND (D-15 dialog keyframes) + tests (COMP-02, COMP-06, COMP-07, COMP-08, SHR-01) — Wave 4 modal
  - [x] 09-09-PLAN.md — Dashboard.tsx (4th CustomCard) + App.tsx (Composer + Toast + useHashComposition wiring) + AGGREGATED SEG-05 byte-identical guardrail (25 paths) (COMP-01, COMP-08) — Wave 5 integration
**UI hint**: yes

### Phase 10: SEO Meta + JSON-LD + Service Worker Update Infra
**Goal**: All static SEO metadata (title, description, OG tags, Twitter card, canonical, JSON-LD WebApplication schema, robots.txt, sitemap.xml) lives in static HTML so OG/Twitter/iMessage scrapers see it without JavaScript, and the service worker is configured to actually deliver updated meta to installed PWA users on next launch (rather than serving stale precached HTML forever). This phase is shippable in parallel with Phases 6–9 if desired, but the SW update flags MUST land in the same phase as the meta work — otherwise installed users see stale meta indefinitely.
**Depends on**: Nothing structurally (orthogonal track); ships before Phase 11 so the landing page lands into a SW update strategy that already works
**Requirements**: SEO-01, SEO-02, SEO-03, SEO-04, SEO-05, SEO-06, SEO-07, SEO-08, SEO-09
**Success Criteria** (what must be TRUE):
  1. `view-source:` (not DevTools Elements) on the deployed page shows the title, meta description, Open Graph tags (`og:title`, `og:description`, `og:image` 1200×630 ≤ 200 KB, `og:type`, `og:url`), Twitter `summary_large_image` card, canonical link, and a `<script type="application/ld+json">` WebApplication block — all as static HTML, none injected by React
  2. The JSON-LD passes both Google Rich Results Test and Schema.org Validator with zero errors and at least one detected eligible @type; `aggregateRating` is omitted (no synthetic ratings)
  3. `public/robots.txt` (with `Allow: /` and a `Sitemap:` line) and `public/sitemap.xml` (listing the landing URL and the `/app` deep link) are present in the production build; deploy runbook documents Search Console manual sitemap submission as the primary path on GitHub Pages and Facebook Sharing Debugger force-refresh after content changes
  4. `vite.config.ts` sets `registerType: 'autoUpdate'` and `src/sw.ts` calls `self.skipWaiting()` and `self.clients.claim()` so installed PWA users receive updated meta on next launch without manual user intervention
  5. The OG image asset uses a versioned filename (e.g. `og-image-v1.png`); a deploy verification confirms that sharing the live URL to Slack and iMessage renders the correct title, description, and image
**Plans:** 6/6 plans complete
  - [x] 10-01-PLAN.md — Static SEO meta block in index.html (title + ~15 new meta/link/script tags; SEO-01..05)
  - [x] 10-02-PLAN.md — public/robots.txt + public/sitemap.xml hand-authored static assets (SEO-06, SEO-07)
  - [x] 10-03-PLAN.md — vite.config.ts registerType: autoUpdate + src/sw.ts skipWaiting + clientsClaim append (SEO-09)
  - [x] 10-04-PLAN.md — scripts/generate-og-image.mjs + npm run og-image + public/og-image-v1.png + D-09 user-approval checkpoint (SEO-02, SEO-08)
  - [x] 10-05-PLAN.md — docs/deploy-runbook.md operator playbook (D-28 — covers URL swap, Search Console, FB Debugger, SW smoke test)
  - [x] 10-06-PLAN.md — tests/static-assets.test.ts source-regex + DOMParser + JSON.parse coverage for all 9 SEO-* + final dist/ build verification (D-27)
**UI hint**: no

### Phase 11: Multi-page Split + Landing Page
**Goal**: The build splits into two HTML entries — a hand-authored static marketing landing at `/` and the existing React app shell at `/app` — with no router runtime dependency. The service worker is rescoped to `/app` only so the landing page is served fresh from the network and the app shell remains fully precached and offline-capable. The landing page presents an honest pitch (including an iOS limitation section), an install CTA that handles both `beforeinstallprompt` (Android/Chrome) and manual Add-to-Home-Screen instructions (iOS), a plain-HTML FAQ, and a deep link into `/app`. This is the highest-risk v2.0 phase because it touches `vite.config.ts` and `src/sw.ts` simultaneously.
**Depends on**: Phase 10 (SEO meta + SW update infra in place); ideally also after Phase 9 (avoid mixing landing-page launch with composer feature churn)
**Requirements**: LAND-01, LAND-02, LAND-03, LAND-04, LAND-05, LAND-06
**Success Criteria** (what must be TRUE):
  1. The build produces two HTML entries via Vite multi-page configuration: `index.html` (hand-authored marketing landing — hero, value prop, screenshot(s), install CTA, FAQ, footer; no React runtime) and `app/index.html` (existing alarm app shell); the PWA manifest `start_url` is updated from `/` to `/app` so installed users launch into the app
  2. Service worker scope and NavigationRoute fallback are rescoped to `/app` only; the landing page is served from the network (not precached aggressively); installed-PWA users opening the app land directly in `/app` and the alarm continues to work fully offline
  3. The landing page install CTA detects platform and display mode: Android Chrome users see a `beforeinstallprompt`-driven install button; iOS Safari users see manual "Share → Add to Home Screen" instructions (no automatic prompt — iOS does not support `beforeinstallprompt`); installed users (`display-mode: standalone`) see no install UI
  4. The landing FAQ is plain HTML `<h3>` + paragraph Q&A (no `FAQPage` JSON-LD); an iOS honesty section explicitly states the locked-screen limitation ("pure PWAs cannot fire audio when iPhone is locked") and recommends home-screen install plus keeping the app foregrounded for reliability
  5. End-to-end deploy verification: a fresh visitor to `/` sees the marketing page (no app bundle download); clicking "Open App" navigates to `/app` and the alarm app loads; an installed PWA opens directly to `/app`; both pages pass Lighthouse PWA + SEO checks at 90+ on mobile
**Plans:** 5 plans
  - [ ] 11-01-PLAN.md — Multi-page build skeleton: vite.config.ts rollupOptions.input + manifest.id/scope/start_url + injectManifest.globPatterns + app/index.html stub (LAND-02, LAND-06)
  - [ ] 11-02-PLAN.md — Wholesale landing rewrite: hero + install CTA + FAQ + iOS honesty + footer + inline CSS + inline install JS (LAND-01, LAND-03, LAND-04, LAND-05)
  - [ ] 11-03-PLAN.md — App shell move: apple-* meta + SEO meta variant + JSON-LD + React mount in app/index.html (LAND-02, LAND-06)
  - [ ] 11-04-PLAN.md — SW rescoping: NavigationRoute allowlist /Soundly/app/ + createHandlerBoundToURL + openWindow target update (LAND-02)
  - [ ] 11-05-PLAN.md — Verification gate: screenshot capture checkpoint + tests/static-assets.test.ts + scripts/verify-phase-10-build.mjs + deploy-runbook §10 + sitemap lastmod (LAND-02, LAND-06)
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11

Phase 10 may ship in parallel with Phases 6–9 if desired (orthogonal track); Phase 11 ships last.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Audio Engine and Timer | 2/2 | Shipped | v1.0 |
| 2. Background Reliability | 2/2 | Shipped | v1.0 |
| 3. React UI | 3/3 | Shipped | v1.0 |
| 4. PWA Shell | 1/1 | Shipped | v1.0 |
| 5. iOS Audio Loudness Fixes | 1/1 | Shipped | v1.0 |
| 6. AlarmSession Refactor + v1 Regression Guard | 3/3 | Shipped | v2.0 |
| 7. Segment Engine + Triangle Sound | 5/5 | Shipped | v2.0 |
| 8. Wake Easy Preset + Segment Countdown UI | 6/6 | Complete    | 2026-05-10 |
| 9. Custom Composer + Share via URL | 9/9 | Complete    | 2026-05-16 |
| 10. SEO Meta + JSON-LD + SW Update Infra | 6/6 | Complete    | 2026-05-21 |
| 11. Multi-page Split + Landing Page | 0/5 | Planned | - |
