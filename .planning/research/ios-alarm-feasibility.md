# iOS Alarm Feasibility — Pre-Planning Assessment

**Researched:** 2026-04-22
**Context:** Field-test findings on iPhone — locked-screen silence and weak Phase 3 volume.
**Scope:** Feasibility-only. No implementation guidance beyond what's needed to choose a path.

---

## Summary

**Soundly cannot reliably wake an iPhone user on a locked screen with the current pure-PWA stack, and no amount of WebAudio tuning will fix it.** The root cause is structural: iOS suspends the AudioContext when the screen locks, and a web page (PWA or otherwise) cannot *start* audio while in that suspended state — audio start requires a user gesture or in-progress playback. A web push notification can fire on the lock screen, but iOS PWAs have zero control over notification sound (no custom sounds, no critical-alert bypass, and the subscription is killed after three "silent" pushes).

The Phase 3 loudness problem has a partial software fix (switch to `navigator.audioSession.type = "playback"` so the ringer/silent switch doesn't mute WebAudio, add a `DynamicsCompressorNode`, and shift peak energy to ~2–4 kHz). But it does not solve the locked-screen case — that's an iOS policy wall, not a tuning problem.

**Bottom line:** If "reliably wakes the user on a locked iPhone" is core value (stated in CLAUDE.md), the project needs a Capacitor shell that schedules a native local notification via `UNUserNotificationCenter`. Estimated incremental effort: **1–3 days** to wrap the existing PWA, schedule the alarm natively, and have the tap handler resume the PWA into Phase 3. Without this, the project should downgrade its promise to "must-be-foregrounded-or-installed-and-unlocked alarm."

---

## iOS Audio Capability Matrix

Legend: **Yes** = works reliably; **Partial** = works with caveats documented below; **No** = platform policy blocks it.

| Technique | (a) Foreground, screen on | (b) Foreground, screen auto-locked | (c) Backgrounded or app closed, screen locked |
|---|---|---|---|
| WebAudio `OscillatorNode` via `AudioContext` | **Yes** | **Partial** — continues if already playing; AudioContext gets suspended on screen-off. Cannot be *started* from suspended state without gesture. [1][2] | **No** — AudioContext suspended, no user gesture available to resume. [1][2][8] |
| `<audio>` element playback (pre-encoded file) | **Yes** | **Partial** — if playback was active before lock and uses Media Session, continues; pausing for >30s kills it. [7][9] | **No** — cannot auto-start from background; pre-existing playback may continue briefly before OS kills. [7][8][9] |
| Silent audio loop keepalive (`<audio>` with silence) | **Yes** | **Partial** — tested to extend AudioContext life briefly on screen-off; not a reliable keep-alive across lock. [8] | **No** — once app is backgrounded long enough, iOS suspends the media session. [8][9] |
| Media Session API (`navigator.mediaSession`) | **Yes** — lock-screen controls appear | **Partial** — only useful if audio was already playing; does not by itself start audio. [4][7] | **No** — Media Session requires an active playback session; cannot spawn one from idle. [4][7] |
| Wake Lock API | **Yes** — iOS 18.4+ in installed PWA | **N/A** — when Wake Lock is held, the screen does not auto-lock; it keeps the screen *on*. [CLAUDE.md verified + 02-RESEARCH.md] | **No** — Wake Lock is released as soon as the document is hidden. [CLAUDE.md + MDN] |
| Web Push (iOS 16.4+, installed PWA) — notification banner | **Yes** | **Yes** — banner appears on lock screen | **Yes** — banner appears on lock screen [5][6] |
| Web Push — custom sound | **No** — not supported on iOS | **No** | **No** — iOS does not expose custom notification sounds to PWAs. [5][10] |
| Web Push — silent / alarm-triggering push | **No** — `userVisibleOnly` required; 3 silent pushes = subscription killed | **No** | **No** — cannot use a push to secretly start audio; Apple terminates subscription. [6] |
| Web Push — `defaultCritical` / bypass silent mode | **No** — no entitlement mechanism exists for PWAs | **No** | **No** — requires Apple-approved native entitlement. [3][11] |
| Service Worker initiating audio on `push` event | **No** — SWs cannot create/resume AudioContext (no user gesture, short-lived) | **No** | **No** — structural SW limitation. [5][6] |
| `navigator.audioSession.type = "playback"` (iOS 17+) | **Yes** — WebAudio no longer muted by silent switch [12][13] | **Partial** — applies to active contexts; does not prevent background suspension | **No** — does not resurrect a backgrounded/locked-screen audio context |

Citations: [1] WebKit bug 237878 [2] WebKit bug 231105 [3] Apple Critical Alerts entitlement docs [4] MDN Media Session [5] webkit.org/blog/13878 [6] Progressier iOS push termination [7] Apple Developer forum 762582 (iOS Audio Lockscreen PWA) [8] WebKit bug 198277 [9] MacRumors forums — iOS 26 PWA audio regression [10] Pushpad — sound on web push [11] Medium — Alon Wolenitz on Critical Alerts in Capacitor [12] WebKit bug 237322 resolution [13] MDN Navigator.audioSession.

---

## Locked-screen silence — findings and recommendation

**What's causing it:**

1. **The AudioContext is suspended when the screen locks.** The app's countdown timer fires a callback that calls `strikeBowl()` or starts the Phase 3 ramp — but the OscillatorNodes are created against a suspended AudioContext. They produce no sound. No amount of `context.resume()` in the callback will work: `resume()` without a prior user gesture is blocked by iOS. [WebKit bug 237878, 198277]

2. **The silent keepalive oscillator does not survive screen-lock to the degree the project hoped.** Bug 198277 was resolved in iOS 15.4 for the case where audio is *already playing* and the page goes to the background — that playback can continue for a while. But this does not help a countdown that fires *after* the screen has been locked and the AudioContext has been suspended. [WebKit bug 198277 resolution + bug 237878 which explicitly covers the suspension-on-background case].

3. **The `setTimeout`/`setInterval` timer itself is also throttled when backgrounded**, though less severely on iOS than on Chrome. Even if audio *could* start, the fire time would drift by tens of seconds. The wall-clock timer in Phase 1 mitigates drift magnitude but not the audio-start problem.

**What would fix it in the current stack:** Nothing. Per WebKit bug 237878 (unresolved as of the most recent 2023 comment, and the iOS 26 MacRumors thread confirms regressions persist through iOS 26.1), there is no pure-PWA mechanism to start audio on a locked-screen iOS device. The available levers — audio element pre-roll, Media Session metadata, Wake Lock, silent keepalive, web push — all hit a policy wall:

- Web push cannot carry custom sound on iOS PWAs. [10][5]
- Service Workers cannot initiate WebAudio without a page-side user gesture. [5][6]
- The `userVisibleOnly` push constraint + "3 silent pushes = termination" rule forecloses any scheme that tries to use push as an alarm trigger. [6]
- Wake Lock doesn't apply: if it's held, the screen stays on, so there's no "locked" state. If the screen is locked, Wake Lock has been released.

**The hard limit:** iOS treats alarms as a reserved capability. Apple's public answer to "how do I build an alarm app" as of WWDC 2025 is AlarmKit (iOS 26+ only, native Swift, native `UNUserNotificationCenter`) — there is no PWA equivalent and Apple has not announced one. [14]

**Recommendation:** Accept that pure-PWA locked-screen alarms are not possible on iOS today. Either (a) change the product promise for iOS users, or (b) ship a thin Capacitor wrapper (see Scope Decision Points below).

---

## Phase 3 volume — findings and recommendation

Three distinct things limit loudness on iOS — the user-reported "Phase 3 doesn't feel louder than Phase 2 even after 5x overdrive" is almost certainly (1) + (2) compounded:

### 1. The ringer/silent switch mutes WebAudio by default — but NOT `<audio>` elements

**Confirmed:** iOS mutes WebAudio API output when the silent switch is on, while `<audio>` elements continue to play. [WebKit bug 237322]. If the user is field-testing with the silent switch engaged (common for bedside testing), **WebAudio is producing sound at whatever gain but iOS is muting the media channel the browser puts WebAudio on.** This explains "Phase 3 not noticeably louder" — it might be approximately equally muted as Phase 2.

**Fix (iOS 17+):** Set `navigator.audioSession.type = "playback"` before or during AudioContext creation. This overrides the default `"ambient"` session and tells iOS to put WebAudio on the playback channel, which is not silenced by the mute switch. Confirmed shipping in WebKit ([12][13] — WebKit enabled `navigator.audioSession` and `type` by default; bug 237322 resolution confirms this is the intended modern fix).

**Caveat:** The `"playback"` session also makes the OS show lock-screen media controls for your app — this is acceptable for an alarm. iOS 16 and earlier do not have this API; on those versions, the older silent-`<audio>`-element keepalive hack is the only option. [swevans/unmute, feross/unmute-ios-audio]

### 2. `GainNode.gain > 1` does not give you more loudness — it gives you clipping

**Confirmed behavior:** `GainNode.gain` is a linear multiplier on float audio samples. Setting it to 5.0 ("5x overdrive") multiplies the sample values by 5, which immediately clips at the output stage (samples > 1.0 are hard-clipped to 1.0 by the audio rendering pipeline on every platform including iOS). The result is distortion, not more volume. [MDN GainNode + Web Audio API spec]

Beyond hard-clipping, iOS does not expose a "boost the volume past the system max" mechanism to web content. There is no API equivalent to `AVAudioPlayer.volume > 1` or `UNNotificationSound.defaultCriticalSound(withAudioVolume:)`. System volume is the ceiling. [VERIFIED via MDN + Apple AudioToolbox docs — no public WebAudio API exposes above-system-max loudness]

### 3. iOS output is speaker-capped by the system, not by your code

Speaker max on an iPhone 15/16 is far below what the DAC and amp could technically produce — Apple caps speaker output for hardware protection and battery. There is no software path to exceed this from a browser context. The user's "5x overdrive" tweak is not doing what the name suggests.

### Phase 3 recommendations — prioritized

These recommendations assume Option A (stay pure PWA) or apply equally inside a Capacitor shell.

**Must-do (software fixes with real impact):**

1. **Set `navigator.audioSession.type = "playback"`** on AudioContext creation (feature-detect: `if ('audioSession' in navigator)`). This alone likely resolves most of the "not louder" perception if the user is testing with silent switch on. [HIGH confidence — fix confirmed in WebKit bug 237322 resolution + MDN]

2. **Remove gain values > 1.** Replace the "5x overdrive" with gain = 1.0 at peak and use a `DynamicsCompressorNode` to push more perceived loudness through the ceiling without clipping. Canonical pre-destination chain: `source → gain → compressor → destination`. Settings starting point: `threshold = -24dB`, `knee = 12`, `ratio = 12`, `attack = 0.003`, `release = 0.25`. This is how every DAW makes things sound "loud" without exceeding 0 dBFS. [HIGH confidence — DynamicsCompressorNode is MDN-documented, ratio/threshold tuning is standard mastering practice]

3. **Shift Phase 3 frequency content to 2–4 kHz.** The ear is most sensitive in this band (Fletcher-Munson / equal-loudness contours). The current Phase 3 design in 01-RESEARCH.md (80→220 Hz swell) is centered where human hearing is *least* sensitive AND where the iPhone speaker is weakest (phone speakers roll off hard below ~300 Hz). Shift the primary urgent tone's fundamental to 1 kHz with harmonics at 2 kHz and 3 kHz. Layer a 2–4 kHz "chirp" or amplitude-modulated tone on top. [HIGH confidence — psychoacoustic fundamentals + phone speaker physics]

4. **Add amplitude modulation / beating.** Sirens are attention-grabbing because they modulate, not because they're loud. A 4–8 Hz tremolo on the Phase 3 tone (square LFO on a GainNode) dramatically increases wakeability at equal SPL. [HIGH confidence — standard psychoacoustic technique]

5. **Stack multiple detuned oscillators** for perceived thickness. Three sines at 1000, 1003, 1007 Hz panned slightly differently is perceived as louder than a single 1 kHz tone at the same peak gain. [MEDIUM confidence — widely used in synth design]

**Should-do:**

6. **Switch Phase 3 to an `<audio>` element with a pre-encoded, heavily-limited WAV file.** This is the one software path that may give *slightly* more loudness than WebAudio on iOS: a pre-mastered WAV that is already maximally limited at 0 dBFS will output at full media-channel loudness, whereas WebAudio goes through an additional processing layer. Trade-off: larger bundle, less flexible (no parametric control). But if Phase 3 must be as loud as iOS permits, this is the way. [MEDIUM confidence — empirical claim from community reports; plausible given separate WebAudio/media codepaths but not formally documented by Apple]

**Won't-work (explicitly):**

- **`GainNode.gain > 1`** — clips, doesn't amplify. [HIGH confidence]
- **Any JavaScript attempt to exceed system volume** — no API exists in a browser context. [HIGH confidence]
- **Web push with `.sound` set** — iOS ignores sound fields on PWA web push. [HIGH confidence — Pushpad + Apple forum threads]
- **Adding a "please raise your volume" dialog** — users won't do this at 2 AM. Don't.

**Hard ceiling:** Even with every recommendation above, Phase 3 on iOS is at most as loud as a phone-speaker-capped media channel at user's system volume. That is enough to wake a light sleeper in a quiet room but not a deep sleeper or anyone with the phone under a pillow. This is a device-hardware-and-policy ceiling, not a code problem.

---

## Scope decision points

Three honest options. The user needs to pick one before more phase work.

### Option A — Stay pure PWA, document the limits

**What changes:** Apply the Phase 3 software fixes above (audioSession + compressor + frequency shift + modulation). Add iOS-specific copy on the install screen: *"On iPhone, Soundly must be installed to home screen, kept open with screen on (or via Wake Lock), or you will not hear the alarm when screen locks. We recommend plugging in and keeping the app foregrounded."*

**Estimated effort:** 2–4 hours to implement audioSession + compressor + frequency shift + copy. Fits inside the current Phase 3 UI work.

**What it buys:** A clearly-scoped product that works well on Android and in foreground iOS, and is honest about its iOS limitation.

**What it costs:** The app does not deliver on CLAUDE.md's stated core value ("The alarm must actually wake the user") for iPhone users who lock their phone. Some users will uninstall when they oversleep.

### Option B — Capacitor shell with native local notifications

**What changes:** Wrap the existing PWA build output in a Capacitor iOS project. Add `@capacitor/local-notifications`. When the user taps "Start" in the React UI, schedule two native notifications via Capacitor:
1. Phase 1 trigger time (quiet — uses the singing bowl sound pre-encoded as a bundled notification sound).
2. Phase 3 trigger time (loud — uses a long-duration pre-encoded notification sound, critical sound if entitlement obtained).

When the user taps the notification, the app opens and the PWA takes over with its existing UI, resuming whatever phase the wall-clock math says we're in.

**iOS behavior this unlocks:**
- **Notifications fire reliably** on a locked screen. `UNUserNotificationCenter` is the canonical iOS alarm mechanism short of AlarmKit.
- **Custom notification sound files** (up to 30 seconds, bundled WAV/AIFF under 30s, placed in the iOS app bundle).
- **Critical Alert capability** available via `UNNotificationSound.defaultCritical` / `.defaultCriticalSound(withAudioVolume:)` **if** Apple grants the entitlement (application via the developer portal, manual review; historical approval rate for general consumer alarm apps is low — Apple reserves this for medical/safety apps per their documentation). [Apple Critical Alerts docs]
- **Bypass silent switch and Focus modes** with the critical entitlement; without it, sound still plays but respects silent/Focus.

**Estimated effort:** **1–3 days total.**
- 0.5–1 day: `npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/local-notifications`, `npx cap init`, `npx cap add ios`, configure iOS project in Xcode, wire `cap sync` into the Vite build, test on device.
- 0.5–1 day: wire the Capacitor bridge into AlarmEngine: on `start()`, schedule two native notifications; on `stop()`/`dismiss()`, cancel them. Keep the in-app audio engine intact — it still runs Phase 1/2/3 *when the app is foregrounded*. The native notifications are the fallback that fires regardless of foreground state.
- 0.5 day: bundle pre-encoded WAV sounds (singing bowl ~10s, urgent tone ~30s) into the iOS resources folder, reference them in the notification payload.

Real LOC additions: probably under 150 lines of TypeScript (one new platform module for Capacitor scheduling, conditional wrapping of existing managers) + ~20 lines of Swift boilerplate that `@capacitor/ios` generates automatically.

**What it buys:**
- iPhone alarm actually rings on locked screen. This is the core-value fix.
- Path to Critical Alerts if warranted.
- Phase 3 loudness is bounded by iOS notification sound loudness (higher than WebAudio alone in practice because it goes through the system alert path).

**What it costs:**
- Apple Developer Program: **$99/year**.
- App Store review: 1–3 days typical review time; rejection risk is low for a simple alarm app but non-zero.
- Dual delivery: Android users still get the PWA; iOS users get the App Store app. Two install paths to document.
- Build complexity: adding Xcode to the build matrix. Macs required for iOS builds.
- Critical Alerts entitlement: extra 1–4 weeks review. May be denied — alarm apps aren't Apple's prototypical "critical" category. Default (non-critical) notification sound is sufficient for most users if they don't engage silent mode.

**Recommendation if Option B:** Skip Critical Alerts for v1. Ship with standard `UNMutableNotificationContent.sound = UNNotificationSound(named:)` pointing at a bundled loud WAV. Apply for Critical Alerts only if users report being woken up via the alarm works only when phone is not silenced — then it becomes a targeted v1.1 feature.

### Option C — Wait for iOS 26 AlarmKit + re-evaluate

**What changes:** Do Option A now. In a few months when iOS 26 adoption reaches critical mass, evaluate whether to build a native iOS-26-only app using AlarmKit (which *does* bypass silent mode, shows on Dynamic Island and Lock Screen, and is Apple's explicit blessing for alarm apps). AlarmKit is iOS 26+ only and requires a native Swift app (or a React Native / Capacitor wrapper using a third-party AlarmKit plugin — the `react-native-nitro-ios-alarm-kit` plugin on GitHub exists but is new). [14][15]

**Estimated effort:** 0 now, indeterminate later. Probably 1 week for a native AlarmKit integration when warranted.

**What it buys:** The most iOS-native experience possible. Lock-screen integration matches system Clock app.

**What it costs:** Only works for iOS 26+ users (currently a minority); still requires native build; doesn't solve the iOS 25-and-below problem; likely duplicates Option B work.

**Use Option C as:** a future upgrade path on top of Option B, not as a substitute.

---

### Recommended path

**Option A + stage Option B** — Apply the Phase 3 software fixes immediately (2–4 hours). These are valuable regardless of which direction the project takes. Then make the explicit product call: is "reliably wakes iPhone users" a promise you're keeping? If yes, Option B (Capacitor wrap) is a 1–3 day commitment that pays off permanently. If no, update CLAUDE.md and the UI copy to set correct expectations, and ship pure PWA.

---

## Confidence Assessment

| Claim | Confidence | Basis |
|---|---|---|
| AudioContext is suspended on iOS screen lock and cannot be resumed without user gesture | **HIGH** | WebKit bugs 237878, 231105, 198277; consistent across multiple Apple Developer forum threads; confirmed by MacRumors iOS 26 testing |
| iOS PWA web push does not support custom sounds | **HIGH** | Pushpad article, WebKit blog 13878, Apple Developer forum consensus, iOS 16.4 discussion thread |
| Web push subscription is killed after 3 silent pushes on iOS | **HIGH** | Progressier article + Apple platform security documentation behavior |
| `navigator.audioSession.type = "playback"` fixes the silent-switch mute for WebAudio on iOS 17+ | **HIGH** | WebKit bug 237322 resolution explicitly states this is the fix; WebKit commit enabling by default confirmed |
| `GainNode.gain > 1` causes clipping, not extra loudness | **HIGH** | Web Audio API spec; fundamental DSP; universal behavior |
| Critical Alerts require Apple-granted entitlement for native apps, not available to PWAs | **HIGH** | Apple Developer Documentation — entitlement application page |
| Capacitor + `@capacitor/local-notifications` reliably fires on locked iOS screen | **HIGH** | Canonical Capacitor API; wraps `UNUserNotificationCenter` which is the standard iOS notification mechanism |
| DynamicsCompressorNode + 2–4 kHz shift + AM = perceptually louder on iPhone speaker | **MEDIUM** | Standard psychoacoustics + phone-speaker physics; not tested on Soundly's specific content |
| `<audio>` element with pre-encoded WAV outputs louder than equivalent WebAudio on iOS | **MEDIUM** | Community reports + WebKit bug 237322 context (different audio channels); not formally documented by Apple |
| Capacitor wrap effort estimate of 1–3 days | **MEDIUM** | Based on Capacitor's published getting-started docs + typical PWA-to-Capacitor migrations; assumes no unusual build issues |
| AlarmKit is iOS 26+ only and is the Apple-blessed alarm path | **HIGH** | Apple Developer Documentation + WWDC 2025 session 230 |

---

## Sources

**Primary (HIGH confidence — Apple/WebKit/MDN)**

- WebKit Bug 237878 — [AudioContext is suspended on iOS when page is backgrounded](https://bugs.webkit.org/show_bug.cgi?id=237878) (patch landed 2022, not fully released through iOS 16.3; regressions reported through iOS 26)
- WebKit Bug 198277 — [Audio stops playing when standalone web app is no longer in foreground](https://bugs.webkit.org/show_bug.cgi?id=198277) (resolved in iOS 15.4, duplicate of 232909)
- WebKit Bug 237322 — [webaudio api is muted when the iOS ringer is muted](https://bugs.webkit.org/show_bug.cgi?id=237322) (resolved via `navigator.audioSession.type = "playback"` in iOS 17+)
- WebKit Bug 231105 — [AudioContext stops playing when minimizing or moving the macOS Safari window to the background](https://bugs.webkit.org/show_bug.cgi?id=231105)
- [WebKit Blog — Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) (iOS 16.4 launch announcement)
- Apple Developer Documentation — [Critical Alerts entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.usernotifications.critical-alerts)
- Apple Developer Documentation — [UNNotificationSound.defaultCriticalSound(withAudioVolume:)](https://developer.apple.com/documentation/usernotifications/unnotificationsound/defaultcriticalsound(withaudiovolume:))
- Apple Developer Documentation — [AlarmKit](https://developer.apple.com/documentation/AlarmKit) (iOS 26+)
- [Apple Developer Forum — iOS Audio Lockscreen Problem in PWA (thread 762582)](https://developer.apple.com/forums/thread/762582)
- MDN — [Navigator.audioSession](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/audioSession)
- MDN — [GainNode](https://developer.mozilla.org/en-US/docs/Web/API/GainNode) and [DynamicsCompressorNode](https://developer.mozilla.org/en-US/docs/Web/API/DynamicsCompressorNode)
- [WebKit Commit — Enable AudioSession Web API by default](https://github.com/WebKit/WebKit/commit/c39358705b79ccf2da3b76a8be6334e7e3dfcfa6)
- W3C — [Audio Session API specification](https://www.w3.org/TR/audio-session/)

**Secondary (MEDIUM confidence — community but multiply confirmed)**

- [WWDC 2025 Session 230 — Wake up to the AlarmKit API](https://developer.apple.com/videos/play/wwdc2025/230/)
- [Pushpad — Sound on web push notifications](https://pushpad.xyz/blog/sound-on-web-push-notifications) (confirms no custom sound on iOS PWA)
- [Progressier — How to fix iOS push subscriptions being terminated after 3 notifications](https://dev.to/progressier/how-to-fix-ios-push-subscriptions-being-terminated-after-3-notifications-39a7)
- [Capacitor — Local Notifications Plugin](https://capacitorjs.com/docs/apis/local-notifications)
- [Medium — iOS Critical Alerts in Capacitor Apps (Alon Wolenitz)](https://medium.com/@alonwo/ios-critical-alerts-in-capacitor-apps-fcm-push-notifications-ce591179feec)
- [feross/unmute-ios-audio](https://github.com/feross/unmute-ios-audio) (pre-iOS-17 silent-switch workaround)
- [MacRumors Forums — iOS 26 Audio issues in PWA web apps](https://forums.macrumors.com/threads/ios-26-audio-issues-in-pwa-web-apps.2466839/) (confirms ongoing regressions)

**Tertiary (LOW confidence — individual reports)**

- Apple Community thread — [No sound for PWA / web app notifications in iOS 16.4](https://discussions.apple.com/thread/254759442)
- [Matt Montag — Unlock JavaScript Web Audio in Safari and Chrome](https://www.mattmontag.com/web/unlock-web-audio-in-safari-for-ios-and-macos) (user-gesture unlock pattern; still correct but dated)

**Project references**

- `.planning/phases/01-audio-engine-and-timer/01-RESEARCH.md` — existing audio engine research (confirms keepalive limitations)
- `.planning/phases/02-background-reliability/02-RESEARCH.md` — existing background research (confirms AudioContext suspension as known limitation; Assumption A2 in that doc is now verified)
- `CLAUDE.md` — Wake Lock iOS 18.4+ MEDIUM confidence, Vibration iOS unsupported HIGH confidence (both still correct)

---

**Research date:** 2026-04-22
**Valid until:** 2026-07-22 (iOS platform behavior is stable short-term; re-check after next major iOS release)
