---
phase: 11-multi-page-split-landing-page
reviewed: 2026-05-24T09:22:50Z
depth: deep
files_reviewed: 9
files_reviewed_list:
  - vite.config.ts
  - src/sw.ts
  - index.html
  - app/index.html
  - scripts/verify-phase-10-build.mjs
  - tests/static-assets.test.ts
  - docs/deploy-runbook.md
  - public/sitemap.xml
  - package.json
findings:
  critical: 0
  warning: 3
  info: 6
  total: 9
status: issues_found
---

# Phase 11: Code Review Report

**Reviewed:** 2026-05-24T09:22:50Z
**Depth:** deep
**Files Reviewed:** 9 (10th file `public/screenshot-composer-v1.png` is a binary asset — verified by header byte test only, per scope)
**Status:** issues_found

## Summary

Phase 11 (multi-page split + landing page) is the highest-risk v2.0 phase and the implementation handles the risk well. The Pitfall A coupling (manifest changes in `vite.config.ts` must ship in the SAME deploy as the SW rescoping in `src/sw.ts`) is correctly enforced at build time by `scripts/verify-phase-10-build.mjs` (asserts BOTH `dist/app/index.html` exists AND `dist/sw.js` contains `allowlist`). The `manifest.id: '/Soundly/'` install-identity ratchet is correctly applied. The SW allowlist regex `^/Soundly/app/` is anchored and narrow. The landing has zero React imports (verified by both the test `LAND-01 — does NOT load Tailwind app bundle` and by source inspection — `<script type="module" src="/src/main.tsx">` lives only in `app/index.html`).

The dist/ build was inspected directly and the multi-page emit is correct: `dist/index.html` for the landing, `dist/app/index.html` for the app shell, `dist/sw.js` containing the narrowed allowlist regex `^/Soundly/app/`.

No blockers and no critical findings. Three warnings flag user-facing concerns that fall just under the v1 scope bar but deserve attention before deploy. Six info items capture maintainability, test-coverage gaps, and minor UX concerns.

**Threat-model coverage:** All ASVS L1 surfaces from the planning threat models hold — no XSS surface in the inline install JS (no user input flows in), no injection paths in the static `<details>` panel, no secrets in source. The `beforeinstallprompt` deferral correctly calls `e.preventDefault()` before stashing (RESEARCH Finding 5).

## Warnings

### WR-01: notificationclick handler may focus the landing tab instead of the app

**File:** `src/sw.ts:36-43`
**Issue:** The existing-client check matches any open tab on the same origin (`client.url.startsWith(self.location.origin)`). After Phase 11 the user can have BOTH the landing (`/Soundly/`) and the app (`/Soundly/app/`) open simultaneously. When a notification fires while both are open, iteration order over `clientList` is implementation-defined — the SW may focus the landing tab, leaving the user to manually re-navigate. Before Phase 11 this asymmetry didn't exist because only one URL was reachable; Phase 11 makes the bug user-visible.

**Fix:** Narrow the existing-client check to the app scope, mirroring the `openWindow` fallback target on the next line:

```ts
// src/sw.ts
const appScopePrefix = self.location.origin + '/Soundly/app/';
for (const client of clientList) {
  if (client.url.startsWith(appScopePrefix) && 'focus' in client) {
    return (client as WindowClient).focus();
  }
}
return self.clients.openWindow('/Soundly/app/');
```

This keeps the symmetry with `createHandlerBoundToURL('/Soundly/app/index.html')` and `allowlist: [/^\/Soundly\/app\//]` already established three lines above. Plan 11-04 only touched the `openWindow` literal — the matching loop above it kept the wider Phase-10 `origin`-only check, which is now too permissive.

### WR-02: SW allowlist regex misses `/Soundly/app` (no trailing slash)

**File:** `src/sw.ts:23`
**Issue:** The allowlist regex is `/^\/Soundly\/app\//` — it requires the trailing slash. A navigation to the bare path `/Soundly/app` (no slash, e.g., from a typo in a hand-typed URL, an old shared link without the slash, or an external referrer that stripped the trailing slash) will NOT be intercepted by the SW. Online, GitHub Pages typically 301-redirects `/foo` → `/foo/` for directory paths, so the user is fine. Offline (the whole point of the app PWA), the SW can't intercept the navigation and the user sees the browser's offline error page even though `/Soundly/app/index.html` is fully precached.

The Phase 11 plan threat model called this out as `T-11-04-03` (path-coverage edge cases) and the test at `tests/static-assets.test.ts:198` asserts the literal regex source — but the test doesn't exercise the runtime matching behavior, so this case isn't covered by a regression test.

**Fix:** Either widen the regex to make the trailing slash optional:

```ts
allowlist: [/^\/Soundly\/app(\/|$)/],
```

…or accept the edge case (which is rare) and add a comment + a test that demonstrates the offline gap is intentional. The regex change is one character and has no downside — `/Soundly/apps/` still doesn't match because of the `(\/|$)` anchor. Recommend the fix.

### WR-03: Install button hides permanently after user dismisses the prompt

**File:** `index.html:355-363`
**Issue:** When the user clicks `Install Soundly` and then dismisses the Chrome native install prompt, the click handler runs:

```js
deferredPrompt = null;
installBtn.hidden = true;
```

`beforeinstallprompt` is single-use per page session (correct per the spec), so `deferredPrompt = null` is right. But `installBtn.hidden = true` permanently removes the install affordance from the page — the user has no way to retry without a full reload. The Chrome install banner only re-fires after engagement heuristics reset (minutes to hours). A user who tapped Cancel by accident has lost the install button for the rest of their session.

**Fix:** Don't hide the button unconditionally — check the outcome first:

```js
installBtn.addEventListener('click', async function () {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  var choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  // Only hide if the user accepted — on dismissal, leave the button visible
  // so they can retry on the next beforeinstallprompt firing (rare, but
  // possible in long sessions).
  if (choice.outcome === 'accepted') {
    installBtn.hidden = true;
  }
});
```

Note that `appinstalled` will also hide the button (line 370), so the accepted branch is handled twice — that's fine, idempotent.

## Info

### IN-01: Allowlist regex test only asserts source text, not runtime behavior

**File:** `tests/static-assets.test.ts:198`
**Issue:** The test `expect(sw).toMatch(/allowlist:\s*\[\s*\/\^\\\/Soundly\\\/app\\\/\/\s*\]/)` matches the literal regex source as a string. It does not import the regex, instantiate `new NavigationRoute`, or verify which paths actually match. A copy-paste typo or escaping mistake during a future refactor (e.g., dropping the `^` anchor, swapping `\/` for `/`, changing `app` to `apps`) could pass source-text matching but fail at runtime. The threat-model T-11-04-03 mitigation cited in the test comment is therefore weaker than implied.

**Fix:** Add a complementary runtime test (jsdom env already in scope):

```ts
it('Phase 11 — allowlist regex matches /Soundly/app/* paths, rejects landing', () => {
  const re = /^\/Soundly\/app\//;
  expect(re.test('/Soundly/app/')).toBe(true);
  expect(re.test('/Soundly/app/index.html')).toBe(true);
  expect(re.test('/Soundly/app/assets/main.js')).toBe(true);
  expect(re.test('/Soundly/')).toBe(false);
  expect(re.test('/Soundly/index.html')).toBe(false);
  expect(re.test('/Soundly/apps/')).toBe(false);
  // Document the WR-02 edge case (passes today; flip if WR-02 fixed)
  expect(re.test('/Soundly/app')).toBe(false);
});
```

This catches regressions and documents the WR-02 edge case as a deliberate test expectation.

### IN-02: Verifier asserts source-text match but doesn't enforce coupling at deploy

**File:** `scripts/verify-phase-10-build.mjs:159-161`
**Issue:** The Pitfall A coupling gate is `/allowlist/.test(sw)` — a single-character substring match. The string `allowlist` could appear in a comment, a variable name, or a stale code path that doesn't actually wire up the route. The gate trusts that the presence of the word `allowlist` in `dist/sw.js` proves the SW rescoping shipped. In practice this is fine because workbox-routing minifies away unused code, but the gate is weaker than a regex like `/allowlist:\s*\[\s*\/\^[^\]]*Soundly[^\]]*app/`.

**Fix:** Tighten the assertion to require both the allowlist key AND the `Soundly` + `app` tokens in the same regex-literal context:

```js
const allowlistOk = /allowlist\s*[:=]\s*\[\s*\/[^\]]*Soundly[^\]]*app/.test(sw);
if (!allowlistOk) {
  fail('dist/sw.js missing allowlist regex narrowed to /Soundly/app/ — ' +
       'Phase 11 SW rescope (Plan 11-04) did not ship');
}
```

This still works against minified output and prevents false-positives from accidental string matches.

### IN-03: Inline CSS palette duplicates `src/index.css` with no drift detection

**File:** `index.html:42-61`
**Issue:** The landing inlines the warm-earth palette CSS variables (`--bg`, `--text-primary`, `--sage`, etc.) as a copy of `src/index.css` `@theme` block. The comment at line 41 acknowledges this: `Warm-earth palette (synced from src/index.css @theme)`. There is no automated check that the two copies stay in sync. If a future phase tweaks the sage hex in `src/index.css`, the landing will silently drift to a different shade — visible to anyone who compares the landing and the installed app side-by-side.

**Fix (low-effort):** Add a test that reads both files and asserts the hex values match:

```ts
it('landing palette stays in sync with src/index.css @theme', () => {
  const css = read('src/index.css');
  const html = read('index.html');
  const themeHexes = {
    '#f4f1eb': '--bg|--color-bg',
    '#3d4a38': '--text-primary|--color-text-primary',
    '#5c6b56': '--sage|--color-sage',
    '#c27c5a': '--accent|--color-accent',
    '#d4cbbe': '--border|--color-border',
  };
  for (const hex of Object.keys(themeHexes)) {
    expect(css).toContain(hex);
    expect(html).toContain(hex);
  }
});
```

Catches palette drift in CI; no runtime cost.

### IN-04: 30-second fallback microcopy timer can re-reveal after user-initiated install dismiss

**File:** `index.html:385-391`
**Issue:** The 30-second timer reveals the fallback microcopy when no install affordance is visible. If a user clicked `Install Soundly` and then dismissed the prompt (so `installBtn.hidden = true` per WR-03), the timer's check `!installBtn.hidden` becomes false, so `hasInstallBtn = false`. If the user is also not on iOS, the microcopy reveals — saying "Works in any modern browser. Install for offline use." after the user just declined to install. Mildly redundant UX.

**Fix:** Track whether install was attempted, suppress the microcopy if so:

```js
var installAttempted = false;
installBtn.addEventListener('click', async function () {
  installAttempted = true;
  // ... rest unchanged
});

setTimeout(function () {
  if (installAttempted) return;
  // ... rest of fallback logic
}, 30000);
```

Low-priority; the microcopy is calm and accurate even in this case.

### IN-05: Inline iOS detection drops iPadOS 12 and below

**File:** `index.html:328-333`
**Issue:** The inline `isIos()` uses `/iphone|ipod/i` (no `ipad`) plus the `MacIntel + maxTouchPoints > 1` branch for iPadOS 13+. iPadOS 12 and earlier still report `iPad` in the UA, so those users will not see the iOS install panel. iPadOS 12 was released Sept 2018 (replaced by iPadOS 13 Sept 2019); by 2026 the population is negligible. The comment at lines 323-327 documents the trade-off (`src/platform/standalone.ts MISSES this branch` and the landing carries the corrected version inline).

**Fix:** None required. If maximum coverage is desired, restore the `ipad` UA token alongside the maxTouchPoints check:

```js
function isIos() {
  var ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return true;
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;
  return false;
}
```

This covers iPadOS 12 (pre-spoofing) AND iPadOS 13+ (post-spoofing) without false positives.

### IN-06: `screenshot-composer-v1.png` size cap test is identical to OG image — copy-paste hazard

**File:** `tests/static-assets.test.ts:389-409` and `scripts/verify-phase-10-build.mjs:140-144`
**Issue:** Three places now assert `<= 204800 bytes && > 1000 bytes` for two PNG assets with no shared helper. Future asset additions (Phase 12+ icons, screenshots) will copy-paste this boilerplate again. Not a bug; just a maintenance smell.

**Fix:** Extract a helper, e.g.:

```ts
function assertReasonablePng(filePath: string, label: string) {
  it(`${label} exists`, () => expect(existsSync(filePath)).toBe(true));
  it(`${label} is <= 200 KB`, () => {
    const size = statSync(filePath).size;
    expect(size).toBeLessThanOrEqual(204800);
    expect(size).toBeGreaterThan(1000);
  });
  it(`${label} is a valid PNG`, () => {
    const buf = readFileSync(filePath);
    expect([buf[0], buf[1], buf[2], buf[3]]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  });
}
```

Defer until a third asset arrives (rule of three).

---

_Reviewed: 2026-05-24T09:22:50Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
