---
phase: 11-multi-page-split-landing-page
plan: 01
subsystem: infra
tags: [vite, vite-plugin-pwa, pwa-manifest, multi-page-build, rollup, workbox, injectManifest]

requires:
  - phase: 10-seo-meta-json-ld-service-worker-update-infra
    provides: registerType:autoUpdate + injectManifest strategy + base:/Soundly/ already locked; manifest.id is a NEW addition that did not exist in Phase 10
provides:
  - vite.config.ts wired with build.rollupOptions.input.{main,app} resolving index.html + app/index.html
  - PWA manifest gains explicit id:'/Soundly/' (D-LAND-17) — install-identity continuity for v1.0/v2.0 PWA users
  - PWA manifest start_url narrowed to /Soundly/app/ (LAND-02)
  - PWA manifest scope narrowed to /Soundly/app/ (LAND-06)
  - injectManifest.globPatterns narrowed to app/** + globIgnores for landing assets (Pitfall B)
  - app/index.html stub at repo root — Plan 11-03 replaces with full app shell
affects:
  - 11-02-PLAN.md (landing rewrite — depends on root index.html being separate from app shell)
  - 11-03-PLAN.md (app shell move — depends on app/index.html stub existing; replaces its body wholesale)
  - 11-04-PLAN.md (SW rescoping — MUST ship in same deploy as this plan per Pitfall A)
  - 11-05-PLAN.md (verification — must update tests/static-assets.test.ts line 233 to assert /Soundly/app/ for start_url)

tech-stack:
  added:
    - "@types/node ^25.9.1 (devDep — required for node:path + node:url + import.meta.url in vite.config.ts)"
  patterns:
    - "Vite multi-page input via build.rollupOptions.input + resolve(__dirname, ...) using fileURLToPath(import.meta.url) for ESM-compatible __dirname"
    - "PWA manifest.id explicit-identity ratchet — set once, never change (one-way constraint, documented inline)"
    - "vite-plugin-pwa injectManifest globPatterns + globIgnores narrowing — landing assets explicitly excluded from SW precache"

key-files:
  created:
    - "app/index.html (STUB — 24 lines; Plan 11-03 replaces with full app shell)"
  modified:
    - "vite.config.ts (37 → 74 lines; +37 net — multi-page rollupOptions + manifest id/scope/start_url + injectManifest globs)"
    - "package.json (+1 devDep: @types/node ^25.9.1)"
    - "package-lock.json (transitive @types/node install)"

key-decisions:
  - "D-LAND-17 NEW (Phase 11): manifest.id locked to '/Soundly/' — derived from RESEARCH Finding 4 / Q6. Preserves install identity across the start_url narrow. One-way ratchet documented in inline comment."
  - "[Rule 3 auto-fix] @types/node devDep added (^25.9.1) — required so vite.config.ts can import node:path + node:url + reference import.meta.url under tsc -b. No prior need because Phase 10's config additions didn't touch Node built-ins."
  - "Pitfall A coupling documented inline in vite.config.ts injectManifest comment block: these manifest changes MUST ship in same deploy as Plan 11-04 SW rescoping; splitting deploys leaves installed users on stale precached /Soundly/index.html."

patterns-established:
  - "Pattern: ESM __dirname via dirname(fileURLToPath(import.meta.url)) — first usage in repo's TS code; needed because Vite project is type:module so CommonJS __dirname is undefined."
  - "Pattern: rollupOptions.input object-key naming irrelevant — Vite uses resolved file path for output structure (key 'main' → dist/index.html, key 'app' → dist/app/index.html)."
  - "Pattern: PWA install-identity preservation via explicit manifest.id — set BEFORE shipping any start_url change; never modify after the fact."

requirements-completed:
  - LAND-02
  - LAND-06

duration: 4m 39s
completed: 2026-05-21
---

# Phase 11 Plan 01: Multi-page build skeleton + PWA manifest scope narrow Summary

**Vite multi-page rollupOptions wiring + PWA manifest.id/scope/start_url narrowed to /Soundly/app/ + injectManifest globPatterns scoped to app/** so landing assets stay network-fresh**

## Performance

- **Duration:** 4m 39s
- **Started:** 2026-05-21T19:48:56Z
- **Completed:** 2026-05-21T19:53:35Z
- **Tasks:** 2
- **Files modified:** 3 (vite.config.ts + package.json + package-lock.json) + 1 created (app/index.html)

## Accomplishments

- Multi-page Vite build emits both `dist/index.html` AND `dist/app/index.html` from the same project (verified — 71 modules transformed, 2.17s build time)
- PWA manifest gains explicit `id: '/Soundly/'` (D-LAND-17 — derived during this plan from RESEARCH Finding 4); installed v1.0/v2.0 PWA users will continue to be recognized as the same application after the `start_url` narrow ships
- PWA `start_url` + `scope` both narrowed to `/Soundly/app/` (LAND-02 + LAND-06) so installed users launch into the app shell and navigation inside the installed PWA stays in `/app/`
- SW precache narrowed to `app/**` (verified — `dist/sw.js` precache manifest contains `app/index.html` + 3 icons + `manifest.webmanifest` only; root `index.html`, `og-image-v1.png`, `sitemap.xml`, and `robots.txt` are all correctly excluded — Pitfall B mitigation working)
- Stub `app/index.html` lets Plan 11-02 rewrite root `index.html` and Plan 11-03 rewrite app/index.html in parallel without breaking the build between waves

## Task Commits

Each task was committed atomically:

1. **Task 1: vite.config.ts multi-page wiring + manifest narrow + injectManifest globs + @types/node Rule-3 auto-fix** — `8bf3863` (feat)
2. **Task 2: app/index.html stub creation** — `ae6d5db` (feat)

**Plan metadata commit (this SUMMARY + STATE + ROADMAP):** pending.

## Files Created/Modified

- `app/index.html` — Wave-1 stub (24 lines): minimal `<head>` + `<div id="root">` + `<script type="module" src="/src/main.tsx">`; HTML5 comment block flags it as a stub for Plan 11-03 author
- `vite.config.ts` — multi-page rollupOptions.input + manifest.id/scope/start_url + injectManifest.globPatterns + node:path/node:url ESM `__dirname` shim
- `package.json` — `@types/node ^25.9.1` added to devDependencies (Rule 3 — required to type-check the node:path import in vite.config.ts)
- `package-lock.json` — `@types/node` resolution + transitive entries

## Decisions Made

- **D-LAND-17 (NEW — derived from RESEARCH Finding 4):** Locked `manifest.id` value to `'/Soundly/'`. Rationale: preserves implicit identity that v1.0/v2.0 installed PWAs already have (their browsers use the original `start_url: '/Soundly/'` as the implicit ID; setting `id` explicitly to the same string ratchets the identity in place before `start_url` changes). One-way ratchet: never change `id` again or every installed PWA orphans. Documented in inline comment with cross-reference to RESEARCH Finding 4 / Q6.
- **Rule 3 auto-fix:** Installed `@types/node ^25.9.1` as devDep. The new `vite.config.ts` uses `import { resolve, dirname } from 'node:path'` + `import { fileURLToPath } from 'node:url'` + `import.meta.url`. Without `@types/node`, `tsc -b` (run before `vite build` per the `build` npm script) fails with TS2307 + TS2339. This is a Rule 3 blocking issue — the configured changes from the plan don't compile without it. `@types/node` is the canonical Vite-project devDep for this exact pattern.
- **Pitfall A coupling documented inline:** Added a 4-line comment block above the `injectManifest:` key in `vite.config.ts` reminding future maintainers that the manifest changes here MUST ship in the same deploy as Plan 11-04's `src/sw.ts` rescoping; splitting them leaves installed users on stale precached `/Soundly/index.html`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed @types/node devDep**
- **Found during:** Task 1 verification (`npm run build`)
- **Issue:** `tsc -b` failed with 3 errors: TS2307 on `node:path`, TS2307 on `node:url`, TS2339 on `ImportMeta.url`. The new `vite.config.ts` (per the plan's required action) imports node built-ins that have no type declarations until `@types/node` is present.
- **Fix:** Ran `npm install --save-dev @types/node` — added `@types/node ^25.9.1`. Standard Vite project devDep for any config that resolves paths via Node APIs.
- **Files modified:** `package.json`, `package-lock.json`
- **Verification:** `npm run build` re-run after install: `tsc -b` clean, `vite build` succeeds in 2.17s, both `dist/index.html` and `dist/app/index.html` emitted.
- **Committed in:** `8bf3863` (Task 1 commit, bundled with the vite.config.ts edit since the package change is prerequisite to that edit compiling)

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** Single tooling devDep required to make the planned config additions type-check. Zero scope creep — no runtime code or product behavior changed by the auto-fix.

## Plan Prediction Discrepancy (NOT a deviation — just a documentation nit)

The plan predicted that `npx vitest run tests/static-assets.test.ts` would yield **2 failures** after this plan lands:
- Line 233 — `preserves the manifest block with start_url` (asserts old `'/Soundly/'`)
- Lines 239–245 — `placeholder canonical URL consistency` (asserts a placeholder across 3 files)

Actual result: **1 failure** only — line 233.

The lines-239–245 test inspects `index.html`, `public/robots.txt`, and `public/sitemap.xml` for the canonical placeholder string `https://soundly.local/Soundly/`. This plan does NOT touch any of those files (root `index.html` is unchanged this plan per the plan's explicit instructions; `public/robots.txt` and `public/sitemap.xml` weren't touched either). So the placeholder consistency test correctly continues to pass.

Net: Plan 11-05 only needs to update the line-233 assertion (and any sibling tests in the same describe block) — NOT lines 239–245. Final result: `36 passed, 1 failed (37 total)` — exactly the expected post-this-plan state.

## Issues Encountered

- None beyond the documented Rule 3 auto-fix above.

## Verification Results

| Acceptance Check | Result |
|---|---|
| `grep rollupOptions vite.config.ts` returns 1+ | PASS (line 67) |
| `grep "id: '/Soundly/'" vite.config.ts` returns 1 | PASS (line 24) |
| `grep "start_url: '/Soundly/app/'" vite.config.ts` returns 1 | PASS (line 31) |
| `grep "scope: '/Soundly/app/'" vite.config.ts` returns 1 | PASS (line 32) |
| `grep globPatterns vite.config.ts` returns 1 | PASS (line 46) |
| `app/index.html` exists as stub | PASS (24 lines, repo root) |
| `npm run build` exits 0 and emits both `dist/index.html` AND `dist/app/index.html` | PASS (`dist/index.html` 2.80 kB, `dist/app/index.html` 1.24 kB) |
| `base: '/Soundly/'` unchanged | PASS (line 11) |
| `registerType: 'autoUpdate'` unchanged | PASS (line 16) |
| `strategies: 'injectManifest'` unchanged | PASS (line 17) |
| `devOptions.enabled: true` unchanged | PASS (line 56) |
| icons[] array unchanged | PASS (lines 33–37) |
| `static-assets.test.ts` — only line-233 fails as expected | PASS (36/37, 1 expected fail at line 233) |
| `dist/sw.js` precache narrowed to app/ only | PASS (5 entries: `app/index.html` + 3 icons + manifest.webmanifest; no root `index.html`, no `og-image-v1.png`, no `sitemap.xml`, no `robots.txt`) |
| `dist/manifest.webmanifest` contains id/scope/start_url correctly | PASS (id:'/Soundly/', start_url:'/Soundly/app/', scope:'/Soundly/app/') |

## Known Stubs

| File | Lines | Reason |
|---|---|---|
| `app/index.html` | full file (24 lines) | Wave-1 stub by design (per plan); Plan 11-03 replaces wholesale with full app shell (apple-* PWA meta, SEO meta, JSON-LD WebApplication, apple-touch-icon). HTML5 comment block inside the file marks it as a stub for the Plan 11-03 author. NOT a hidden stub — explicitly scheduled. |

## Threat Flags

None — Plan's threat model already covered all surface introduced by this plan (T-11-01-01 through T-11-01-05). The Rule 3 auto-fix (`@types/node`) is a build-time type dependency only — no runtime surface, no trust boundary, no input/output paths added.

## Next Phase Readiness

- Multi-page build skeleton is live; Plans 11-02 (landing rewrite — root `index.html`) and 11-03 (app shell move — `app/index.html` body) can both proceed in Wave 2 without build breakage.
- Plan 11-04 (SW rescoping) MUST ship in the same deploy as this plan per the inline Pitfall A coupling note.
- Plan 11-05 will update `tests/static-assets.test.ts` line 233 (and possibly add new assertions for `manifest.id`, `scope`, `injectManifest.globPatterns`, and the multi-page `rollupOptions.input` shape).

## Self-Check: PASSED

Verified via Read tool + git log:

- `vite.config.ts` FOUND (modified — 74 lines)
- `app/index.html` FOUND (new — 24 lines)
- `package.json` FOUND (modified — `@types/node ^25.9.1` present)
- Commit `8bf3863` FOUND in `git log --oneline -5`
- Commit `ae6d5db` FOUND in `git log --oneline -5`
- `dist/index.html` FOUND (emitted by build)
- `dist/app/index.html` FOUND (emitted by build)
- `dist/manifest.webmanifest` FOUND with correct id/scope/start_url

---
*Phase: 11-multi-page-split-landing-page*
*Completed: 2026-05-21*
