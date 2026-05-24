# Phase 5: iOS Audio Loudness Fixes — Research

**Researched:** 2026-04-22
**Mode:** ecosystem — focused on iOS WebAudio loudness levers.
**Source:** Distilled from `.planning/research/ios-alarm-feasibility.md` (feasibility assessment). This doc is the planning-facing extract; the full assessment is the authoritative source.

---

## Standard Stack

- **Web Audio API (native)** — no Tone.js, no Howler.js. Existing project convention (CLAUDE.md). All four fixes (audioSession, compressor, frequency shift, AM) are native Web Audio primitives.
- **`navigator.audioSession`** — W3C Audio Session API, shipped in WebKit by default. Sole entry point for telling iOS "this AudioContext is `playback`, not `ambient`." MDN: `Navigator.audioSession`.
- **`DynamicsCompressorNode`** — canonical Web Audio loudness-maximization tool. MDN-documented. Preferred over hand-rolled gain staging.
- **Oscillator + GainNode AM pattern** — documented pattern: LFO oscillator → scaling gain → target `AudioParam`. MDN `AudioParam` has a "Connecting an AudioNode to an AudioParam" example.

## Architecture Patterns

### Signal chain for Phase 3 (new)

```
Source stack (3 detuned sines + 2 kHz harmonic + 3 kHz chirp)
  ↓
oscGain (per-oscillator gain, unchanged soft-attack envelope)
  ↓
amLfoGain  ← driven by 6 Hz LFO oscillator through a scaling gain
  ↓
masterGain (0 → 1.0 ramp over Phase 3 duration; NO values > 1)
  ↓
DynamicsCompressorNode (threshold -24, ratio 12, knee 12, attack 0.003, release 0.25)
  ↓
destination
```

Rationale: compressor sits between `masterGain` and `destination` so the ramp still drives perceived loudness up over time while the compressor prevents clipping when multiple oscillators sum above unity. AM sits *before* the master ramp so the modulation depth is independent of the ramp position (warble is audible from the moment Phase 3 starts, not only at peak).

### AM implementation

```
LFO: OscillatorNode(type='sine', frequency=6)
LFO.connect(amScale: GainNode(gain = depth/2))   // half-depth peak
amScale.connect(amDcOffset: ConstantSourceNode)  // alternate: use a GainNode with offset input
amScale.connect(amLfoGain.gain)                   // audio-rate modulation of the signal gain
```

Simpler alternative (preferred): use a `GainNode` with its `.gain` parameter modulated by a scaled LFO. Set a constant source to `0.65` (mean of 0.3–1.0 range), add a ±0.35 LFO into the same gain param. MDN's AudioParam example is the template.

### audioSession placement

Set `navigator.audioSession.type = 'playback'` inside `getAudioContext()` immediately after `new AudioContext()` creation, before any `.resume()` call. Do it every time the context is (re)created — there's no harm in setting it repeatedly and no meaningful cost. Feature-detect with `'audioSession' in navigator` to avoid errors on non-WebKit browsers.

## Don't Hand-Roll

- **Don't hand-roll gain-staging-for-loudness** — use `DynamicsCompressorNode`. Hand-rolled limiters (sample-by-sample via `ScriptProcessorNode` or `AudioWorklet`) are categorically worse for this use case: higher CPU, worse quality, and the native compressor is specifically tuned for real-time music loudness.
- **Don't hand-roll amplitude modulation math** — use oscillator-driven modulation of an `AudioParam`. Do NOT schedule gain values via `setValueAtTime` in a `setInterval` — that's imprecise, jitter-prone, and undoes all the drift-free work from Phase 1.
- **Don't re-implement feature detection for audioSession** — single `if ('audioSession' in navigator)` branch is the whole feature test.

## Common Pitfalls

1. **Setting `audioSession.type` AFTER audio has started may not re-route on all iOS versions.** Set it on or immediately after `new AudioContext()`, before any `resume()` or oscillator start. Order matters.
2. **Compressor introduces latency (~6 ms lookahead).** Negligible for an alarm, but don't compare it against the uncompressed version waveform-for-waveform in tests — test structurally (is there a DynamicsCompressorNode in the chain?) not by output sample equality.
3. **AM depth = 0 to 1.0 creates audible "silences"** that sound like dropouts, not warble. Use 0.3 to 1.0 range. The mean of the carrier amplitude is 0.65, not 0.5.
4. **Changing Phase 3 frequencies will make the existing `phase3Tone.test.ts` fail.** Update the tests in the same plan as the code — do not skip tests, update assertions.
5. **`navigator.audioSession` is only exposed in secure contexts (HTTPS)** — Vite dev server over HTTP won't set it, but the feature-detect guard makes this a no-op, not an error. Verify on HTTPS (or the installed PWA) for real iOS testing.
6. **iOS auto-starts AudioContext in `interrupted` state (not `suspended`) when another app takes audio focus.** Our existing `if (state === 'suspended') resume()` check doesn't cover `interrupted`. Not strictly in scope for this phase, but if we see "AudioContext won't resume" reports on iPhone after these changes, that's the next investigation.
7. **Setting `audioSession.type` makes iOS show lock-screen media controls.** This is expected and desirable for an alarm, but developers sometimes mistake it for a bug. It's the canonical side-effect of the `'playback'` category.

## Code Examples

### D-01: audioSession inside `getAudioContext()`

```ts
export async function getAudioContext(): Promise<AudioContext> {
  if (!_ctx || _ctx.state === 'closed') {
    _ctx = new AudioContext();
    // iOS 17+ WebAudio silent-switch fix (WebKit bug 237322).
    // No-op on iOS ≤16 and non-WebKit browsers.
    if ('audioSession' in navigator) {
      (navigator as Navigator & { audioSession: { type: string } }).audioSession.type = 'playback';
    }
  }
  if (_ctx.state === 'suspended') {
    await _ctx.resume();
  }
  return _ctx;
}
```

### D-02: compressor in `createPhase3Ramp`

```ts
export function createPhase3Ramp(ac: AudioContext, durationSec: number): GainNode {
  const masterGain = new GainNode(ac, { gain: 0 });
  masterGain.gain.setValueAtTime(0, ac.currentTime);
  masterGain.gain.linearRampToValueAtTime(1.0, ac.currentTime + durationSec);

  const compressor = new DynamicsCompressorNode(ac, {
    threshold: -24, knee: 12, ratio: 12, attack: 0.003, release: 0.25,
  });
  masterGain.connect(compressor).connect(ac.destination);

  return masterGain;  // oscillators still connect here — callers unchanged
}
```

### D-03 + D-04: shifted frequency + AM LFO in `startPhase3Swell`

```ts
export function startPhase3Swell(ac: AudioContext, masterGain: GainNode): OscillatorNode[] {
  // AM carrier gain: mean 0.65, ±0.35 via 6 Hz LFO
  const amGain = new GainNode(ac, { gain: 0.65 });
  const lfo = new OscillatorNode(ac, { type: 'sine', frequency: 6 });
  const lfoScale = new GainNode(ac, { gain: 0.35 });
  lfo.connect(lfoScale).connect(amGain.gain);
  lfo.start();
  amGain.connect(masterGain);

  // Three detuned sines around 1 kHz fundamental + harmonic + chirp
  const oscs = [1000, 1003, 1007].map(f => {
    const o = new OscillatorNode(ac, { type: 'sine', frequency: f });
    o.frequency.linearRampToValueAtTime(f * 1.4, ac.currentTime + 3.0); // rising swell
    o.connect(amGain);
    o.start();
    return o;
  });

  const harmonic = new OscillatorNode(ac, { type: 'sine', frequency: 2000 });
  harmonic.connect(new GainNode(ac, { gain: 0.5 })).connect(amGain);
  harmonic.start();

  const chirp = new OscillatorNode(ac, { type: 'triangle', frequency: 3000 });
  chirp.connect(new GainNode(ac, { gain: 0.3 })).connect(amGain);
  chirp.start();

  return [...oscs, harmonic, chirp, lfo]; // caller stops all at end of loop cycle
}
```

Notes:
- Signature changes from returning `OscillatorNode` to `OscillatorNode[]` — the AlarmEngine caller needs to be updated to stop all nodes. This is an intentional breaking change scoped to this phase.
- The LFO is included in the returned array so the caller stops it, preventing orphan nodes.

## Validation Architecture

Out of scope for this phase — `nyquist_validation_enabled` is `false` in project config.

## Confidence Assessment

| Claim | Confidence | Basis |
|---|---|---|
| `navigator.audioSession.type = 'playback'` fixes iOS silent-switch muting of WebAudio (iOS 17+) | **HIGH** | WebKit bug 237322 resolution + MDN documentation + WebKit commit enabling by default |
| `GainNode.gain > 1` causes hard clipping at the output, not louder sound | **HIGH** | Web Audio API spec; universal cross-platform behavior |
| `DynamicsCompressorNode` + gain=1 produces subjectively louder output than gain=5 clipping | **HIGH** | Fundamental mastering/DSP practice; DynamicsCompressorNode is the Web Audio canonical tool |
| Shifting to 1–3 kHz exploits ear sensitivity + phone speaker response | **HIGH** | Fletcher-Munson contours + typical smartphone speaker response curves |
| 4–8 Hz amplitude modulation materially increases wakeability at equal SPL | **MEDIUM** | Standard psychoacoustic practice for alarms/sirens; not measured on Soundly-specific content |
| 3-voice detune stack perceived as thicker/louder than single oscillator | **MEDIUM** | Widely used synth-design heuristic; subjective |
| Compressor settings (threshold -24, ratio 12) produce inaudible pumping at this signal type | **MEDIUM** | Sensible default; may need on-device tuning |

## Sources

Primary (HIGH confidence):
- `.planning/research/ios-alarm-feasibility.md` — feasibility research (also links to all primary Apple/WebKit/MDN sources).
- WebKit Bug 237322 — https://bugs.webkit.org/show_bug.cgi?id=237322
- MDN — https://developer.mozilla.org/en-US/docs/Web/API/Navigator/audioSession
- MDN — https://developer.mozilla.org/en-US/docs/Web/API/DynamicsCompressorNode
- MDN — https://developer.mozilla.org/en-US/docs/Web/API/AudioParam (AM pattern)
- W3C Audio Session API spec — https://www.w3.org/TR/audio-session/

Secondary (MEDIUM confidence):
- Fletcher-Munson equal-loudness contours — standard psychoacoustics reference
- Phone-speaker frequency response — typical rolloff data across iPhone generations

Project-internal:
- `src/engine/AudioContext.ts` — current singleton (no audioSession today)
- `src/engine/sounds/phase3Tone.ts` — current gain=3→5 overdrive implementation
- `src/engine/sounds/__tests__/phase3Tone.test.ts` — existing tests (need update)

---

**Research complete.** This phase has a fully specified technical approach; planner should produce 1–2 PLAN.md files (D-01 is a small change and can either be its own plan or bundled with D-02/D-03/D-04).
