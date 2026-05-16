---
status: partial
phase: 09-custom-composer-share-via-url
source: [09-VERIFICATION.md]
started: 2026-05-16T16:05:00Z
updated: 2026-05-16T16:05:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Web Share API on Android Chrome (or Edge mobile)
expected: Tap Custom on Dashboard → modify a few segments → tap Share. Native share sheet opens with title "My alarm composition" and a URL of the form `<origin>/Soundly/app#c=v1:...`. After share/cancel, no toast appears (AbortError is silent per Pattern 7).
result: [pending]

### 2. Clipboard fallback on desktop browsers
expected: On Chrome/Firefox/Safari desktop where `navigator.canShare` rejects URL payloads, tapping Share copies the full URL to clipboard and shows the Toast "Share link copied to clipboard" auto-dismissing in 3 s. Paste into another browser tab confirms the URL works.
result: [pending]

### 3. Shared URL round-trip
expected: Take the URL from Test 1 or 2 → paste into a fresh browser tab → Composer opens with the decoded segments (not Wake Easy default) → `location.hash` is cleared from the URL bar via `history.replaceState` → no console errors.
result: [pending]

### 4. Tampered URL fallback
expected: Visit `<origin>/Soundly/app#c=v1:0-9,abc-def` (invalid sound index + malformed pair) → Dashboard renders normally → an unobtrusive Toast appears: "Couldn't load shared alarm — using default" → no runtime exception in DevTools console → Composer does NOT auto-open. Repeat with `#c=v2:240000-0` → same fallback (reason: wrong_version).
result: [pending]

### 5. Modal open/close animation (D-15)
expected: Tap Custom → modal fades in with slight upward slide (~240 ms); Escape / Cancel / X close the modal with a reverse animation. Toggle macOS "Reduce motion" or Chrome devtools rendering "Emulate CSS prefers-reduced-motion: reduce" → animation collapses to a near-instant fade (≤100 ms).
result: [pending]

### 6. Mobile narrow-viewport responsive grid
expected: Open DevTools → emulate iPhone SE (375 × 667) → SegmentRow reflows from 4-column to 3-column with SoundPicker wrapping below the StepperInput. All buttons remain ≥44 × 44 px. Modal still scrolls; Add segment button visible; Total: caption visible at top.
result: [pending]

### 7. iOS Safari standalone-mode hash preservation
expected: On a real iPhone (NOT just Safari devtools simulation), install the PWA via Add to Home Screen. Tap the home-screen icon to launch in standalone mode with a shared URL pasted somewhere (deep-link test). Verify `location.hash` survives the standalone launch and decodeComposition runs successfully. If hash is stripped by iOS standalone init, the Composer opens with Wake Easy default (graceful — not a failure for this gate, but document the observed behavior).
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
