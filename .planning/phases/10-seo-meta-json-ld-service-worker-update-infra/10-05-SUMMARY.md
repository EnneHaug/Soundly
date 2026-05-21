---
phase: 10-seo-meta-json-ld-service-worker-update-infra
plan: 05
subsystem: docs
tags: [docs, deploy, runbook, search-console, og-image, sw-update, operator-playbook]
requirements_completed: [SEO-06, SEO-07, SEO-08, SEO-09]
dependency_graph:
  requires:
    - .planning/phases/10-seo-meta-json-ld-service-worker-update-infra/10-CONTEXT.md (D-23, D-28, specifics)
    - .planning/phases/10-seo-meta-json-ld-service-worker-update-infra/10-RESEARCH.md (Findings 6, 7, 10, 11; Pitfalls 1, 3, 4, 5, 6)
    - index.html (5 placeholder occurrences documented)
    - public/robots.txt (1 placeholder occurrence documented)
    - public/sitemap.xml (2 placeholder occurrences documented)
    - public/og-image-v1.png (Plan 10-04 artifact referenced in OG regeneration section)
    - vite.config.ts registerType: 'autoUpdate' + src/sw.ts clientsClaim (Plan 10-03 — referenced in SW smoke-test section)
  provides:
    - docs/deploy-runbook.md (9-section operator playbook; 278 lines)
    - docs/ top-level directory (new — first non-icon static doc dir in repo)
    - documented canonical-URL find/replace command (POSIX sed + PowerShell variants)
    - documented Search Console manual sitemap submission flow (primary discoverability path)
    - documented Facebook Sharing Debugger force-refresh flow (SEO-08)
    - documented SW update smoke test (the only end-to-end SEO-09 verification per Finding 10)
    - documented Pitfall 1/3/4/5/6 cross-references for future-maintainer safety
  affects:
    - Plan 10-06 (final phase verification) — runbook is the documentation surface that 10-06's automated tests complement, not replace
    - Phase 11 (multi-page split) — runbook will need a follow-up edit when SW scope rescopes to /app
tech-stack:
  added: []
  patterns:
    - Self-contained operator playbook in single Markdown file (no .planning/ cross-links in user-facing content)
    - Cross-platform shell-command pairs (POSIX sed + PowerShell Get-Content) for Windows-dev / Linux-CI compat
    - Numbered linear section ordering IS the quickstart (per plan-locked anti-TL;DR rule)
key-files:
  created:
    - docs/deploy-runbook.md (278 lines, 9 numbered sections)
  modified: []
decisions:
  - "[Phase 10 P05]: docs/ is the first top-level non-icon documentation directory in the repo; chose this over appending to a top-level DEPLOY.md per CONTEXT D-28 Claude's Discretion + PATTERNS.md recommendation (single-purpose file, clean top-level)"
  - "[Phase 10 P05]: Runbook uses literal `https://soundly.local/Soundly/` in command examples (not abstract `<DEPLOY_URL>`) so operator can copy-paste find/replace verbatim; surfaces the placeholder string concretely"
  - "[Phase 10 P05]: Both sed (POSIX) AND PowerShell Get-Content variants documented because Soundly dev env is Windows + GitHub Pages deploy will run on GitHub Actions Linux runner — operator needs working command for either shell (T-10-05-01 Tampering mitigation)"
  - "[Phase 10 P05]: Search Console manual sitemap submission documented as PRIMARY discoverability path (not best-effort fallback) per v2.0 ROADMAP Hosting decision — GitHub Pages does not auto-discover sitemaps at subpath sites (RESEARCH Finding 6)"
  - "[Phase 10 P05]: SW update smoke test documented as the ONLY end-to-end SEO-09 verification — Vitest/jsdom cannot emulate ServiceWorkerGlobalScope across a real install/redeploy/relaunch lifecycle (RESEARCH Finding 10); Plan 10-06's automated tests cover source-regex tier only"
  - "[Phase 10 P05]: Pitfall 6 (Google Rich Results 'not eligible') explicitly documented in section 5 so future maintainers do not interpret the expected outcome as a regression — schema is valid, WebApplication just is not in Google's rich-result-eligible type list"
metrics:
  duration: "~14 minutes (single session)"
  completed: "2026-05-21"
  commits: 1
  files_created: 1
  files_modified: 0
---

# Phase 10 Plan 05: Deploy Runbook Summary

One-liner: New `docs/deploy-runbook.md` (278 lines, 9 numbered sections) — self-contained operator playbook documenting canonical-URL placeholder swap (POSIX sed + PowerShell variants), OG image regeneration + D-09 approval flow, Search Console manual sitemap submission (primary discoverability path), Facebook Sharing Debugger force-refresh, SW update smoke test (the only end-to-end SEO-09 verification per Finding 10), and cross-references to Pitfalls 1/3/4/5/6 — closing the D-28 LOCKED requirement for Phase 10.

## Objective

Author the operator playbook that downstream plans (01-04) reference. Without this runbook the user has six committed files with placeholder URLs and no recorded procedure for swapping them, submitting the sitemap, or verifying the SW update behavior end-to-end. Closes the D-28 LOCKED requirement.

## Tasks Executed

| Task | Name | Commit | Outcome |
|------|------|--------|---------|
| 1 | Author docs/deploy-runbook.md (D-28 LOCKED content) | `c1bfbfe` | 278 lines, 9 numbered sections, all 17 verifier content fragments present |

## 9 Section Titles

1. Pre-deploy: swap placeholder canonical URL
2. Pre-deploy: generate / accept OG image
3. Build
4. Deploy
5. Post-deploy: verify static SEO meta
6. Post-deploy: Search Console manual sitemap submission
7. Post-deploy: force-refresh Facebook Sharing Debugger
8. Post-deploy: SW update smoke test (when meta or SW changes)
9. Maintenance notes

## Verifier Confirmation — All 17 Content Fragments Present

The plan's `node -e` automated verifier exits 0 with output `OK -- 278 lines`. All 17 regex checks pass:

| # | Check | Status |
|---|-------|--------|
| 1 | `soundly.local` placeholder | OK |
| 2 | `sed -i.bak` POSIX command | OK |
| 3 | `Get-Content` PowerShell variant | OK |
| 4 | `npm run og-image` script reference | OK |
| 5 | Facebook Sharing Debugger URL (`developers.facebook.com/tools/debug`) | OK |
| 6 | Google Search Console URL (`search.google.com/search-console`) | OK |
| 7 | Schema.org Validator URL (`validator.schema.org`) | OK |
| 8 | Google Rich Results Test URL (`search.google.com/test/rich-results`) | OK |
| 9 | `view-source:` warning (vs DevTools) | OK |
| 10 | `DevTools Elements` warning | OK |
| 11 | Pitfall 4 JSON-LD `</script>` maintenance rule | OK |
| 12 | SW smoke test references `skipWaiting` / `clientsClaim` | OK |
| 13 | 200 KB cap (`200 KB` or `204800`) | OK |
| 14 | `/app/` forward-compat tradeoff (D-21) | OK |
| 15 | "not eligible for rich results" caveat (Pitfall 6) | OK |
| 16 | Manual sitemap submission as Search Console step | OK |
| 17 | vite-plugin-pwa 0.21 / 1.x pin warning (Pitfall 5) | OK |

Also verified independently: all 4 cross-referenced pitfalls (Pitfall 1, 3, 4, 6) appear as literal substrings.

## Deploy-Runbook Coverage Map (per plan must_haves)

| must_have | Section in runbook |
|-----------|---------------------|
| Pre-deploy / Deploy / Post-deploy sections (D-28) | Sections 1-3 / 4 / 5-8 |
| Placeholder URL swap with exact find/replace commands (D-23 + Finding 7) | Section 1 (POSIX + PowerShell + sanity-check grep) |
| OG image regeneration + D-09 approval flow | Section 2 (`npm run og-image` + image-viewer inspection + iterate-on-feedback) |
| Search Console manual sitemap submission as PRIMARY path (v2.0 Hosting decision) | Section 6 (3-step verify-ownership + submit-sitemap flow) |
| Facebook Sharing Debugger force-refresh for OG content changes (D-28 step 5, SEO-08) | Section 7 (3-condition trigger list + 5-step debug flow) |
| SW update smoke test (Finding 10) | Section 8 (close + relaunch test + title-bump verification + 3-step troubleshooting) |
| Google Rich Results 'not eligible' caveat (Pitfall 6) | Section 5 step 3 (explicit "This is NOT an error" callout) |
| JSON-LD `</script>` maintenance rule (Pitfall 4) | Section 9 (Editing JSON-LD description content) |

## Closes D-28 LOCKED Requirement

CONTEXT.md D-28 mandates a deploy runbook documenting:
1. **Canonical URL swap** — covered in Section 1 (sed + PowerShell + sanity-check grep, three files enumerated with occurrence counts)
2. **OG image generate + accept** — covered in Section 2 (D-09 inspection flow + iterate-on-feedback + versioned-filename rationale)
3. **Build + deploy** — covered in Sections 3 + 4 (npm run build + grep gates + deploy-mechanism-is-implementation-defined)
4. **Search Console manual sitemap submission** — covered in Section 6 (primary discoverability path, not fallback)
5. **Facebook Sharing Debugger force-refresh** — covered in Section 7 (force-refresh trigger conditions + 5-step flow)

All five D-28 mandates landed in a single file. Plan 10-06's automated tests will provide complementary source-regex coverage; this runbook covers the operator-procedure surface that source tests structurally cannot.

## Load-Bearing Manual Steps Documented Here

| Requirement | Why this runbook is the delivery vehicle |
|-------------|------------------------------------------|
| **SEO-06** (robots.txt + sitemap) | Sitemap submission to Search Console is manual on GitHub Pages subpath sites (Finding 6); runbook Section 6 IS the implementation |
| **SEO-08** (versioned OG filename + FB cache busting) | Facebook Sharing Debugger force-refresh is manual; runbook Section 7 IS the implementation |
| **SEO-09** (SW auto-update delivers fresh meta) | End-to-end verification requires real device + real cross-deploy lifecycle (Finding 10); runbook Section 8 IS the verification protocol |

## Threat Surface Coverage

Per plan `<threat_model>`:

- **T-10-05-01 (Tampering — wrong commands)** — mitigated: both POSIX sed AND PowerShell Get-Content variants documented; URL placeholder is literal `https://soundly.local/Soundly/` (not abstract), find/replace commands are copy-pasteable
- **T-10-05-04 (DoS — bad sed corrupts files)** — mitigated: sed command uses `-i.bak` (creates backup); sanity-check grep step verifies the swap before deploy
- **T-10-05-06 (EoP — runbook misleads operator)** — mitigated: Pitfall 1 (view-source vs DevTools), Pitfall 4 (JSON-LD `</script>`), Pitfall 6 (Rich Results "not eligible") all explicitly documented so operator does not chase non-bugs
- T-10-05-02 / T-10-05-03 / T-10-05-05 — accept (solo-dev project, public-friendly procedures, well-known external services, git history is the audit trail)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed table summary count from "six occurrences" to "eight occurrences"**
- **Found during:** Task 1 authoring
- **Issue:** The plan's verbatim runbook content opened with "**Three files, six occurrences:**" but the immediately following table totaled 5 + 1 + 2 = 8 occurrences (the 5-count cell parenthetically listed 6 items but counted to 5; sitemap had 2; robots had 1). "Six" did not match either the cell-count sum (8) nor the parenthetical-item sum (9). The actual on-disk occurrence count is 8 (verified via `grep -c soundly.local` against `index.html`, `public/robots.txt`, `public/sitemap.xml`).
- **Fix:** Changed summary header to "**Three files, eight occurrences:**" so the prose matches the table arithmetic and matches the real file state.
- **Files modified:** `docs/deploy-runbook.md` (the file under creation in this task)
- **Commit:** `c1bfbfe` (single-task commit covers the fix)

**2. [Rule 1 - Bug] Cleaned up redundant item in occurrence-count parenthetical**
- **Found during:** Same authoring pass
- **Issue:** The plan's verbatim table cell for index.html read "5 (canonical link, og:url, og:image, twitter:image, JSON-LD url, og:image)" — `og:image` appeared twice, which is wrong (there is one `og:image` in the static meta block at line 19 of index.html, and one `twitter:image` at line 24; the JSON-LD does not have an og:image field).
- **Fix:** Wrote it as "5 (canonical link, og:url, og:image, twitter:image, JSON-LD url)" — five distinct items matching the count.
- **Files modified:** `docs/deploy-runbook.md`
- **Commit:** `c1bfbfe`

Both fixes are Rule 1 (factual bugs in commit-able text) and are documented for transparency. No architectural changes; no plan re-litigation needed.

## Self-Check

**Files claimed:**
- `docs/deploy-runbook.md` → FOUND (278 lines)
- `.planning/phases/10-seo-meta-json-ld-service-worker-update-infra/10-05-SUMMARY.md` → THIS FILE

**Commits claimed:**
- `c1bfbfe` (docs(10-05): add deploy runbook (D-28 LOCKED operator playbook)) → FOUND

**Verifier exit code:** 0 (`OK -- 278 lines`)

**Section count:** 9 numbered top-level sections (matches plan success criterion)

**Pitfalls cross-referenced:** 4 (Pitfall 1, 3, 4, 6) — verified by literal-substring grep

## Self-Check: PASSED
