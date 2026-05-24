---
status: partial
phase: 11-multi-page-split-landing-page
source: [11-VERIFICATION.md]
started: 2026-05-24
updated: 2026-05-24
---

## Current Test

[awaiting human testing — all 12 items are inherently post-deploy or on-device]

## Tests

### 1. Lighthouse PWA + SEO ≥ 90 on mobile for landing `/`
expected: Run Lighthouse Mobile audit on the deployed landing page URL. Performance, Accessibility, Best Practices, SEO, and PWA categories each score ≥ 90.
result: [pending]

### 2. Lighthouse PWA + SEO ≥ 90 on mobile for app shell `/app/`
expected: Same Lighthouse Mobile audit on the deployed `/app/` URL. All 5 categories ≥ 90.
result: [pending]

### 3. Install identity preserved (manifest.id ratchet) for v1.0 PWA users (D-LAND-16)
expected: A user with the v1.0 Soundly PWA already installed (start_url `/Soundly/`) opens the v2.0 deploy. Their installed PWA upgrades in place — they do NOT get a new install prompt and they do NOT end up with two installed copies. Browser preserves the install identity via the new `manifest.id: '/Soundly/'`.
result: [pending]

### 4. SW rescoping propagates to installed users (deploy runbook §10 step 1-4)
expected: After deploy, an existing installed PWA user's service worker updates within one launch — the new SW is scoped to `/Soundly/app/` and the old SW is unregistered cleanly. Verify via DevTools Application panel → Service Workers on a real device.
result: [pending]

### 5. Offline alarm still works after SW rescope
expected: Disable network, open the installed PWA, start a Quick Nap alarm → it fires on time with audio and notifications. Confirms the precache + offline strategy survived the scope change.
result: [pending]

### 6. Landing served from network (not SW cache)
expected: Visit `/Soundly/` (the landing) with network disabled in DevTools → should fail to load (no SW serves it). Then enable network → loads fresh. Confirms landing is not aggressively precached.
result: [pending]

### 7. Installed users see no install CTA on landing (D-LAND-08)
expected: Open the installed PWA → navigate to the landing page (e.g., via address bar typing `/Soundly/`) → install button and iOS panel are both hidden. Only landing content + footer visible.
result: [pending]

### 8. Android Chrome `beforeinstallprompt` button reveals (D-LAND-05)
expected: On Android Chrome, visit the landing page in a non-installed state. After Chrome's engagement heuristics fire (~30s on page or scroll), the install button appears. Click → native install prompt opens.
result: [pending]

### 9. iOS Safari install panel reveals on iPhone/iPad (D-LAND-06)
expected: On iOS Safari (iPhone AND iPad — the maxTouchPoints fix in 11-02 should detect iPadOS 13+), visit the landing in a non-installed state. The "Install on iPhone" `<details>` link is visible. Click → 3-step instructions expand inline.
result: [pending]

### 10. Post-install confirmation + 1.5s redirect (D-LAND-07)
expected: Trigger an actual install on Android Chrome → after acceptance, the install button is replaced with "Installed ✓ — launching app…" → ~1-1.5s later, page redirects to `/Soundly/app/` automatically.
result: [pending]

### 11. Dark mode palette swap on landing
expected: Toggle OS-level dark mode (Windows Settings / macOS Appearance / mobile OS). Landing background switches to `#2a2f26` (deep forest), text to `#a4b29a` (lifted sage), accent to `#d49075`. Contrast remains readable; nothing breaks.
result: [pending]

### 12. Mobile breakpoint visual rendering at ≤767px
expected: Resize browser to <768px (or open on a phone). Hero stacks vertically, install CTA + open-app link stack with `gap: 0.75rem`, FAQ remains readable, footer wraps gracefully. No horizontal scroll, no clipped content, no overlapping elements.
result: [pending]

## Summary

total: 12
passed: 0
issues: 0
pending: 12
skipped: 0
blocked: 0

## Gaps
