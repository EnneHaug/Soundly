---
phase: 10-seo-meta-json-ld-service-worker-update-infra
plan: 02
subsystem: infra
tags: [seo, robots, sitemap, public-asset, gh-pages]

# Dependency graph
requires:
  - phase: 10-seo-meta-json-ld-service-worker-update-infra
    provides: "Plan 10-01 established the locked placeholder URL https://soundly.local/Soundly/ in index.html; Plan 10-02 mirrors that placeholder in robots.txt + sitemap.xml so the same find/replace covers all three files at deploy time."
provides:
  - "public/robots.txt — crawler directive (Allow: /) + Sitemap reference (74 bytes)"
  - "public/sitemap.xml — sitemaps.org v0.9 XML with 2 <url> entries: landing + /app deep link (440 bytes)"
  - "Three locked placeholder URL occurrences (1 in robots.txt, 2 in sitemap.xml) for Plan 10-05 deploy-runbook to swap"
  - "Vite public/ passthrough → both files ship byte-identical to dist/ on npm run build (covered by Plan 10-06 build test)"
affects:
  - "10-05 (deploy runbook) — must document the canonical-URL swap covering both files"
  - "10-06 (build/test verification) — XML well-formedness test + dist passthrough test will assert both files"
  - "11-* (multi-page landing/app split) — /app/ loc becomes live; sitemap forward-compat already in place"

# Tech tracking
tech-stack:
  added: []  # No new deps (D-22 — vite-plugin-sitemap explicitly rejected)
  patterns:
    - "Vite public/ passthrough for non-icon static assets (first non-PNG content in public/)"
    - "Hand-authored XML for sitemap (10 lines, no plugin) — replaces transitive-dep alternatives"
    - "Locked-placeholder canonical URL pattern (https://soundly.local/Soundly/) extended from index.html to sitemap.xml + robots.txt — three files, one find/replace at deploy"

key-files:
  created:
    - "public/robots.txt — 74 bytes, 3 lines + trailing newline"
    - "public/sitemap.xml — 440 bytes, 16 lines, sitemaps.org v0.9 schema"
  modified: []

key-decisions:
  - "robots.txt has no Disallow directives — Soundly has no private paths (no /admin, no auth, no /internal); listing private paths in robots.txt is itself a disclosure anti-pattern per threat T-10-02-01"
  - "sitemap.xml /app/ URL is forward-compat for Phase 11 — pre-Phase-11 it 404s; Search Console flags as 'discovered but not indexed' without penalty (D-21 intentional tradeoff per threat T-10-02-02)"
  - "Both files use locked placeholder https://soundly.local/Soundly/ (D-23) — deferred to Plan 10-05 deploy-runbook for swap; total 3 placeholder occurrences in this plan's files"
  - "No vite-plugin-sitemap dependency added (D-22) — 10 lines of hand-authored XML beats a transitive dep for a static 2-URL site"
  - "<lastmod>2026-05-16</lastmod> locked per D-22 — manually bumped on subsequent meta changes per deploy runbook; no plugin automation"

patterns-established:
  - "Static-asset placement: Vite copies every file in public/ to dist/ byte-for-byte at the configured base path (/Soundly/) — proven by existing public/icons/*.png and now extended to text + XML content"
  - "Trailing newline + LF line endings + no BOM for all hand-authored text/XML in public/ (POSIX convention; preserved in repo blob via .gitattributes — verified blob bytes match working-tree bytes after the git CRLF autoconversion warning)"

requirements-completed: [SEO-06, SEO-07]

# Metrics
duration: 2min
completed: 2026-05-19
---

# Phase 10 Plan 02: robots.txt + sitemap.xml Static Assets Summary

**Hand-authored robots.txt (Allow: / + Sitemap line) and sitemaps.org v0.9 sitemap.xml (landing + forward-compat /app/) added to public/ with locked placeholder canonical URL for Plan 05 deploy-runbook swap — zero new dependencies, ready for Vite public/ passthrough.**

## Performance

- **Duration:** 2 min 2 sec
- **Started:** 2026-05-19T19:45:54Z
- **Completed:** 2026-05-19T19:47:56Z
- **Tasks:** 2 / 2
- **Files created:** 2

## Accomplishments

- `public/robots.txt` shipped: 3 lines of verbatim D-20 content + trailing newline. Covers SEO-06.
- `public/sitemap.xml` shipped: sitemaps.org v0.9 XML with two `<url>` entries (landing at priority 1.0, `/app/` deep link at priority 0.8). Covers SEO-07.
- Both files use locked placeholder URL `https://soundly.local/Soundly/` (D-23) — three total occurrences in this plan's files (1 in robots.txt, 2 in sitemap.xml) for Plan 10-05 deploy-runbook to document the swap.
- Well-formedness asserted via jsdom DOMParser (`urlset` root, sitemaps.org/0.9 namespace, 2 `<url>` entries) — Plan 10-06 will harden this into a vitest test.
- Zero new dependencies — D-22's explicit rejection of `vite-plugin-sitemap` / `vite-plugin-robots` honored.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create public/robots.txt (verbatim from D-20)** — `65396e1` (feat)
2. **Task 2: Create public/sitemap.xml (verbatim from D-21/D-22)** — `eb74ab4` (feat)

**Plan metadata commit:** (pending — will include this SUMMARY.md, STATE.md, ROADMAP.md, REQUIREMENTS.md)

## Files Created/Modified

### Created

- `public/robots.txt` — 74 bytes, 3 lines + trailing newline, LF, no BOM. Crawl directive (`User-agent: *` / `Allow: /`) + Sitemap reference pointing at the placeholder canonical URL. Served at `<host>/Soundly/robots.txt` post-deploy.
- `public/sitemap.xml` — 440 bytes, 16 lines, 2-space indentation, LF, no BOM. XML declaration + sitemaps.org v0.9 namespace + 2 `<url>` blocks (loc + lastmod=2026-05-16 + changefreq=monthly + priority). Served at `<host>/Soundly/sitemap.xml` post-deploy.

### Modified

- None.

## Decisions Made

All decisions inherited verbatim from Phase 10 CONTEXT.md (D-20, D-21, D-22, D-23) and the threat register (T-10-02-01..06). No execution-time decisions beyond confirming the LF-no-BOM convention and choosing `jsdom`'s `DOMParser` (already in devDependencies) for the well-formedness sanity check.

Key takeaways for downstream agents:

- **Three placeholder URL occurrences across this plan's files** (1 in robots.txt + 2 in sitemap.xml). When Plan 10-05's deploy runbook lists "find/replace `https://soundly.local/Soundly/` → actual deploy URL", these are the locations in this plan's deliverables. (Plan 10-01 added more occurrences in `index.html`; the full deploy swap covers all of them.)
- **The `/app/` URL in sitemap intentionally 404s pre-Phase-11.** Search Console will flag it "discovered but not indexed" with no penalty; when Phase 11 lands the multi-page split, Google re-crawls and indexes it without any sitemap edit.
- **No `Disallow:` in robots.txt by design.** Listing private paths to keep them out of indexes would disclose them (anti-pattern); Soundly has no private paths to disclose anyway (no admin, no auth, no `/internal/*`).

## Deviations from Plan

None — plan executed exactly as written. Both tasks completed in order with verbatim CONTEXT-locked content. No Rule 1/2/3 auto-fixes triggered, no Rule 4 architectural decisions needed.

## Issues Encountered

- **Git CRLF autoconversion warning on commit** ("LF will be replaced by CRLF the next time Git touches it") for both `public/robots.txt` and `public/sitemap.xml`. Verified that the committed blobs (`git cat-file -p HEAD:public/...`) preserve LF — 74 bytes for robots.txt, 440 bytes for sitemap.xml, no `0x0D` byte present. The warning is purely about working-tree checkout behavior on Windows, not the committed content. No action required; production builds run on Linux/CI where the working tree matches the blob.
- **No external XML parser dep (`xml2js`, `@xmldom/xmldom`) in node_modules.** Used `jsdom`'s `DOMParser` (already in devDependencies via Vitest's `jsdom` test environment) for the equivalent well-formedness validation per the success criteria's "or equivalent XML validation". Returned: root `urlset`, namespace `http://www.sitemaps.org/schemas/sitemap/0.9`, `<url>` count = 2, no parsererror nodes.

## Threat Surface Coverage

All three "mitigate" dispositions in the plan's `<threat_model>` are addressed by the as-shipped files:

- **T-10-02-01 (Info Disclosure — robots.txt):** robots.txt lists no private paths; `Allow: /` is intentionally permissive (no admin/auth/internal routes to hide). Verified.
- **T-10-02-03 (Tampering — XML structure):** XML well-formedness asserted via jsdom DOMParser (XML decl + sitemaps.org/0.9 namespace + exactly 2 `<loc>` entries with exact values: `https://soundly.local/Soundly/` and `https://soundly.local/Soundly/app/`). Plan 10-06 will harden into a vitest test per the threat register's mitigation note.
- **T-10-02-05 (DoS — hand-edits):** `<lastmod>2026-05-16</lastmod>` is a regex-safe substring for any future deploy-runbook bump; sitemap structure is shallow and predictable.

No new security-relevant surface introduced outside the threat model.

## User Setup Required

None for this plan in isolation. The Phase 10 deploy runbook (Plan 10-05) will document:

- Swap placeholder `https://soundly.local/Soundly/` → actual deploy URL in `public/robots.txt` (1 occurrence) and `public/sitemap.xml` (2 occurrences) — total 3 occurrences in this plan's files (plus the ones Plan 10-01 added in `index.html`).
- Submit `sitemap.xml` manually to Google Search Console after deploy (GitHub Pages does not auto-discover).

## Next Phase Readiness

- Plans 10-03 (sw.ts update infra), 10-04 (OG image generator), 10-05 (deploy runbook), and 10-06 (build/test verification) are unblocked.
- Plan 10-05's deploy runbook can now reference the concrete file paths + placeholder occurrence count documented above.
- Plan 10-06's build test can rely on `public/robots.txt` and `public/sitemap.xml` being present at the repo paths above; the Vite passthrough means `dist/robots.txt` and `dist/sitemap.xml` should be byte-identical after `npm run build` (Plan 10-06 will assert this).
- No blockers introduced. Both files are 100% static and have no runtime dependencies.

## Self-Check: PASSED

- FOUND: `public/robots.txt` (74 bytes, LF, no BOM, verbatim D-20)
- FOUND: `public/sitemap.xml` (440 bytes, LF, no BOM, well-formed XML, verbatim D-21/D-22)
- FOUND: commit `65396e1` (`feat(10-02): add public/robots.txt with Allow + Sitemap directives`)
- FOUND: commit `eb74ab4` (`feat(10-02): add public/sitemap.xml with landing + /app URLs`)
- FOUND: Plan automated verifiers both exit 0 (robots.txt regex match, sitemap.xml structure match)
- FOUND: jsdom XML well-formedness validation succeeds (root `urlset`, sitemaps.org/0.9 namespace, 2 `<url>` entries)
- FOUND: zero new entries in `package.json` (D-22 honored — no `vite-plugin-sitemap`)

---
*Phase: 10-seo-meta-json-ld-service-worker-update-infra*
*Completed: 2026-05-19*
