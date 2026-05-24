---
phase: 11-multi-page-split-landing-page
verified: 2026-05-24T11:30:00Z
status: human_needed
score: 33/33 codebase must-haves verified
overrides_applied: 0
re_verification:
  previous_status: null
  previous_score: null
  gaps_closed: []
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Lighthouse PWA + SEO ≥ 90 on mobile for / (landing)"
    expected: "Both PWA and SEO category scores at or above 90 in Lighthouse Mobile audit run against the deployed landing URL"
    why_human: "Lighthouse requires a deployed URL + real browser audit; cannot be run from this repo (SC #5 — inherently post-deploy)"
  - test: "Lighthouse PWA + SEO ≥ 90 on mobile for /app/ (app shell)"
    expected: "Both PWA and SEO category scores at or above 90 in Lighthouse Mobile audit run against the deployed app shell URL"
    why_human: "Lighthouse requires a deployed URL + real browser audit; cannot be run from this repo (SC #5 — inherently post-deploy)"
  - test: "v1.0/v2.0 PWA install identity preserved across deploy (D-LAND-16)"
    expected: "Phone with pre-Phase-11 PWA installed, after deploy: (a) does NOT re-prompt to install, (b) second launch opens /Soundly/app/ via the new start_url, (c) home-screen icon's destination updates"
    why_human: "Requires installed PWA on a real device + full deploy cycle; manifest.id ratchet behavior is browser-internal; runbook §10 step 1-2"
  - test: "SW rescoping propagates to installed users (D-LAND-16)"
    expected: "On previously-installed PWA, after one app-launch cycle (force-close + reopen), the SW serves /Soundly/app/index.html and landing /Soundly/ fetches fresh from network"
    why_human: "Requires real installed PWA + cross-deploy SW lifecycle; tested at runbook §10 step 1-4"
  - test: "Offline alarm still works after SW rescope"
    expected: "On installed PWA with airplane mode enabled, the alarm app continues to load and Quick Nap fires correctly"
    why_human: "Requires installed PWA + airplane mode + alarm execution; runbook §10 step 3"
  - test: "Landing served from network (not SW cache)"
    expected: "Visiting /Soundly/ in a regular browser (NOT installed PWA), DevTools → Network shows 200 without SW indicator on the landing HTML response"
    why_human: "Requires deployed URL + browser DevTools Network panel inspection; runbook §10 step 4"
  - test: "Installed users see no install CTA on landing (D-LAND-08)"
    expected: "From within the installed PWA (display-mode: standalone), navigating to /Soundly/ shows landing content with no install button, no iOS panel, and no Open Soundly anchor"
    why_human: "Requires real installed PWA + navigation to landing URL; cannot be reliably simulated in dev SW; runbook §10 step 5"
  - test: "Android Chrome beforeinstallprompt button reveals after engagement"
    expected: "On Android Chrome, after browser engagement heuristics fire (~30s page time), the Install Soundly button becomes visible on /Soundly/; tapping it opens the native install prompt; accepting installs the PWA with start_url /Soundly/app/"
    why_human: "beforeinstallprompt is browser-internal and gated on Chrome engagement heuristics; cannot be deterministically triggered in test environments"
  - test: "iOS Safari install panel reveals on iPhone/iPad"
    expected: "On iOS Safari (iPhone or iPadOS 13+), the click-to-expand iOS install <details> panel is visible on /Soundly/; the Add-to-Home-Screen flow works; the installed icon opens /Soundly/app/ directly"
    why_human: "Requires real iOS Safari device + Share-menu interaction; cannot be simulated in jsdom or desktop browsers"
  - test: "Post-install confirmation + 1.5s redirect (D-LAND-07)"
    expected: "After native Chrome install accept, the page shows 'Installed ✓ — launching app…' inline confirmation, then navigates to /Soundly/app/ approximately 1500ms later"
    why_human: "appinstalled event only fires after a real native install completion; cannot be simulated programmatically"
  - test: "Dark mode palette swap on landing (prefers-color-scheme)"
    expected: "Toggling OS to dark mode swaps the landing palette to deep-forest + warm-sand variant (sage lifted for AA contrast, accent shifted)"
    why_human: "prefers-color-scheme media query requires OS-level theme change to verify visually; runbook smoke test"
  - test: "Mobile breakpoint visual rendering at ≤767px"
    expected: "At viewport widths ≤767px, hero/main/section/footer padding narrows per the @media (max-width: 767px) block; content remains readable and well-spaced"
    why_human: "Visual rendering quality requires human inspection at multiple viewport sizes"
---

# Phase 11: Multi-page Split + Landing Page Verification Report

**Phase Goal:** Build splits into two HTML entries — hand-authored static landing at `/` and React app shell at `/app/` — no router runtime; SW rescoped to `/app/` only; landing has install CTA (Android beforeinstallprompt + iOS Share→AddToHome), plain-HTML FAQ, iOS honesty section, deep link into `/app/`.

**Verified:** 2026-05-24T11:30:00Z
**Status:** human_needed (33/33 codebase truths verified; 12 human-verification items queued for on-device / post-deploy)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                                                  | Status     | Evidence                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | npm run build emits BOTH dist/index.html and dist/app/index.html                                                                                       | ✓ VERIFIED | `npm run build` exits 0; both files exist in dist/; verifier confirms "all 6 dist/ static assets present"                                                  |
| 2   | PWA manifest declares id: '/Soundly/' (D-LAND-17 install-identity ratchet)                                                                             | ✓ VERIFIED | vite.config.ts:24 `id: '/Soundly/'` with one-way-ratchet comment block                                                                                    |
| 3   | PWA manifest start_url is '/Soundly/app/' (LAND-02)                                                                                                    | ✓ VERIFIED | vite.config.ts:31 `start_url: '/Soundly/app/'`                                                                                                             |
| 4   | PWA manifest scope is '/Soundly/app/' (LAND-06)                                                                                                        | ✓ VERIFIED | vite.config.ts:32 `scope: '/Soundly/app/'`                                                                                                                 |
| 5   | injectManifest.globPatterns narrows to app/** + globIgnores blocks landing assets (Pitfall B)                                                          | ✓ VERIFIED | vite.config.ts:46 globPatterns `['app/**/*.{js,css,html,svg,png,webp,woff2}']` + globIgnores for index.html/screenshot-/og-image-/sitemap/robots          |
| 6   | base: '/Soundly/' preserved unchanged                                                                                                                  | ✓ VERIFIED | vite.config.ts:11 unchanged                                                                                                                                |
| 7   | rollupOptions.input has both main + app entries (LAND-06)                                                                                              | ✓ VERIFIED | vite.config.ts:67-71 `main: resolve(__dirname, 'index.html'), app: resolve(__dirname, 'app/index.html')`                                                  |
| 8   | Landing hero has verbatim D-LAND-01 copy 'A calmer alarm that alerts you gently'                                                                       | ✓ VERIFIED | index.html:253 `<h1>A calmer alarm that alerts you gently</h1>`                                                                                            |
| 9   | Landing install button hidden by default, revealed only after beforeinstallprompt (D-LAND-05)                                                          | ✓ VERIFIED | index.html:256 `<button id="install-btn" hidden>`; inline JS lines 348-352 add event listener that calls preventDefault then sets `installBtn.hidden = false` |
| 10  | iOS Safari users see click-to-expand <details> panel with Share→Add to Home Screen steps (D-LAND-06)                                                   | ✓ VERIFIED | index.html:257-264 `<details id="ios-install-panel" hidden>` with summary + 3 ordered steps; isIos() reveals it at line 341-343                           |
| 11  | Already-installed (display-mode: standalone) users see no install CTA at all (D-LAND-08)                                                               | ✓ VERIFIED | index.html:312-321 inline JS checks display-mode + navigator.standalone, removes #install-cta entirely if installed                                        |
| 12  | Post-install (appinstalled event) shows 'Installed ✓ — launching app…' inline confirmation, then redirects to /Soundly/app/ after 1.5s (D-LAND-07)     | ✓ VERIFIED | index.html:265 confirm element with U+2713 inside aria-hidden span; index.html:369-379 appinstalled handler sets hidden=false then setTimeout 1500ms      |
| 13  | iOS detection includes navigator.maxTouchPoints > 1 check for iPadOS 13+ (Finding 6)                                                                   | ✓ VERIFIED | index.html:331 `if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true`                                                       |
| 14  | FAQ uses 6 plain <h3>+<p> Q&A pairs; no FAQPage JSON-LD (D-LAND-03 / D-LAND-04)                                                                        | ✓ VERIFIED | index.html:278-294 contains exactly 6 `<h3>` + `<p>` pairs; no `"@type":"FAQPage"` substring anywhere                                                      |
| 15  | iOS honesty section has verbatim D-LAND-04 two-paragraph copy                                                                                          | ✓ VERIFIED | index.html:297-301 `<section class="ios-honesty">` with 2 paragraphs starting "We wish Soundly worked perfectly..." and "Here's how to use Soundly..."   |
| 16  | Footer is single line: 'GitHub · Made by J. B. E. Haug · © 2026' (D-LAND-12)                                                                          | ✓ VERIFIED | index.html:304-306 `<a href="https://github.com/J-B-E-Haug/Soundly">GitHub</a> · Made by J. B. E. Haug · © 2026`                                          |
| 17  | Landing has its own SEO meta block with canonical/og:url at /Soundly/                                                                                  | ✓ VERIFIED | index.html:11 `<link rel="canonical" href="https://soundly.local/Soundly/" />`; index.html:18 og:url same; JSON-LD url same                                |
| 18  | Landing has NO React runtime — no `<div id="root">`, no `<script src="/src/main.tsx">`                                                                 | ✓ VERIFIED | grep on index.html returns no `id="root"` and no `/src/main.tsx`; landing test `LAND-01 — does NOT load Tailwind app bundle` passes                       |
| 19  | Landing has lang="en" attribute (Lighthouse SEO + WCAG 3.1.1)                                                                                          | ✓ VERIFIED | index.html:2 `<html lang="en">`                                                                                                                            |
| 20  | install-cta container has aria-live="polite" aria-atomic="false"                                                                                       | ✓ VERIFIED | index.html:255 `<div class="install-cta" id="install-cta" aria-live="polite" aria-atomic="false">`                                                         |
| 21  | Visiting /Soundly/app/ loads the existing React app shell                                                                                              | ✓ VERIFIED | app/index.html:49 `<div id="root"></div>`; app/index.html:50 `<script type="module" src="/src/main.tsx"></script>`                                       |
| 22  | app/index.html has its own SEO meta block with canonical/og:url at /Soundly/app/                                                                       | ✓ VERIFIED | app/index.html:20 canonical /Soundly/app/; line 27 og:url /Soundly/app/; lines 36-46 JSON-LD url /Soundly/app/                                            |
| 23  | app/index.html has the apple-* PWA meta block MOVED from root index.html (Finding 9)                                                                   | ✓ VERIFIED | app/index.html:12-15 all 4 apple-* tags (capable, status-bar-style, title, touch-icon); landing tests assert these are absent from root index.html        |
| 24  | createHandlerBoundToURL target is /Soundly/app/index.html                                                                                              | ✓ VERIFIED | src/sw.ts:20 `createHandlerBoundToURL('/Soundly/app/index.html')`                                                                                          |
| 25  | NavigationRoute constructed with { allowlist: [/^\/Soundly\/app\//] } — landing bypasses SW (LAND-02 + D-LAND-15)                                      | ✓ VERIFIED | src/sw.ts:22-24 anchored regex `/^\/Soundly\/app\//` inside allowlist array                                                                                |
| 26  | notificationclick openWindow target is /Soundly/app/                                                                                                   | ✓ VERIFIED | src/sw.ts:44 `return self.clients.openWindow('/Soundly/app/');`                                                                                            |
| 27  | All other SW handlers + module-scope calls preserved (cleanupOutdatedCaches, precacheAndRoute, skipWaiting, clientsClaim, notificationclick body)      | ✓ VERIFIED | src/sw.ts:10, 13, 32, 63, 64 all present; D-17 / Phase 10 SEO-09 preservation contract honored                                                            |
| 28  | dist/sw.js contains 'allowlist' (Pitfall A coupling gate — SW rescope shipped)                                                                         | ✓ VERIFIED | Build verifier OK line: "dist/sw.js contains allowlist (SW rescope confirmed — Pitfall A gate passed)"                                                    |
| 29  | public/screenshot-composer-v1.png exists at ≤200 KB with valid PNG header                                                                              | ✓ VERIFIED | File present at 44012 bytes (< 204800); PNG header byte test passes in tests/static-assets.test.ts D-LAND-13 describe block                               |
| 30  | tests/static-assets.test.ts has Phase 11 split-aware assertions (5 edit classes)                                                                       | ✓ VERIFIED | All 5 edit classes present; 66 tests in suite pass; full vitest run = 641 tests passing (43 files)                                                        |
| 31  | scripts/verify-phase-10-build.mjs asserts dist/app/index.html + dist/sw.js allowlist + screenshot size + manifest link injection                       | ✓ VERIFIED | Verifier prints 11 OK lines including "Phase 10 + Phase 11 final build verification: ALL OK"                                                              |
| 32  | docs/deploy-runbook.md has §1 placeholder swap table updated to 4 files / 13 occurrences, §3.1 dual-entry build verification, §10 SW-rescoping addendum | ✓ VERIFIED | docs/deploy-runbook.md:19 "Four files, thirteen occurrences (post-Phase-11 split)"; §3.1 dual-entry block present; §10 with D-LAND-16 procedure present  |
| 33  | public/sitemap.xml lastmod bumped to 2026-05-24                                                                                                        | ✓ VERIFIED | public/sitemap.xml:5, 11 both contain `<lastmod>2026-05-24</lastmod>`                                                                                      |

**Score:** 33/33 codebase truths verified

### Required Artifacts

| Artifact                                  | Expected                                                                          | Status      | Details                                                                                                                                       |
| ----------------------------------------- | --------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `vite.config.ts`                          | Multi-page rollupOptions + manifest id/scope/start_url + injectManifest globs     | ✓ VERIFIED  | 74 lines; all required keys present at expected positions                                                                                     |
| `index.html` (landing)                    | Wholesale-rewritten static landing ≥200 lines with full hero/CTA/FAQ/iOS/footer   | ✓ VERIFIED  | 395 lines; all D-LAND-* verbatim copy present; no React runtime; no FAQPage JSON-LD                                                           |
| `app/index.html` (app shell)              | Full app shell with apple-* meta moved from root + /Soundly/app/ SEO + React mount | ✓ VERIFIED  | 52 lines; apple-* tags present; canonical/og:url/JSON-LD url all end /Soundly/app/; #root + main.tsx script preserved                         |
| `src/sw.ts`                               | Rescoped SW with allowlist regex + /Soundly/app/index.html handler + openWindow   | ✓ VERIFIED  | 65 lines; 3 surgical edits applied; D-17 preservation contract honored                                                                        |
| `tests/static-assets.test.ts`             | Split-aware Phase 11 test additions (~20 new it() blocks)                          | ✓ VERIFIED  | 410 lines; 66 tests pass; all 5 edit classes (SW, vite.config, placeholder consistency, app shell, landing structural+screenshot) present     |
| `scripts/verify-phase-10-build.mjs`       | dist/app/index.html SEO + JSON-LD + manifest-link + screenshot size + sw.js allowlist | ✓ VERIFIED  | 166 lines; 11 OK lines printed; final "ALL OK" message                                                                                        |
| `docs/deploy-runbook.md`                  | §1 table updated, §3.1 inserted, §10 appended                                      | ✓ VERIFIED  | 356 lines; all 3 sections present; "Four files, thirteen occurrences" lead line confirmed; old "Three files, eight" absent                    |
| `public/sitemap.xml`                      | lastmod dates bumped to current ship date                                          | ✓ VERIFIED  | 16 lines; both `<lastmod>2026-05-24</lastmod>` present; both `<loc>` URLs preserved                                                            |
| `public/screenshot-composer-v1.png`       | 1200x800 PNG, ≤200 KB, valid PNG header                                            | ✓ VERIFIED  | 44012 bytes (≤204800); PNG magic bytes 0x89 0x50 0x4E 0x47 confirmed via verifier                                                              |

### Key Link Verification

| From                                  | To                                       | Via                                              | Status     | Details                                                                                                |
| ------------------------------------- | ---------------------------------------- | ------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------ |
| vite.config.ts                        | app/index.html                           | build.rollupOptions.input.app                    | ✓ WIRED    | `app: resolve(__dirname, 'app/index.html')` — Vite emits dist/app/index.html confirmed                |
| vite.config.ts manifest.id            | install identity continuity              | id: '/Soundly/'                                  | ✓ WIRED    | One-way-ratchet comment present; matches v1.0/v2.0 implicit start_url identity                        |
| index.html inline JS                  | /Soundly/app/ deep link                  | window.location.href = '/Soundly/app/'           | ✓ WIRED    | Line 377; literal preserved (Pitfall C — JS strings not Vite-rewritten)                               |
| index.html inline JS                  | iPadOS 13+ detection                     | navigator.maxTouchPoints > 1                     | ✓ WIRED    | Line 331; combined with MacIntel platform check                                                       |
| index.html <details>                  | iOS Safari users                         | isIos() reveal at line 341-343                   | ✓ WIRED    | id="ios-install-panel" hidden, revealed on iOS detection                                              |
| app/index.html                        | src/main.tsx                             | `<script type="module" src="/src/main.tsx">`     | ✓ WIRED    | Line 50; Vite resolves /src/main.tsx against project root regardless of HTML location                 |
| app/index.html canonical              | deploy-time /Soundly/app/                | placeholder https://soundly.local/Soundly/app/   | ✓ WIRED    | Line 20; runbook §1 swap procedure covers it                                                          |
| src/sw.ts NavigationRoute             | browser navigation to /Soundly/app/*     | allowlist: [/^\/Soundly\/app\//]                 | ✓ WIRED    | Line 23; anchored regex; ships into dist/sw.js (verified by verifier)                                |
| src/sw.ts notificationclick           | /Soundly/app/ window target              | self.clients.openWindow('/Soundly/app/')         | ✓ WIRED    | Line 44                                                                                                |
| tests/static-assets.test.ts           | app/index.html, src/sw.ts, vite.config.ts | split-aware regex assertions                     | ✓ WIRED    | All 5 edit classes load files via read() helper and assert split-aware patterns                       |
| scripts/verify-phase-10-build.mjs     | dist/app/index.html + dist/sw.js coupling | requiredAssets array + sw.js allowlist regex     | ✓ WIRED    | Pitfall A gate: verifier exits non-zero if EITHER half missing — coupling enforced at build time      |
| docs/deploy-runbook.md §10            | D-LAND-16 manual phone test              | appendix with force-close, offline, landing checks | ✓ WIRED    | All 5 manual smoke-test steps present; manifest.id troubleshooting branch documented                  |

### Data-Flow Trace (Level 4)

| Artifact                | Data Variable                          | Source                                              | Produces Real Data | Status      |
| ----------------------- | -------------------------------------- | --------------------------------------------------- | ------------------ | ----------- |
| index.html (landing)    | beforeinstallprompt deferred event     | window event listener (browser-internal source)     | Yes (when fires)   | ✓ FLOWING   |
| index.html (landing)    | install button visibility              | beforeinstallprompt handler sets `hidden = false`    | Yes                | ✓ FLOWING   |
| index.html (landing)    | iOS panel visibility                   | isIos() return value drives `iosPanel.hidden = false` | Yes (on iOS only)  | ✓ FLOWING   |
| index.html (landing)    | install-confirm visibility             | appinstalled handler sets `hidden = false`            | Yes                | ✓ FLOWING   |
| app/index.html          | React app render at #root              | src/main.tsx createRoot().render() on #root         | Yes                | ✓ FLOWING   |
| src/sw.ts               | precache manifest entries              | precacheAndRoute(self.__WB_MANIFEST) — workbox injected at build | Yes (5 entries / 3.31 KiB per build log) | ✓ FLOWING   |
| src/sw.ts               | NavigationRoute matching               | allowlist regex evaluated against request.url       | Yes (browser-runtime) | ✓ FLOWING   |

### Behavioral Spot-Checks

| Behavior                                                                | Command                                            | Result                                                                                  | Status |
| ----------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------- | ------ |
| Multi-page build emits both entries                                     | `npm run build`                                     | exits 0; dist/index.html + dist/app/index.html both present; 70 modules transformed     | ✓ PASS |
| Build verifier exits 0 with full Phase 10 + Phase 11 coupling enforced  | `node scripts/verify-phase-10-build.mjs`           | 11 OK lines; "Phase 10 + Phase 11 final build verification: ALL OK"                     | ✓ PASS |
| Full test suite passes (Phase 10 baseline + Phase 11 additions)         | `npx vitest run`                                    | 641 tests passed (43 files); 0 failures                                                  | ✓ PASS |
| TypeScript clean (SW edits + test additions don't introduce type errors) | `npx tsc --noEmit`                                  | exits 0; no output                                                                       | ✓ PASS |
| dist/sw.js contains the allowlist regex (rescope ships into bundle)     | grep `allowlist:\[/\^\\\/Soundly\\\/app\\\/\/\]` dist/sw.js | line 2 matches (minified)                                                          | ✓ PASS |
| <link rel="manifest"> auto-injected on BOTH dist HTMLs (Q3 + Q4)        | grep `rel="manifest"` dist/index.html dist/app/index.html | both contain `<link rel="manifest" href="/Soundly/manifest.webmanifest">`           | ✓ PASS |
| Placeholder occurrence counts match runbook §1 table                    | grep -c "soundly.local" index.html app/index.html public/robots.txt public/sitemap.xml | 5 + 5 + 1 + 2 = 13 (matches "Four files, thirteen occurrences") | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan(s)              | Description                                                                                                  | Status      | Evidence                                                                                                                                       |
| ----------- | --------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| LAND-01     | 11-02                       | Marketing landing page at `/` — hero, value, screenshot, install CTA, FAQ, footer. Hand-authored static HTML; no React. | ✓ SATISFIED | index.html (395 lines) is static HTML with hero/CTA/screenshot section/FAQ/iOS-honesty/footer; no React runtime; tests `LAND-01` pass         |
| LAND-02     | 11-01, 11-03, 11-04, 11-05  | Two-tier routing — landing at `/`, alarm app at `/app`. PWA start_url updates from `/` to `/app`.            | ✓ SATISFIED | vite.config.ts start_url `/Soundly/app/` + scope `/Soundly/app/`; src/sw.ts NavigationRoute allowlist `/^\/Soundly\/app\//`; manifest id ratchet preserves install identity |
| LAND-03     | 11-02                       | Install CTA — Android beforeinstallprompt button; iOS manual Share→AddToHome instructions; no autoprompt on iOS. | ✓ SATISFIED | index.html install-btn driven by beforeinstallprompt; ios-install-panel with Share→AddToHome <details>; both hidden by default; D-LAND-08 strips for installed users |
| LAND-04     | 11-02                       | FAQ on landing — plain HTML `<h3>` + paragraph Q&A. No `FAQPage` JSON-LD.                                     | ✓ SATISFIED | index.html lines 278-294 contain 6 `<h3>` + `<p>` pairs inside `<section class="faq">`; no `"@type":"FAQPage"` substring anywhere in repo     |
| LAND-05     | 11-02                       | iOS honesty section — explicit locked-screen limitation statement + home-screen install + foregrounded use recommendation. | ✓ SATISFIED | index.html lines 297-301 `<section class="ios-honesty">` with D-LAND-04 verbatim two paragraphs                                              |
| LAND-06     | 11-01, 11-03, 11-05         | Vite multi-page configuration — two HTML entries; no router runtime; SW scope rescoped to `/app`.            | ✓ SATISFIED | vite.config.ts rollupOptions.input has both `main` + `app` entries; injectManifest.globPatterns scoped to `app/**`; sw.js NavigationRoute allowlist narrowed |

All 6 LAND-* requirements satisfied at the codebase tier. No orphaned requirements.

### Anti-Patterns Found

| File                                  | Line | Pattern                                       | Severity | Impact                                                                                                       |
| ------------------------------------- | ---- | --------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| index.html                            | 361  | `installBtn.hidden = true` after dismissal    | ⚠️ Warning | WR-03 from code review — user who clicks Install then dismisses prompt loses the button for the rest of session. Functional, but UX rough edge. Outside Phase 11 minimum scope; not a goal blocker. |
| src/sw.ts                             | 40   | client.url.startsWith(self.location.origin)   | ⚠️ Warning | WR-01 from code review — notificationclick may focus the landing tab if user has both tabs open after notification fires; iteration order undefined. Outside Phase 11 minimum scope. |
| src/sw.ts                             | 23   | `/^\/Soundly\/app\//` (requires trailing slash) | ⚠️ Warning | WR-02 from code review — `/Soundly/app` bare path (no trailing slash) is NOT intercepted by SW offline. GitHub Pages 301-redirects online so users are fine; offline gap is rare. Outside Phase 11 minimum scope. |

All 3 warnings from 11-REVIEW.md are documented and accepted as future maintenance items. **No Blocker (🛑) anti-patterns found.** Six Info (ℹ️) items from 11-REVIEW.md (IN-01 through IN-06) are maintenance / test-coverage gaps that don't affect goal achievement.

### Human Verification Required

12 items routed to human verification — see frontmatter `human_verification:` array. Notable categories:

1. **Lighthouse PWA + SEO ≥ 90 on mobile** (2 items, SC #5) — requires deployed URL + real browser audit
2. **D-LAND-16 on-device SW-rescoping migration test** (5 items) — requires installed PWA on a real device + full deploy cycle; documented in deploy-runbook.md §10
3. **Browser-internal install flows** (3 items) — Android beforeinstallprompt + iOS Share→AddToHome + appinstalled cannot be programmatically triggered
4. **Visual/UX verification** (2 items) — dark mode palette swap + mobile breakpoint rendering

### Gaps Summary

**No gaps found at the codebase tier.** All 33 must-have truths are verified by source inspection, build output, automated tests, and the Phase 10 + Phase 11 coupling-enforcement verifier (`scripts/verify-phase-10-build.mjs` exits 0 with 11 OK lines).

All 5 ROADMAP Success Criteria are addressed:
- SC #1 (multi-page emit + manifest start_url narrows): ✓ VERIFIED at codebase tier
- SC #2 (SW rescoped + landing from network + installed users in /app/ + offline alarm): ✓ codebase verified; on-device propagation verification routed to human (D-LAND-16)
- SC #3 (install CTA: Android button + iOS instructions + installed users see no UI): ✓ codebase verified; live browser flows routed to human
- SC #4 (FAQ plain HTML, iOS honesty verbatim D-LAND-04): ✓ VERIFIED
- SC #5 (Lighthouse PWA + SEO ≥ 90 on mobile for / and /app/): inherently post-deploy — routed to human verification

Phase 11 is **codebase-complete and ready for deploy**. The Pitfall A coupling gate (`dist/app/index.html` + `dist/sw.js` `allowlist`) is enforced by the build verifier and will block any partial deploy that ships only one half. The 12 human-verification items are post-deploy / on-device gates explicitly anticipated by the planning docs (D-LAND-16, SC #5 inherently external).

---

_Verified: 2026-05-24T11:30:00Z_
_Verifier: Claude (gsd-verifier)_
