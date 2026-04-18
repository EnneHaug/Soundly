---
phase: 04-pwa-shell
reviewed: 2026-04-18T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - index.html
  - src/sw.ts
  - vite.config.ts
  - tsconfig.app.json
  - src/vite-env.d.ts
  - src/engine/index.ts
  - src/components/Countdown.tsx
  - src/engine/sounds/__tests__/phase3Tone.test.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-04-18T00:00:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

This phase added the PWA shell: Apple meta tags, a NavigationRoute SPA fallback in the service worker, a `notificationclick` handler, notification utilities in `src/platform/notifications.ts`, and minor TypeScript fixes (`export type` split in the engine barrel, `jsx` option in tsconfig, `src/vite-env.d.ts` creation). The bulk of the changes are correct and well-structured.

Three warnings are flagged: a logic bug in `getPhaseDuration` (wrong config field used for `phase1`/`phase2`), a silently broken `renotify` workaround in `notifications.ts` that always passes `false` instead of `true`, and the `NavigationRoute` not having an allowlist denylist that could serve stale HTML to non-navigation requests in edge cases. Three info items cover the missing `scope` field in the PWA manifest, the `apple-mobile-web-app-status-bar-style` value choice, and a minor dead-variable in `Countdown.tsx`.

---

## Warnings

### WR-01: getPhaseDuration maps phases to wrong config fields

**File:** `src/components/Countdown.tsx:41-52`

**Issue:** The `getPhaseDuration` switch uses the wrong config fields for the `idle` and `phase1` cases, and uses `phase2to3GapMs` for `phase2` — which is the gap *between* phase 2 and phase 3 (10 seconds), not the duration of phase 2 itself. The mapping is off by one: the `idle` case (countdown before phase 1 starts) returns `phase1DurationMs` when it should return 0 (or the delay-to-phase1 value), and `phase1` should return `phase1DurationMs` while `phase2` should return `phase2DurationMs`.

As written, when `alarm.phase === 'phase2'` the progress ring advances over 10 seconds (the gap) rather than the actual phase-2 duration (up to 300 seconds), making the ring complete almost immediately during phase 2.

```
Current (broken):
  'idle'   → config.phase1DurationMs   ← used during pre-start countdown, wrong context
  'phase1' → config.phase2DurationMs   ← off by one
  'phase2' → config.phase2to3GapMs     ← this is a 10-second gap, not phase duration
  'phase3' → config.phase3RampDurationMs ← correct
```

**Fix:**
```ts
function getPhaseDuration(
  phase: AlarmPhase,
  config: NonNullable<UseAlarmReturn['activeConfig']>
): number {
  switch (phase) {
    case 'idle':
      return 0; // or the scheduled delay before phase1, if exposed
    case 'phase1':
      return config.phase1DurationMs;
    case 'phase2':
      return config.phase2DurationMs;
    case 'phase3':
      return config.phase3RampDurationMs;
    default:
      return 0;
  }
}
```

---

### WR-02: renotify workaround always passes false — notification de-duplication is silently broken

**File:** `src/platform/notifications.ts:40`

**Issue:** The spread to work around the missing `renotify` TypeScript type is malformed. The immediately-invoked destructuring `(({ renotify: false }) as Record<string, unknown>)` is not a function call — it creates an object literal `{ renotify: false }` and type-asserts it. The intent was almost certainly `renotify: true` (re-notify the user on repeated calls), but even if `false` is intended, the construction is misleading and fragile. As written, the notification will be shown with `renotify: false`, which means subsequent calls to `showAlarmNotification()` while a notification with the same tag is already displayed will be silently ignored — the user will not be re-alerted if the notification was already dismissed from the lock screen.

More importantly, if the intent was `renotify: true` (replace-and-re-alert), the bug means the escalation behaviour is wrong: the alarm could ring in phase 3 without the notification re-triggering on Android.

**Fix:** Pass the value explicitly and correctly. The cleanest approach is a cast to avoid the TS lib gap:
```ts
await reg.showNotification('Soundly \u2014 Alarm ringing', {
  body: 'Tap to return to the app and dismiss.',
  icon: '/icons/icon-192x192.png',
  tag: 'soundly-alarm',
  requireInteraction: true,
  renotify: true,  // add to NotificationOptions in a local .d.ts if TS complains
} as NotificationOptions & { renotify: boolean });
```

If `renotify: false` is intentional (show once, don't re-alert), document this explicitly so future maintainers understand the silent-dedup behaviour during escalation.

---

### WR-03: NavigationRoute without allowlist — may serve stale index.html to same-origin API/asset paths not in precache

**File:** `src/sw.ts:18-19`

**Issue:** `new NavigationRoute(navHandler)` with no second argument matches *all* navigation requests from the SW's scope, including any future `fetch` calls that happen to be navigation-typed (e.g., iframes, server-sent resources). For a SPA this is typically fine, but `createHandlerBoundToURL('/index.html')` with an unfiltered `NavigationRoute` will respond with the cached `index.html` to any navigation URL, including ones that are not part of the app (e.g., a future API route served from the same origin). The comment even anticipates deep links, making this gap more likely to matter.

The Workbox documentation recommends passing an allowlist array of URL patterns to `NavigationRoute` to restrict which navigations it handles.

**Fix:**
```ts
const navHandler = createHandlerBoundToURL('/index.html');
registerRoute(
  new NavigationRoute(navHandler, {
    allowlist: [/^\/(?!api\/)/],  // all paths except /api/...
  })
);
```

For the current app (no API routes, pure SPA at `/`) the risk is low, but adding the allowlist makes the intent explicit and prevents silent misbehaviour if the origin ever serves non-SPA resources.

---

## Info

### IN-01: PWA manifest missing scope field

**File:** `vite.config.ts:14-27`

**Issue:** The web app manifest does not declare a `scope` field. Without it, browsers default the scope to the directory of `start_url`, which for `start_url: '/'` means `'/'`. This is correct for the current app, but it should be explicit: the PWA spec requires `scope` for Android installability in some browser versions, and the absence creates ambiguity if `start_url` is ever changed.

**Fix:**
```ts
manifest: {
  // ...
  start_url: '/',
  scope: '/',
  // ...
}
```

---

### IN-02: apple-mobile-web-app-status-bar-style uses "default" — may not match dark theme-color

**File:** `index.html:8`

**Issue:** `apple-mobile-web-app-status-bar-style` is set to `"default"` (white/light status bar). The `theme-color` is `#5c6b56` (a dark green), and the manifest uses `background_color: '#f4f1eb'`. On iOS, `"default"` renders a white status bar. If the app uses a dark or olive top bar, the white iOS status bar will look visually inconsistent. `"black-translucent"` overlaps the status bar over the app content (requires padding-top to compensate), and `"black"` gives a black bar regardless of theme.

**Fix:** Evaluate the intended visual treatment and set accordingly:
```html
<!-- For dark status bar that matches the green theme-color: -->
<meta name="apple-mobile-web-app-status-bar-style" content="black" />
<!-- Or for translucent overlay (requires safe-area-inset-top padding): -->
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
```

This is a visual/UX concern, not a bug, but it affects the iOS standalone experience.

---

### IN-03: Dead variable currentPhase in Countdown.tsx

**File:** `src/components/Countdown.tsx:87`

**Issue:** `const currentPhase = alarm.phase;` is assigned but `currentPhase` is used only as a prop to `ProgressRing`, making it a pass-through alias for `alarm.phase`. The alias adds no clarity. With `noUnusedLocals: true` in tsconfig this compiles only because the variable is referenced — but it is purely an intermediate that obscures the data flow.

**Fix:** Pass `alarm.phase` directly to `ProgressRing`:
```tsx
<ProgressRing
  config={config}
  currentPhase={alarm.phase}
  phaseProgress={phaseProgress}
>
```

---

_Reviewed: 2026-04-18T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
