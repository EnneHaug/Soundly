---
status: partial
phase: 10-seo-meta-json-ld-service-worker-update-infra
source: [10-VERIFICATION.md]
started: 2026-05-21
updated: 2026-05-21
---

## Current Test

[awaiting human testing — all 5 items are inherently post-deploy]

## Tests

### 1. Live Slack + iMessage OG share preview (SC #5)
expected: Sharing the deployed URL into Slack and iMessage renders the title `Soundly — gentle alarm`, the og:description tagline, and the warm-earth `og-image-v1.png` thumbnail.
result: [pending]

### 2. Google Rich Results + Schema.org Validator zero-error pass (SC #2)
expected: Pasting the deployed URL into https://search.google.com/test/rich-results and https://validator.schema.org/ both return zero errors with at least one detected eligible @type (WebApplication). `aggregateRating` absent.
result: [pending]

### 3. view-source: on deployed page shows full static SEO block (SC #1)
expected: Navigating to `view-source:<deploy-url>` (NOT DevTools Elements) shows the title, meta description, OG tags, Twitter card, canonical link, and `<script type="application/ld+json">` block as plain static HTML — none injected by React.
result: [pending]

### 4. SW auto-update smoke test on installed PWA (SC #4)
expected: Install the app on a phone, change any visible string in `index.html`, redeploy, relaunch the installed PWA — the new content appears on next launch without a manual reload. Confirms `registerType: 'autoUpdate'` + `skipWaiting()` + `clientsClaim()` deliver updated meta to installed users.
result: [pending]

### 5. Search Console manual sitemap submission (SC #3)
expected: After deploy, sign into Google Search Console for the deploy host, submit `<deploy-url>/sitemap.xml` manually (GH Pages does not auto-discover). Confirm submission accepted; track indexing over the following days.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
