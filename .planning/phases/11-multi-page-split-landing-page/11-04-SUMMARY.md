---
phase: 11-multi-page-split-landing-page
plan: 04
subsystem: infra
tags: [service-worker, workbox, navigation-route, pwa, allowlist, vite-plugin-pwa]

# Dependency graph
requires:
  - phase: 11-multi-page-split-landing-page
    provides: "Plan 11-01 manifest.scope=/Soundly/app/ + start_url=/Soundly/app/ + injectManifest.globPatterns app/** (Pitfall A coupling partner)"
  - phase: 10-seo-meta-json-ld-service-worker-update-infra
    provides: "SW autoUpdate + skipWaiting + clientsClaim — Phase 10 D-17 / SEO-09 preserved byte-identical here"
provides:
  - "src/sw.ts NavigationRoute scoped via allowlist [/^\\/Soundly\\/app\\//] — landing (/Soundly/) bypasses SW per LAND-02 + D-LAND-15"
  - "src/sw.ts createHandlerBoundToURL bound to /Soundly/app/index.html — installed users get app shell, not stale landing"
  - "src/sw.ts notificationclick openWindow target /Soundly/app/ — notification taps land in app shell, not marketing landing"
  - "Pitfall A coupling reminder inline-documented in 2 comment blocks (must ship with Plan 11-01 in same deploy)"
affects: [11-05-verification-reconciliation, future-app-deploy, post-deploy-smoke-tests]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Workbox NavigationRoute allowlist option (RegExp[]) for scope-narrowing in multi-page PWAs"
    - "Inline coupling-reminder comments — when two plans MUST ship together, document Pitfall in BOTH files' comments (vite.config.ts AND sw.ts)"

key-files:
  created: []
  modified:
    - "src/sw.ts — 3 surgical edits (NavigationRoute allowlist + createHandlerBoundToURL target + openWindow target); 54 → 65 lines"

key-decisions:
  - "[Phase 11 P04]: NavigationRoute allowlist regex anchored with ^ — /^\\/Soundly\\/app\\// not /\\/Soundly\\/app\\// — defense-in-depth even though NavigationRoute internally same-origin-restricts (T-11-04-03 mitigation, per RESEARCH Finding 2 + CONTEXT positive-constraint preference)"
  - "[Phase 11 P04]: Pitfall A coupling documented inline in 2 comment blocks within sw.ts (NavigationRoute setup + skipWaiting/clientsClaim section) — comment-block coupling reminder is the chosen mitigation for the high-risk deploy-split scenario (code-level coupling impossible since vite.config.ts and src/sw.ts must remain separate files). Plan 11-05's deploy-runbook addendum + verifier check provides the operational gate."
  - "[Phase 11 P04]: Phase 10 SEO-09 update infra (skipWaiting + clientsClaim from workbox-core) preserved byte-identical per D-17 preservation contract — comment block extended (not rewritten) so Phase 10 rationale stays intact, with Phase 11 note appended explaining clientsClaim() is what makes the SW rescoping propagate to installed users on next launch."

patterns-established:
  - "Pattern A — NavigationRoute scope-narrowing: `new NavigationRoute(handler, { allowlist: [/^\\/path\\/scope\\//] })` is the canonical vite-plugin-pwa pattern for excluding sibling routes from SW navigation handling (RESEARCH Finding 2). Future multi-page PWA additions follow this idiom."
  - "Pattern B — Comment-block coupling reminders: When two files in different layers (config + runtime SW) must change together for a coupled deploy, both files get inline 'COUPLING (Pitfall X)' comments at the change site. Operational enforcement still lives in the deploy runbook (Plan 11-05), but the inline reminder catches future devs editing only one file."
  - "Pattern C — Phase preservation contract via comment-extension (not rewrite): When a later phase modifies a SW that has prior-phase preservation requirements, extend the existing comment with a new section rather than replacing it. Preserves prior-phase rationale for archaeologists; makes the multi-phase intent explicit."

requirements-completed: [LAND-02]

# Metrics
duration: 3min
completed: 2026-05-21
---

# Phase 11 Plan 4: SW Rescoping (NavigationRoute Allowlist) Summary

**Three surgical edits to src/sw.ts narrow NavigationRoute via { allowlist: [/^\/Soundly\/app\//] }, bump createHandlerBoundToURL to /Soundly/app/index.html, and bump notificationclick openWindow to /Soundly/app/ — closing LAND-02 at the SW navigation-routing layer.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-21T20:14Z (approx)
- **Completed:** 2026-05-21T20:16:48Z
- **Tasks:** 1
- **Files modified:** 1 (src/sw.ts only)

## Accomplishments

- NavigationRoute rescoped via `{ allowlist: [/^\/Soundly\/app\//] }` — landing navigations (/Soundly/) now bypass the SW per LAND-02 + D-LAND-15 (network fetch keeps landing fresh; no stale precached shell)
- `createHandlerBoundToURL` bound to `/Soundly/app/index.html` — installed users navigating to /Soundly/app/* are served the app-shell precache entry (offline-capable)
- `notificationclick` `openWindow` target bumped to `/Soundly/app/` — notification taps land directly in the alarm app shell, not on the marketing landing
- Phase 10 SEO-09 update infrastructure (cleanupOutdatedCaches, precacheAndRoute, skipWaiting, clientsClaim, full notificationclick handler body) preserved byte-identical per D-17 preservation contract
- Pitfall A coupling note inline-documented in 2 comment blocks within sw.ts — guards against future devs editing only one half of the manifest↔SW coupling

## Task Commits

Each task was committed atomically:

1. **Task 1: Apply three surgical edits to src/sw.ts** — `d78d74e` (feat)

_Note: Single-task plan, no separate metadata commit yet (will be folded into the orchestrator's wave/phase close)._

## Files Created/Modified

- `src/sw.ts` — 3 surgical edits + extended comment blocks; 54 → 65 lines (+19 / -8 diff). NavigationRoute now scoped via allowlist regex; createHandlerBoundToURL target updated to app shell; notificationclick openWindow target updated to /Soundly/app/. All other handlers byte-identical.

## Decisions Made

- **Anchored allowlist regex**: Used `/^\/Soundly\/app\//` (not `/\/Soundly\/app\//`) per T-11-04-03 mitigation — `^` anchor is defense-in-depth even though NavigationRoute internally same-origin-restricts. Makes intent explicit and guards against future open-redirect-style regex matching.
- **Positive constraint (allowlist) over denylist**: Per CONTEXT specifics — clearer intent; future app sub-routes added to the regex rather than being subtracted from a denylist.
- **Comment-block coupling reminder pattern**: Pitfall A (manifest changes coupled to SW changes) cannot be enforced at the code level since the two changes live in separate files (vite.config.ts + src/sw.ts). Inline comments at both change sites + Plan 11-05's deploy-runbook addendum + Plan 11-05's `dist/sw.js` allowlist verifier provide the three-layer defense.
- **Comment-extension over rewrite for Phase 10 SEO-09 block**: The skipWaiting/clientsClaim comment block from Phase 10 P03 was extended (not rewritten) with a Phase 11 paragraph explaining how `clientsClaim()` is critical for SW-rescoping propagation. Preserves the original Phase 10 rationale for future archaeologists.

## Deviations from Plan

None - plan executed exactly as written.

Three surgical edits applied verbatim per `<action>` spec (lines 138–219 of 11-04-PLAN.md). No Rule 1 (bug), Rule 2 (missing critical functionality), Rule 3 (blocking), or Rule 4 (architectural) auto-fixes triggered. The plan's threat model T-11-04-01..T-11-04-07 all satisfied by the spec's prescribed code (anchored regex; comment-coupling; same-deploy gating delegated to Plan 11-05).

## Issues Encountered

None. Build clean (`npm run build` exits 0 with `dist/sw.js` 17.04 KB containing the `allowlist` substring), TypeScript clean (`tsc --noEmit` exits 0), all preservation patterns intact (cleanupOutdatedCaches, precacheAndRoute, skipWaiting, clientsClaim, notificationclick handler all match expected regex).

## Verification Results

**Source-level regex gates (all PASS):**
- `createHandlerBoundToURL\('/Soundly/app/index\.html'\)` → 1 match
- `allowlist:\s*\[/\^\\\/Soundly\\\/app\\\//]` → 1 match (the anchored regex literal)
- `openWindow\('/Soundly/app/'\)` → 1 match
- Combined preservation check (cleanupOutdatedCaches + precacheAndRoute + skipWaiting + clientsClaim + notificationclick) → 8 matches total (expected: import + call instances)
- Forbidden-old-patterns check (`/Soundly/index\.html`, bare `openWindow('/Soundly/')`, bare `new NavigationRoute(navHandler)`) → 0 matches

**Build-output gates (all PASS):**
- `npm run build` exits 0
- `dist/sw.js` contains the `allowlist` substring → 1 match (Pitfall A coupling gate — confirms 11-04 SW rescope shipped)
- `tsc --noEmit` exits 0

**Plan 11-01 + 11-04 coupling status:**
- vite.config.ts manifest (start_url=/Soundly/app/, scope=/Soundly/app/, id=/Soundly/) — IN PLACE from Plan 11-01 commit
- src/sw.ts NavigationRoute allowlist + createHandlerBoundToURL + openWindow — IN PLACE from this plan
- Both halves of Pitfall A now resident on `main` — single git commit chain → single deploy unit → coupling honored

**Tests expected to remain failing until Plan 11-05** (documented in plan output spec):
- `tests/static-assets.test.ts` lines 202–204 still assert OLD NavigationRoute strings (`createHandlerBoundToURL('/Soundly/index.html')` and `registerRoute(new NavigationRoute(navHandler))`). These 2 assertions will be inverted by Plan 11-05's test reconciliation pass. Pre-existing failure from Plan 11-01 (line 233 start_url assertion) also stays until Plan 11-05.

## Pitfall A Coupling Note

**HIGH RISK — coupling honored by `main` branch chain:** Plan 11-01 manifest changes (commit on `main` before this plan) + Plan 11-04 SW rescoping (commit `d78d74e` this plan) are both now resident on `main`. Any deploy from `main` after `d78d74e` MUST include both — there is no way to split them without rewriting history. Pre-deploy verifier (Plan 11-05) will assert `dist/sw.js` contains `allowlist` as the canonical "rescope shipped" gate.

## D-17 / Phase 10 SEO-09 Preservation Audit

All five protected items still verbatim:

| Item | Source line | Status |
|------|-------------|--------|
| `/// <reference lib="webworker" />` | sw.ts:1 | byte-identical |
| 3 import statements (workbox-precaching, workbox-routing, workbox-core) | sw.ts:3-5 | byte-identical |
| `declare let self: ServiceWorkerGlobalScope;` | sw.ts:7 | byte-identical |
| `cleanupOutdatedCaches();` | sw.ts:10 | byte-identical |
| `precacheAndRoute(self.__WB_MANIFEST);` | sw.ts:13 | byte-identical |
| `notificationclick` handler body (excluding `openWindow` URL string) | sw.ts:32-47 | byte-identical except line 44 URL change (spec-mandated Edit 2) |
| `self.skipWaiting();` + `clientsClaim();` | sw.ts:63-64 | byte-identical |

D-17 contract: HONORED. Comment block above `skipWaiting/clientsClaim` extended (not rewritten) — Phase 10 SEO-09 rationale paragraphs 1-2 preserved verbatim, Phase 11 paragraph appended.

## User Setup Required

None - no external service configuration required. SW rescoping is a build-time + runtime concern only; deployment-time gating belongs to Plan 11-05's deploy runbook addendum.

## Next Phase Readiness

**Plan 11-05 (final integration + verification reconciliation) unblocked:**
- Plan 11-05 owns the `tests/static-assets.test.ts` lines 202–204 + line 233 reconciliation (4 failing assertions across Plans 11-01 + 11-04, all expected).
- Plan 11-05 owns the deploy-runbook addendum that operationalizes the Pitfall A coupling gate (assert `dist/sw.js` contains `allowlist` AND `dist/manifest.webmanifest` has `start_url: /Soundly/app/` before any deploy).
- Plan 11-05 owns the `public/screenshot-composer-v1.png` manual capture (referenced from index.html since Plan 11-02; currently 404 on dist/).

**No blockers introduced.** The 3 known failing test assertions are owned by Plan 11-05 by design and were not introduced by this plan — they were already failing after Plan 11-01.

## Self-Check: PASSED

- src/sw.ts modifications verified — file present at expected path, contains all 3 required new patterns (allowlist regex, /Soundly/app/index.html target, openWindow /Soundly/app/), zero old patterns remaining.
- Commit `d78d74e` verified in `git log --oneline -3` output.
- dist/sw.js verified to contain `allowlist` substring after `npm run build`.

---
*Phase: 11-multi-page-split-landing-page*
*Completed: 2026-05-21*
