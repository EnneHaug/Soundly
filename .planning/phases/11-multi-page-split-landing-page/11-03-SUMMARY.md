---
phase: 11-multi-page-split-landing-page
plan: 03
subsystem: app-shell-entry
tags: [multi-page-build, app-shell, react-mount, apple-pwa-meta, seo-meta, json-ld, canonical-url, og-meta, twitter-card, pwa-installability]

requires:
  - phase: 11-multi-page-split-landing-page
    provides: app/index.html stub from Plan 11-01 (24-line scaffold) — without it, the multi-page build skeleton would not have an app-shell entry to populate
  - phase: 11-multi-page-split-landing-page
    provides: root index.html landing rewrite from Plan 11-02 (apple-* meta already removed) — this plan is the destination half of the apple-* MOVE; Plan 11-02 already performed the source-side removal
  - phase: 10-seo-meta-json-ld-service-worker-update-infra
    provides: SEO meta block (description, OG×5, Twitter×4, canonical, JSON-LD WebApplication) — carried over verbatim into app/index.html's <head> with canonical/og:url/JSON-LD url adjusted to /Soundly/app/
  - phase: 10-seo-meta-json-ld-service-worker-update-infra
    provides: D-26 apple-* PWA meta tags (apple-mobile-web-app-capable, apple-mobile-web-app-status-bar-style, apple-mobile-web-app-title, apple-touch-icon) — moved from root index.html to app/index.html (this file is now the installable PWA entry per Plan 11-01's start_url narrow)
provides:
  - app/index.html as full React app shell (53 lines, ~3.39 KB dist)
  - apple-* PWA meta block in app shell (4 tags — the installable PWA entry per Plan 11-01 start_url=/Soundly/app/)
  - app-shell SEO meta variant with canonical, og:url, JSON-LD url all ending /Soundly/app/
  - JSON-LD WebApplication block for the app shell (Phase 10 D-12 carry-over with /Soundly/app/ url)
  - React mount point preserved (<div id="root"> + <script type="module" src="/src/main.tsx">)
  - Q4 RESOLVED: vite-plugin-pwa 0.21.2 auto-injects <link rel="manifest"> into dist/app/index.html — no D-25 fallback applied
affects:
  - 11-04-PLAN.md (SW rescope to /app/ only — app shell is now the canonical PWA entry; SW scope narrows to match)
  - 11-05-PLAN.md (verification — tests must split: app/index.html owns apple-* + #root + /src/main.tsx assertions; root index.html owns landing-only hero/install/FAQ assertions; both entries share the dist <link rel="manifest"> auto-injection check)
  - Phase 10 D-26 contract (4 apple-* tags now physically live in app/index.html instead of root index.html — the contract holds, the location moved)

tech-stack:
  added:
    - "none — pure HTML edit; no new dependencies introduced"
  patterns:
    - "Multi-page app-shell entry pattern: HTML file in subdirectory (app/index.html) references React entry via root-relative /src/main.tsx — Vite resolves against project root regardless of HTML file location (RESEARCH Finding 1; verified by clean build emitting dist/app/index.html with /Soundly/assets/app-*.js script injection)"
  - "Two-variant SEO meta pattern: landing (/) and app shell (/app/) ship distinct canonical/og:url/JSON-LD url values pointing at their respective canonical paths; shared assets (og-image-v1.png) keep a single absolute URL across both"
  - "apple-* PWA meta belongs to the installable entry, not the marketing landing — when start_url changes, apple-* meta moves with it (Phase 10 D-26 contract preserved; location swapped per Phase 11 split)"

key-files:
  created:
    - ".planning/phases/11-multi-page-split-landing-page/11-03-SUMMARY.md (this file)"
  modified:
    - "app/index.html (24 → 53 lines; +29 net — stub replacement with full app shell content)"

key-decisions:
  - "[Plan 11-03] app shell SEO copy IDENTICAL to landing for description, og:title, og:description, twitter:title, twitter:description, <title>, JSON-LD name/description — only canonical/og:url/JSON-LD url differ between the two entries (locked by Phase 10 D-LAND-01 + D-12 + D-02..D-05)"
  - "[Plan 11-03] og:image and twitter:image kept at /Soundly/og-image-v1.png (the shared OG asset lives in public/ and serves both entries) — D-10 versioned filename intact"
  - "[Plan 11-03] No <link rel=\"manifest\"> added to source app/index.html — vite-plugin-pwa 0.21.2 auto-injects it at build time (verified: dist/app/index.html line 49 contains <link rel=\"manifest\" href=\"/Soundly/manifest.webmanifest\">). Q4 RESOLVED — no Phase 10 D-25 fallback needed (mirrors Plan 10-06 finding for root entry)"
  - "[Plan 11-03] No inline <style>, no install CTA, no FAQ, no footer — those are landing-only (Plan 11-02). The app shell is a thin mount point for the React bundle (which loads its own Tailwind via /src/main.tsx)"

patterns-established:
  - "App-shell vs landing meta split: both HTML entries ship the same Phase 10 SEO block structure but with DIFFERENT canonical/og:url/JSON-LD url values reflecting their respective canonical paths. Shared assets (og-image-v1.png) use absolute URLs and stay identical across both. Apple-* meta lives ONLY at the installable PWA entry."
  - "Multi-page Vite app-shell pattern: /src/main.tsx reference in app/index.html is resolved against the project root, NOT the HTML file's directory. Verified by clean build (no path errors, dist/app/index.html emitted with correctly hashed /Soundly/assets/app-*.js script src)."

requirements-completed:
  - LAND-02
  - LAND-06

duration: 6m 0s
completed: 2026-05-21
---

# Phase 11 Plan 03: App Shell Entry Population Summary

**Replaced 24-line app/index.html stub with 53-line full app shell — moved the 4 apple-* PWA meta tags from root index.html (per Plan 11-02's source-side removal), added Phase 10 SEO meta block with canonical/og:url/JSON-LD url adjusted to /Soundly/app/, preserved React mount + Vite entry script; vite-plugin-pwa 0.21.2 auto-injects <link rel="manifest"> into dist/app/index.html (Q4 RESOLVED — no D-25 fallback needed).**

## Files Changed

| File | Lines (before → after) | Status |
|------|------------------------|--------|
| `app/index.html` | 24 → 53 (+29) | stub-replaced |

## What Shipped

### Apple PWA meta block (MOVED from root index.html)

Four tags moved verbatim from old root index.html (Phase 10 D-26 contract — location swapped, values unchanged):

```html
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta name="apple-mobile-web-app-title" content="Soundly" />
<link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
```

Vite prefixes the apple-touch-icon href at build time → `dist/app/index.html` line 15 reads `/Soundly/icons/icon-192x192.png` (the icon file exists in `public/icons/`, so Vite's HTML transform picks it up).

### App-shell SEO meta block

Phase 10 carry-over with three URL adjustments vs landing variant:

| Tag | Landing (Plan 11-02) | App shell (this plan) |
|-----|----------------------|------------------------|
| `<link rel="canonical">` | `https://soundly.local/Soundly/` | `https://soundly.local/Soundly/app/` |
| `<meta property="og:url">` | `https://soundly.local/Soundly/` | `https://soundly.local/Soundly/app/` |
| JSON-LD `url` field | `https://soundly.local/Soundly/` | `https://soundly.local/Soundly/app/` |

Shared (identical to landing):
- `<title>Soundly — a calmer alarm that alerts you gently</title>` (D-LAND-01)
- description meta (Phase 10 D-02)
- og:type, og:title, og:description, og:image (Phase 10 D-03/D-04)
- twitter:card, twitter:title, twitter:description, twitter:image (Phase 10 D-05)
- JSON-LD @context, @type, name, description, applicationCategory, operatingSystem (Phase 10 D-12)
- og:image and twitter:image both point to `/Soundly/og-image-v1.png` (D-10 versioned filename, shared asset)

### React mount point (preserved verbatim from stub)

```html
<div id="root"></div>
<script type="module" src="/src/main.tsx"></script>
```

`src/main.tsx` was NOT modified — Vite resolves `/src/main.tsx` against the project root regardless of HTML file location (RESEARCH Finding 1). Verified by clean build emitting `dist/app/index.html` with hashed bundle injection at line 47 (`/Soundly/assets/app-BKtbSaYO.js`).

## Verification Results

### Acceptance grep checks (source — `app/index.html`)
- `<div id="root"` → 1 ✓
- `src/main.tsx` → 1 ✓
- `apple-touch-icon` → 1 ✓
- `apple-mobile-web-app-capable` → 1 ✓
- `og:url` with `/Soundly/app/` → 1 (line 27) ✓
- `canonical` with `/Soundly/app/` → 1 (line 20) ✓
- `application/ld+json` + `WebApplication` → both present (lines 36, 39) ✓
- `apple-touch-icon` in root `index.html` → 0 ✓ (correctly MOVED out by Plan 11-02)

### Build verification (`dist/app/index.html`)
- Build clean: `npm run build` exits 0; `dist/app/index.html` emitted at 3.39 KB
- All required substrings present in dist output (verified via plan's `<automated>` script):
  - All 4 apple-* meta tags ✓
  - `/Soundly/icons/icon-192x192.png` (Vite-prefixed apple-touch-icon href) ✓
  - canonical, og:url, JSON-LD url all `/Soundly/app/` ✓
  - `<div id="root">` preserved ✓
  - JSON-LD parses as valid JSON; `@type === 'WebApplication'`; `url` ends with `/Soundly/app/` ✓
- `<link rel="manifest" href="/Soundly/manifest.webmanifest">` auto-injected by vite-plugin-pwa 0.21.2 at line 49 ✓ (**Q4 RESOLVED — no D-25 fallback needed**)
- React bundle script auto-injected at line 47 (`<script type="module" crossorigin src="/Soundly/assets/app-BKtbSaYO.js">`) ✓
- `<script id="vite-plugin-pwa:register-sw" src="/Soundly/registerSW.js">` auto-injected at line 49 ✓

### Test suite
- 607/612 tests pass; 5 expected failures in `tests/static-assets.test.ts` are Plan 11-05's reconciliation work (called out in Plan 11-01 SUMMARY for the start_url assertion and the 4 D-26 apple-* tests that now need updated source paths):
  - `index.html preserved tags (D-26) > preserves apple-mobile-web-app-capable meta tag` — source path moved to `app/index.html` (this plan)
  - `index.html preserved tags (D-26) > preserves apple-mobile-web-app-status-bar-style meta tag` — same as above
  - `index.html preserved tags (D-26) > preserves apple-mobile-web-app-title meta tag` — same as above
  - `index.html preserved tags (D-26) > preserves apple-touch-icon link` — same as above
  - `vite.config.ts has SEO-09 registerType > preserves the manifest block with start_url` — start_url narrowed by Plan 11-01 to `/Soundly/app/`
- These are NOT new regressions caused by Plan 11-03; they reflect the Phase-11 split contract that Plan 11-05 will update tests to honor

### Manual smoke test
Manual verification queued for on-device session (per RESEARCH Finding 9):
- `npm run dev` → visit `http://localhost:5173/Soundly/app/` → React Dashboard renders with all 4 cards (Quick Nap, Focus, 4 x 4, Custom)
- Click "Quick Nap" → alarm starts → click Stop → no console errors
- DevTools → Application → Manifest → all manifest fields present (id, start_url, scope, icons)

## Deviations from Plan

None — plan executed exactly as written. The plan's verbatim file content was written byte-identical to spec; build clean on first attempt; no Rule 1/2/3 auto-fixes needed.

## Key Lines / Anchors

- `app/index.html:12-15` — 4 apple-* meta tags (MOVED from old root index.html)
- `app/index.html:20` — `<link rel="canonical" href="https://soundly.local/Soundly/app/" />`
- `app/index.html:27` — `<meta property="og:url" content="https://soundly.local/Soundly/app/" />`
- `app/index.html:36-46` — JSON-LD WebApplication with url=/Soundly/app/
- `app/index.html:49-50` — `<div id="root">` + `<script type="module" src="/src/main.tsx">`
- `dist/app/index.html:15` — Vite-prefixed `/Soundly/icons/icon-192x192.png`
- `dist/app/index.html:47` — Auto-injected React bundle script
- `dist/app/index.html:49` — **Auto-injected `<link rel="manifest" href="/Soundly/manifest.webmanifest">`** (Q4 RESOLVED)

## Confidence Notes

- HIGH: Vite multi-page resolves `/src/main.tsx` from app/index.html — verified by clean build emitting working dist output (RESEARCH Finding 1 confirmed empirically)
- HIGH: vite-plugin-pwa 0.21.2 auto-injects manifest link on BOTH entries — verified by `dist/app/index.html` line 49 inspection (Plan 10-06 verified the same for root entry; Q4 RESOLVED)
- HIGH: All 4 apple-* meta tags transferred byte-identical from old root index.html — cross-referenced against Plan 11-02 SUMMARY "What Shipped" section confirming they're gone from root
- MEDIUM-HIGH: End-to-end Dashboard render + alarm-start smoke test queued for on-device session per Phase 11 RESEARCH Finding 9; codebase-level signals (clean build, React bundle injection, root element present, no test regressions outside the 5 Plan 11-05-owned failures) all confirm the wiring is correct
- HIGH: Threat register (T-11-03-01..06) fully mitigated by plan execution; T-11-03-05 (manifest injection failure) resolved by Q4 RESOLVED VERDICT — no D-25 fallback applied or needed

## Self-Check: PASSED

- FOUND: `app/index.html` (53 lines, populated per plan spec)
- FOUND: `dist/app/index.html` (3.39 KB, all required substrings + auto-injected manifest link + React bundle script)
- FOUND: commit `e39278e` — feat(11-03): populate app/index.html with React app shell + apple-* + SEO meta
