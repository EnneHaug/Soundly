# Phase 6: v1 Regression Checklist (On-Device Manual Matrix)

## Purpose

This checklist verifies that the AlarmSession refactor preserves v1 byte-identical behavior for **Quick Nap** and **Focus** on real devices. It exercises the user-visible surface that automated tests cannot fully reach: real Wake Lock holding the screen on, real Vibration API patterns on Android hardware, and real audio audibility through device speakers and headphones at the right times.

## Status

**This is the SECONDARY verification gate.** Per Phase 6 decision D-07:

- **PRIMARY gate (required for CI):** the automated test suite — run `npx vitest run` from the project root. Plan 2 extended the regression net to cover QUICK_NAP_CONFIG, FOCUS_CONFIG, and pause/resume from each entry phase.
- **SECONDARY gate (this checklist):** a recommended-but-not-required manual matrix. Run on demand before merging Phase 6 if you want device confidence beyond what the mocks can prove. Skipping this checklist does NOT block merge so long as `npx vitest run` is green.

## SEG-05 Reminder

Phase 6 is a pure refactor. **There is no new user-visible behavior in this phase.** Any change in observed behavior during this checklist — different timing, different sound, different vibration pattern, different pause/resume feel, screen sleeping when it shouldn't, audio playing when it shouldn't — is a regression and MUST be addressed before merge. SEG-05 is the v2.0 zero-diff floor; this checklist is the human-eyes layer that proves it on real hardware.

## How to Use

1. Build and run the app on the target device.
   - For dev: `npm run dev` then open the URL on the target device (LAN IP, or use a tunnel for HTTPS-required APIs like Wake Lock).
   - For prod: `npm run build && npm run preview` and open the preview URL.
2. Walk each section in order, top to bottom. Mark each `- [ ]` checkbox as you verify it.
3. If any item fails, file a regression note in this phase directory (e.g. `06-regression-notes-YYYY-MM-DD.md`) and **DO NOT merge** until the regression is resolved or explicitly accepted.
4. iOS Safari (Section 5) has known structural limitations — a partial pass is expected and acceptable per the framing in that section.
5. Remember: automated tests (`npx vitest run`) are the primary gate. This checklist is documentation that complements them, not a replacement.

## Section 1 — Quick Nap on desktop Chrome

**Target:** Chrome (latest stable) on macOS or Windows desktop. Headphones recommended so Phase 1 / Phase 2 details are clearly audible.

**Pre-check:**

- [ ] Browser tab is foregrounded throughout the run.
- [ ] System volume is set to a comfortable mid-range level.

**Run Quick Nap:**

- [ ] Tap **Quick Nap** on the dashboard. The countdown screen appears with the mm:ss timer counting down from the configured Quick Nap total.
- [ ] After Phase 1 duration elapses, the singing-bowl strike plays exactly once and is audibly soft.
- [ ] After Phase 2 duration elapses, the **tick pulse** begins (desktop has no Vibration API — the iOS-style tick fallback is the desktop path too).
- [ ] The tick pulse audibly continues through Phase 2 without dropouts.
- [ ] After Phase 2 plus the configured gap, the Phase 3 swell begins. The volume ramps audibly from 0% toward 100% over the configured Phase 3 duration.
- [ ] Throughout the entire timer (Phase 1 + Phase 2 + Phase 3), the desktop screen does not dim or sleep, and the system does not enter idle/lock.
- [ ] Tap **Stop**. Audio ceases immediately. The screen sleep timer returns to its OS default (verify by watching the screen-saver / lock-screen indicator settle back to normal behavior over the next minute).
- [ ] Relaunch Quick Nap immediately after stopping. The countdown starts cleanly from the configured total — no leftover audio, no stuck timer state.

## Section 2 — Quick Nap on Android Chrome

**Target:** Chrome on Android (any modern Android phone). Confirm vibration is enabled in OS settings (Settings → Sound → Vibration & haptics) before starting.

**Pre-check:**

- [ ] Android phone has vibration enabled at the OS level.
- [ ] Phone is unlocked and Chrome tab is foregrounded.
- [ ] Media volume is set to a comfortable mid-range level.

**Run Quick Nap:**

- [ ] Tap **Quick Nap** on the dashboard. The countdown screen appears.
- [ ] After Phase 1 duration elapses, the singing-bowl strike plays exactly once and is audible through the phone speaker.
- [ ] After Phase 2 duration elapses, the phone **vibrates** in the configured pattern. Vibration is felt continuously through Phase 2 (no tick pulse on this code path — Android uses Vibration API instead).
- [ ] Throughout Phase 1 and Phase 2, the phone screen does NOT auto-lock or dim — Wake Lock holds it on.
- [ ] Phase 3 ramp is audible through the phone speaker (volume increases over the Phase 3 duration).
- [ ] Tap **Stop**. Vibration halts immediately and Phase 3 audio ends.
- [ ] **Background-and-return test:** start Quick Nap again. During Phase 1, switch to another app for ~10 seconds, then return to Chrome. The Wake Lock is re-acquired automatically on `visibilitychange` — confirm by watching the screen stay on once you return (it may have dimmed while the tab was backgrounded; that is acceptable). Phase transitions still fire on schedule.

## Section 3 — Focus on desktop Chrome

**Target:** same as Section 1 — desktop Chrome with headphones. Focus runs at the longer 21 min Phase 1 / 2 min Phase 2 cadence, so allocate ~25 minutes for a full run.

**Run Focus:**

- [ ] Tap **Focus** on the dashboard. The countdown screen appears with the mm:ss timer counting down from the Focus total (~25 min).
- [ ] At the 21:00 mark (Phase 1 fire time), the singing-bowl strike plays exactly once.
- [ ] Phase 2 begins at the 23:00 mark and the tick pulse ramps audibly over the 2-minute Phase 2 duration (desktop tick fallback path, same as Section 1).
- [ ] After Phase 2 plus the configured gap, Phase 3 begins and the volume ramps from 0% toward 100% over the configured Phase 3 duration.
- [ ] Throughout the entire 25-minute timer, the desktop screen does not dim or sleep — Wake Lock holds it on the whole time.
- [ ] Tap **Stop**. Audio ceases and the engine returns to idle.
- [ ] Relaunch Focus immediately. The countdown starts cleanly from the configured total — no carry-over.

**Optional shortcut for faster iteration (NOT for committing):**

If you need to iterate on Focus quickly without waiting 25 minutes, you MAY temporarily edit the `QUICK_NAP_CONFIG` or `FOCUS_CONFIG` values in `src/engine/AlarmState.ts` (e.g., shrink Phase 1 from 21 min to 30 s) for a local test run only. **DO NOT commit those edits.** SEG-05 forbids any diff to `AlarmState.ts` in Phase 6 — the v2.0 v1-zero-diff floor is enforced across the entire phase. Revert with `git checkout -- src/engine/AlarmState.ts` before staging anything.

## Section 4 — Pause / Resume across Phase 1 / 2 / 3

**Target:** any platform from Section 1 or Section 2. Use Quick Nap so the run is short.

**Pause/resume during Phase 1:**

- [ ] Launch Quick Nap and wait until Phase 1 audio is playing (the singing bowl has already struck and the silent pre-Phase-2 stretch is in progress).
- [ ] Tap **Pause**. Any active audio / tick / vibration ceases. The mm:ss countdown stops advancing.
- [ ] Wait 5 seconds.
- [ ] Tap **Resume**. The countdown advances again from the same logical position it paused at. Total elapsed wall-clock time at the Phase 2 fire is approximately the original Phase 1 + Phase 2 plus the 5-second pause.

**Pause/resume during Phase 2:**

- [ ] In the same run (or a fresh Quick Nap), wait until Phase 2 audio (tick pulse) or vibration is active.
- [ ] Tap **Pause**. Tick / vibration ceases immediately. Countdown stops.
- [ ] Wait 5 seconds, then tap **Resume**. Tick / vibration resumes from the same logical position. Phase 3 fires after the remaining Phase 2 duration plus the configured gap, with total elapsed time extended by the 5-second pause.

**Pause/resume during Phase 3:**

- [ ] In the same run (or a fresh Quick Nap), wait until Phase 3 swell is audibly ramping.
- [ ] Tap **Pause**. The swell stops audibly.
- [ ] Wait 5 seconds, then tap **Resume**. The swell continues without a click, pop, or restart artifact — the loop picks up where it left off.

**Displayed countdown sanity:**

- [ ] In all three pause/resume cases above, the displayed countdown reflects the pause-extended total — i.e., a 5-second pause adds 5 seconds to the wall-clock time at which the next phase fires.

## Section 5 — iOS Safari (best-effort — expected partial pass)

> **Framing:** iOS Safari is structurally hostile to web-based alarms. This section is **best-effort** and is expected to pass only its foreground-only checks.
>
> - The Vibration API is **not supported** on iOS Safari. The tick-pulse audio fallback (ALM-05) plays instead — that is the design, not a regression.
> - The AudioContext **may suspend on screen lock** even with the silent keepalive oscillator running. This is a known iOS limitation.
> - Wake Lock support varies by iOS version. Recent iOS versions (18+) have the Screen Wake Lock API; older versions may not.
> - The structural locked-screen audio limitation (PWAs cannot reliably fire audio when the iPhone is locked) is acknowledged in v2.0 **LAND-05** (Phase 11 landing-page iOS honesty section). It is NOT a Phase 6 regression — it has always been this way on iOS.

**Target:** Safari on iPhone, iOS 17+ recommended. Headphones recommended so Phase 1 / Phase 2 audio is clearly audible.

**Pre-check:**

- [ ] iPhone is unlocked, Safari is foregrounded, and the device is not in silent mode.
- [ ] Media volume is set to a comfortable mid-range level.

**Foreground-only run (Quick Nap):**

- [ ] Launch Quick Nap from the foregrounded app. The countdown appears.
- [ ] After Phase 1 duration, the singing-bowl strike fires and is audible.
- [ ] After Phase 2 duration, the **tick pulse** plays (iOS has no Vibration API — the audio fallback is correct here).
- [ ] After Phase 2 plus the gap, Phase 3 ramp plays while the app is foregrounded.
- [ ] Wake Lock holds the screen on through the timer (verify on iOS 18+; older iOS versions may not support Wake Lock — note the iOS version in your regression note if it fails here).
- [ ] Tap **Stop**. Audio halts.
- [ ] Relaunch Quick Nap. The countdown starts cleanly from the configured total.

**Out of scope for Phase 6:** locked-screen behavior, background-tab behavior, and any test that requires the device to lock or the app to leave the foreground. These are documented in v2.0 **LAND-05** (Phase 11) as a known structural iOS limitation and are NOT verified by this checklist.

## Sign-off

If all sections (1–4) pass and Section 5 passes its foregrounded checks: **Phase 6 is verified for v1 byte-identity on real devices.** Record the operator, date, and build identifier below for the audit trail.

**Operator:** _________________________

**Date:** _________________________

**Build / commit:** _________________________

*Phase: 06-alarmsession-refactor-v1-regression-guard. Checklist authored 2026-05-07. The PRIMARY verification gate is `npx vitest run` (see 06-02-PLAN.md and 06-02-SUMMARY.md). This document is the SECONDARY documentation gate per D-07.*
