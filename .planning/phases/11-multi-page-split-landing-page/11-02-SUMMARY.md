---
phase: 11-multi-page-split-landing-page
plan: 02
subsystem: landing-page
tags: [static-html, landing-page, install-cta, beforeinstallprompt, ios-detection, details-summary, inline-css, no-react, seo-meta, json-ld]

requires:
  - phase: 11-multi-page-split-landing-page
    provides: vite.config.ts multi-page rollupOptions.input.{main,app} already shipped in Plan 11-01 — without it, the root index.html would not be a separate build entry from app/index.html
  - phase: 10-seo-meta-json-ld-service-worker-update-infra
    provides: SEO meta block (description, OG, Twitter Card, JSON-LD WebApplication) — carried over verbatim into landing's <head> with canonical/og:url at /Soundly/ (not /Soundly/app/)
provides:
  - root index.html as hand-authored static marketing landing (395 lines)
  - Hero with D-LAND-01 verbatim copy ("A calmer alarm that alerts you gently")
  - Install CTA cluster: beforeinstallprompt-driven Android button + iOS <details> panel + appinstalled redirect to /Soundly/app/ + 30s universal fallback microcopy
  - iPadOS 13+ correct detection via navigator.maxTouchPoints > 1 (RESEARCH Finding 6 — inline only; src/platform/standalone.ts intentionally NOT modified)
  - 6 plain-HTML FAQ Q&A pairs (no FAQPage JSON-LD per LAND-04 D-LAND-03)
  - iOS honesty section with verbatim D-LAND-04 two-paragraph copy
  - D-LAND-12 footer: GitHub · Made by J. B. E. Haug · © 2026
  - UI-SPEC prescriptive inline <style> block shipped verbatim (palette + dark mode + reset + hero + install CTA + details panel + sections + screenshot + FAQ + ios-honesty + footer + mobile breakpoint + reduced-motion gate)
  - aria-live="polite" install confirmation region (UI-SPEC A11y contract)
affects:
  - 11-03-PLAN.md (app shell move — landing now owns root index.html; app/index.html stub from Plan 11-01 ready to receive React app shell + apple-* meta + own SEO block with /Soundly/app/ URLs)
  - 11-05-PLAN.md (verification — tests must split landing vs. app-shell assertions; landing has NO apple-* meta, NO #root, NO /src/main.tsx; landing has 16+ KB dist size; landing has hero/install/FAQ substrings)

tech-stack:
  added:
    - "none — landing is hand-authored static HTML + inline CSS + inline vanilla JS; no new dependencies"
  patterns:
    - "Hand-authored static landing with inline <style> + inline IIFE <script> — no bundler entry, no React, no Tailwind import (UI-SPEC RESEARCH Finding 12)"
    - "iOS detection via navigator.userAgent /iphone|ipod/ OR (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) — RESEARCH Finding 6 iPadOS 13+ fix"
    - "beforeinstallprompt three-step canonical pattern (preventDefault → stash → reveal button → prompt on click) — RESEARCH Finding 5"
    - "<details>/<summary> native disclosure with custom-marker styling — RESEARCH Finding 8 (Baseline 2020, no ARIA needed) + Pitfall D (both -webkit-details-marker and ::marker prefixes)"
    - "Literal /Soundly/app/ prefix in href + JS string — Vite's HTML transform does NOT rewrite arbitrary navigation hrefs or string literals; only known asset attributes pointing at files that exist in public/ get the base prefix"

key-files:
  created:
    - ".planning/phases/11-multi-page-split-landing-page/11-02-SUMMARY.md (this file)"
  modified:
    - "index.html (46 → 395 lines; +349 net — wholesale replacement of React shell with static landing)"

key-decisions:
  - "[Rule 1 fix] /Soundly/app/ written LITERALLY in the Open Soundly <a href> — not as /app/ — because Vite did NOT rewrite the href to /Soundly/app/ during build (verified by inspecting dist/index.html line 267 after first build attempt: href remained /app/). RESEARCH Finding 11 stated that <a href='/app/'> becomes <a href='/Soundly/app/'> after build, but observed behavior shows Vite only rewrites paths that resolve to files in public/. Robust fix: use the literal /Soundly/app/ prefix, matching the same pattern already used in the inline JS window.location.href."
  - "[Rule 1 fix] /Soundly/screenshot-composer-v1.png written LITERALLY in the screenshot <img src> — because the screenshot file doesn't yet exist in public/ (D-LAND-13 deferred manual capture), so Vite skipped its path-rewriting pass on this attribute. Robust fix: literal prefix ensures runtime path is correct once the asset lands; image will show as broken until the capture ships."
  - "iPadOS 13+ detection inlined (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) — RESEARCH Finding 6 LOCKED. src/platform/standalone.ts NOT modified per CONTEXT scope (touching v1-shipped files crosses a boundary)."
  - "JSON-LD WebApplication block carried verbatim from current index.html with url unchanged at /Soundly/ — distinct from the app shell's JSON-LD which will use /Soundly/app/ in Plan 11-03."

patterns-established:
  - "Static landing path-resolution discipline: HTML attribute paths pointing at files THAT EXIST IN public/ may use root-relative paths and let Vite prefix them (e.g., /og-image-v1.png → /Soundly/og-image-v1.png). EVERY OTHER path (navigation hrefs, missing public/ assets, inline JS string literals) MUST use the literal /Soundly/... prefix. Documented in inline comments at both the <img src> and the JS window.location.href = '/Soundly/app/' line."
  - "Install CTA contract: button hidden by default, revealed by beforeinstallprompt OR iOS panel revealed by iOS detection OR fallback microcopy revealed after 30s — at most ONE install affordance visible at any time; .open-app-link always visible unless display-mode: standalone."

requirements-completed:
  - LAND-01
  - LAND-03
  - LAND-04
  - LAND-05

duration: 7m 0s
completed: 2026-05-21
---

# Phase 11 Plan 02: Landing Page Wholesale Rewrite Summary

**Root index.html replaced from 46-line React shell with 395-line hand-authored static marketing landing per UI-SPEC verbatim — hero + install CTA + screenshot section + 6-Q&A FAQ + iOS honesty + footer; inline CSS palette + dark-mode + reduced-motion; inline vanilla-JS install logic with iPadOS 13+ detection fix.**

## Files Changed

| File | Lines (before → after) | Status |
|------|------------------------|--------|
| `index.html` | 46 → 395 (+349) | wholesale-rewritten |

## What Shipped

### Above-the-fold (header.hero)
- Hero `<img src="/og-image-v1.png">` (Vite prefix-rewritten → `/Soundly/og-image-v1.png` in dist)
- `<h1>A calmer alarm that alerts you gently</h1>` — D-LAND-01 verbatim
- Hero value paragraph — D-LAND-02 wording per UI-SPEC line 207
- Install CTA cluster:
  - `<button id="install-btn" hidden>Install Soundly</button>` — revealed only after `beforeinstallprompt`
  - `<details id="ios-install-panel" hidden>` with `<summary>Install on iPhone</summary>` + 3-step `<ol>` (each step with one `<strong>` glyph reference per UI-SPEC line 210)
  - `<p id="install-confirm" hidden>Installed <span aria-hidden="true">✓</span> — launching app…</p>` — D-LAND-07 verbatim, U+2713 + U+2026
  - `<p id="install-fallback-microcopy" hidden>Works in any modern browser. Install for offline use.</p>` — Claude's Discretion 30s fallback per CONTEXT line 86
  - `<a href="/Soundly/app/" class="open-app-link">Open Soundly</a>` — always visible unless installed
- Wrapping `<div class="install-cta" aria-live="polite" aria-atomic="false">` — UI-SPEC A11y contract

### Below-the-fold (main)
- `<section class="screenshot">` with `<img src="/Soundly/screenshot-composer-v1.png" alt="...">` — image will be broken until D-LAND-13 manual capture ships
- `<section class="faq"><h2>Questions</h2>` + 6 `<h3>`/`<p>` Q&A pairs verbatim from UI-SPEC FAQ Draft Copy (lines 222–249)
- `<section class="ios-honesty"><h2>If you're on iPhone</h2>` + 2 paragraphs verbatim from D-LAND-04 / UI-SPEC lines 216–217

### Footer
- Single-line per D-LAND-12: `<a href="https://github.com/J-B-E-Haug/Soundly">GitHub</a> · Made by J. B. E. Haug · © 2026` (middle dot U+00B7)

### Inline CSS (head <style>)
The UI-SPEC §"CSS-Level Contract Reference" block (lines 482–690) ships VERBATIM:
- Warm-earth palette `:root` (synced from `src/index.css` `@theme`) + `@media (prefers-color-scheme: dark)` swap
- Reset + base (`*, *::before, *::after { box-sizing: border-box; }`, body system-ui stack, overflow-x: hidden)
- Hero / install CTA / `<details>` panel / sections / screenshot / FAQ / iOS-honesty / footer
- Mobile breakpoint `@media (max-width: 767px)`
- `@media (prefers-reduced-motion: reduce)` gate

### Inline JS (body trailing <script>)
IIFE encapsulating install logic:
1. **D-LAND-08:** `isInstalled()` checks `display-mode: standalone` + iOS WebKit `navigator.standalone`; removes entire `#install-cta` element on installed view
2. **D-LAND-06:** `isIos()` returns true for iPhone/iPod UA OR `MacIntel` + `maxTouchPoints > 1` (RESEARCH Finding 6 iPadOS 13+ fix); reveals `<details>` panel
3. **D-LAND-05:** `beforeinstallprompt` listener — `e.preventDefault()` BEFORE stashing event; button click triggers `prompt()` then awaits `userChoice`; button is single-use per page session
4. **D-LAND-07:** `appinstalled` listener — hides button, shows confirm text, redirects to literal `/Soundly/app/` after 1500ms
5. **Claude's Discretion 30s fallback:** if neither install button nor iOS panel visible after 30s, reveal `install-fallback-microcopy`

## Verbatim Copy Strings Shipped

| String | Source | Verified |
|--------|--------|----------|
| `A calmer alarm that alerts you gently` (h1) | D-LAND-01 | grep count 1 ✓ |
| iOS honesty para 1: `We wish Soundly worked perfectly...` | D-LAND-04 / UI-SPEC L216 | grep count 1 ✓ |
| iOS honesty para 2: `Here's how to use Soundly reliably on iPhone...` | D-LAND-04 / UI-SPEC L217 | grep count 1 ✓ |
| `Installed ✓ — launching app…` (U+2713 + U+2026) | D-LAND-07 | present ✓ |
| Footer: `GitHub · Made by J. B. E. Haug · © 2026` (U+00B7) | D-LAND-12 | grep "Made by" count 1 ✓ |
| 6 FAQ Q&A pairs | UI-SPEC L222-249 verbatim | h3 count = 6 ✓ |

## Verification Pass Summary

`npm run build` exit 0. `dist/index.html` size = 16.62 KB (well above 8 KB acceptance floor — proves the rewrite landed).

Required substrings present in `dist/index.html`:
- `A calmer alarm that alerts you gently` ✓
- `id="install-btn"` ✓
- `id="ios-install-panel"` ✓
- `id="install-confirm"` ✓
- `id="install-cta"` ✓
- `aria-live="polite"` ✓
- `navigator.maxTouchPoints` ✓
- `window.location.href` ✓
- `/Soundly/app/` ✓
- `/Soundly/og-image-v1.png` (Vite-prefixed from source `/og-image-v1.png`) ✓
- `/Soundly/screenshot-composer-v1.png` (literal in source — file missing from public/) ✓
- `soundly.local/Soundly/` (placeholder canonical, Phase 10 D-23) ✓
- `class="hero"`, `class="faq"`, `class="ios-honesty"` ✓
- `application/ld+json` ✓

Forbidden substrings absent in `dist/index.html`:
- `id="root"` ✓ absent
- `/src/main.tsx` ✓ absent
- `FAQPage` ✓ absent (no FAQPage JSON-LD per LAND-04)
- `@import "tailwindcss"` ✓ absent
- `apple-mobile-web-app-capable` ✓ absent (moves to app/index.html in Plan 11-03)
- `apple-touch-icon` ✓ absent (moves to app/index.html in Plan 11-03)

Source-level orchestrator acceptance greps:
- `<h3>` count = 6 (FAQ Q&A pairs) ✓
- `<script` count = 2 — one JSON-LD `<script type="application/ld+json">` SEO block + one IIFE install script; NO React bundle `<script type="module">` (`type="module" src="/src/main.tsx"` count = 0) ✓
- `<details` count = 2 (in the inline CSS comment + in the body markup) ✓ (acceptance gate "1+")

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] /Soundly/app/ deep link href did not survive Vite build with /app/ source**
- **Found during:** Task 1 verify pass after initial build
- **Issue:** First build emitted `<a href="/app/">` in `dist/index.html` (line 267) — Vite did NOT rewrite the navigation href to `/Soundly/app/` despite RESEARCH Finding 11 claiming it would. On deployed GitHub Pages at `username.github.io/Soundly/`, clicking Open Soundly would navigate to `/app/` (404) instead of `/Soundly/app/`.
- **Fix:** Changed source `<a href="/app/">` → `<a href="/Soundly/app/">`. Same literal-prefix discipline already documented for the JS `window.location.href` line.
- **Files modified:** `index.html` (one line)
- **Commit:** `48cb255` (shipped within the wholesale-rewrite commit)

**2. [Rule 1 - Bug] /Soundly/screenshot-composer-v1.png path not rewritten by Vite**
- **Found during:** Task 1 verify pass after initial build
- **Issue:** Source `<img src="/screenshot-composer-v1.png">` was emitted by Vite as `/screenshot-composer-v1.png` (no prefix) in `dist/index.html`. The plan's verify step required `/Soundly/screenshot-composer-v1.png` to be present. Root cause: the screenshot file doesn't yet exist in `public/` (D-LAND-13 manual capture is deferred), so Vite skipped its path-rewriting pass.
- **Fix:** Changed source `<img src="/screenshot-composer-v1.png">` → `<img src="/Soundly/screenshot-composer-v1.png">`. Literal prefix is robust whether or not the file exists at build time. The image will display as broken until D-LAND-13 ships, but the rendered URL is correct.
- **Files modified:** `index.html` (one line)
- **Commit:** `48cb255` (shipped within the wholesale-rewrite commit)

### Pattern Note (added to patterns-established)

Both fixes converge on a single principle: **literal `/Soundly/...` prefixes for navigation hrefs and for any path Vite won't rewrite.** Asset paths pointing at files that exist in `public/` may use root-relative source paths and rely on Vite's prefix rewrite (e.g., `<img src="/og-image-v1.png">`). Everything else — navigation hrefs, missing-asset paths, inline JS strings — must use the literal prefix.

## Authentication Gates

None.

## Deferred Issues

`public/screenshot-composer-v1.png` does NOT yet exist (D-LAND-13 manual capture is intentionally out of scope per CONTEXT — Composer screenshot capture is a separate D-LAND-13 task). The landing's `<img src="/Soundly/screenshot-composer-v1.png">` will render a broken image until the asset ships. The HTML path is already correct, so once the file is dropped into `public/`, the image will render without any further code change.

## Threat Model Verification

All 7 STRIDE threats from the plan's `<threat_model>` are addressed:
- T-11-02-01..04, 06: `accept` dispositions — no implementation surface (no untrusted input flows, no analytics, no dynamic href generation, browser fires `beforeinstallprompt` from chrome-internal source)
- T-11-02-05 (DoS via inline JS): `mitigate` — IIFE registers each event listener exactly once; two `setTimeout`s (1500ms post-install redirect + 30s fallback) are fire-once; no recursion, no leaks
- T-11-02-07 (Tampering via SW poisoning): `mitigate` — landing assets explicitly excluded from SW precache via Plan 11-01's `globIgnores`; landing served from network per LAND-02 / D-LAND-15

No new threat surface introduced (no network endpoints, no auth paths, no schema changes).

## Self-Check: PASSED

**Files claimed created/modified:**
- `index.html`: MODIFIED ✓ (verified via `git status --short` showed ` M index.html` before commit; verified at 395 lines via `wc -l`)
- `.planning/phases/11-multi-page-split-landing-page/11-02-SUMMARY.md`: CREATED ✓ (this file)

**Commits claimed:**
- `48cb255` (`feat(11-02): rewrite root index.html as static landing per UI-SPEC`): FOUND ✓ (verified via `git rev-parse --short HEAD`)
