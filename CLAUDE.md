<!-- GSD:project-start source:PROJECT.md -->
## Project

**Soundly Gentle Alarm**

A Progressive Web App that wakes or alerts users gently through a multi-phase approach — starting with soft sounds, escalating through vibration, and only reaching full volume as a last resort. Designed for people who hate jarring alarms and want to wake calmly without disturbing others nearby.

**Core Value:** The alarm must actually wake the user — gently first, reliably always. If the gentle phases fail, escalation guarantees the user doesn't oversleep.

### Constraints

- **Tech stack**: React + Vite + Tailwind CSS — specified by user
- **PWA**: Must use vite-plugin-pwa for service worker and manifest
- **Audio**: No copyrighted audio files — synthesized or royalty-free only
- **Browser APIs**: Wake Lock, Vibration, Notification APIs are not universally supported — must degrade gracefully
- **No persistence**: Settings are not stored between sessions
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

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
## Background Audio Keepalive Strategy
### The Technique Stack (layer by layer)
## vite-plugin-pwa Configuration Notes
- `display: "standalone"` — full-screen launch, no browser chrome
- `orientation: "portrait"` — alarm app is portrait-native
- `background_color` and `theme_color` — must match the app's zen palette for splash screen
- `icons` — 192px and 512px PNG required; also `maskable` variant for Android adaptive icons and `apple-touch-icon` for iOS home screen
- `start_url: "/"` — ensures offline launch works
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
## Installation
# Core
# PWA
# Tailwind v4
# Icon generation (run once to generate assets)
# Optional: animations (add only if CSS transitions insufficient)
### vite.config.ts skeleton
### CSS entry point (src/index.css)
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
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
