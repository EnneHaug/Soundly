# Phase 11: Multi-page Split + Landing Page - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Split the build into two HTML entries — a hand-authored static marketing landing at `/` and the existing React app shell at `/app/` — with no router runtime dependency. The service worker is rescoped to `/app` only so the landing page is served fresh from the network and the app shell remains fully precached and offline-capable. The landing page presents an honest pitch (including an iOS limitation section), an install CTA that handles both `beforeinstallprompt` (Android/Chrome) and manual Add-to-Home-Screen instructions (iOS), a plain-HTML FAQ, and a deep link into `/app/`.

**In scope:**
- New hand-authored `index.html` at repo root — marketing landing (compact one-page, hero + value + install + screenshot + FAQ + iOS honesty + footer). No React runtime, no `<script>` for app bundle.
- New `app/index.html` — moves the current React app shell down one level. Vite multi-page entries config in `vite.config.ts`.
- Existing React entry (`src/main.tsx`) re-targets `app/index.html`; app boots only at `/app/`.
- PWA manifest `start_url` updated from `/Soundly/` to `/Soundly/app/`.
- Service worker scope rescoped to `/app/` only. `NavigationRoute` fallback only catches `/app/*`. Precaching only includes `/app/*` assets.
- Install CTA — `beforeinstallprompt` button on Android, click-to-expand panel for iOS Safari, hidden for already-installed users.
- Plain-HTML FAQ + iOS honesty section (no FAQPage JSON-LD per Phase 10 D-15).
- Existing Phase 10 SEO meta (OG, Twitter, JSON-LD, canonical) — verify still present in the new `index.html`; the `/app/` shell gets its own (distinct) meta block.
- `public/sitemap.xml` already lists `/Soundly/` + `/Soundly/app/` — verify still correct after split.
- Existing `IosInstallBanner.tsx` component in `src/components/` — pattern source for the landing iOS panel; do NOT import (landing has no React); copy the platform-detection logic to vanilla JS / inline HTML+CSS.

**Explicitly out of scope (Phase 12+ or future):**
- Additional static pages (`/privacy`, `/about`) — single-landing for v2.0
- Newsletter signup, waitlist, analytics — out per PROJECT.md "Out of Scope"
- Localization / i18n
- Schema.org `Organization` / `WebSite` JSON-LD additions — Phase 10 D-15 deferred; revisit only if low-effort during this phase
- Custom domain configuration — user owns the deploy decision
- Native iOS app to fix the locked-screen audio limitation — PWA-only is locked per PROJECT.md

</domain>

<decisions>
## Implementation Decisions

### Landing copy + tone

- **D-LAND-01 (LOCKED):** Hero line = `A calmer alarm that alerts you gently` — verbatim. Mirrors the Phase 10 OG image tagline and `<title>` element; consistent voice across landing + app + share cards.
- **D-LAND-02 (LOCKED):** Value framing = Calm-first, then "and reliable when it matters." The supporting paragraph beneath the hero leads with the gentle wake-up experience; the reliability/escalation guarantee is the safety net. Matches the project's stated `gentle first, reliable always` core value from PROJECT.md.
- **D-LAND-03 (LOCKED):** FAQ scope = Standard 6–8 questions, covering the "before I install I want to understand" band. Plain HTML `<h3>` + paragraph Q&A per LAND-04. No `FAQPage` JSON-LD (Google deprecated rich-result eligibility for non-gov/health sites in 2023). Candidate question list (planner refines):
  1. Will Soundly actually wake me up?
  2. Does it work offline?
  3. Why is the iPhone experience limited?
  4. How much does it cost? Will it ever cost money?
  5. Where's my data?
  6. Can I customize the alarm sounds and timing?
  7. Can I share an alarm setup with someone else?
  8. Why is there no account or sign-in?
- **D-LAND-04 (LOCKED):** iOS honesty section tone = **Combined warm/apologetic + workaround-forward.** Open with the empathetic acknowledgment (no spin, no PR voice), then *immediately* pivot to the workaround. Two-paragraph structure. Draft seed (planner refines for final voice):
  > "We wish Soundly worked perfectly on iPhone's locked screen — but iOS blocks PWA audio in that state. We're being honest so you can decide if Soundly fits your iPhone use.
  >
  > Here's how to use Soundly reliably on iPhone: install to your home screen, plug in or keep the screen on while the alarm is armed, and use it as a nap timer or focus timer where you'll be near the phone."

### Install CTA UX

- **D-LAND-05 (LOCKED):** Android install button visibility = **`beforeinstallprompt`-driven only.** The button only renders after Chrome's `beforeinstallprompt` event fires (after engagement heuristics pass — typically ~30s on the page or scroll). When the event has not fired, no install button is shown. Honest UX: the button only appears when install is actually possible. No greyed-out / disabled state.
- **D-LAND-06 (LOCKED):** iOS Safari instructions = **Click-to-expand inline panel.** Detect iOS Safari on page load. Show an "Install on iPhone" link in the CTA area. Click expands an inline panel showing the 3 Share-menu steps + small step screenshots (or icon-glyph row). No modal/sheet. Lower visual weight on landing, one extra interaction for iOS users who explicitly want it.
- **D-LAND-07 (LOCKED):** Post-install behavior = **Sequenced: inline confirmation, then auto-navigate.** On `appinstalled` event:
  1. Replace the install button with a brief inline confirmation ("Installed ✓ — launching app…" or similar).
  2. After a short delay (~1–1.5 s, enough for the user to see the confirmation), `window.location` redirect to `/Soundly/app/`.
  - Acknowledges the action without intrusion, then removes the "where did it go?" friction.
- **D-LAND-08 (LOCKED):** Already-installed (display-mode: standalone) view = **Strip the entire install CTA section.** No install button, no iOS panel, no "Open App" button — just the landing content. Detect `window.matchMedia('(display-mode: standalone)').matches` on page load. Installed users navigate to `/app/` naturally via address bar / home screen icon.

### Visual layout + screenshots

- **D-LAND-09 (LOCKED):** Page structure = **Compact one-page layout.** Above the fold: hero (OG image visual) + value paragraph + install CTA. Below the fold (short scroll): inline product screenshot + brief FAQ + iOS honesty section + minimal footer. Total page height roughly 1.5–2× viewport on desktop, 3–4× on mobile. Below-fold sections are intentionally compact — not full-bleed marketing-page sections.
- **D-LAND-10 (LOCKED):** Hero visual = **Reuse `public/og-image-v1.png`** (ring + wordmark, user-approved per Phase 10 D-09). Zero new assets, perfect brand consistency. Render as `<img>` (or `<picture>` for art direction) inside the hero. May be cropped / scaled for above-the-fold display; the canonical 1200×630 asset stays untouched for OG share cards.
- **D-LAND-11 (LOCKED):** Section order = `Hero → value paragraph → screenshot → FAQ → iOS honesty → footer`. Calm-first promise leads, product visual follows, details below.
- **D-LAND-12 (LOCKED):** Footer = **Minimal.** Single-line: GitHub repo link + "Made by [name]" (planner pulls name from git config — currently "J. B. E. Haug") + copyright year (2026). Matches the no-account, no-tracking, no-marketing ethos.
- **D-LAND-13 (LOCKED):** Inline product screenshot = **Composer view with Wake Easy preset open.** Shows the most visually distinctive new feature (segment composition + the gentle preset). Best demonstrates "customizable + calm." Captured manually (or via dev-tools screenshot helper) at a fixed viewport (e.g., 1200×800 desktop or 390×844 iPhone 14 viewport). Stored at `public/screenshot-composer-v1.png` with versioned filename (same convention as Phase 10 D-10 / SEO-08).

### SW migration safety (Claude's Discretion — user explicitly skipped this gray area)

- **D-LAND-14:** Inherit the Phase 10 D-18 silent-update lineage. Plan applies `registerType: 'autoUpdate'` (already set) + `skipWaiting()` + `clientsClaim()` (already in `src/sw.ts`) so users with the old SW (scoped to `/Soundly/`) get the new SW (scoped to `/Soundly/app/`) automatically on next launch. No banner, no toast.
- **D-LAND-15:** During the transition window, the old SW's precached cache may still serve stale `/Soundly/` content for a short time. Acceptable: the landing page is served from network (per LAND-02), and the app shell rescoping is forward-only — no user-visible breakage, just a one-time SW swap.
- **D-LAND-16:** Deploy runbook (Phase 10 `docs/deploy-runbook.md`) gets a Phase 11 addendum: "Test the SW rescoping on a phone that has the v2.0 app installed — confirm the SW updates to the new scope on next launch and `/app/` continues to work offline."

### Claude's Discretion (further)

- Specific FAQ question wording (planner drafts from candidate list in D-LAND-03)
- Footer attribution name (planner pulls from `git config user.name` — currently "J. B. E. Haug")
- Screenshot capture method (manual via DevTools at fixed viewport, or scripted via Playwright if already a dep)
- Dark mode on landing (follow `prefers-color-scheme` like the app does — sage-on-deep-forest in dark, sage-on-warm-sand in light)
- Subtle CSS transitions on landing (hover states, button feedback — no JS animations)
- Hero OG image responsive scaling (full width on mobile, max-width on desktop centered)
- Firefox / Edge / desktop browser fallback messaging (no install button if `beforeinstallprompt` unsupported — show a "works in any modern browser, install for offline" microcopy line instead)
- Inline panel CSS for iOS instructions (accordion-style with `<details>`/`<summary>` is cleanest — no JS needed)
- Schema.org `Organization` / `WebSite` JSON-LD additions (Phase 10 D-15 deferred — add here if low-effort and improves SEO; otherwise skip)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project / milestone
- `.planning/PROJECT.md` — v2.0 milestone scope; zen aesthetic; no-account/no-tracking ethos; PWA-only constraint
- `.planning/REQUIREMENTS.md` — LAND-01..06 (6 Phase 11 requirements)
- `.planning/ROADMAP.md` §"Phase 11" — goal + 5 success criteria
- `CLAUDE.md` — Tailwind v4 + Vite 6 + React 19; GitHub Pages deploy at `/Soundly/`; vite-plugin-pwa injectManifest strategy

### Phase 10 prior context (locked decisions that flow into Phase 11)
- `.planning/phases/10-seo-meta-json-ld-service-worker-update-infra/10-CONTEXT.md` — meta tag block (D-08, D-12, D-23, D-24), OG image (D-07..D-10), SW update strategy (D-16..D-19), placeholder URL contract (D-23)
- `.planning/phases/10-seo-meta-json-ld-service-worker-update-infra/10-SUMMARY.md` files (01..06) — what shipped
- `.planning/phases/10-seo-meta-json-ld-service-worker-update-infra/10-VERIFICATION.md` — codebase-verified gates; 5 post-deploy gates queued for human

### Existing files (read before modifying)
- `index.html` — current single React app shell; Phase 11 SPLITS this into landing (root) + `app/index.html`. The Phase 10 meta block currently in `<head>` MOVES with the app shell to `app/index.html`; the landing gets its OWN meta block (similar but with `og:url` pointing to `/Soundly/` not `/Soundly/app/`).
- `vite.config.ts` — current single-entry build; Phase 11 ADDS `build.rollupOptions.input` with two entries (`{ main: 'index.html', app: 'app/index.html' }`); VitePWA `manifest.start_url` changes from `/Soundly/` to `/Soundly/app/`; VitePWA `manifest.scope` adds `/Soundly/app/`; SW `globPatterns` narrows to `app/**/*`
- `src/sw.ts` — current SW; Phase 11 narrows `NavigationRoute` fallback to only `/app/*` paths (existing handlers preserved)
- `src/main.tsx` — current React entry; verify it still mounts to `#root` and that `app/index.html` includes `<div id="root">`
- `src/components/IosInstallBanner.tsx` — EXISTS in the React app already; pattern source for the landing iOS panel (do NOT import; landing has no React; copy the platform-detection logic to vanilla JS or static HTML)
- `public/og-image-v1.png` — hero visual reuse (D-LAND-10)
- `public/sitemap.xml` — already lists both `/Soundly/` and `/Soundly/app/`; verify still correct after split
- `public/robots.txt` — unchanged
- `docs/deploy-runbook.md` — extend with Phase 11 SW-rescoping verification step (D-LAND-16)
- `src/index.css` — warm-earth palette CSS variables; landing reuses these via `<link rel="stylesheet">` (or inlines a tiny subset to avoid loading the full app CSS on landing)

### External validators (deploy-time)
- Lighthouse Mobile PWA + SEO audit — both `/` and `/app/` must score ≥ 90 (success criterion #5)
- Google Rich Results Test — re-run after split to confirm landing meta validates
- Facebook Sharing Debugger — force-refresh after deploy to update shared-card previews

### Files protected (NEVER modified or moved this phase)
- All SEG-05 v1 byte-identical floor paths (per `.planning/milestones/v1.0-ROADMAP.md` § Cross-Milestone Notes)
- All Phase 7–9 deliverables (SegmentEngine.ts, SegmentState.ts, triangle.ts, Composer.tsx, etc.) — Phase 11 only restructures HTML entries + SW scope, not React code

### Files created by this phase
- `app/index.html` (moved from root, app shell)
- `public/screenshot-composer-v1.png` (manual capture for D-LAND-13)
- Possibly `public/landing.css` or inline `<style>` block in `index.html` (planner decides — extract subset of `src/index.css` palette tokens for landing-only styling)

### Files modified by this phase
- `index.html` (rewritten as static landing — none of the previous React-shell content remains)
- `vite.config.ts` (multi-page input + manifest start_url + manifest scope + SW globPatterns)
- `src/sw.ts` (NavigationRoute fallback narrowed to /app/*)
- `public/sitemap.xml` (verify URLs still correct; lastmod date update)
- `docs/deploy-runbook.md` (append Phase 11 SW-rescoping verification)
- Possibly `src/main.tsx` (no change expected if `#root` selector still resolves; verify)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets (consumed via copy/extract — NOT React imports)
- `public/og-image-v1.png` (33 KB) — hero visual (D-LAND-10)
- `src/index.css` warm-earth palette CSS variables — landing reuses or inlines a subset
- `src/components/IosInstallBanner.tsx` — pattern source for iOS install panel (extract platform-detection logic into vanilla JS; do NOT import the React component into landing)
- Existing apple-* meta tags in current `index.html` — preserved on the new `app/index.html` (D-26 of Phase 10 carries through)
- Phase 10 meta tag block in current `index.html` — splits: landing keeps its own version (canonical `/Soundly/`, og:url `/Soundly/`), app shell keeps its own version (canonical `/Soundly/app/`, og:url `/Soundly/app/`)

### Established patterns
- Tailwind v4 via `@tailwindcss/vite` plugin — landing may use Tailwind utilities, OR can ship hand-rolled CSS for minimum footprint. Planner decides based on bundle-size impact.
- vite-plugin-pwa with injectManifest strategy — Phase 11 KEEPS this; the SW source (`src/sw.ts`) stays the build input.
- Versioned asset filenames (`og-image-v1.png`, `screenshot-composer-v1.png`) — consistent with D-10 / SEO-08; future revisions get -v2, -v3.
- `gsd-sdk query commit "msg" file file file` — used throughout prior phases for atomic commits.

### Integration points (where the diff lands)
- `vite.config.ts` — `build.rollupOptions.input` (multi-page), `VitePWA.manifest.start_url`, `VitePWA.manifest.scope`, `VitePWA.workbox.globPatterns` (narrow to app/**), `VitePWA.includeAssets` (landing assets)
- `src/sw.ts` — `NavigationRoute` matcher narrows to `({ request, url }) => request.mode === 'navigate' && url.pathname.startsWith('/Soundly/app/')` (or equivalent path-aware check)
- Root `index.html` — wholesale rewrite as static landing
- `app/index.html` — new file, hosts the React app shell (move current `<div id="root">` + script tag here)

### Pre-existing v1/v2 quirks NOT addressed in Phase 11
- `base: '/Soundly/'` in vite.config.ts unchanged — both entries respect this base.
- The 8 placeholder canonical URL occurrences (Phase 10 D-23) gain ~5 more on the landing + app shell split; deploy runbook URL-swap covers them all.
- Tests in `tests/static-assets.test.ts` (Phase 10) will need updating to handle the split — separate test cases for `dist/index.html` (landing) vs `dist/app/index.html` (app shell).
- `scripts/verify-phase-10-build.mjs` similarly needs updating for the split structure.

</code_context>

<specifics>
## Specific Ideas

### Hero block sketch (planner refines into final HTML)

```html
<!-- Above the fold -->
<header class="hero">
  <img src="og-image-v1.png" alt="Soundly — a calmer alarm" class="hero-visual" />
  <h1>A calmer alarm that alerts you gently</h1>
  <p class="value-prop">Wakes you with soft sounds first — vibration second, full volume only if needed. Calm first, reliable when it matters.</p>
  <div class="install-cta">
    <!-- Android: only if beforeinstallprompt fired -->
    <button id="install-btn" hidden>Install Soundly</button>
    <!-- iOS Safari: detected on load -->
    <details id="ios-install" hidden>
      <summary>Install on iPhone</summary>
      <ol>
        <li>Tap the Share button</li>
        <li>Choose "Add to Home Screen"</li>
        <li>Tap "Add"</li>
      </ol>
    </details>
    <!-- Universal: deep link into app -->
    <a href="/Soundly/app/" class="open-app-link">Open Soundly</a>
  </div>
</header>
```

### Below-fold structure

```html
<main>
  <section class="screenshot-section">
    <img src="screenshot-composer-v1.png" alt="Soundly Composer with Wake Easy preset" />
  </section>
  <section class="faq">
    <h2>Questions</h2>
    <h3>Will Soundly actually wake me up?</h3>
    <p>...</p>
    <!-- 5-7 more Q&A -->
  </section>
  <section class="ios-honesty">
    <h2>If you're on iPhone</h2>
    <p>We wish Soundly worked perfectly on iPhone's locked screen — but iOS blocks PWA audio in that state. We're being honest so you can decide if Soundly fits your iPhone use.</p>
    <p>Here's how to use Soundly reliably on iPhone: install to your home screen, plug in or keep the screen on while the alarm is armed, and use it as a nap timer or focus timer where you'll be near the phone.</p>
  </section>
  <footer>
    <a href="https://github.com/[user]/Soundly">GitHub</a> · Made by J. B. E. Haug · © 2026
  </footer>
</main>
```

### Vite multi-page input sketch

```ts
// vite.config.ts
build: {
  rollupOptions: {
    input: {
      main: resolve(__dirname, 'index.html'),
      app: resolve(__dirname, 'app/index.html'),
    },
  },
},
```

### SW NavigationRoute scope narrowing sketch

```ts
// src/sw.ts — narrow the navigation handler
const navHandler = createHandlerBoundToURL('/Soundly/app/index.html')
const navRoute = new NavigationRoute(navHandler, {
  // Only catch app-scope navigations; landing is served by network
  allowlist: [/^\/Soundly\/app\//],
})
```

</specifics>

<deferred>
## Deferred Ideas

- **Additional static pages** (`/privacy`, `/about`, `/changelog`) — single-landing for v2.0 keeps complexity minimal; future polish phase or v2.1 can add
- **Newsletter / waitlist / email signup** — explicitly NOT in scope per PROJECT.md "Out of Scope"
- **Analytics / telemetry** — explicitly NOT in scope per PROJECT.md
- **Localization / i18n** — out of scope for v2.0; English-only landing
- **Schema.org `Organization` / `WebSite` JSON-LD** — Phase 10 D-15 deferred; planner may add here if low-effort and improves SEO, otherwise defer further
- **Native iOS app to fix locked-screen audio** — PWA-only constraint is locked per PROJECT.md
- **Custom domain configuration / DNS** — user owns the deploy decision
- **Tour / onboarding flow on first app load** — current `/app/` is direct-into-Dashboard; tour can be a separate UX polish phase
- **Animated hero (CSS or JS animation)** — explicitly skipped for zen aesthetic; subtle hover states only
- **Sticky nav / scroll-to-section** — explicitly skipped; compact one-page layout doesn't need it
- **A/B testing infrastructure** — out of scope; single landing, no experimentation
- **Open-source contributor guide on landing** — repo README can host this; landing stays product-focused

</deferred>

---

*Phase: 11-multi-page-split-landing-page*
*Context gathered: 2026-05-21*
