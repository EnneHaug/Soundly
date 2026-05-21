---
phase: 10-seo-meta-json-ld-service-worker-update-infra
plan: 04
subsystem: build-assets
tags: [og-image, sharp, asset-generation, checkpoint, workbox-core, seo-02, seo-08, seo-09]
requirements_completed: [SEO-02, SEO-08]
requirements_supported: [SEO-09]
dependency_graph:
  requires:
    - scripts/generate-icons.mjs (analog — same sharp+SVG idiom)
    - src/index.css @theme palette (source-of-truth hex values)
    - public/ directory (already present from Phase 9 icons work)
    - sharp ^0.34.5 (already in devDependencies)
  provides:
    - scripts/generate-og-image.mjs (one-shot OG image generator, build-time helper, NOT in main build pipeline)
    - npm run og-image script entry
    - public/og-image-v1.png (1200×630 PNG, 33930 bytes, vector-derived flat-color)
    - workbox-core ^7.4.0 as direct devDep (Q1 RESOLVED — replaces transitive resolution)
  affects:
    - Plan 10-01's static OG meta tags (which reference og-image-v1.png URL) — image is now present at the path the meta tags claim
    - Plan 10-03's src/sw.ts (which imports clientsClaim from workbox-core) — the import is now backed by a direct devDep pin, immune to vite-plugin-pwa minor-version churn
    - Plan 10-05 deploy runbook (D-10 versioned-filename guidance documented there) — runbook will reference og-image-v1 → og-image-v2 swap protocol for future image refreshes
tech-stack:
  added:
    - workbox-core ^7.4.0 (direct devDep pin — was transitive via vite-plugin-pwa@0.21.1)
  patterns:
    - sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(...) — cloned verbatim from scripts/generate-icons.mjs
    - ALL-CAPS palette constants at module scope with inline swatch-name comments
    - Single async generate() wrapper with .catch(console.error + process.exit(1))
    - Versioned asset filename (og-image-v1.png) for Facebook OG cache busting on future swaps
key-files:
  created:
    - scripts/generate-og-image.mjs (62 lines)
    - public/og-image-v1.png (33930 bytes, 1200×630)
  modified:
    - package.json (+1 script key + 1 devDep key, file remains minified single-line)
decisions:
  - "[Phase 10 P04]: D-09 LOCKED user-approval checkpoint honored — PNG was generated in a prior session at commit ca247ee but NOT committed; resumed session in this run after user typed `approve` and committed the approved PNG as 0b162e2"
  - "[Phase 10 P04]: D-08 Claude's Discretion composition shipped on first iteration — single sage ring (r=80 stroke 14) + outer ghost ring (r=120 stroke 6 opacity 0.35) + 'Soundly' Georgia italic 140px sage wordmark + 'a calmer alarm' system-ui 42px deep forest tagline on warm sand (#f4f1eb) background. No regeneration iterations needed."
  - "[Phase 10 P04]: Q1 RESOLVED — workbox-core promoted from transitive (resolved 7.4.0 via vite-plugin-pwa@0.21.1) to direct devDep pinned at ^7.4.0; matches sibling pins workbox-precaching/workbox-routing ^7.4.0; immune to future vite-plugin-pwa minor-version upgrades dropping workbox-core as a transitive."
  - "[Phase 10 P04]: D-10 LOCKED versioned filename (og-image-v1.png NOT og-image.png) — defeats Facebook's OG cache on future bumps; Plan 10-05 deploy runbook will document the v1→v2 swap protocol (re-render with new SVG composition, rename to og-image-v2.png, update index.html meta references, trigger Facebook Sharing Debugger force-refresh)."
metrics:
  duration: "executed across 2 sessions (initial 2026-05-19, finalization 2026-05-19)"
  completed: "2026-05-19"
  commits: 4
  files_created: 2
  files_modified: 1
---

# Phase 10 Plan 04: OG Image Generator + Workbox-Core Pin Summary

One-liner: Hand-authored `scripts/generate-og-image.mjs` renders a 1200×630 warm-earth Open Graph share-card to `public/og-image-v1.png` via sharp + SVG (33930 bytes, well under SEO-02's 200 KB cap), `package.json` gains both the `og-image` script entry and a direct `workbox-core: ^7.4.0` devDependency pin (Q1 RESOLVED — replaces transitive resolution that supports Plan 10-03's `clientsClaim` import for SEO-09).

## Objective

Deliver SEO-02 (OG image 1200×630, ≤200 KB) + SEO-08 (versioned filename for cache busting) + the SEO-09 dependency-hygiene support pin (workbox-core as a direct devDep, immune to vite-plugin-pwa minor-version churn). The image is the share-card payload that Slack/iMessage/Facebook/Twitter render — visual quality matters, hence the D-09 LOCKED user-approval checkpoint.

## Tasks Executed

| Task | Name | Commit | Outcome |
|------|------|--------|---------|
| 1 | Write scripts/generate-og-image.mjs | `bad22cb` | 62-line ESM script, sharp+SVG idiom cloned from generate-icons.mjs |
| 2 | Add og-image script + workbox-core ^7.4.0 to package.json | `ca247ee` | +1 script key + 1 devDep key (file remains minified single-line) |
| 3 | Run `npm run og-image` → public/og-image-v1.png | (PNG generated, NOT committed pending D-09 approval) | 33930 bytes, 1200×630, PNG header verified |
| 4 | CHECKPOINT — D-09 user-approval | (paused for user inspection) | User typed `approve` — no regeneration iterations needed |
| Final | Commit approved PNG | `0b162e2` | feat(10-04): commit approved OG image v1 |

## Artifact Verification

Final automated verifier results (all four exit 0):

```
$ node -e "stat=fs.statSync('public/og-image-v1.png'); ..."
OK PNG size: 33930 bytes  (16.6% of 200 KB SEO-02 cap)

$ node -e "sharp('public/og-image-v1.png').metadata()..."
width=1200 height=630 format=png  (matches SEO-02 spec exactly)

$ node -e "/* generator script structural checks */"
OK generator  (sharp import + 1200×630 + og-image-v1.png + all 3 palette hex + sharp idiom + .catch wrapper)

$ node -e "/* package.json structural checks */"
OK package.json  (og-image script + workbox-core ^7.4.0 + sharp preserved + all 5 existing scripts unchanged)
```

## Generator Script Excerpt

```js
import sharp from 'sharp';

const WARM_EARTH_BG = '#f4f1eb';   // --color-bg
const SAGE = '#5c6b56';            // --color-sage
const TEXT_PRIMARY = '#3d4a38';    // --color-text-primary

function createOgSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <rect width="1200" height="630" fill="${WARM_EARTH_BG}"/>
    <circle cx="240" cy="315" r="80" fill="none" stroke="${SAGE}" stroke-width="14"/>
    <circle cx="240" cy="315" r="120" fill="none" stroke="${SAGE}" stroke-width="6" opacity="0.35"/>
    <text x="380" y="305" font-family="Georgia, ... serif" font-size="140" font-style="italic" fill="${SAGE}" ...>Soundly</text>
    <text x="380" y="395" font-family="system-ui, ... sans-serif" font-size="42" fill="${TEXT_PRIMARY}">a calmer alarm</text>
  </svg>`;
}

async function generate() {
  await sharp(Buffer.from(createOgSvg()))
    .png({ compressionLevel: 9 })
    .toFile(outputPath);
  console.log(`Created ${outputPath}`);
}

generate().catch((err) => { console.error(err); process.exit(1); });
```

## package.json Diff Summary

**Before:**
```json
"scripts":{"dev":"vite","build":"tsc -b && vite build","lint":"eslint .","preview":"vite preview","test":"vitest"}
"devDependencies":{..., "vite-plugin-pwa":"^0.21.1","vitest":"^3.1.2","workbox-precaching":"^7.4.0","workbox-routing":"^7.4.0"}
```

**After:**
```json
"scripts":{"dev":"vite","build":"tsc -b && vite build","lint":"eslint .","preview":"vite preview","test":"vitest","og-image":"node scripts/generate-og-image.mjs"}
"devDependencies":{..., "vite-plugin-pwa":"^0.21.1","vitest":"^3.1.2","workbox-core":"^7.4.0","workbox-precaching":"^7.4.0","workbox-routing":"^7.4.0"}
```

Minified single-line format preserved (PATTERNS section requirement). Surgical insertion — no other keys touched.

## D-09 LOCKED Checkpoint Outcome

**Approach:** Per plan-locked D-09, the PNG was generated by Task 3 but NOT staged for commit; execution paused at Task 4 with the path surfaced to the user for inspection in any image viewer.

**User interaction:**
- Generated path: `public/og-image-v1.png` (33930 bytes)
- User opened the file in their image viewer
- User reply: `approve` (no adjustments requested, no regeneration loop entered)
- Commit `0b162e2` landed the approved PNG with explicit user-approval reference in commit body

**Iteration history:** None — first generated composition approved as-is.

**Audit trail:** git history records commit `0b162e2` author + timestamp as the visual-approval audit point per T-10-04-06 mitigation (Repudiation).

## workbox-core Direct-Pin Rationale (Q1 RESOLVED)

`workbox-core` was previously resolved transitively at exactly 7.4.0 via `vite-plugin-pwa@0.21.1`. Plan 10-03 added `import { clientsClaim } from 'workbox-core'` to `src/sw.ts` — a direct ESM import that worked at build time because the transitive package happens to be hoisted to a resolvable location in node_modules.

**Risk pre-pin:** Any future minor-version upgrade of `vite-plugin-pwa` could drop workbox-core as a transitive (or shift it to a non-resolvable nested location), silently breaking the SW build with no package.json signal.

**Mitigation shipped:** `workbox-core: ^7.4.0` now lives directly in `devDependencies` at the same caret-pin as siblings `workbox-precaching` and `workbox-routing` (both already pinned at ^7.4.0). The pin matches what's already installed (`node_modules/workbox-core/package.json` reports 7.4.0). `npm install` is now a no-op for this dep but package-lock.json may have updated metadata (normal side effect of pinning).

This is a defense-in-depth move — it doesn't change current runtime behavior, but it future-proofs the SEO-09 import against transitive-resolution drift. Matches threat T-10-04-07 (Tampering — version drift via transitive resolution).

## SEO-08 Versioned Filename Rationale (D-10 LOCKED)

`og-image-v1.png` (NOT `og-image.png`). Facebook's OG scraper aggressively caches images by URL — once `https://soundly.local/Soundly/og-image.png` is scraped, content swaps at the same URL may take days/weeks to refresh, even with `og:image:updated_time` hints.

**Solution:** Version the filename. When a future phase swaps the image, the file becomes `og-image-v2.png`, the meta tag references the new URL, and Facebook's cache miss forces a fresh scrape. Plan 10-05 deploy runbook will document this swap protocol (re-render via `npm run og-image` with edited filename constant → update `og:image` + `twitter:image` references in `index.html` → trigger Facebook Sharing Debugger force-refresh as belt-and-suspenders).

## Deviations from Plan

None — plan executed exactly as written across two sessions.

The execution naturally spanned two agent sessions because Task 4 is a D-09 LOCKED human-verify checkpoint:
- Session 1 (commits `bad22cb`, `ca247ee`): Tasks 1 + 2 (generator + package.json), then Task 3 ran the generator (PNG written but NOT committed), then paused at Task 4 with the path surfaced for visual approval
- Session 2 (commits `0b162e2`, this metadata commit): User typed `approve`; PNG committed; SUMMARY + STATE + ROADMAP + REQUIREMENTS metadata updated

The session split is the intended D-09 flow, not a deviation. No auto-fixes were triggered. No iterations were requested.

## Requirements Satisfied

| Requirement | Status | Delivered By |
|-------------|--------|--------------|
| SEO-02 (OG image 1200×630, ≤200 KB) | Complete | `public/og-image-v1.png` — 33930 bytes (16.6% of cap), dimensions verified via sharp metadata |
| SEO-08 (versioned filename + deploy-runbook doc) | Complete in this plan; runbook coverage in Plan 10-05 | Filename `og-image-v1.png` shipped; Plan 10-05 documents the Facebook Sharing Debugger force-refresh protocol |
| SEO-09 (workbox-core direct devDep pin supporting clientsClaim import) | Supported here; primary delivery in Plan 10-03 | `workbox-core: ^7.4.0` direct pin replaces transitive resolution; Plan 10-03 commits the actual `clientsClaim` call |

## Self-Check

**Files claimed:**
- `scripts/generate-og-image.mjs` → FOUND (62 lines, sharp + SVG + all 3 palette hex + .catch wrapper)
- `public/og-image-v1.png` → FOUND (33930 bytes, PNG header `89 50 4E 47`, 1200×630)
- `package.json` → FOUND (og-image script + workbox-core ^7.4.0 + sharp preserved + all 5 existing scripts unchanged)
- `.planning/phases/10-seo-meta-json-ld-service-worker-update-infra/10-04-SUMMARY.md` → THIS FILE

**Commits claimed:**
- `bad22cb` (feat(10-04): add scripts/generate-og-image.mjs OG image generator) → FOUND
- `ca247ee` (chore(10-04): add og-image script + pin workbox-core direct devDep) → FOUND
- `0b162e2` (feat(10-04): commit approved OG image v1) → FOUND

## Self-Check: PASSED
