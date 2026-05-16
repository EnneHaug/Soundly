# Requirements: Soundly Gentle Alarm

**v1.0 defined:** 2026-04-14
**v2.0 defined:** 2026-05-06
**Core Value:** The alarm must actually wake the user — gently first, reliably always.

---

## v1.0 Requirements (Shipped)

All v1.0 requirements are validated and live. Phase references in the Traceability section.

### Audio

- [x] **AUD-01**: Phase 1 plays a synthesized singing bowl sound via Web Audio API
- [x] **AUD-02**: Phase 3 ramps volume from 0% to 100% over configurable duration (default 1 min) using `linearRampToValueAtTime`
- [x] **AUD-03**: Test Sound button plays Phase 3 sound at mid-range volume to verify audio works
- [x] **AUD-04**: Silent audio keepalive loop runs during active timer to prevent OS from killing the app

### Alarm

- [x] **ALM-01**: Three-phase escalation: soft sound → vibration → volume ramp
- [x] **ALM-02**: Quick Nap preset: 5 min → Phase 1 → 5 min → Phase 2 → 10s → Phase 3
- [x] **ALM-03**: Focus preset: 21 min → Phase 1 → 2 min → Phase 2 → 10s → Phase 3
- [x] **ALM-04**: Wall-clock timer with drift correction (no setInterval tick counting)
- [x] **ALM-05**: Phase 2 uses Vibration API with audio fallback on iOS (no vibration support)

### Platform

- [x] **PLT-01**: PWA installable on home screens with offline support via vite-plugin-pwa
- [x] **PLT-02**: Wake Lock API keeps screen on during active timer (re-acquires on visibility change)
- [x] **PLT-03**: System notification fires when alarm triggers while backgrounded
- [x] **PLT-04**: iOS standalone detection with "Add to Home Screen" prompt for non-installed users

### UX

- [x] **UX-01**: Dashboard with preset cards as large, tappable surfaces
- [x] **UX-02**: Countdown screen with large Stop/Dismiss button and phase indicator
- [x] **UX-03**: Pause and resume functionality during active timer
- [x] **UX-04**: Gentle, zen aesthetic — smooth transitions, generous spacing, minimalist design

---

## v2.0 Requirements — Custom Alarm Composer + Discoverability

### Segment Engine (SEG)

User-composed alarms run alongside the v1.0 continuous-phase model. Quick Nap and Focus stay byte-identical on the v1 path.

- [x] **SEG-01**: Segment-based alarm data model — `Segment = { id, durationMs, endSound: 'gentle' | 'triangle' | 'alarm' }`. A segment plays mostly silence, then triggers its `endSound` at the tail.
- [x] **SEG-02**: Segment runtime fires segment boundaries via absolute scheduling (compute all fire times at `start()`, not chained `setTimeout`). Sound strikes are scheduled against `AudioContext.currentTime`. Drift across a 17-minute Wake Easy preset must be < 2 s.
- [x] **SEG-03**: Pause/resume preserves mid-segment progress — resuming continues from the snapshot point within the current segment, mirroring v1.0 pause semantics. Pause is disabled during the final alarm-sound segment.
- [x] **SEG-04**: Segment-config validation rejects empty segment lists, NaN/zero/negative durations, and unknown sound keys before the alarm starts. Validation surfaces a user-readable error in the composer; never throws into the runtime.
- [x] **SEG-05**: v1.0 paths are byte-identical — `AlarmEngine`, `AlarmConfig`, `validateConfig`, `Quick Nap`, `Focus`, `useAlarm`, `Countdown.tsx`, `ProgressRing.tsx`, and all existing `src/engine/sounds/*.ts` (except the new `triangle.ts`) carry zero diff in v2.0.
- [x] **SEG-06
**: Wake Easy preset ships as the third dashboard preset card — 4 × (4 min ending in gentle chime) + 1 × (1 min ending in alarm) = 17 min total. The displayed total label matches the actual segment sum exactly.

### Composer UI (COMP)

- [x] **COMP-01
**: Dashboard has a "Custom" entry button that opens the segment composer.
- [x] **COMP-02
**: Composer opens pre-loaded with the Wake Easy template (5 editable segments) — never a blank screen.
- [x] **COMP-03
**: Each segment row shows: a stepper duration input (+/− buttons + arrow-key support), a sound picker (gentle / triangle / alarm), and an explicit delete button per row.
- [x] **COMP-04
**: An "Add segment" button appends a new segment to the list (default duration + gentle sound).
- [x] **COMP-05
**: Each segment row has a "Duplicate" action that clones the segment immediately below it.
- [x] **COMP-06
**: A live total-duration display updates as the user edits segments.
- [x] **COMP-07
**: Composer Start/Cancel buttons — Start launches the alarm with the composed segments; Cancel returns to the Dashboard without starting.
- [x] **COMP-08
**: Composer is presented as a full-screen modal over the Dashboard (no separate route in the app shell).

### Sound (AUD continued)

- [x] **AUD-05**: Triangle sound — synthesized Web Audio strike, ~1–2 s decay, click-free attack (≥5 ms `linearRampToValueAtTime`), fundamental frequency ≥1 octave above the singing-bowl's **dominant** partials (defined as partials with peak gain ≥0.10 — the 220 / 607 / 1038 Hz partials, giving an effective floor of ~2076 Hz) so the two tones do not sonically clash. The bowl's quietest partial at 1503 Hz (peak gain 0.06 — at noise-floor level) is intentionally not a constraint, since it is not a perceptible component of the bowl's timbre. Phase 7 design auditioning settled on F7 (2793.83 Hz) as the chosen fundamental, which is above this floor and forms a major-third-flavored interval against the bowl's A root for a warm "ping" feel.

### Discoverability — SEO (SEO)

All meta + JSON-LD lives in static HTML, never React-rendered, so OG/Twitter/iMessage scrapers see it without JavaScript.

- [ ] **SEO-01**: Static `<title>` and `<meta name="description">` in the landing page's `index.html`. Distinct title/description on the app shell entry.
- [ ] **SEO-02**: Open Graph meta tags on the landing page — `og:title`, `og:description`, `og:image` (1200×630, ≤200 KB), `og:type`, `og:url`.
- [ ] **SEO-03**: Twitter Card meta — `summary_large_image` with title/description/image.
- [ ] **SEO-04**: JSON-LD `WebApplication` schema in static HTML — `@context`, `@type`, `name`, `description`, `applicationCategory`, `operatingSystem`. No `aggregateRating` (Google manual-action risk on synthetic ratings).
- [ ] **SEO-05**: `<link rel="canonical">` on the landing page pointing at the canonical URL.
- [ ] **SEO-06**: `public/robots.txt` with `Allow: /` and a `Sitemap:` line. (GitHub Pages constraint: subpath robots.txt is best-effort indexing only — Search Console manual sitemap submission is the primary path.)
- [ ] **SEO-07**: `public/sitemap.xml` listing the landing URL and the `/app` deep link, generated at build time (vite-plugin-sitemap or hand-authored).
- [ ] **SEO-08**: OG image asset uses a versioned filename (e.g. `og-image-v1.png`); deploy runbook documents Facebook Sharing Debugger force-refresh after content changes.
- [ ] **SEO-09**: Service worker config gains `registerType: 'autoUpdate'`, `self.skipWaiting()`, and `self.clients.claim()` so installed PWA users actually receive updated meta + content.

### Landing & Routing (LAND)

- [ ] **LAND-01**: Marketing landing page at `/` — hero pitch, value proposition, screenshot(s), install CTA, FAQ, footer. Hand-authored static HTML; no React.
- [ ] **LAND-02**: Two-tier routing — landing at `/`, alarm app shell at `/app`. PWA `start_url` updates from `/` to `/app` so installed users launch into the app.
- [ ] **LAND-03**: Install CTA — Android browsers see a `beforeinstallprompt`-driven install button; iOS Safari users see manual "Share → Add to Home Screen" instructions (no automatic prompt — iOS does not support `beforeinstallprompt`).
- [ ] **LAND-04**: FAQ section on landing — plain HTML `<h3>` + paragraph Q&A. No `FAQPage` JSON-LD (Google deprecated rich-result eligibility for non-gov/health sites in 2023).
- [ ] **LAND-05**: iOS honesty section explicitly states the locked-screen alarm limitation (pure PWAs cannot fire audio when iPhone is locked) and recommends home-screen install + keeping the app foregrounded for reliability.
- [ ] **LAND-06**: Build uses Vite multi-page configuration — two HTML entries (`index.html` for landing, `app/index.html` for app shell). No router runtime dependency. Service worker scope and NavigationRoute fallback rescoped to `/app` only.

### Share via URL (SHR)

A composed alarm can be shared as a URL — recipient opens the link and the composer pre-loads with the shared segments. No backend, no localStorage, no accounts. Reinforces the no-persistence design by making compositions portable without storage.

- [x] **SHR-01
**: Composer "Share" button serializes the current segment list into a versioned URL hash fragment (e.g. `/app#c=v1:240000-0,240000-0,240000-0,240000-0,60000-2`) and invokes `navigator.share({ url, title, text })`. Falls back to copy-to-clipboard with a confirmation toast on browsers without Web Share API support.
- [x] **SHR-02
**: When the app loads with a shared composition in `location.hash`, the composer mounts pre-loaded with the decoded segments (instead of the Wake Easy template). Decoded configs pass through the same SEG-04 validation gate before being accepted.
- [x] **SHR-03
**: Invalid, malformed, or oversized shared URLs fail gracefully — composer falls back to the Wake Easy default and surfaces an unobtrusive "couldn't load shared alarm" notice. The runtime never throws on tampered URL input.
- [x] **SHR-04
**: Encoding format begins with a single-token version prefix (`v1:`). Decoders reject unknown versions cleanly. The format is documented in source so future versions remain backward-compatible (or explicit about breaking).

---

## Future Requirements (Deferred to v2.x or later)

- Drag-and-drop segment reorder (table-stakes-adjacent, but adds first runtime DnD dependency — defer pending real demand)
- Visual segment timeline preview in the composer
- Per-segment volume control
- Color-coded segment cards (visual differentiation)
- Save-as-preset for custom compositions (would require breaking the v1 no-persistence decision)
- Long-form SEO content / blog posts / keyword-targeted articles
- Analytics + privacy disclosure
- Custom domain migration (would unlock root-level robots.txt control)

## Out of Scope (v2.0)

| Feature | Reason |
|---------|--------|
| Clock-based scheduling ("wake at 7am") | PWAs can't reliably deliver scheduled alarms; countdown timers only |
| Persistent custom presets / localStorage of compositions | Conflicts with v1.0 ephemeral-settings decision |
| User accounts / cloud sync | No backend; pure client-side app |
| Capacitor / native iOS shell for locked-screen alarm | Structural iOS limit per `.planning/research/ios-alarm-feasibility.md` — deferred to potential v3.x |
| Multiple simultaneous alarms | Complexity with no clear v2 value |
| Cookie banner / consent UI | No analytics or tracking in v2.0 — would be dishonest noise |
| `aggregateRating` in JSON-LD | Google manual-action risk for synthetic ratings without real review data |
| `FAQPage` JSON-LD rich result | Google restricted to gov/health sites in 2023; visually discontinued in 2024 |
| Smart App Banner / iOS Smart Banner | Designed for App Store apps; not applicable to PWAs |
| `beforeinstallprompt` on iOS | iOS does not support this API — handled via manual instructions instead |
| Auto-prompt for notifications on landing | Anti-pattern; permission must come from explicit user gesture in-app |
| `vite-plugin-pwa` major upgrade (0.21.x → 1.x) | Orthogonal to milestone, risks regressing validated `injectManifest` behavior |

---

## Traceability

v1.0 traceability (shipped):

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUD-01, AUD-02, AUD-03, AUD-04 | Phase 1 | Shipped |
| ALM-01, ALM-04 | Phase 1 | Shipped |
| ALM-02, ALM-03, ALM-05 | Phase 2 | Shipped |
| PLT-02, PLT-03, PLT-04 | Phase 2 | Shipped |
| UX-01, UX-02, UX-03, UX-04 | Phase 3 | Shipped |
| PLT-01 | Phase 4 | Shipped |

v2.0 traceability:

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEG-05 | Phase 6 | Shipped |
| SEG-01 | Phase 7 | Complete |
| SEG-02 | Phase 7 | Complete |
| SEG-03 | Phase 7 | Complete |
| SEG-04 | Phase 7 | Complete |
| AUD-05 | Phase 7 | Complete |
| SEG-06 | Phase 8 | Complete |
| COMP-01 | Phase 9 | Complete |
| COMP-02 | Phase 9 | Pending |
| COMP-03 | Phase 9 | Pending |
| COMP-04 | Phase 9 | Pending |
| COMP-05 | Phase 9 | Pending |
| COMP-06 | Phase 9 | Pending |
| COMP-07 | Phase 9 | Pending |
| COMP-08 | Phase 9 | Complete |
| SHR-01 | Phase 9 | Pending |
| SHR-02 | Phase 9 | Pending |
| SHR-03 | Phase 9 | Pending |
| SHR-04 | Phase 9 | Pending |
| SEO-01 | Phase 10 | Pending |
| SEO-02 | Phase 10 | Pending |
| SEO-03 | Phase 10 | Pending |
| SEO-04 | Phase 10 | Pending |
| SEO-05 | Phase 10 | Pending |
| SEO-06 | Phase 10 | Pending |
| SEO-07 | Phase 10 | Pending |
| SEO-08 | Phase 10 | Pending |
| SEO-09 | Phase 10 | Pending |
| LAND-01 | Phase 11 | Pending |
| LAND-02 | Phase 11 | Pending |
| LAND-03 | Phase 11 | Pending |
| LAND-04 | Phase 11 | Pending |
| LAND-05 | Phase 11 | Pending |
| LAND-06 | Phase 11 | Pending |

**Coverage:**
- v1.0 requirements: 17 total — all shipped ✓
- v2.0 requirements: 34 total — all mapped to phases ✓
  - Phase 6: 1 requirement (SEG-05)
  - Phase 7: 5 requirements (SEG-01..04, AUD-05)
  - Phase 8: 1 requirement (SEG-06)
  - Phase 9: 12 requirements (COMP-01..08, SHR-01..04)
  - Phase 10: 9 requirements (SEO-01..09)
  - Phase 11: 6 requirements (LAND-01..06)

---
*v1.0 requirements defined: 2026-04-14*
*v2.0 requirements defined: 2026-05-06*
*v2.0 traceability populated by roadmapper: 2026-05-04*
