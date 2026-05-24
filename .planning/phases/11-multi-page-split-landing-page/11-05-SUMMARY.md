---
phase: 11-multi-page-split-landing-page
plan: 05
subsystem: verification
tags: [verification, tests, build-verifier, deploy-runbook, sitemap, screenshot, coupling-gate, phase-finale]

# Dependency graph
requires:
  - phase: 11-multi-page-split-landing-page
    provides: "Plan 11-01 vite.config.ts manifest changes (id/scope/start_url + rollupOptions.input + globPatterns) — Pitfall A coupling partner verified at dist tier"
  - phase: 11-multi-page-split-landing-page
    provides: "Plan 11-02 landing rewrite (hero + install CTA + FAQ + iOS honesty + footer) — landing-structural tests anchor here"
  - phase: 11-multi-page-split-landing-page
    provides: "Plan 11-03 app shell SEO meta (canonical/og/JSON-LD at /Soundly/app/ + apple-* moved) — app shell test block + verifier dist/app/index.html SEO checks anchor here"
  - phase: 11-multi-page-split-landing-page
    provides: "Plan 11-04 SW rescoping (NavigationRoute allowlist + createHandlerBoundToURL + openWindow target) — verifier Pitfall A coupling gate asserts dist/sw.js contains 'allowlist' substring"
  - phase: 10-seo-meta-json-ld-service-worker-update-infra
    provides: "tests/static-assets.test.ts source-regex framework + scripts/verify-phase-10-build.mjs dist verifier + docs/deploy-runbook.md §1-9 operator playbook — all extended (not replaced) here"
provides:
  - "public/screenshot-composer-v1.png — 44012 bytes (43.0 KB), valid PNG, well under 200 KB cap — Composer Wake Easy preset reference visual (D-LAND-13)"
  - "tests/static-assets.test.ts — 5 edits + 1 Rule-1 fix; 246 → 409 lines; +29 Phase 11 tests; full suite 612 → 641"
  - "scripts/verify-phase-10-build.mjs — 4 additive edits; 106 → 165 lines; verifies dist/app/index.html SEO + JSON-LD + manifest link + screenshot size + Pitfall A allowlist coupling gate"
  - "docs/deploy-runbook.md — 3 edits (§1 table 4 files/13 occurrences; §3.1 multi-page build verification; §10 SW-rescoping addendum D-LAND-16); 278 → 355 lines"
  - "public/sitemap.xml — both <lastmod> entries bumped 2026-05-16 → 2026-05-24 (Phase 11 ship date)"
  - "Phase 11 declared COMPLETE — all 6 LAND-* requirements (LAND-01..06) closed at source-regex + dist + operator-runbook tiers; Lighthouse PWA + SEO ≥ 90 on mobile (success criterion #5) queued for post-deploy operator gate"
affects: [future-phase-deploys, future-multi-page-additions, search-console-recrawl, post-deploy-lighthouse-gates]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pitfall A coupling gate via verifier — asserting both halves of a multi-file deploy (manifest changes + SW rescope) inside a single CI gate script; failure of either substring/file presence blocks deploy"
    - "Source-regex test stratification — describe blocks per file (landing vs app shell vs SW vs vite config); each block reads its own source and asserts surface contract; cross-file consistency block at end asserts placeholder URL discipline across both halves of multi-page split"
    - "Verifier line-count discipline — extend (not replace) the verifier script as later phases ship; existing Phase 10 sections kept verbatim, Phase 11 sections inserted at natural boundaries with section comments"

key-files:
  created:
    - "public/screenshot-composer-v1.png (44012 bytes, 1200×800 viewport, Composer Wake Easy preset open)"
    - ".planning/phases/11-multi-page-split-landing-page/11-05-SUMMARY.md (this file)"
  modified:
    - "tests/static-assets.test.ts — 246 → 409 lines; 5 edit classes (A: SW assertions; B: 5 vite.config.ts assertions; C: placeholder-consistency 2-it form; D: app shell SEO + apple-* moved; E: 13 landing-structural + 3 screenshot tests) plus Rule-1 fix on landing 'preserved tags' describe (apple-* assertions converted to NOT-match per Finding 9 / Pitfall G)"
    - "scripts/verify-phase-10-build.mjs — 106 → 165 lines; 4 additive edits (A: dist/app/index.html SEO + JSON-LD parse + manifest link Q4 RESOLVED; B: requiredAssets +dist/screenshot + dist/app/index.html; C: screenshot size cap mirror; D: dist/sw.js allowlist Pitfall A coupling gate); final log line updated to mention Phase 10 + Phase 11"
    - "docs/deploy-runbook.md — 278 → 355 lines; 3 edits (A: §1 placeholder swap table 4 files/13 occurrences + POSIX sed + PowerShell loops include app/index.html; B: §3.1 multi-page build verification inserted; C: §10 SW-rescoping addendum D-LAND-16 appended with Pitfall A coupling reminder, 5-step manual smoke test, manifest.id troubleshooting D-LAND-17)"
    - "public/sitemap.xml — both <lastmod> entries 2026-05-16 → 2026-05-24"

key-decisions:
  - "[Phase 11 P05]: D-LAND-13 screenshot captured at 44012 bytes (43.0 KB) — well under 200 KB cap; no compression pass needed (sharp re-encode was the documented fallback). Versioned filename screenshot-composer-v1.png mirrors og-image-v1.png discipline (SEO-08 / D-10) — future Composer UI revisions get -v2, -v3."
  - "[Phase 11 P05]: Q4 RESOLVED VERDICT — vite-plugin-pwa 0.21.2 DOES auto-inject <link rel='manifest' href='/Soundly/manifest.webmanifest'> into dist/app/index.html (mirrors Plan 10-06 finding for landing). NO Phase 10 D-25 fallback needed at app-shell layer. Verifier check passes on fresh build."
  - "[Phase 11 P05]: Pitfall A coupling gate operationalized — scripts/verify-phase-10-build.mjs now asserts BOTH dist/app/index.html exists (manifest changes shipped from Plan 11-01) AND dist/sw.js contains 'allowlist' substring (SW rescope shipped from Plan 11-04). Partial deploy = verifier exit 1 = CI blocked. The pattern (build verifier as CI deploy gate) is the chosen mitigation for split-deploy risk on coupled multi-file changes."
  - "[Phase 11 P05]: Rule-1 auto-fix — the existing 'index.html preserved tags (D-26)' describe block in tests/static-assets.test.ts asserted 4 apple-* tags on the LANDING. Per Finding 9 / Pitfall G + Plan 11-03 actual implementation, those tags MOVED to app/index.html (landing is not installable on its own; only the app-shell entry carries apple-* meta). Block rewritten to: (a) keep charset/viewport/theme-color positive assertions, (b) add a NEGATIVE assertion that the 4 apple-* patterns are NOT present on landing. The 4 positive assertions live in the new 'app/index.html preserved tags' describe block (EDIT D) per plan spec. Net coverage preserved; landing variance now actively enforced."
  - "[Phase 11 P05]: Rename of scripts/verify-phase-10-build.mjs DEFERRED per Task 3 Claude's Discretion — script is no longer Phase-10-only (now covers Phase 10 + Phase 11), but rename touches package.json scripts, docs/deploy-runbook.md, and possibly CI workflows. Treat as a future maintenance phase. Inline final-log message updated to mention both phases as a stopgap."

patterns-established:
  - "Pattern A — Coupling-gate via verifier: When two source files in different layers (vite.config.ts manifest + src/sw.ts NavigationRoute) MUST ship in the same deploy, a single build-verifier script asserts the presence of both halves in dist/. Failure of either substring/file presence blocks the deploy. Documented in inline comment + deploy-runbook addendum + this SUMMARY's key-decisions."
  - "Pattern B — Versioned filename for visual assets: PNG screenshots (and OG images) use -v1, -v2, -v3 suffixes — future revisions defeat aggressive caches (Facebook OG cache; future PWA screenshot caches) while keeping the same canonical name in source references. Mirrors SEO-08 / D-10."
  - "Pattern C — Source-regex test split-aware describe blocks: For multi-page apps, each HTML entry gets its OWN describe block (NOT a shared 'index.html' block with parameterized assertions). Makes test failures explicit ('app/index.html SEO meta > has canonical pointing to /Soundly/app/') and prevents accidental shared-context coupling."
  - "Pattern D — Negative-assertion test for moved content: When content MOVES from file A to file B (apple-* meta moving from landing to app shell), keep a NEGATIVE assertion on file A ('NOT.toMatch(...)') AND a POSITIVE assertion on file B. The negative side actively prevents accidental re-add; the positive side enforces the new location."

requirements-completed: [LAND-02, LAND-06]
# Plan-level note: LAND-01..05 were closed in earlier Plan 11-0X SUMMARYs;
# this plan's verifier matrix re-asserts them at the dist tier (landing structural
# tests in tests/static-assets.test.ts; multi-page build verification in §3.1).
# Phase 11 overall = COMPLETE.

# Metrics
duration: "~50 min wall-clock (Task 1 was a USER checkpoint earlier; Tasks 2-6 completed in this session)"
completed: 2026-05-24
---

# Phase 11 Plan 5: Verification Gate + SUMMARY

**The verification matrix that closes Phase 11 — Composer screenshot captured + committed, test suite extended with 29 new Phase 11 assertions (612 → 641 passing), build verifier extended with Pitfall A coupling gate, deploy runbook §10 SW-rescoping addendum appended. All four acceptance gates pass on fresh build. Phase 11 declared COMPLETE.**

## Performance

- **Duration:** ~50 min wall-clock (this session) + the earlier USER checkpoint session for screenshot capture
- **Tasks completed:** 6 / 6
- **Files modified:** 5 (screenshot, tests, verifier, runbook, sitemap)
- **Test count delta:** 612 (Phase 10 baseline) → 641 (+29 new Phase 11)
- **Verifier script delta:** 106 → 165 lines
- **Deploy runbook delta:** 278 → 355 lines

## Tasks Executed

| # | Task | Status | Commit |
|---|------|--------|--------|
| 1 | USER CHECKPOINT — Composer screenshot capture (D-LAND-13) | Done | `f311c79` |
| 2 | Update tests/static-assets.test.ts for Phase 11 split (5 edit classes + 1 Rule-1 fix) | Done | `18b1458` |
| 3 | Update scripts/verify-phase-10-build.mjs (4 additive edits + Pitfall A coupling gate) | Done | `98ccb3a` |
| 4 | Update docs/deploy-runbook.md (§1 table + §3.1 build verification + §10 SW-rescoping addendum) | Done | `0529f98` |
| 5 | Bump public/sitemap.xml lastmod to Phase 11 ship date | Done | `5bb2796` |
| 6 | Final acceptance gate (vitest run + tsc + build + verifier) | Done — all 4 gates exit 0 | (no commit per plan) |

## Acceptance Gates (Task 6 verification matrix)

| Gate | Command | Result |
|------|---------|--------|
| Full test suite | `npx vitest run` | 641/641 PASS across 43 test files |
| TypeScript clean | `npx tsc --noEmit` | Clean (no output) |
| Production build | `npm run build` | Clean — both `dist/index.html` + `dist/app/index.html` emitted; sw.js 17.04 KB / 5 precache entries |
| Verifier (Phase 10 + 11) | `node scripts/verify-phase-10-build.mjs` | Exits 0 — 11 OK lines printed including "Phase 10 + Phase 11 final build verification: ALL OK" |

Each verifier OK line:
1. dist/index.html contains all 8 Phase 10 SEO substrings
2. dist/index.html contains `<link rel="manifest" ...>` (Q3 RESOLVED — landing)
3. dist/index.html JSON-LD parses + @type=WebApplication
4. **dist/app/index.html contains all 9 Phase 11 SEO substrings** (NEW)
5. **dist/app/index.html JSON-LD parses + @type=WebApplication + url ends with /Soundly/app/** (NEW)
6. **dist/app/index.html contains `<link rel="manifest" ...>` (Q4 RESOLVED — app shell)** (NEW)
7. All 6 dist/ static assets present (was 4; +dist/screenshot-composer-v1.png +dist/app/index.html)
8. dist/og-image-v1.png size: 33930 bytes (within bounds)
9. **dist/screenshot-composer-v1.png size: 44012 bytes (within bounds)** (NEW)
10. dist/sw.js contains skipWaiting + clientsClaim references
11. **dist/sw.js contains allowlist (SW rescope confirmed — Pitfall A gate passed)** (NEW)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Test assertion mismatch] tests/static-assets.test.ts apple-* assertions on landing**

- **Found during:** Task 2 (running test suite after applying EDIT A–E)
- **Issue:** Existing `describe('index.html preserved tags (D-26)')` block (lines 73–104 of the Phase 10 file) asserted 4 apple-* meta tags on the LANDING `index.html`. Per Plan 11-03 + Finding 9 / Pitfall G, those tags MOVED to `app/index.html` (landing is not installable on its own — only the app-shell entry carries apple-* meta).
- **Fix:** Block rewritten in two halves:
  - Keep positive assertions for `charset`, `viewport`, `theme-color` (those DO remain on landing)
  - Replace the 4 individual apple-* `toMatch` assertions with one consolidated `not.toMatch` block asserting NONE of the 4 patterns appear on landing (active enforcement of the move, not just absence)
  - Positive apple-* assertions live in the new EDIT D `describe('app/index.html preserved tags (D-26 moved to app shell in Phase 11)')` block per plan spec
- **Files modified:** `tests/static-assets.test.ts` (within the Task 2 commit `18b1458`)
- **Rationale:** Plan's `must_haves.truths[3]` explicitly states "D-26 apple-* meta tests MOVED to a new describe('app/index.html preserved tags') block (landing keeps charset/viewport/theme-color only)" — the MOVE was intended, EDIT D added the new home, this Rule-1 fix made the OLD home stop asserting the moved content. Net coverage preserved; landing variance now actively enforced.

### Authentication Gates

None — all 6 tasks ran without auth gates.

### USER Checkpoint (planned, not a deviation)

Task 1 was a planned `checkpoint:human-verify` per D-LAND-13 manual screenshot capture. The user captured the screenshot in a prior session at 44012 bytes / 1200×800 viewport and typed `approved`. This session resumed by:

1. Verifying the file existed at `public/screenshot-composer-v1.png` (initial filename was `screenshot-composer-v1.PNG` — case fixed via PowerShell two-step rename, then staged + committed)
2. Confirming PNG header (89 50 4E 47) + size in band (1000 < 44012 < 204800)
3. Committing as Task 1 (`f311c79`) then proceeding to Tasks 2-6 autonomously

## Verifier outcomes — Q4 RESOLVED

The verifier script (Task 3, EDIT A) asserts `<link rel="manifest" ...>` is present on `dist/app/index.html`. On the fresh production build, this check PASSED — vite-plugin-pwa 0.21.2 auto-injects the manifest link on every HTML entry passed via `build.rollupOptions.input`. **No Phase 10 D-25 fallback (explicit `<link rel="manifest" href="/Soundly/manifest.webmanifest">` in `app/index.html` source) was required.** This mirrors Plan 10-06's Q3 RESOLVED verdict for the landing entry.

If a future vite-plugin-pwa upgrade ever drops this auto-injection, the verifier will catch it at the build stage; the fallback recipe is documented inline in the verifier failure message.

## Screenshot Metadata

| Property | Value |
|----------|-------|
| Path | `public/screenshot-composer-v1.png` |
| Size | 44012 bytes (43.0 KB) |
| PNG header | `89 50 4E 47` (verified) |
| Cap | 200 KB (SEO-08 / D-LAND-13 mirror) |
| Headroom | ~157 KB before cap (78.5%) |
| Compression | None applied (file landed well under cap on first capture) |
| Visible UI elements | Per UI-SPEC L802 — Composer modal sticky header, "Total" caption + 17:00, 5 SegmentRow instances (4 × 4:00 gentle + 1 × 1:00 alarm), "+ Add segment" button, sticky footer (Cancel / Share / Start) |
| Privacy review | Clean — no browser chrome, no DevTools, no console, no bookmarks (user-confirmed at checkpoint) |

## Test Count Delta

| Phase | Test count | Δ |
|-------|------------|---|
| Phase 10 baseline (post 10-06) | 612 | — |
| Phase 11 P02 (landing rewrite) | (no tests added in 11-02..04 — deferred to 11-05) | 0 |
| **Phase 11 P05 (this plan)** | **641** | **+29** |

The +29 breakdown:
- EDIT A (SW.ts): -1 old test + 2 new = +1
- EDIT B (vite.config.ts): -1 old test + 5 new = +4
- EDIT C (placeholder consistency): -1 old test + 2 new = +1
- EDIT D (app/index.html SEO + apple-* moved): +11 new tests
- EDIT E (landing structural + screenshot): +16 new tests
- Rule-1 fix (negative-assertion replacing 4 apple-* on landing): -4 old + 1 new = -3
- Net: +30 — 1 from minor test consolidations = +29

## Future Cleanup Note (Claude's Discretion deferred)

**Rename `scripts/verify-phase-10-build.mjs` → `scripts/verify-build.mjs`:** The script now covers Phase 10 + Phase 11 (and any future phase deliverables in `dist/`). Renaming would touch `package.json` (if it ever gets a script entry), `docs/deploy-runbook.md` (every `node scripts/...` invocation), and any future CI workflow that calls it. Defer to a maintenance phase. Final log message updated to mention both phases as a stopgap.

## Phase 11 — Final Status

**COMPLETE.** All 6 LAND-* requirements (LAND-01..06) closed end-to-end across 5 plans:
- LAND-01 (marketing landing) — Plan 11-02 (rewrite) + Plan 11-05 (13 landing structural tests)
- LAND-02 (two-tier routing + SW rescope) — Plan 11-01 (manifest) + Plan 11-03 (app shell) + Plan 11-04 (SW) + Plan 11-05 (coupling-gate verification)
- LAND-03 (install CTA) — Plan 11-02 (inline JS) + Plan 11-05 (5 install-CTA tests)
- LAND-04 (FAQ plain HTML) — Plan 11-02 (FAQ section) + Plan 11-05 (FAQPage-not-present negative test)
- LAND-05 (iOS honesty) — Plan 11-02 (2-paragraph copy) + Plan 11-05 (>= 2 paragraphs test)
- LAND-06 (multi-page build) — Plan 11-01 (rollupOptions.input) + Plan 11-03 (app/index.html) + Plan 11-05 (dist/app/index.html dist-tier verifier check)

**Success criterion #5 (Lighthouse PWA + SEO ≥ 90 on mobile)** is NOT automatable from this repo — requires deploy + real browser. Documented in `docs/deploy-runbook.md` §5 + §10. Queued for post-deploy operator gate.

**v2.0 milestone progress:** 6/6 phases (Phases 6–11) shipped. Custom Alarm Composer + Discoverability milestone COMPLETE pending operator deploy.

## Self-Check: PASSED

Verifications:
- `public/screenshot-composer-v1.png` exists — FOUND (44012 bytes)
- `tests/static-assets.test.ts` exists at 409 lines — FOUND
- `scripts/verify-phase-10-build.mjs` exists at 165 lines — FOUND
- `docs/deploy-runbook.md` exists at 355 lines — FOUND
- `public/sitemap.xml` lastmod = 2026-05-24 — VERIFIED (both entries)
- Commits referenced exist:
  - `f311c79` (Task 1 screenshot) — FOUND
  - `18b1458` (Task 2 tests) — FOUND
  - `98ccb3a` (Task 3 verifier) — FOUND
  - `0529f98` (Task 4 runbook) — FOUND
  - `5bb2796` (Task 5 sitemap) — FOUND
