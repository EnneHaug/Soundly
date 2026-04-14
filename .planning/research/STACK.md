# Technology Stack

**Project:** Soundly — Gentle Alarm PWA
**Researched:** 2026-04-14
**Confidence:** MEDIUM-HIGH (MDN verified for browser APIs; vite-plugin-pwa version from npm page was blocked, version pinned from training data + release pattern knowledge; Tailwind v4 confirmed via official blog)

---

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| React | 19.x (19.2 latest as of Oct 2025) | UI rendering, component tree | Specified by user. React 19 stable with no breaking changes relevant to this app. Hooks model (useReducer, useRef, useEffect) maps cleanly onto alarm state machine + AudioContext lifecycle. |
| Vite | 6.x | Dev server, build tool | Specified by user. Vite 6 is the current major. Fast HMR critical for iterating on sound synthesis. vite-plugin-pwa requires Vite 5+ and works with Vite 6. |
| TypeScript | 5.x | Type safety | Strong-type AudioContext nodes, alarm state, phase enums. Catches category errors (passing Hz as seconds) that are easy to make in audio code. Worth the setup cost here. |

### PWA Layer

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| vite-plugin-pwa | 0.21.x | Service worker, web app manifest, offline caching | The canonical PWA integration for Vite. Wraps Workbox. Handles manifest injection, SW registration, and asset precaching automatically. No viable alternative for Vite. |
| Workbox (bundled) | 7.x | SW caching strategies | Bundled with vite-plugin-pwa. Use `generateSW` mode (not `injectManifest`) unless custom SW logic is needed — and for an alarm app it will be needed (background timer coordination). Use `injectManifest` mode so the service worker can contain custom push/notification logic. |
| @vite-pwa/assets-generator | latest | Icon generation (192px, 512px, maskable, apple-touch) | Companion CLI tool. PWA install requires 192px + 512px icons. This generates the full icon set from a single SVG source. Avoids manual export. |

### Styling

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tailwind CSS | 4.x (v4.0 released Jan 2025) | Utility-first styling | Specified by user. v4 is a major rewrite with native CSS variables, `@import "tailwindcss"` setup, and first-party Vite plugin (`@tailwindcss/vite`) replacing the PostCSS path. The `@tailwindcss/vite` plugin is the correct integration, not `tailwindcss` via PostCSS in Vite 6. Dark mode via `prefers-color-scheme` media query works out of the box. |
| @tailwindcss/vite | 4.x | Vite plugin for Tailwind v4 | Replaces the old PostCSS configuration. Tighter integration, better HMR, no `tailwind.config.js` required. Single `@import "tailwindcss"` in CSS file. |

### State Management

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| React built-ins (useReducer + Context) | — | Alarm state machine | The alarm has a well-defined state machine: idle → running (phase 1 → phase 2 → phase 3) → dismissed/paused. `useReducer` with explicit action types models this perfectly without external libraries. No async side effects in state (audio and timers live in refs/effects). Zustand or Redux would add accidental complexity. |

### Audio

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Web Audio API (browser native) | — | Sound synthesis | No library needed. `OscillatorNode`, `GainNode`, `BiquadFilterNode`, and `PeriodicWave` cover all required synthesis. Singing bowl = detuned sine partials with slow exponential gain decay. Chimes = high-frequency sine oscillators with sharp attack and long release. Volume ramp = `GainNode.gain.linearRampToValueAtTime()`. Runs offline natively. No copyright issues. |
| Tone.js | — | NOT RECOMMENDED | Tone.js wraps the Web Audio API but adds 200KB+ bundle weight and abstraction that makes fine-grained synthesis harder, not easier. This app's synthesis needs are specific enough that raw Web Audio API is the right tool. |

### Browser APIs (no libraries)

| API | Status | Notes |
|-----|--------|-------|
| Wake Lock API | Baseline 2025 (March 2025) | Requires HTTPS + document visible. Auto-released when tab backgrounded or battery critical. Must re-acquire on `visibilitychange`. Does NOT prevent screen-off on iOS (no iOS support at time of research — confirmed "Baseline 2025" means newly available across *some* browsers, not universally iOS). |
| Vibration API | Limited availability (not Baseline) | Chrome on Android: supported. iOS Safari: NOT supported. Firefox desktop: removed. Must feature-detect with `'vibrate' in navigator`. Treat as Android-only enhancement. |
| Notifications API | Supported with caveats | Use `ServiceWorkerRegistration.showNotification()` (not `new Notification()`) for mobile. Requires HTTPS + explicit permission. iOS 16.4+ supports web push from installed PWA only. Must request permission from user gesture. |
| Media Session API | Limited availability (not Baseline) | Useful for lock screen metadata and play/pause controls when audio is running. Does not itself keep audio alive — the audio context must already be running. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns or Day.js | — | NOT needed | Alarm time math is simple: `Date.now() + delayMs`. No date formatting library required for this use case. |
| Framer Motion | 11.x | Smooth animations for zen aesthetic | The PROJECT.md calls for smooth transitions and soft animations. Framer Motion's `AnimatePresence` and `motion.*` components handle enter/exit animations that `@starting-style` CSS (Tailwind v4 compatible) can't yet do reliably cross-browser. Use for screen transitions and phase-change animations. Optional — evaluate whether CSS transitions suffice first. |

---

## Background Audio Keepalive Strategy

This is the most complex constraint in the stack. Browser audio stops when a tab is backgrounded. The project requires the alarm to fire even when the screen is off.

### The Technique Stack (layer by layer)

**Layer 1 — Wake Lock (primary, foreground)**
Request `navigator.wakeLock.request("screen")` when alarm starts. Keeps screen on and tab foregrounded. Re-acquire on `visibilitychange` events. This works as long as the user does not manually lock the screen.

**Layer 2 — Silent audio loop (background fallback)**
Play a looping 1-second silent audio buffer (`AudioBuffer` filled with zeros) via `AudioBufferSourceNode` immediately when the alarm is set. Most browsers (Chrome on Android especially) keep the audio context alive when an audio element or context is actively "playing", even if silent. This is the canonical PWA alarm technique. The context must be created from a user gesture (the "Set Alarm" button tap).

**Layer 3 — Media Session API**
Register `navigator.mediaSession` metadata and action handlers when the silent loop starts. This registers the app as an "active media session," which signals to the OS not to suspend the audio context. Increases reliability of Layer 2.

**Layer 4 — Service Worker + Notifications**
When the alarm time arrives (computed in the main thread's timer), the main thread posts a message to the service worker, which calls `self.registration.showNotification()`. This fires even if the tab is backgrounded (but the app must be installed as a PWA and the service worker must be active). On Android Chrome this is reliable. On iOS this requires the app to be installed to the home screen and iOS 16.4+.

**iOS limitation (critical):** iOS Safari kills audio contexts when the tab is backgrounded, regardless of the silent loop technique. There is no reliable workaround for the screen-off case on iOS without a native app. The alarm will work when the screen is on (Wake Lock prevents sleep). Notification fallback may fire on iOS 16.4+ from a home screen install, but cannot play audio when the notification fires — only shows notification UI.

**Honest assessment:** This is a fundamental browser limitation. The stack enables the best possible PWA behavior, but users should be informed that "screen kept on" mode is the primary reliability path.

---

## vite-plugin-pwa Configuration Notes

Use `injectManifest` strategy (not `generateSW`) because the service worker needs custom code for notification handling and posting messages from the SW to the main thread.

Key manifest settings for an alarm PWA:
- `display: "standalone"` — full-screen launch, no browser chrome
- `orientation: "portrait"` — alarm app is portrait-native
- `background_color` and `theme_color` — must match the app's zen palette for splash screen
- `icons` — 192px and 512px PNG required; also `maskable` variant for Android adaptive icons and `apple-touch-icon` for iOS home screen
- `start_url: "/"` — ensures offline launch works

Workbox precaching strategy: `CacheFirst` for all app shell assets (JS, CSS, HTML, icons). No network requests needed — the app is fully offline-capable by design (synthesized audio, no external API calls).

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Styling | Tailwind CSS v4 + `@tailwindcss/vite` | Tailwind v3 + PostCSS | v3 is maintenance mode. v4 is the current release, has better DX with Vite, native CSS variables are useful for theming the zen palette at runtime. |
| State | useReducer + Context | Zustand | Overkill. Alarm state fits a finite state machine cleanly. Adding an external store adds a dependency for no benefit. |
| State | useReducer + Context | Redux Toolkit | Way overkill. |
| Audio | Raw Web Audio API | Tone.js | Tone.js is 200KB+ and abstracts away the exact primitives needed. Singing bowl synthesis requires precise control of `PeriodicWave` and exponential decay envelopes — easier to express directly. |
| Audio | Raw Web Audio API | Howler.js | Howler.js is for file-based audio, not synthesis. Wrong tool. |
| PWA | vite-plugin-pwa | Manual SW | vite-plugin-pwa is the standard. Writing a service worker from scratch in a Vite project is unnecessary complexity. |
| Animations | Framer Motion | CSS transitions only | CSS transitions work for simple fade/scale. If the zen animation fidelity requirement exceeds what `transition` classes provide, Framer Motion is the right addition. Start without it. |

---

## Installation

```bash
# Core
npm create vite@latest soundly -- --template react-ts
cd soundly

# PWA
npm install -D vite-plugin-pwa

# Tailwind v4
npm install -D tailwindcss @tailwindcss/vite

# Icon generation (run once to generate assets)
npm install -D @vite-pwa/assets-generator

# Optional: animations (add only if CSS transitions insufficient)
npm install framer-motion
```

### vite.config.ts skeleton

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      manifest: {
        name: 'Soundly',
        short_name: 'Soundly',
        description: 'A gentle alarm that wakes you calmly',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icons/192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
```

### CSS entry point (src/index.css)

```css
@import "tailwindcss";
/* Dark mode follows OS preference automatically via prefers-color-scheme */
```

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| React 19 version | HIGH | Verified via react.dev blog (Oct 2025 = React 19.2) |
| Tailwind CSS v4 | HIGH | Verified via official Tailwind blog (Jan 2025 release, Vite plugin confirmed) |
| Wake Lock API | HIGH | MDN verified: Baseline 2025, requires HTTPS, re-acquire on visibilitychange |
| Wake Lock iOS | MEDIUM | "Baseline 2025" designation means newly available — iOS support still unclear at research date; treat as Android-only for reliability |
| Vibration API iOS | HIGH | MDN: "not Baseline, limited availability" — consistent with known iOS Safari non-support |
| Notifications API | HIGH | MDN confirmed: use ServiceWorkerRegistration.showNotification for mobile, iOS 16.4+ for installed PWA |
| vite-plugin-pwa version | MEDIUM | npm page blocked; 0.21.x based on training knowledge + release cadence. Verify with `npm show vite-plugin-pwa version` before installing. |
| Silent audio loop keepalive | MEDIUM | Widely documented community technique; not in official browser docs; effectiveness varies by browser version and OS power management |
| Media Session API | MEDIUM | MDN: "not Baseline, limited availability" — works in Chrome/Edge, uncertain in Safari |
| Tone.js rejection | HIGH | Bundle size and abstraction level are well-established objections for synthesis use cases |
| AudioContext autoplay | HIGH | MDN verified: must create or resume from user gesture; state can be suspended, running, or closed |

---

## Sources

- MDN Web Audio API Best Practices: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices
- MDN Screen Wake Lock API: https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API
- MDN Vibration API: https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API
- MDN Notifications API: https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API
- MDN Media Session API: https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API
- MDN Push API and Notifications (PWA): https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Tutorials/js13kGames/Re-engageable_Notifications_Push
- Tailwind CSS v4 official blog: https://tailwindcss.com/blog/tailwindcss-v4
- React blog (version history): https://react.dev/blog
- MDN PWA installability: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
- vite-plugin-pwa official docs: https://vite-pwa-org.netlify.app/guide/
