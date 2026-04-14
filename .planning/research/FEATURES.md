# Feature Landscape

**Domain:** Gentle alarm / meditation timer / sleep timer PWA
**Researched:** 2026-04-14
**Confidence note:** Web search and WebFetch were unavailable. Analysis draws on training-data knowledge of Sleep Cycle, Gentle Alarm (Android), Insight Timer, Oak, Calm, Waking Up, and the broader alarm/meditation timer category. Confidence is MEDIUM — these are stable, well-documented product categories, but specific current UI patterns may have shifted.

---

## Reference Apps Surveyed

| App | Category | Key differentiator |
|-----|----------|--------------------|
| Sleep Cycle | Sleep tracker + gentle alarm | Wakes in lightest sleep phase via microphone/accelerometer |
| Gentle Alarm | Android alarm | Multi-phase escalation (pre-alarm soft → main alarm) |
| Insight Timer | Meditation timer | Bell intervals, ambient sound layers, session logging |
| Oak | Meditation timer | Breathing patterns, interval bells, minimalist UI |
| Calm | Meditation + sleep | Curated audio library, sleep stories, guided sessions |
| Waking Up | Meditation | Session-based, no alarm, daily check-in |
| Google Clock | System alarm | Sunrise alarm, gradual volume, snooze |
| iOS Clock | System alarm | Bedtime mode, volume ramp, haptic wake |

---

## Table Stakes

Features users expect from any gentle alarm or meditation timer. Missing = product feels broken or inferior.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Set a timer duration | Core loop — without this there is no product | Low | Must be fast, 1–2 taps from home screen |
| Alarm fires reliably | Fundamental promise — failing here destroys trust immediately | High | The hardest problem in browser-based alarms; see PITFALLS.md |
| Gentle start sound | Defining feature of the category; users chose "gentle alarm" for a reason | Medium | Sound quality matters — harsh synthesis is worse than silence |
| Volume escalation to full | Safety net — user must wake even if gentle phases fail | Medium | Must reach 100% volume as a backstop |
| Stop / Dismiss button | Must be easy to hit while groggy, large tap target | Low | Small buttons cause frustration and complaints |
| Snooze (or explicit no-snooze) | Every alarm app has snooze; must either include it or make a clear design statement that it is absent | Low | No-snooze is a valid choice but must be communicated |
| Works on phone screen-off | Users expect alarm to fire when phone is pocketed or sleeping | High | Hardest PWA constraint; requires combined keepalive strategy |
| No audio glitches or gaps | Silence mid-alarm or stuttering audio reads as "broken" | Medium | Web Audio API scheduling requires care with buffer sizing |
| Works without internet after install | Offline-first expectation once installed as PWA | Medium | Service worker + audio synthesis must be fully offline |
| Dark mode support | Dominant expectation on mobile in 2026, especially for nighttime use | Low | System-following toggle is sufficient |
| Clear countdown display | Users want to see time remaining; absence of it creates anxiety | Low | Large readable type, visible from arm's length in bed |

---

## Differentiators

Features that set a product apart. Not universally expected, but provide meaningful competitive advantage.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Three-phase escalation (sound → vibration → volume ramp) | Uniquely gentle escalation; vibration before loud sound is rare in PWAs | Medium | Vibration API is supported on Android Chrome; absent on iOS Safari — must degrade gracefully |
| Synthesized singing bowl / chime audio | Avoids copyright, sounds premium vs. generic beeps, works fully offline | Medium | Web Audio API synthesis of harmonic series requires tuning; FM synthesis for bowl resonance is achievable |
| Configurable phase delays | Power-user control; rare in consumer alarm apps | Medium | Adds perceived complexity — surface only after the simple presets |
| Configurable ramp duration | Lets users tune wake sensitivity; rare outside dedicated sleep apps | Low-Med | Simple slider input once phase system is built |
| Named presets (Quick Nap, Focus) | Reduces decision fatigue; users appreciate opinionated starting points | Low | Two presets is the right number — enough choice, not overwhelming |
| Test Sound button | Reduces user anxiety about whether the alarm will actually work | Low | Extremely high value for trust; trivial to build |
| Wake Lock during active countdown | Prevents screen sleep which would kill audio context on some browsers | Low | Single API call; graceful degradation if unsupported |
| Zen / calm aesthetic throughout | Emotional differentiation; most alarm apps feel utilitarian or aggressive | Medium | Requires design discipline, not feature work — smooth transitions, whitespace, soft palette |
| Haptic interval bells (meditation use) | Interval bells during a meditation session are expected by meditators | Medium | Depends on vibration API; useful for "Focus" preset framing |
| Pause mid-session | Allows bathroom break, phone call, etc. without losing session | Low | Simple state machine addition once timer is built |

---

## Anti-Features

Features to explicitly NOT build in this scope. Building these would add complexity, slow delivery, or contradict the product's identity.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Persistent custom preset storage | Adds IndexedDB/localStorage complexity, schema migration risk, and session state bugs; project explicitly out-of-scoped this | Configure per-session; session is short-lived by nature |
| User accounts / cloud sync | No benefit for a single-user, single-device, ephemeral tool; adds auth complexity and attack surface | Accept statelessness as a feature |
| Multiple simultaneous alarms | Multiplies state complexity significantly; target user sets one alarm at a time | One active timer is cleaner and safer |
| Sleep phase detection (microphone/accelerometer) | Requires continuous sensor access, battery drain, privacy implications, and server-side ML; Sleep Cycle does this but it is a heavyweight feature | Rely on user-set duration; they know when they want to wake |
| Guided meditation audio content | Curated audio = copyright risk or large file downloads; Calm/Insight Timer have this locked up | Synthesized ambient sound fills the same role without licensing |
| Social / sharing | Antithetical to the "private, calm, personal" product identity | Keep it solo |
| Subscription / paywall | PWA in this category competes with free native apps; friction kills install | Free is the right model for this scope |
| Alarm scheduling (set an alarm for 7am tomorrow) | Clock-based alarms require persistent background processes that browsers cannot reliably provide; this is a timer, not a scheduler | Frame product as a timer (start now, duration-based) not a scheduler |
| Waveform / audio visualizer | Visual complexity that contradicts the zen aesthetic | Soft ambient animation (e.g., pulsing circle) if anything |
| Settings screen with many options | Complex settings create decision paralysis; options should be exposed inline on the session-setup screen | Inline controls, progressive disclosure |

---

## Feature Dependencies

```
Preset cards (Quick Nap, Focus)
  └─→ Session setup screen (duration, phase delays)
        └─→ Active countdown screen
              └─→ Phase 1: Soft sound (Web Audio API synthesis)
              │     └─→ Phase 2: Vibration (Vibration API)
              │           └─→ Phase 3: Volume ramp to 100%
              │
              ├─→ Wake Lock (prevents screen sleep during countdown)
              ├─→ Silent audio keepalive (maintains audio context when backgrounded)
              ├─→ System notification at alarm trigger (Notification API)
              │
              ├─→ Pause button (suspends all phases, resumes on tap)
              └─→ Stop / Dismiss button (tears down all audio + vibration + wake lock)

Test Sound button
  └─→ Web Audio synthesis (same engine as Phase 1; no additional dependency)

PWA install / offline
  └─→ Service worker (vite-plugin-pwa)
        └─→ All synthesis code must be locally available (no CDN audio files)

Dark / light mode
  └─→ Tailwind CSS dark: variant following prefers-color-scheme (no extra dependency)
```

---

## MVP Recommendation

The MVP is defined by the alarm reliability guarantee. Everything else is secondary.

**Must be in MVP:**

1. Single timer setup screen with Quick Nap and Focus presets
2. Three-phase escalation: soft sound → vibration → volume ramp
3. Web Audio synthesis (singing bowl / chime, not beep)
4. Wake Lock + silent audio loop for background reliability
5. System notification at trigger
6. Stop button with large tap target
7. Test Sound button
8. PWA install + offline support
9. Dark/light mode

**Should be in MVP but could slip to phase 2:**

- Pause button (low complexity, high utility)
- Configurable phase delays (medium complexity; presets cover most users)
- Configurable ramp duration

**Defer post-MVP:**

- Snooze (explicit design statement to omit initially; revisit after user feedback)
- Haptic interval bells during session (meditation use case; secondary to alarm use case)
- Any additional presets beyond two

---

## PWA-Specific Feature Considerations

These are not features per se but constraints that shape how features must be built.

| Concern | Impact | Mitigation |
|---------|--------|------------|
| iOS Safari kills audio context on screen lock | Phase 1/2/3 audio may never play for iPhone users | Silent audio loop keepalive must start at session start, not at alarm trigger |
| iOS Safari has no Vibration API | Phase 2 does nothing on iPhone | Degrade to additional audio cue instead; document limitation |
| Notification API requires user grant | System notification at trigger may never appear | Request permission at session start; if denied, show in-app overlay instead |
| Service worker cannot execute arbitrary JS on a timer | Cannot schedule alarm logic in SW | All alarm logic lives in main thread; SW only handles offline caching |
| Browser tab must stay open (or PWA window) | Users who close the app lose the alarm | Show persistent warning: "Keep this tab open" or "App must stay in foreground" |
| Wake Lock is revoked on tab hide | Does not prevent backgrounding on mobile | Pair with silent audio loop which persists through tab hide |

---

## Alarm Escalation Patterns (Domain Survey)

**Pattern A — Hard cut (most basic alarm apps):**
Silence → 100% volume immediately. Jarring. Universal fallback.

**Pattern B — Single soft → loud (Gentle Alarm Android):**
Pre-alarm at low volume for N minutes → main alarm at full. Common in dedicated gentle alarm apps.

**Pattern C — Volume ramp only (Google Clock "sunrise alarm", iOS):**
Volume gradually increases from 0% to 100% over a set window. No phase change, just amplitude.

**Pattern D — Sensor-gated wake window (Sleep Cycle):**
Monitor sleep phase, trigger alarm during lightest sleep within a 30-minute window. Requires microphone/accelerometer. Not feasible in PWA.

**Pattern E — Multi-phase with modality change (Soundly):**
Sound (soft) → tactile (vibration) → volume ramp to 100%. This is the most layered pattern in the category. Uncommon in consumer apps, which makes it genuinely differentiating when it works reliably.

Soundly's pattern (E) is the most distinctive in the market. The risk is that it requires all three APIs to work correctly together, and browser constraints affect each differently per platform.

---

## Sound Design Approaches (Domain Survey)

| Approach | Used By | Pros | Cons |
|----------|---------|------|------|
| Curated audio files (MP3/OGG) | Calm, Insight Timer, Sleep Cycle | Easy to produce high quality | Copyright, file downloads, offline complexity |
| System sounds / ringtones | iOS Clock, Google Clock | Always available, familiar | Jarring, not distinctive, no control |
| Web Audio API synthesis | Niche PWA apps, Soundly | Offline-first, no copyright, fully customizable | Requires synthesis skill; naive implementation sounds cheap |
| Binaural beats | Some meditation apps | Claimed sleep/wake benefit | Requires headphones; scientifically disputed |

Web Audio synthesis is the right call for Soundly. The singing bowl harmonic series (fundamental + overtones with slow amplitude decay) and sine wave swells (slow LFO on gain envelope) are achievable with the oscillator node graph. The main risk is that cheap synthesis — too pure a sine, no reverb, no harmonic richness — sounds worse than a simple beep. Budget time for sound design iteration.

---

## Sources

- Training-data knowledge of Sleep Cycle, Gentle Alarm (Android), Insight Timer, Oak, Calm, Waking Up, Google Clock, iOS Clock — MEDIUM confidence (stable category, established apps)
- Web Audio API oscillator/gain node capabilities — HIGH confidence (well-documented spec)
- Vibration API platform support (Android Chrome yes, iOS Safari no) — HIGH confidence (long-standing known limitation)
- Wake Lock API behavior on tab hide — HIGH confidence (spec documented behavior)
- iOS audio context suspension on screen lock — HIGH confidence (known, persistent iOS WebKit behavior)
- Notification API requiring explicit grant — HIGH confidence (browser security model)
- Web search and WebFetch unavailable for this session — competitor feature lists are from training data only; verify against current App Store / Play Store listings before locking requirements
