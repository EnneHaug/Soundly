# Domain Pitfalls: v2.0 Custom Alarm Composer + Discoverability

**Project:** Soundly Gentle Alarm — Milestone v2.0
**Researched:** 2026-05-04
**Scope:** Pitfalls specific to *adding* segment-based alarms, a Custom Mode UI, the Wake Easy preset, the triangle synthesis sound, SEO meta + JSON-LD, robots/sitemap, and a marketing landing page to an existing React 19 + Vite 6 + Tailwind v4 PWA that uses `vite-plugin-pwa` in `injectManifest` mode and is hosted at base path `/Soundly/`.
**Confidence:** HIGH for browser API behavior and SEO mechanics; MEDIUM for psychoacoustic claims about the triangle timbre; HIGH for vite-plugin-pwa precache semantics (verified against project config).

**Relationship to v1.0 PITFALLS.md:** The v1.0 doc covers the foundational alarm engine pitfalls (AudioContext gesture, Wake Lock re-acquire, vibration absent on iOS, drift-free timer, SW cannot play audio, etc.). All v1.0 pitfalls remain in force; this document only adds *new* pitfalls introduced by v2.0 features. Where a v1.0 pitfall is intensified by v2.0 (e.g., timer drift across many short segments), it is re-flagged here with the new threat surface.

---

## Critical Pitfalls

Mistakes that cause the segment alarm to misfire, the triangle to sound broken, the SEO to silently fail to index, or the OG embed to be cached incorrectly forever.

---

### Pitfall 1: Segment Transitions Scheduled with `setTimeout` Drift Cumulatively Across a 17-Minute Wake Easy Run

**What goes wrong:** v1.0's `scheduleAt` uses `Date.now()` polling at 250ms cadence — accurate enough for a single fire-once transition (Phase 1 / Phase 2 / Phase 3). But the segment runner introduces a *chain of N transitions in sequence*. If the implementer naively chains with `setTimeout(nextSegment, segment.durationMs)` after each segment fires, each step inherits whatever lateness the previous step had, and on backgrounded mobile the cumulative drift over a 17-minute, 5-segment Wake Easy preset is bounded only by browser throttling. On Chrome Android with intensive throttling (5+ minutes hidden, no media activity), a chained `setTimeout` chain can drift by minutes; the final 1-minute alarm segment may fire 30+ seconds late, or the entire chain may finish minutes after the user expected to be woken.

**Why it happens:** Each `setTimeout` resets the clock to "now + segment duration" at fire time. The fire time itself is whatever the throttled event loop happened to dispatch — drift compounds. The Web Audio clock (`AudioContext.currentTime`) does *not* drift; it ticks on the audio thread regardless of main-thread throttling. The "Tale of Two Clocks" pattern is the standard fix: schedule audio events against `AudioContext.currentTime`, use the JS timer only as a coarse "look ahead and schedule the next batch" trigger.

**Consequences:**
- 17-minute Wake Easy preset finishes at 17:30, 18:00, or longer when phone is backgrounded. User oversleeps by a margin proportional to how long the phone was idle.
- Chime-strike timing within a segment (sound at the tail) drifts off the displayed countdown — UI shows 0:00 remaining while audio fires 800ms later, or vice versa.
- On iOS the situation is worse: WebAudio is suspended on lock anyway (per `ios-alarm-feasibility.md`), so the question is moot for locked-screen — but for *foreground* iOS with the screen on, drift still hurts.

**Prevention:**
1. **Compute all segment fire times absolutely at `start()` time.** Just like v1.0 does for Phase 1/2/3:
   ```ts
   let cursor = Date.now();
   const fireTimes = config.segments.map((seg) => {
     cursor += seg.durationMs;
     return { fireAt: cursor, sound: seg.sound };
   });
   ```
   Then `scheduleAt(fireTimes[i].fireAt, ...)` for each segment. This is the existing v1.0 pattern, just extended to N entries. Each `scheduleAt` self-corrects against `Date.now()` independently — drift does not cascade.
2. **Schedule the actual audio strike via `AudioContext.currentTime`**, not via `playSound()` called from the JS callback. When Phase 1 of a segment is "play chime at tail", compute `ac.currentTime + (segment.durationMs / 1000) - now()` and call `oscillator.start(ac.currentTime + leadTime)`. This makes the audio strike sample-accurate even if the JS callback fires 30ms late. (Pattern from `web.dev/articles/audio-scheduling`.)
3. **Avoid the chained `setTimeout(next, segment.duration)` pattern entirely.** Even with wall-clock correction inside, it is harder to pause/resume cleanly than absolute-fire-time scheduling.
4. **Snapshot the absolute fire times in a single array at `start()`.** Pause/resume should rebase the array (subtract elapsed time, add `Date.now()`), not iterate-and-reschedule from the current segment forward.

**Detection (warning signs):**
- QA test: start Wake Easy, lock phone, wait 17 minutes. If the alarm segment fires more than 5 seconds late vs wall clock, drift is unacceptable.
- Dev test: log `Date.now() - expectedFireAt` in each segment callback. Should be <250ms per v1.0 ALM-04 contract; more than 1 second indicates the chained-setTimeout antipattern.
- UI desync: countdown timer shows 0:00 but the chime hasn't played yet, or the chime plays before the counter reaches 0.

**Phase to address:** Segment Runner phase (the new alarm engine code that replaces or wraps `AlarmEngine` for segment configs). The fix is foundational — must be designed in, not retrofitted. Verification step in that phase's plan: "Run a 17-minute Wake Easy segment chain in foreground; assert each segment fires within 250ms of its absolute target."

---

### Pitfall 2: Segment Pause/Resume Has Three Plausible Semantics — Pick One Explicitly

**What goes wrong:** When the user pauses mid-segment-3 of a 5-segment alarm with 8 seconds elapsed in a 4-minute segment, "resume" has at least three reasonable interpretations and the implementer will pick whichever is easiest to code, which will not match user expectation:
- (a) **Resume mid-segment** — continue the current segment with 3 minutes 52 seconds remaining, then proceed to segment 4.
- (b) **Restart segment** — start segment 3 over from the beginning, then proceed to segment 4.
- (c) **Skip segment** — fire segment 3's end-of-segment sound now, treat as completed, advance to segment 4.

v1.0's `AlarmEngine.pause()`/`resume()` already takes option (a) for the three-phase model, snapshotting `phase1Remaining`, `phase2Remaining`, `phase3Remaining`. For segments, (a) is the most consistent — but the implementer must verify the snapshot/restore pattern *per segment*, not just for the next phase boundary, and must handle the edge case where pause happens *between* segments (after segment 2's chime but before segment 3 starts).

**Why it happens:** v1.0's pause was a 3-element snapshot. v2.0 turns this into an N-element problem with new edge cases:
- Pause exactly when an end-of-segment sound is mid-decay — should the sound continue? cut off? resume on un-pause?
- Pause during the transition between segments (~0ms gap if any).
- Pause while in the final "alarm" segment of Wake Easy — is "resume" sensible at all, or should pause auto-dismiss?

**Consequences:**
- User pauses Wake Easy at 8:00 (mid-segment-2) to take a phone call; resumes 90 seconds later expecting to be woken at 17:00 from start, but the chain is now off by 90 seconds and the alarm fires at 18:30. Or worse, the chain restarts from segment 2 and the user is woken at ~22:00.
- Pause during the alarm segment cuts off the alarm sound, user re-pauses by tapping the Pause button thinking it's Stop, then the alarm never re-fires.

**Prevention:**
1. **Specify pause semantics explicitly in the phase plan** — recommend (a) "resume mid-segment" matching v1.0 behavior, with this rule: paused alarm extends total duration by the pause length. Document this in the spec as a contract.
2. **Snapshot pattern from v1.0:** at pause time, store `(remainingInCurrentSegment, currentSegmentIndex, segmentsRemaining[])`. At resume, rebase: `nowFireTime = Date.now() + remainingInCurrentSegment` for current, then chain absolute fire times for the rest.
3. **Disable Pause during the final alarm segment** — at this point the user wanted to be woken, "pause" semantics are nonsensical. Show only Stop/Dismiss. Mirrors the v1.0 mental model.
4. **Define behavior for pause-on-segment-boundary:** if pause fires within 50ms of a transition, snapshot the *next* segment as having full duration remaining (don't double-fire the end-of-segment sound).
5. **Write three explicit unit tests:** pause mid-segment-2 + resume → assert next sound fires at correct absolute time; pause during alarm segment → assert Pause button is hidden or disabled; pause exactly at segment transition (use fake timers, fire at ms=segmentEnd) → assert exactly one sound played.

**Detection (warning signs):**
- Manual QA: pause Wake Easy at 5:00, wait 30 seconds, resume. Total elapsed should be 17:30, not 17:00.
- Bug report: "I paused for a minute and the alarm finished early/late."
- The chime fires twice when pause happens near segment boundary.

**Phase to address:** Segment Runner phase (alongside Pitfall 1's scheduling fix). Pause semantics belong in the same phase as the segment runner because they share state.

---

### Pitfall 3: Triangle Synthesis Click Transient on Attack — Web Audio's Most Common Synthesis Bug

**What goes wrong:** A naive triangle/bell strike sets `gain.value = 1.0` instantaneously and connects the oscillator. The discontinuity from 0 → 1 in a single sample produces a broadband click at attack — audible as a sharp "tick" before the bell tone. On a zen-aesthetic alarm where the *whole point* is gentle un-jarring sound, this single sample of clipping is a product-killing detail. The same bug bites on release: setting `gain.value = 0` mid-tone produces a click on stop.

**Why it happens:** WebAudio runs at sample rate (44.1kHz typical). A `gainNode.gain.setValueAtTime(1, now)` followed by `osc.start(now)` creates a step function in the output signal. Step functions in the time domain = energy at all frequencies = audible click. The fix is to ramp the gain *over* a few milliseconds (3–10ms is typical for "instant but click-free" attack).

**Existing project pattern:** `src/engine/sounds/singingBowl.ts` and `src/engine/sounds/phase3Tone.ts` should already use this pattern (the codebase has `fadeOutGain` per `AlarmEngine.cleanup()`). The triangle implementer must follow the same convention. Reading the singing bowl code before writing the triangle code is the correct mitigation.

**Consequences:**
- Triangle plays as "click-bell" instead of "bell." Worst possible UX for a zen alarm.
- If the click is loud enough, it competes with the singing bowl's perceptual character — users describe both sounds as "harsh."
- On Phase 3 the alarm escalation already has hand-tuned tones; adding a clicky triangle to the segment vocabulary degrades the whole sound design.

**Prevention:**
1. **Always ramp gain on attack:**
   ```ts
   const g = ac.createGain();
   g.gain.setValueAtTime(0, ac.currentTime);
   g.gain.linearRampToValueAtTime(peakGain, ac.currentTime + 0.005); // 5ms attack
   ```
   3–10ms is inaudible as a separate event but eliminates the click.
2. **Always ramp gain on release / before disconnecting:**
   ```ts
   g.gain.setValueAtTime(g.gain.value, ac.currentTime);
   g.gain.linearRampToValueAtTime(0.0001, ac.currentTime + 0.05); // 50ms release
   osc.stop(ac.currentTime + 0.06);
   ```
   The 0.0001 floor (instead of 0) avoids the `exponentialRampToValueAtTime` zero-target error if you switch ramp types later. Singing bowl already uses `fadeOutGain` per cleanup; mirror its API.
3. **Use a real bell envelope, not a constant gain:** triangle's recognizable character is *fast attack, long exponential decay* (1–2s). Set `linearRampToValueAtTime(peak, +0.005)` then `exponentialRampToValueAtTime(0.0001, +1.5)`. Without decay it just sounds like a constant tone for the duration.
4. **Pick a fundamental that does not clash with the singing bowl.** Singing bowl uses detuned partials around a low fundamental (~196Hz / G3 typical). A bright triangle in the 1.5–2.5 kHz range gives clear sonic separation. Below 1 kHz competes with the bowl harmonics; above 4 kHz sounds "thin" on phone speakers (which roll off above ~4kHz).
5. **Use `OscillatorNode` with `type = 'triangle'` only as the foundation.** Real triangle/bell timbre needs at least 2–3 stacked oscillators: fundamental + odd harmonic (3rd, 5th) detuned slightly + a high "shimmer" partial. Pure triangle wave alone is too synthetic. (Pattern: see existing `singingBowl.ts` for the multi-oscillator approach.)

**Detection (warning signs):**
- Listen on headphones — clicks are masked on phone speaker but obvious on AirPods.
- Visualize on a spectrum analyzer (browser DevTools' MediaStream tab or a recorded WAV in Audacity) — see broadband energy at attack as a vertical white bar.
- A/B with the singing bowl: if triangle has audible "tick" before tone and bowl doesn't, it's the click bug.
- User feedback: "the triangle sounds harsh / clicky / synthetic."

**Phase to address:** Triangle Sound phase (the phase that introduces `src/engine/sounds/triangle.ts`). Verification step: "On headphones at 50% volume, attack of triangle is inaudible as a separate event from the tone."

---

### Pitfall 4: AlarmConfig Validation for Segments Has More Failure Modes Than v1.0's

**What goes wrong:** v1.0's `validateConfig` checks four scalar fields are >0 and ≤4 hours. The segment model expands the threat surface considerably:

- **Empty segment list** (`config.segments = []`) — engine starts, fires nothing, user thinks alarm is set. Sleeps through.
- **Single segment with no end-of-segment sound** — runs silently for N minutes, no wake.
- **Zero-duration segment** — fires immediately, then next, then next; entire chain collapses to instant "alarm finished" state.
- **One ridiculously long segment** (e.g., user enters "999" minutes by typo) — alarm scheduled for 16+ hours, user oversleeps.
- **Sound reference to a non-existent sound key** (`segment.sound = 'cowbell'` but only `'gentle' | 'triangle' | 'alarm'` exist) — runtime error in segment callback when trying to dispatch the sound. Engine throws mid-alarm, leaves user un-woken.
- **Total duration exceeds reasonable bound** — sum of all segments is 8 hours; UI happily displays "8h 17m alarm."
- **Segment with negative duration** (typo, JS coercion bug) — `Date.now() + -300_000` yields a fire time in the past, `scheduleAt` fires immediately.
- **NaN duration from invalid form input** — slider/input returns `NaN`, math propagates, every segment fires at `NaN ms`.

**Why it happens:** v1.0's `validateConfig` was designed for fixed-shape configs. Segments are user-authored arbitrary lists. Each item needs validation; the list itself needs validation; the aggregate needs validation; sound IDs need referential validation against the runtime sound registry.

**Consequences:**
- Worst case: silent or absent alarm — user oversleeps, reports "Soundly didn't ring."
- Mid case: alarm fires at wrong time — user oversleeps by hours.
- Soft case: validator throws at `start()` time, button doesn't respond to tap, no error shown to user — user thinks alarm is set but it isn't.

**Prevention:**
1. **Extend `validateConfig` to handle the segment shape:**
   ```ts
   const MIN_SEGMENT_MS = 5_000;        // 5 second minimum (UI may allow lower; clamp)
   const MAX_SEGMENT_MS = 4 * 60 * 60_000; // 4 hours per segment
   const MAX_SEGMENTS = 32;             // sanity cap on segment count
   const MAX_TOTAL_MS = 8 * 60 * 60_000; // 8 hours total — longest reasonable alarm
   const VALID_SOUNDS = new Set(['gentle', 'triangle', 'alarm']);
   ```
   And explicit checks for each: empty list, segment count, per-segment duration, total duration, sound key validity, NaN/negative.
2. **Validate at form-submit time (not just engine-start time)** — show inline UI errors per segment so the user can correct. Disable the "Start Alarm" button if `validateConfig` would throw.
3. **Sanitize at the input layer** — duration picker should be a `<select>` or stepper, not a free-text `<input type="number">` (which can produce NaN, negatives, scientific notation `1e10`). If using number input, use `Number.isFinite()` guard, `Math.floor`, and `Math.max(MIN, Math.min(MAX, value))` clamp on every change.
4. **Sound dropdown should bind to the runtime sound registry,** so removing a sound from code automatically removes it from the dropdown — no orphaned sound IDs.
5. **Treat validation errors as a UI-recoverable state, not exceptions.** `validateConfig` can return `{ valid: true } | { valid: false, errors: ValidationError[] }` instead of throwing — surfaces errors per-field for the form. Throwing is fine in the engine but the form should pre-validate.
6. **Test the empty-segment-list case explicitly** — the most likely user mistake is "I deleted all segments and tapped Start."

**Detection (warning signs):**
- QA: try Start with empty segment list → alarm should not start, error should be visible.
- QA: enter "0" as segment duration → either rejected at input or clamped to MIN with visible feedback.
- Console error in the segment callback: `TypeError: undefined is not a function` (sound dispatch lookup failed).

**Phase to address:** Segment Composer UI phase + Segment Runner phase. The UI phase owns input sanitization; the runner phase owns the engine validator. Both must pass.

---

### Pitfall 5: SPA Meta Tags Are Invisible to Crawlers If You Mutate `<head>` After Mount

**What goes wrong:** A common React pattern for "dynamic" meta tags is to use `react-helmet`, `@unhead/react`, or direct `document.title = ...` / `document.querySelector('meta[name=description]').setAttribute(...)` calls inside a `useEffect`. This works in browsers but **Googlebot can index the static HTML before executing JavaScript on the second-pass render** — so the indexed title and description are whatever was in the static `index.html`, not what `useEffect` wrote. For a single-landing-page PWA where the static `index.html` says `<title>Soundly</title>` and the React component intends to set `<title>Soundly Gentle Alarm — Wake calmly without jarring sounds</title>`, Google indexes the bad title.

Worse: Googlebot's two-pass renderer has been deprioritized (Google now claims "render and index in one pass" for most pages, but real-world testing in 2025 shows JS-rendered meta is *still* delayed by days to weeks for new domains). Open Graph crawlers (Facebook, Twitter, LinkedIn, Slack, iMessage preview) **do not execute JavaScript at all** — they read static HTML only. JS-injected OG tags are completely invisible to them.

**Why it happens:** React renders client-side. The HTML the crawler downloads is the Vite-built `index.html` — only `<title>`, `<meta>`, `<link>` tags that exist in the static file at build time are seen by no-JS crawlers, and OG/Twitter scrapers are hard no-JS.

**Consequences:**
- Search results show wrong / generic title and description.
- iMessage / WhatsApp / Slack / Discord previews of the URL show no image, no description, or stale defaults.
- The marketing landing page exists but cannot rank for its intended keywords.
- Days-to-weeks lag before Google updates the index after JS-rendered changes.

**Prevention:**
1. **Put the canonical landing-page meta directly in `index.html` at build time.** For a single-landing-page app (which Soundly v2.0 is), this is the simplest and most reliable approach. Vite's `index.html` is the source of truth; treat it as a real HTML file, not a React mount point with placeholder tags.
   ```html
   <title>Soundly — Wake calmly with gentle escalating alarms</title>
   <meta name="description" content="A web alarm that wakes you gently…">
   <meta property="og:image" content="https://example.com/Soundly/og-image.png">
   <meta property="og:title" content="Soundly — Wake calmly">
   <meta property="og:description" content="…">
   <meta property="og:url" content="https://example.com/Soundly/">
   <meta name="twitter:card" content="summary_large_image">
   ```
2. **Use a Vite plugin to inject the OG image absolute URL with the deployed base path** (`/Soundly/og-image.png`) so previews work on the GitHub Pages base path. `vite-plugin-html` or a custom `transformIndexHtml` hook can substitute `%OG_IMAGE_URL%` placeholders.
3. **Do NOT use `react-helmet` or `@unhead/react` for the landing-page tags.** Those libraries are for *route-changing SPAs* where each route needs different meta. Soundly v2.0 has effectively one indexable URL (the root). Static `<head>` is correct here.
4. **For the JSON-LD structured data, also embed it directly in `index.html`:**
   ```html
   <script type="application/ld+json">
     { "@context": "https://schema.org", "@type": "WebApplication", … }
   </script>
   ```
5. **If the future requires per-route meta (e.g., a `/about` or `/faq` page),** consider Vite SSG plugins (`vite-plugin-ssg`, `vite-plugin-react-meta-map`) that prerender each route to a static HTML file with route-specific tags. Do not rely on client-side meta mutation.

**Detection (warning signs):**
- View the page source (`Ctrl+U`, NOT DevTools "Elements" — Elements shows the live DOM after JS) and search for the intended title — if absent, no-JS crawlers won't see it.
- `curl -A "facebookexternalhit/1.1" https://yourdomain/Soundly/` and check the returned HTML — must contain the OG tags as static markup.
- Test in [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) and [Twitter Card Validator](https://cards-dev.twitter.com/validator) — both will show the static-HTML view, not the JS-rendered view.
- Google Search Console "URL inspection" tool shows the rendered HTML — useful for verification but slow feedback loop.

**Phase to address:** SEO Meta phase (the phase that introduces `<title>`, meta tags, OG tags, JSON-LD). The phase plan must specify "edit `index.html` directly, do not introduce a meta-mutation library." Verification step: "View page source (not Elements) — assert title, OG tags, JSON-LD all present in static HTML."

---

### Pitfall 6: vite-plugin-pwa Precaches `/Soundly/index.html` — Stale Meta Tags Persist Forever Without Cache Bust

**What goes wrong:** The project's `vite.config.ts` uses `strategies: 'injectManifest'` and `src/sw.ts` calls `precacheAndRoute(self.__WB_MANIFEST)` plus `createHandlerBoundToURL('/Soundly/index.html')` in a `NavigationRoute`. This means **`index.html` (and therefore all the OG/meta/JSON-LD tags inside it) is precached by the service worker for installed PWA users**. When you ship updated meta tags, *installed PWA users continue to load the old precached `index.html`* until the service worker activates the new precache manifest — and even then, the activation may take a tab close/reopen, and the OG image referenced by the cached HTML may itself be precached at the old URL.

The double-edged consequence: SEO tags update fine for fresh search-engine crawls (they hit the network HTML), but **iMessage / Slack / WhatsApp previews shared *from* the installed PWA may still reference the old OG image** until the user's SW updates.

**Why it happens:** Workbox's precache uses revision hashes per asset. A change to the *content* of `index.html` produces a new revision; the new SW will replace the old on next activation. But:
- Activation requires all old SW clients to close (the `clients.claim()` + `skipWaiting()` dance is needed for immediate activation).
- The OG image at `/Soundly/og-image.png` is a separate asset with its own revision. If you update the image content but not the filename, Workbox revisions it correctly *internally* — but Facebook's OG cache (separate from the user's browser cache) keys on the URL. Same URL = same cached OG image at Facebook for 7–30 days.

**Consequences:**
- Updated landing copy doesn't show in OG previews even after the SW updates, because the OG cache is at Facebook/Twitter/LinkedIn, not in the user's browser.
- Installed PWA users see old landing page even after deploy until SW activates.
- Rolling back a bad deploy doesn't fix the OG embeds — once a bad image is cached at Facebook, only the Sharing Debugger or a URL change clears it.

**Prevention:**
1. **Set `registerType: 'autoUpdate'`** in `vite.config.ts` `VitePWA({ ... })` so SW updates activate without manual user action. Currently the config does not set this — defaults to `'prompt'` which requires user to confirm an update.
   ```ts
   VitePWA({
     registerType: 'autoUpdate',
     // ...
   })
   ```
   Combined with `skipWaiting()` + `clientsClaim()` inside `sw.ts`, this gives the fastest safe update path.
2. **Add `self.skipWaiting()` and `self.clients.claim()` to `src/sw.ts`** at install/activate respectively — current `sw.ts` doesn't have these, so updates wait for all tabs to close.
3. **Version OG images in their filename, not just their content:** name them `og-image-v2.png` (or hash them). When you change copy / branding, change the filename. This guarantees Facebook's cache treats it as a new image. Keep the old filename redirecting or alive for a transition period if preview-shared links are likely.
4. **Pre-warm the OG cache on deploy** by hitting the [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) and [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/) for the canonical URL after each deploy that touches OG tags. Twitter / X automatically re-scrapes after 7 days but can be force-refreshed via the Card Validator. Worth a "post-deploy checklist" entry.
5. **Do not precache `og-image.png` aggressively** — let it use a `NetworkFirst` or `StaleWhileRevalidate` strategy via Workbox's `registerRoute`. The OG image is meant to be fetched by *external* crawlers (Facebook, etc.), not by the PWA shell — precaching it serves no PWA purpose. Add an exclusion:
   ```ts
   precacheAndRoute(self.__WB_MANIFEST.filter(e => !e.url.includes('og-image')));
   ```
   Or generate the OG image into a `/public/seo/` folder excluded from the manifest by glob pattern.
6. **Honest acknowledgment in the deploy runbook:** "After a meta/landing change, OG previews on Facebook/LinkedIn will lag up to 24 hours unless we manually re-fetch via the debugger."

**Detection (warning signs):**
- Deploy a meta change. Visit the live URL in a browser-private tab — should show new title. Visit in installed PWA — may still show old title (depending on SW state).
- Share the URL in iMessage / Slack — preview shows old OG image / title for hours after deploy.
- Service worker DevTools tab shows old SW in `activated` state and new SW in `waiting`.

**Phase to address:** SEO Meta phase (sets the precaching strategy for `index.html` and OG image) + landing page phase (specifies the "version the filename" practice) + deploy/runbook update.

---

### Pitfall 7: JSON-LD Validation Errors Are Silent — Wrong Schema Just Doesn't Show Rich Results

**What goes wrong:** A JSON-LD block with a typo (`"@contxt"` instead of `"@context"`), invalid `@type` (`"WebApp"` instead of `"WebApplication"`), missing required fields, or malformed nested objects produces no error in the browser, no error in the page source, and no error in Search Console for several days. Google silently drops it. The implementer thinks JSON-LD is working because they pasted it from a guide; the rich result eligibility never appears.

A second trap: even *valid* `SoftwareApplication` / `WebApplication` schema **does not produce a Google rich result by itself** — Google's Rich Results Test only validates against ~30 pre-approved schema types that have rich treatments in SERP. SoftwareApplication is supported for app rich results (price, rating, install count) but only when the required fields (`name`, `operatingSystem`, `applicationCategory`, `offers` or `aggregateRating`) are all present. Missing one = no rich result, no error message.

**Why it happens:** Schema.org validation is permissive. JSON-LD parsers ignore unknown properties. Google's validation only checks for the presence of fields it cares about for SERP rendering, and gives partial errors only via the Rich Results Test, not in normal indexing.

**Consequences:**
- Marketing landing has JSON-LD but no rich result eligibility shows up in Search Console after weeks.
- Implementer thinks the schema is a free SEO win; it's actually invisible.
- A typo in `@context` makes the entire block invalid, indistinguishable from "Google decided not to show a rich result."

**Prevention:**
1. **Validate every JSON-LD block in [Google Rich Results Test](https://search.google.com/test/rich-results) before committing.** Paste the block; it shows which fields are missing for rich result eligibility and which @types it recognizes.
2. **Cross-validate with [Schema.org Validator](https://validator.schema.org/)** — Google's tool only flags Google-supported types; the schema.org validator catches generic structure errors (malformed JSON, invalid @types).
3. **Use a JSON-LD generator tool to scaffold the schema** — generators emit syntactically valid schemas with required fields pre-filled. Then trim to the real values.
4. **Required fields for `SoftwareApplication` rich result:**
   ```json
   {
     "@context": "https://schema.org",
     "@type": "SoftwareApplication",
     "name": "Soundly",
     "operatingSystem": "Web, iOS, Android",
     "applicationCategory": "UtilitiesApplication",
     "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" }
   }
   ```
   `aggregateRating` is optional and **should be omitted if you don't have real ratings** — fake ratings are a Google policy violation and trigger manual penalties.
5. **Embed JSON-LD as a `<script type="application/ld+json">` in static `index.html`** — same reasoning as Pitfall 5; crawlers won't execute JS to read it.
6. **Do not add multiple conflicting `@type`s** (e.g., one `SoftwareApplication` block and one `WebApplication` block). Pick one. `WebApplication` is a subtype of `SoftwareApplication`; either works for a PWA, but use one canonical block. `SoftwareApplication` is more broadly recognized by Google.
7. **Re-run the Rich Results Test after every change to the JSON-LD.** Add it to the deploy checklist.

**Detection (warning signs):**
- Rich Results Test reports 0 detected items → JSON-LD is malformed or wrong @type.
- Rich Results Test reports the @type but says "no rich result eligible" → required fields missing.
- Search Console "Enhancements" section never lists the schema after 1–2 weeks of indexing.

**Phase to address:** SEO Meta phase. Verification step: "JSON-LD passes both Rich Results Test and Schema.org Validator with zero errors and at least one detected eligible @type."

---

## Moderate Pitfalls

### Pitfall 8: Form State for Segments — `useReducer` with Index-Based Operations Trips Stale Closures

**What goes wrong:** Implementing the segment list as `useState<Segment[]>([])` with handlers like `onRemove(index) => setSegments(prev => prev.filter((_, i) => i !== index))` is correct *if* you use the functional updater. The bug appears when the implementer reaches for the non-functional form: `setSegments(segments.filter((_, i) => i !== index))` inside an event handler that closes over a stale `segments` value — common when the handler is generated in a `.map()` and the user clicks "Remove" on segment 3 just after a previous remove already shifted indices.

A specific footgun: **drag-and-drop reorder + "remove segment" buttons that use array indices**. The reorder updates the array; the remove handler's closed-over `index` is now stale. User taps Remove on what visually appears to be segment 4, but the handler removes the segment that was at index 4 before reorder.

**Why it happens:** React closures capture variables at render time. Handlers created in `.map((seg, i) => <Button onClick={() => remove(i)}>)` capture the `i` at render — fine within a single render. But if a parent state update re-renders some children and not others (uncommon but possible with memoization), or if the handler is passed as a stable ref, the `i` can be stale relative to the current state.

**Prevention:**
1. **Always use functional setState for array mutations:**
   ```ts
   const removeSegment = (id: string) => setSegments(prev => prev.filter(s => s.id !== id));
   ```
2. **Key segments by stable ID, not by index.** Generate a UUID (`crypto.randomUUID()`) when a segment is added; use it as the React `key` and as the operand for remove/reorder/update. This eliminates the entire class of "index changed under me" bugs.
3. **For the segment list, consider `useReducer` over `useState[]`** — actions like `{ type: 'REMOVE', id }`, `{ type: 'REORDER', from, to }`, `{ type: 'UPDATE', id, patch }` make the state transitions explicit and testable. Mirrors the v1.0 `AlarmEngine` state-machine philosophy.
4. **Use the React 19 form actions API** (`<form action={fn}>`) for the final "save / start alarm" handler — gets you Suspense integration and pending state for free; less relevant for segment editing itself.
5. **Use `eslint-plugin-react-hooks` exhaustive-deps rule** — it flags most stale-closure bugs at lint time.

**Phase to address:** Custom Mode UI phase.

---

### Pitfall 9: Drag-and-Drop Reorder on Touch Devices Conflicts with Page Scroll and Lacks Keyboard Path

**What goes wrong:** A naive HTML5 `draggable` implementation breaks immediately on touch devices: touch events don't trigger `dragstart` at all in iOS Safari (HTML5 drag-and-drop has zero touch support in Safari). Library-based DnD (e.g., `react-dnd` with `react-dnd-touch-backend`, vanilla `Sortable.js`, `dnd-kit`, `@hello-pangea/dnd`, or `react-aria` DnD) is required.

Even with a library, two pitfalls remain:
- **Touch-scroll conflict:** if the drag handle is the entire segment row, swiping to scroll the page initiates a drag instead. User tries to scroll the segment list and accidentally reorders it.
- **Accessibility:** mouse drag-and-drop has no keyboard equivalent unless the library implements one. Screen readers cannot announce "moved item from position 3 to position 1" without explicit support.

**Why it happens:** HTML5 DnD predates touch and has never been retrofitted. Touch DnD requires manual touch-event handling; libraries do this. Keyboard / SR support requires an entirely separate API surface (focus management, `aria-grabbed`, live region announcements).

**Prevention:**
1. **Use a library with first-class touch + keyboard + SR support.** Recommended (in 2026): `dnd-kit` (modular, headless, supports keyboard + SR + touch + mouse) OR `@hello-pangea/dnd` (the maintained fork of `react-beautiful-dnd`, simpler API, has keyboard + SR built in) OR `react-aria` DnD primitives (most accessible, more boilerplate). Avoid vanilla `Sortable.js` — it has touch but weak SR support.
2. **Use a dedicated drag handle, not the whole row.** A small "≡" handle on the left/right of each segment row that the user must press to initiate drag. The rest of the row is tappable for editing fields and scrollable for page scroll.
3. **Set `touch-action: pan-y` on the segment list container** so vertical page scroll wins by default; the drag library activates only after the user touches the handle (which has `touch-action: none`).
4. **Provide a keyboard reorder path** (up/down arrow buttons next to each segment, or "Move up" / "Move down" buttons in a context menu). This is the pragmatic minimum even without full ARIA DnD support.
5. **Test with VoiceOver on iOS** — try to reorder with eyes closed using only the screen reader. If the announcements are nonsensical, the SR support isn't there yet.

**Phase to address:** Custom Mode UI phase. If reorder turns out to be too costly to do accessibly, consider deferring it (segments can be edited by add/remove/insert-at-position) — explicit cut from the milestone is better than shipping inaccessible DnD.

---

### Pitfall 10: Wake Easy Preset Hardcodes 17 Minutes — Drift in Any One Segment Throws Off the Total

**What goes wrong:** The Wake Easy spec is "4 × 4 min gentle + 1 × 1 min alarm = 17 min." The implementer writes `WAKE_EASY_CONFIG = { segments: [...] }` with literal durations. Any drift in segment timing (Pitfall 1) doesn't just shift the alarm — it changes the *promised total duration* shown in the UI. If the UI separately computes `sum(segments.duration)` as "17 min" but the actual fire time drifts to 17:30, users get inconsistent expectations.

A subtler version: a future preset designer (you, in 6 months) tweaks one segment's duration without updating the docs/copy; the "17 min" label silently becomes wrong.

**Prevention:**
1. **Compute total duration from the segment list, not from a constant:**
   ```ts
   const totalMs = WAKE_EASY_CONFIG.segments.reduce((sum, s) => sum + s.durationMs, 0);
   const totalLabel = formatDuration(totalMs); // "17 min"
   ```
   Single source of truth.
2. **Display the *expected* completion time on the running countdown UI** (e.g., "Alarm at 7:17 AM") computed at start time — users can verify match against their wake target.
3. **Snapshot Pitfall 1's prevention** — if all fire times are computed absolutely at `start()` from `Date.now()`, the total cannot drift relative to the start time, only relative to wall clock if the JS thread is fully suspended. Acceptable.
4. **Unit test that `WAKE_EASY_CONFIG` totals to exactly 17 minutes** so future edits trip the test if total changes.

**Phase to address:** Wake Easy preset phase + Segment Runner phase.

---

### Pitfall 11: "Add to Home Screen" Anti-Patterns on the Landing Page

**What goes wrong:** Trying to encourage PWA install via:
- **Showing the install banner on every visit** → hostile UX, tanks conversion.
- **Showing the install banner when already installed** → embarrassing, looks broken.
- **Relying on `beforeinstallprompt` for iOS** → never fires on iOS Safari; iOS users see no install path at all unless given manual Add-to-Home-Screen instructions.
- **Showing iOS install instructions to Android users** (or vice versa) → confuses users with wrong steps.
- **Re-showing the dismissed banner on next visit without remembering dismissal** → death spiral of annoyance.

**Why it happens:** `beforeinstallprompt` is Chrome/Edge-only (and Samsung Internet, Opera). Safari ignores it entirely. iOS install requires the user to tap Share → Add to Home Screen manually — there is no API to trigger this. Most one-line "PWA install" tutorials skip iOS entirely or show a generic "install our app" button that does nothing on iPhone.

**Prevention:**
1. **Detect platform and display mode before showing any install prompt:**
   ```ts
   const isStandalone = window.matchMedia('(display-mode: standalone)').matches
                     || (navigator as any).standalone === true; // iOS legacy flag
   const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
   ```
   - If `isStandalone` → never show install UI (already installed).
   - If iOS + browser → show **manual instructions card**: "Tap Share, then Add to Home Screen." Include an annotated screenshot or icon.
   - If non-iOS + `beforeinstallprompt` available → save the deferred prompt event, show a styled "Install" button that calls `event.prompt()` on click.
   - If non-iOS + no event → hide the install UI.
2. **Remember dismissal in localStorage** (the one persistent state Soundly should allow itself, despite the project's "no persistence" rule — install nudge dismissal is UX hygiene, not user data) and don't re-show for 30 days.
3. **Don't show the install nudge on first visit.** Show it after the user has tapped a preset card (signal of intent). Or as a small sticky bar that doesn't dominate the page. Or in an FAQ section as opt-in info.
4. **In the landing page copy, be honest:** "On iPhone, install from your browser's Share menu for the best experience" — set expectations.

**Phase to address:** Landing page phase. Test on both iOS Safari and Android Chrome — these are the two install paths to verify.

---

### Pitfall 12: robots.txt Blocking the Manifest, Service Worker, or Precached Assets

**What goes wrong:** A copy-pasted "secure" robots.txt that disallows `/api/`, `/admin/`, etc. is harmless. But common variants block:
- `Disallow: /` for staging/preview environments that get accidentally promoted.
- `Disallow: /*.json$` blocks `manifest.webmanifest` and `manifest.json` → search engines can't read app metadata.
- `Disallow: /sw.js` or `/Soundly/sw.js` → blocks the service worker file from being fetched by anything claiming to respect robots (Google's renderer used to respect this; modern Googlebot ignores robots for SW per public statement, but other crawlers may not).
- `Disallow: /assets/` → blocks the JS/CSS bundles → Google can't render the page → indexing fails.
- Missing `Sitemap: https://example.com/Soundly/sitemap.xml` reference at the bottom → Google Search Console must be told manually instead of via the standard discovery mechanism.

For Soundly hosted at `/Soundly/`, the project's robots.txt MUST live at the *origin root* (`/robots.txt`), not under `/Soundly/robots.txt` — robots.txt is per-origin, not per-path. If the deploy is on `username.github.io/Soundly/`, the robots.txt is at `username.github.io/robots.txt` (which the project may not control on a github.io subdomain).

**Prevention:**
1. **Use a minimal, permissive robots.txt:**
   ```
   User-agent: *
   Allow: /

   Sitemap: https://yourdomain/Soundly/sitemap.xml
   ```
2. **Verify with [Google Search Console robots tester](https://search.google.com/search-console/settings/robots-txt)** before deploy.
3. **For GitHub Pages on a path-based deploy:** the user's `username.github.io/robots.txt` is the canonical robots.txt, which may not include the Soundly project's sitemap reference. Either (a) host on a custom domain where you control the root, or (b) accept that robots.txt at the project path is non-standard and rely on Search Console's manual sitemap submission.
4. **Sitemap.xml should list canonical URLs only**, must be valid XML, must use HTTPS URLs that match the canonical site URL exactly (no http:// when the site is https://, no `www.` mismatch, no trailing slash mismatch).
5. **Keep the sitemap auto-generated** at build time from the route list — even for a single-page app, a 1-URL sitemap is correct. Don't omit it.

**Phase to address:** SEO Meta phase / Landing page phase.

---

### Pitfall 13: Marketing Landing + App Shell Sharing the Same React Bundle Wastes Initial Load

**What goes wrong:** If the landing page is implemented as a React component in the same `src/` tree as the alarm app, every visitor downloads the entire app bundle (audio engine, alarm state machine, segment runner, sound synthesis modules, all ~hundreds of KB) just to view a static-looking landing page. Time-to-first-paint suffers; bounce rate increases for visitors who arrived from search and never tap "Start Alarm."

For a PWA, the situation is nuanced: precaching means returning users get the bundle from SW cache fast, but **first-time visitors from search results download the full bundle synchronously**. SEO tools (Lighthouse, PageSpeed Insights) measure first-time load; a slow LCP hurts ranking.

**Why it happens:** Vite by default emits one main bundle plus dynamic imports as separate chunks. Without explicit `lazy()` / `Suspense` boundaries, all top-level imports are eager.

**Prevention:**
1. **Code-split the alarm engine behind a `lazy()` boundary.** The landing page should be a small route (or the default view) that imports only landing-page UI. The alarm engine and audio modules load only when the user taps "Start Alarm" or navigates to the app shell.
   ```ts
   const AlarmShell = lazy(() => import('./AlarmShell'));
   ```
   Bundle the audio synthesis (`singingBowl`, `phase3Tone`, `triangle`) inside `AlarmShell`'s chunk so they don't ship in the landing bundle.
2. **Keep landing page under 50KB JS** if possible — a hero section, screenshots, FAQ, and install CTA don't need React for static content. Consider rendering most of the landing as plain HTML in `index.html` and mounting React only for interactive components (install button, "Start Alarm" → opens app shell).
3. **Or split into two HTML entry points:** `index.html` for the landing (no React, just HTML/CSS/Tailwind), `app.html` for the React app. vite-plugin-pwa can precache both. Two URLs, two precached entries, separate concerns. More work, cleanest result for SEO.
4. **Defer non-critical assets:** OG image, screenshots, font files — `<link rel="preload">` for above-the-fold, `loading="lazy"` for below-the-fold images.
5. **Measure LCP in Lighthouse before and after.** Goal: landing LCP < 2.5s on simulated mobile 4G.

**Phase to address:** Landing page phase + bundle architecture decision (may belong in the SEO phase or landing phase depending on whose roadmap entry owns the bundle topology).

---

## Minor Pitfalls

### Pitfall 14: Sitemap Lists Only the Root URL But Excludes the App Shell Route

**What goes wrong:** If the landing page is at `/Soundly/` and the app shell at `/Soundly/app` (or wherever), forgetting to list the app shell URL in `sitemap.xml` means search results only ever surface the landing — fine for marketing but means deep-linked content (if any future routes are added) won't be indexed.

**Prevention:** Auto-generate sitemap from the route list. For v2.0 with a single landing URL this is fine; document the assumption so v3.x doesn't forget.

**Phase to address:** SEO Meta phase.

---

### Pitfall 15: Triangle Sound Plays Loud on Test Sound Button Because No Volume Normalization

**What goes wrong:** Each new sound (`singingBowl`, `triangle`, `alarm`) is synthesized with its own peak gain. Without normalization, the triangle may be perceptually 3× louder than the singing bowl at the same nominal `gain.value = 1.0`, because perceived loudness depends on frequency content (high frequencies sound louder at equal amplitude per Fletcher-Munson). Users tap "Test Sound" expecting calm; ear-stab.

**Prevention:**
1. **Loudness-normalize each sound.** Either by ear (the simplest: A/B them on a phone speaker until they sound equally loud, document the gain values) or with a true `LoudnessNormalization` step (overkill for v2.0).
2. **Provide a single `playSound(soundId)` API** that handles per-sound gain calibration internally; callers don't pass gain.
3. **Test all three sounds back-to-back at the same system volume** before shipping.

**Phase to address:** Triangle Sound phase + sound dispatch in Segment Runner.

---

### Pitfall 16: OG Image Below 200KB Constraint Easy to Miss with Screenshots

**What goes wrong:** Open Graph spec recommends 1200×630 PNG/JPG under ~200KB (some platforms are more lenient, but Facebook downsamples large images and Twitter rejects > 5MB). A high-res screenshot exported from a phone simulator is typically 500KB–2MB.

**Prevention:**
1. **Optimize the OG image:** export at exactly 1200×630, save as JPEG (higher compression than PNG for photographic content) or PNG with `pngquant`/`oxipng`.
2. **Verify file size after export.** A 200KB target is conservative; ≤ 1MB is the practical Twitter limit.
3. **Use 1.91:1 ratio exactly** (1200×630 = 1.905) — deviating crops or letterboxes the preview.

**Phase to address:** SEO Meta phase / asset prep.

---

### Pitfall 17: Honest iOS Limitations on the Landing Page Get Lost in Marketing Polish

**What goes wrong:** The landing page promises "wakes you reliably" but per `ios-alarm-feasibility.md`, locked-screen iOS reliability is structurally limited. Marketing copy that overpromises drives App Store-style 1-star reviews ("doesn't actually work, my alarm didn't ring"). v1.0 has a known gap; v2.0 introduces a public landing page that is the first thing a new user sees.

**Prevention:**
1. **Add an honest FAQ entry on the landing:**
   - "Does Soundly work when my iPhone is locked?" → "Soundly works best on iPhone when installed to home screen and with the app open. iPhone restricts background alarms for web apps; for guaranteed locked-screen alarms, see the [iOS native app](#) (when shipped)."
   - "Does Soundly work on Android?" → "Yes, including with screen off when installed to home screen with notifications enabled."
2. **Don't bury the limitation.** Surface it on the landing or first-run, not in a hidden help page. Trust > conversion.
3. **Encourage installation explicitly** — "For best results, install Soundly to your home screen."

**Phase to address:** Landing page phase.

---

### Pitfall 18: Triangle Frequency in 440Hz–1kHz Range Sonically Clashes with Singing Bowl

**What goes wrong:** Picking a triangle fundamental in the same range as the singing bowl's harmonics (~196Hz–800Hz) makes the two sounds blur together when used in adjacent segments. Users perceive "another bowl" rather than "a different sound for a different segment cue."

**Prevention:**
1. **Pitch the triangle at least an octave above the bowl's brightest partial.** Singing bowl in `singingBowl.ts` (read it before tuning the triangle) — pick a triangle fundamental that doesn't share notes/intervals with the bowl partials.
2. **A/B test the two sounds in sequence** — they should be obviously distinguishable to a sleepy user.
3. **Consider micro-detune for character** — three triangle oscillators at e.g., 1864Hz, 1868Hz, 1872Hz produce shimmer that pure single-frequency triangle lacks.

**Phase to address:** Triangle Sound phase.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| Segment Runner | Chained `setTimeout` drift over 17-min Wake Easy | Compute all fire times absolutely at start; use AudioContext.currentTime for sub-second accuracy (Pitfall 1) |
| Segment Runner | Pause/resume semantics ambiguous across N segments | Pick option (a) "resume mid-segment"; snapshot per v1.0 pattern; disable Pause in alarm segment (Pitfall 2) |
| Segment Runner | Validation surface expanded (empty list, NaN, sound-key) | Extend `validateConfig`; sanitize at form layer; error-return not throw (Pitfall 4) |
| Segment Composer UI | Stale closures in remove/reorder by index | Functional updaters; key by stable UUID, not index; `useReducer` (Pitfall 8) |
| Segment Composer UI | Drag-and-drop breaks on touch / no keyboard path | Use `dnd-kit` or `@hello-pangea/dnd`; dedicated drag handle; provide arrow-button reorder fallback (Pitfall 9) |
| Triangle Sound | Click transient on attack/release | 5ms `linearRampToValueAtTime` on attack, 50ms on release (Pitfall 3) |
| Triangle Sound | Volume mismatch with singing bowl | Loudness-normalize by ear; route through single `playSound` API (Pitfall 15) |
| Triangle Sound | Frequency clash with singing bowl | Pitch ≥ 1 octave above bowl partials; test in sequence (Pitfall 18) |
| Wake Easy Preset | "17 min" label drifts from actual total | Compute label from `sum(segments.duration)`; unit test asserts 17 min total (Pitfall 10) |
| SEO Meta | JS-injected meta tags invisible to crawlers | Embed all meta + JSON-LD in static `index.html`; do not use react-helmet (Pitfall 5) |
| SEO Meta | JSON-LD silently fails validation | Run [Rich Results Test](https://search.google.com/test/rich-results) + [schema.org validator](https://validator.schema.org/) before commit (Pitfall 7) |
| SEO Meta | vite-plugin-pwa precache serves stale meta forever | Set `registerType: 'autoUpdate'`; add `skipWaiting/clientsClaim`; version OG image filenames (Pitfall 6) |
| SEO Meta | OG image cached at Facebook for weeks | Force-refresh via Sharing Debugger after deploy; version filename when content changes (Pitfall 6) |
| SEO Meta | OG image > 200KB or wrong ratio | Export 1200×630, JPG, < 200KB ideal (Pitfall 16) |
| SEO Meta | robots.txt blocks manifest/SW/assets | Use minimal `Allow: /` + Sitemap line; test in Search Console robots tester (Pitfall 12) |
| Landing Page | Bundle bloat — alarm engine ships with landing | `lazy()` the AlarmShell; consider two-entry-point split (Pitfall 13) |
| Landing Page | iOS install instructions missing | `display-mode` + `iOS UA` detect; show manual Share→Add to Home Screen (Pitfall 11) |
| Landing Page | Repeat install nudges annoy users | Remember dismissal in localStorage; show after first preset tap, not on first paint (Pitfall 11) |
| Landing Page | iOS limitation hidden from users | Honest FAQ entry on landing; recommend home-screen install (Pitfall 17) |
| Landing Page | Sitemap missing app routes | Auto-generate from route list; OK to be 1-URL for v2.0 (Pitfall 14) |

---

## Cross-Cutting Verification Steps for Roadmapper

These are the gates the milestone should pass before declaring v2.0 complete:

1. **17-minute Wake Easy drift test** — start the preset, lock phone, verify alarm fires within 5s of expected wall time on Android. (Bounded test on iOS due to known suspension; document iOS behavior.)
2. **Empty / single-segment / 0-duration validation** — UI rejects with inline error before allowing Start.
3. **Pause-resume integrity test** — pause mid-segment-3 of a 5-segment alarm; resume after 30s; total duration extends by 30s, not less, not more.
4. **Triangle attack listening test** — on headphones, no audible click before tone.
5. **OG preview test** — share live URL to Slack and iMessage; correct title, description, image render.
6. **Rich Results Test pass** — JSON-LD passes both Google's tool and schema.org validator.
7. **View source test** — `Ctrl+U` on landing shows title, description, OG tags, JSON-LD as static HTML (not just in DevTools Elements).
8. **Service worker update test** — deploy a meta change; new tab loads new meta; existing PWA installs activate new SW within 1 reload (with `autoUpdate` + `skipWaiting`).
9. **iOS install instructions test** — load landing on iPhone Safari; manual install instructions visible. Load installed PWA; instructions hidden.
10. **Touch reorder test** — on iPhone, scroll segment list (page scrolls), drag handle (segment reorders); no conflict.
11. **Keyboard reorder test** — Tab to a segment, arrow keys or buttons to reorder. Screen reader announces moves.
12. **Lighthouse PWA + SEO + Performance** — landing scores 90+ on mobile.

---

## Sources

**HIGH confidence (Apple/WebKit/MDN/Google official):**

- MDN — Web Audio API best practices (verified): https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices
- web.dev — A tale of two clocks (Chris Wilson, canonical scheduling pattern): https://web.dev/articles/audio-scheduling
- MDN — `linearRampToValueAtTime` / GainNode: https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/linearRampToValueAtTime
- Google — Software App (SoftwareApplication) structured data: https://developers.google.com/search/docs/appearance/structured-data/software-app
- Google — Rich Results Test: https://search.google.com/test/rich-results
- Schema.org Validator: https://validator.schema.org/
- vite-plugin-pwa — Service Worker Precache guide: https://vite-pwa-org.netlify.app/guide/service-worker-precache
- vite-plugin-pwa GitHub — Bust cache after release (issue #33): https://github.com/vite-pwa/vite-plugin-pwa/issues/33
- vite-plugin-pwa GitHub — exclude index.html from precache (issue #481): https://github.com/vite-pwa/vite-plugin-pwa/issues/481
- MDN — Making PWAs installable (covers `beforeinstallprompt` and iOS lack thereof): https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
- web.dev — Installation prompt: https://web.dev/learn/pwa/installation-prompt
- React Aria / React Spectrum — Accessible drag and drop: https://react-spectrum.adobe.com/react-aria/dnd.html
- Adobe — Taming the dragon (accessible DnD): https://react-spectrum.adobe.com/blog/drag-and-drop.html
- Smashing Magazine — Accessible list reordering: https://www.smashingmagazine.com/2018/01/dragon-drop-accessible-list-reordering/

**MEDIUM confidence (community/industry, multiply confirmed):**

- Brave River Solutions — Clearing Facebook Open Graph and Twitter Cards Cache: https://www.braveriver.com/blog/how-to-clear-facebook-open-graph-and-twitter-cards-cache-on-demand/
- OG Preview — Why Open Graph Images Not Updating (2025): https://ogpreview.app/why-og-images-not-updating/
- Stackmatix — SPA Meta Tags and Dynamic Rendering: https://www.stackmatix.com/blog/spa-meta-tags-dynamic-rendering
- DEV Community — Why SPAs Still Struggle with SEO (2025): https://dev.to/arkhan/why-spas-still-struggle-with-seo-and-what-developers-can-actually-do-in-2025-237b
- Anton Leybov / Medium — vite-plugin-pwa update handling in React + Vite: https://medium.com/@leybov-anton/how-to-control-and-handle-last-app-updates-in-pwa-with-react-and-vite-cfb98499b500
- BrightCoding — Ultimate guide to vite-plugin-pwa: https://www.blog.brightcoding.dev/2025/12/03/the-ultimate-guide-to-transforming-vite-apps-into-lightning-fast-pwas-with-vite-plugin-pwa/
- Puck Editor — Top 5 Drag-and-Drop Libraries for React 2026: https://puckeditor.com/blog/top-5-drag-and-drop-libraries-for-react
- BrightCoding — @dnd-kit deep dive: https://www.blog.brightcoding.dev/2025/08/21/the-ultimate-drag-and-drop-toolkit-for-react-a-deep-dive-into-dnd-kit/
- TKDodo — Hooks, Dependencies and Stale Closures: https://tkdodo.eu/blog/hooks-dependencies-and-stale-closures
- TPGi — The Road to Accessible Drag and Drop: https://www.tpgi.com/the-road-to-accessible-drag-and-drop-part-1/

**Project context:**

- `.planning/PROJECT.md` — v2.0 milestone scope (Custom Alarm Composer + Discoverability)
- `.planning/research/v1.0/PITFALLS.md` — v1.0 pitfalls (foundational, all still in force)
- `.planning/research/ios-alarm-feasibility.md` — iOS reality for honest landing page promises
- `src/engine/AlarmEngine.ts` — existing scheduling pattern (drift-free wall-clock per phase; segment runner extends this pattern)
- `src/engine/AlarmState.ts` — existing `validateConfig` pattern (segment validation extends this)
- `src/engine/timer.ts` — `scheduleAt` drift-free wall-clock implementation
- `src/sw.ts` — current service worker (precaches `/Soundly/index.html`, no `skipWaiting/clientsClaim`)
- `vite.config.ts` — `injectManifest` mode, base path `/Soundly/`, no `registerType` set (defaults to `prompt`)

---

**Research date:** 2026-05-04
**Re-validate:** Re-check vite-plugin-pwa version, OG/Schema.org Google policy, dnd-kit / @hello-pangea/dnd version compatibility before phase implementation begins.
