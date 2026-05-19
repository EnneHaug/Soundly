---
phase: 10-seo-meta-json-ld-service-worker-update-infra
plan: 01
subsystem: seo
tags: [seo, meta, open-graph, twitter-card, json-ld, schema-org, html, static-html]

# Dependency graph
requires:
  - phase: 09-segment-composer-share-url
    provides: shipped v2.0 app skeleton (index.html + Composer + share URL) — Phase 10 layers SEO meta on top
provides:
  - Static <title>, <meta name="description">, 5 Open Graph tags, 4 Twitter Card tags, canonical link, JSON-LD WebApplication block in index.html
  - Placeholder canonical base URL "https://soundly.local/Soundly/" — to be swapped per Plan 05 deploy runbook
  - All 7 D-26-preserved tags (charset, viewport, theme-color, 3 apple-mobile-web-app-*, apple-touch-icon) confirmed byte-identical
affects:
  - 10-02 (robots.txt) — shares canonical base URL placeholder
  - 10-03 (sitemap.xml) — shares canonical base URL placeholder
  - 10-04 (OG image generation) — og:image URL pins to /Soundly/og-image-v1.png
  - 10-05 (deploy runbook) — documents the placeholder URL swap before publishing
  - 10-06 (build verification + SW autoUpdate) — verifies dist/index.html ships meta as static HTML

# Tech tracking
tech-stack:
  added: []  # no new libraries — pure HTML edit
  patterns:
    - "Static-not-React SEO meta contract — all OG/Twitter/JSON-LD lives in index.html literally; verified by view-source: not DevTools Elements"
    - "Placeholder canonical URL committed verbatim — single substring to find/replace at deploy time"
    - "Minimal JSON-LD WebApplication schema (7 keys, no aggregateRating per D-13)"

key-files:
  created: []
  modified:
    - index.html

key-decisions:
  - "[Phase 10 P01]: All SEO meta lives statically in index.html per D-06/D-24/Pitfall 1 — never React-injected. Verified by 575/575 tests passing (no React render path touched)."
  - "[Phase 10 P01]: Placeholder canonical URL https://soundly.local/Soundly/ committed verbatim per D-23 — appears in exactly 5 places (canonical, og:image, og:url, twitter:image, json-ld url). Plan-text count of '6' was a typo (listed og:image twice); CONTEXT.md <specifics> source of truth has 5."
  - "[Phase 10 P01]: All 7 D-26-preserved tags (charset/viewport/theme-color/3 apple-mobile-web-app-*/apple-touch-icon) confirmed byte-identical via git diff — no - lines on those line numbers; only the <title> line was replaced (1 deletion, 29 insertions in head)."
  - "[Phase 10 P01]: JSON-LD block has exactly 7 keys (@context, @type, name, description, applicationCategory, operatingSystem, url) — no aggregateRating, no offers per D-13 Google manual-action risk avoidance."

patterns-established:
  - "Pattern: SEO meta in index.html literally — search for og:title via `grep og:title index.html` should return exactly 1 match in v2.0; this is the contract that future plans (Phase 11 multi-page split) must honor."
  - "Pattern: em-dash U+2014 in user-facing strings (<title>, meta description) — not two ASCII hyphens. Source-of-truth verbatim CONTEXT D-01/D-02 strings."
  - "Pattern: D-26 byte-identical guardrail for the 7 existing PWA meta tags — Phase 10 ADDS but never MODIFIES."

requirements-completed: [SEO-01, SEO-02, SEO-03, SEO-04, SEO-05]

# Metrics
duration: 3m 22s
completed: 2026-05-19
---

# Phase 10 Plan 01: Static SEO Meta + JSON-LD Block in index.html Summary

**Static title rewrite, 5 OG tags, 4 Twitter Card tags, canonical link, and a minimal WebApplication JSON-LD block landed verbatim from CONTEXT D-01..D-05 + D-12 — all 7 existing PWA meta tags preserved byte-identical per D-26.**

## Performance

- **Duration:** 3m 22s
- **Started:** 2026-05-19T19:38:32Z
- **Completed:** 2026-05-19T19:42:00Z (approx)
- **Tasks:** 1 / 1
- **Files modified:** 1 (index.html)

## Accomplishments
- Title rewritten to D-01 string `Soundly — a calmer alarm that alerts you gently` (em-dash U+2014)
- 15 new head tags appended verbatim from CONTEXT D-* / `<specifics>`: 1 description, 1 canonical, 5 OG, 4 Twitter Card, 1 JSON-LD script
- JSON-LD WebApplication schema with `applicationCategory: "UtilitiesApplication"` — parses cleanly via `JSON.parse`, no aggregateRating per D-13
- All 7 D-26-preserved tags (charset, viewport, theme-color, 3 apple-mobile-web-app-*, apple-touch-icon) confirmed byte-identical via git diff — only the `<title>` line was replaced

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite title + append SEO/OG/Twitter/canonical/JSON-LD meta block to index.html** — `9bd19f5` (feat)

## Files Created/Modified

- `index.html` — added 29 lines, replaced 1 line (`<title>`); net +29 lines in `<head>`. Lines 1-10 untouched (the 7 D-26-preserved tags); lines 11-39 are the new SEO block; line 40 is the rewritten title; lines 41-46 are the unchanged body.

### Verbatim diff excerpt (git diff HEAD~1 HEAD -- index.html)

```diff
@@ -8,7 +8,36 @@
     <meta name="apple-mobile-web-app-status-bar-style" content="default" />
     <meta name="apple-mobile-web-app-title" content="Soundly" />
     <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
-    <title>Soundly</title>
+    <!-- SEO meta (Phase 10) -->
+    <meta name="description" content="A free alarm app with soft sounds, vibration, or full volume — fully customizable. No accounts, no ads. Just share your setup. PWA — installs anywhere." />
+    <link rel="canonical" href="https://soundly.local/Soundly/" />
+
+    <!-- Open Graph -->
+    <meta property="og:type" content="website" />
+    <meta property="og:title" content="Soundly — gentle alarm" />
+    <meta property="og:description" content="A free alarm app with soft sounds or vibration or full volume - fully customizable. No accounts, no ads, just share your alarm setup. Progressive Web App (PWA), install on phone or desktop." />
+    <meta property="og:image" content="https://soundly.local/Soundly/og-image-v1.png" />
+    <meta property="og:url" content="https://soundly.local/Soundly/" />
+
+    <!-- Twitter Card -->
+    <meta name="twitter:card" content="summary_large_image" />
+    <meta name="twitter:title" content="Soundly — gentle alarm" />
+    <meta name="twitter:description" content="A free alarm app with soft sounds or vibration or full volume - fully customizable. No accounts, no ads, just share your alarm setup. Progressive Web App (PWA), install on phone or desktop." />
+    <meta name="twitter:image" content="https://soundly.local/Soundly/og-image-v1.png" />
+
+    <!-- JSON-LD (D-12) -->
+    <script type="application/ld+json">
+    {
+      "@context": "https://schema.org",
+      "@type": "WebApplication",
+      "name": "Soundly Gentle Alarm",
+      "description": "A free alarm app with soft sounds or vibration or full volume - fully customizable. No accounts, no ads, just share your alarm setup. Progressive Web App (PWA), install on phone or desktop.",
+      "applicationCategory": "UtilitiesApplication",
+      "operatingSystem": "Web Browser",
+      "url": "https://soundly.local/Soundly/"
+    }
+    </script>
+    <title>Soundly — a calmer alarm that alerts you gently</title>
   </head>
```

Lines 4-10 (the 7 D-26-preserved tags) are absent from the diff — confirmation they are byte-identical to v1.

### Placeholder canonical URL — appears in 5 places (NOT 6 as plan-text claimed)

The PLAN.md task `<done>` clause says "Placeholder URL appears in exactly 6 places (canonical, og:image, og:url, twitter:image, og:image, json-ld url)" — that list contains `og:image` twice (typo). The CONTEXT.md `<specifics>` verbatim block (source of truth) has exactly 5 distinct occurrences, and the implementation matches:

```
index.html:13:    <link rel="canonical" href="https://soundly.local/Soundly/" />
index.html:19:    <meta property="og:image" content="https://soundly.local/Soundly/og-image-v1.png" />
index.html:20:    <meta property="og:url" content="https://soundly.local/Soundly/" />
index.html:26:    <meta name="twitter:image" content="https://soundly.local/Soundly/og-image-v1.png" />
index.html:37:      "url": "https://soundly.local/Soundly/"
```

**5 occurrences across 5 lines.** All to be swapped per Plan 05 deploy runbook before publishing.

## Decisions Made

- **JSON-LD `description` uses the longer OG-style copy, not the 155-char meta-description.** CONTEXT D-* / `<specifics>` block verbatim. Rationale: JSON-LD has no character cap; the longer copy surfaces more keywords to Google.
- **JSON-LD operatingSystem = "Web Browser"** per CONTEXT `<specifics>` verbatim — matches the PWA-only delivery channel.
- **Placeholder count discrepancy with plan text resolved in favor of CONTEXT.md `<specifics>`** (5 occurrences, not 6). The plan's parenthetical listed og:image twice — a transcription typo. The CONTEXT verbatim block is the locked source of truth. Documented above.

## Deviations from Plan

None - plan executed exactly as written against the CONTEXT `<specifics>` source-of-truth block. The placeholder-URL-count discrepancy (5 vs 6) was a typo in the plan's `<done>` clause, not a deviation; the implementation matches the CONTEXT verbatim block.

## Issues Encountered

- **`npm run lint` fails — eslint not installed locally.** Pre-existing environment condition: `package.json scripts.lint` references `eslint`, but `eslint` is not in `devDependencies` and no `node_modules/.bin/eslint` binary exists. This is unrelated to Plan 10-01 (no TS or config touched). Logged out-of-scope per deviation rules; will surface for the user to address before deploy if they intend to run lint as a CI gate. Test suite (`npm test -- --run`) passes 575/575 with zero regressions.

## Verification Evidence

```
node -e "<verifier from PLAN.md Task 1>" → "OK"
JSON-LD keys: ['@context','@type','name','description','applicationCategory','operatingSystem','url']
Has aggregateRating: false
Has offers: false
Placeholder URL count: 5
Title: "Soundly — a calmer alarm that alerts you gently"

npm test -- --run:
 Test Files  42 passed (42)
      Tests  575 passed (575)
```

## User Setup Required

**Reminder for the user:** The placeholder canonical URL `https://soundly.local/Soundly/` is committed verbatim in `index.html` (5 occurrences). Plan 05 (deploy runbook) will document the substring find/replace to the actual deploy URL before publishing. Do NOT deploy this commit to a public host without first swapping the placeholder — OG scrapers and Google would index the fake domain.

## Next Phase Readiness

- **Plan 10-02 (robots.txt) unblocked** — same placeholder canonical base URL convention established here.
- **Plan 10-03 (sitemap.xml) unblocked** — same placeholder convention.
- **Plan 10-04 (OG image generation) unblocked** — `og:image` content URL is locked at `https://soundly.local/Soundly/og-image-v1.png`; the generator script must produce `public/og-image-v1.png` (so `dist/og-image-v1.png` after build).
- **Plan 10-05 (deploy runbook) consumer** — must document the 5-occurrence placeholder swap in `index.html` (plus robots.txt + sitemap.xml occurrences from Plans 02/03).
- **Plan 10-06 (build verification + SW autoUpdate)** — must include `grep "og:title" dist/index.html` returning 1 match as a build-verification gate.

## Self-Check: PASSED

- `index.html` exists at C:\Users\Admin\Documents\Repos\Soundly\index.html — FOUND
- Commit `9bd19f5` exists in git log — FOUND
- Title rewrite present: `<title>Soundly — a calmer alarm that alerts you gently</title>` — FOUND
- JSON-LD parses cleanly with `@type: WebApplication`, `applicationCategory: UtilitiesApplication` — VERIFIED
- 7 D-26-preserved tags byte-identical (no `-` lines on those line numbers in git diff) — VERIFIED
- 575/575 tests passing post-change — VERIFIED

---
*Phase: 10-seo-meta-json-ld-service-worker-update-infra*
*Completed: 2026-05-19*
