---
phase: 09-custom-composer-share-via-url
plan: 01
subsystem: lib-share-url
tags: [share-url, encode-decode, pure-lib, result-type, tdd, zero-react-deps]

# Dependency graph
requires:
  - phase: 07-segment-engine-triangle-sound
    provides: validateSegmentConfig (defence-in-depth gate per SHR-02), Segment + SegmentConfig types, WAKE_EASY_CONFIG (test fixture)
provides:
  - encodeComposition(SegmentConfig): string — pure D-16 fragment encoder (no leading '#' or 'c=')
  - decodeComposition(string): DecodeResult — discriminated Result type, NEVER throws (SHR-03)
  - DecodeResult type — `{ ok: true; config } | { ok: false; reason: 'wrong_version' | 'malformed' | 'too_long' | 'invalid_segment_data' | 'failed_validation' }`
  - VERSION_PREFIX='v1:' protocol gate (SHR-04) — non-breaking future-version extension point
affects:
  - 09-04 Composer.tsx — calls encodeComposition() for Share button URL construction
  - 09-07 useHashComposition — calls decodeComposition(location.hash) at app mount

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Result-type idiom (mirrors validateSegmentConfig at src/engine/SegmentState.ts:39-94) — discriminated union with explicit reason enum, never throws, testable via .not.toThrow()"
    - "Versioned URL format with explicit wrong_version reason (SHR-04) — `v1:` prefix gates current format; `/^v\\d+:/` regex routes future `vN:` inputs to wrong_version (non-breaking extension point)"
    - "Defence-in-depth two-stage validation: shape parser does strict /^\\d+\\$/ integer parsing (Pitfall 3 NaN-coercion guard) then routes through validateSegmentConfig for engine-level rules — single source of truth preserved"
    - "Hard size caps (1024 chars / 32 segments) reject pathologically-long inputs BEFORE iteration (T-09-01-02 DoS mitigation)"

key-files:
  created:
    - src/lib/shareUrl.ts (174 lines)
    - src/lib/__tests__/shareUrl.test.ts (275 lines, 28 tests)
  modified: []

key-decisions:
  - "Result type discriminated-union mirrors validateSegmentConfig — load-bearing parallel pattern keeps the never-throws contract uniformly testable across engine + lib layers"
  - "decodeComposition tolerates three prefix shapes ('#c=...', 'c=...', 'v1:...') so callers can pass raw window.location.hash interchangeably without pre-slicing"
  - "shareUrl.ts deliberately does NOT build the full share URL — caller composes `${location.origin}${location.pathname}#c=${encodeComposition(config)}` to honour GitHub Pages `base: '/Soundly/'` path (avoids Pitfall 9 from 09-RESEARCH.md:1300-1304)"
  - "Sound-idx mapping inlined as two const objects (SOUND_BY_IDX + IDX_BY_SOUND) rather than computed at runtime — minimal surface, no `Record.entries` allocation, future-extensible additively"
  - "Strict integer regex `/^\\d+\\$/` for BOTH durStr AND sndStr — protects against `Number('123abc')` silent coercion and `Number('')` returning 0 (Pitfall 3 NaN-corruption mitigation, T-09-01-01)"
  - "Empty-body 'c=v1:' returns invalid_segment_data (not malformed) — distinguishes 'version recognised but no payload' from 'version unrecognised', which gives useful telemetry signal for future debugging"

patterns-established:
  - "Per-phase 'pure-TS lib' file convention at src/lib/ with paired __tests__/ — zero React/DOM deps, fastest possible vitest run path (no jsdom needed for these tests, though the project default env is jsdom)"
  - "Plan-level TDD gate sequence honoured: test() RED commit d5b713c (module-resolution failure) followed by feat() GREEN commit 77676b6 (28/28 passing) — first plan in Phase 9 establishing this rhythm for downstream pure-lib plans (09-02 composerValidation will follow the same pattern)"

requirements-completed: [SHR-01, SHR-02, SHR-03, SHR-04]

# Metrics
duration: 3m 19s
completed: 2026-05-16
---

# Phase 9 Plan 1: shareUrl encode/decode Summary

**Pure-TS share-URL library ships at `src/lib/shareUrl.ts` — encodeComposition + decodeComposition implementing the D-16 LOCKED `c=v1:<durationMs>-<soundIdx>,...` format with discriminated-union Result type, never-throws contract (SHR-03), defence-in-depth via validateSegmentConfig (SHR-02), and explicit version-rejection extension point (SHR-04).**

## Performance

- **Duration:** 3m 19s
- **Started:** 2026-05-16T12:52:05Z
- **Completed:** 2026-05-16T12:55:24Z
- **Tasks:** 2 (test() RED + feat() GREEN — TDD plan)
- **Tests added:** 28 (file: src/lib/__tests__/shareUrl.test.ts)
- **Full suite after plan:** 412/412 passing across 33 test files (24.70s)
- **TypeScript:** `npx tsc --noEmit` exits 0

## API Surface (locked)

```typescript
// src/lib/shareUrl.ts — public exports

export type DecodeResult =
  | { ok: true; config: SegmentConfig }
  | { ok: false; reason: 'wrong_version' | 'malformed' | 'too_long' | 'invalid_segment_data' | 'failed_validation' };

export function encodeComposition(config: SegmentConfig): string;
export function decodeComposition(input: string): DecodeResult;
```

### Encoded format

`encodeComposition(WAKE_EASY_CONFIG)` returns the **exact** D-16 LOCKED string:

```
v1:240000-0,240000-0,240000-0,240000-0,60000-2
```

(Verified by test `encodes WAKE_EASY_CONFIG to the exact D-16 locked string`.)

Sound index map (D-16 LOCKED):

| endSound | idx |
|----------|-----|
| gentle   | 0   |
| triangle | 1   |
| alarm    | 2   |

### Decode error categories (SHR-03 coverage matrix)

All 5 reasons present in the DecodeResult union. Four of five are reachable directly from input shape; `failed_validation` is the defence-in-depth backstop.

| Reason                  | Triggered by                                       | Test reachable | Notes |
|-------------------------|----------------------------------------------------|----------------|-------|
| `too_long`              | Input > 1024 chars after prefix strip              | Yes (test L116) | T-09-01-02 DoS mitigation; rejected BEFORE iteration |
| `wrong_version`         | Starts with `vN:` where N != 1                     | Yes (test L96, L104) | SHR-04 future-version extension point |
| `malformed`             | Body shape unparseable (non-digit chars, missing dash, empty parts) | Yes (test L112, L154, L163, L171, L179, L187) | Includes empty-string input |
| `invalid_segment_data`  | Parsed but values out of range (unknown idx, zero duration, > 32 segments, empty body) | Yes (test L124, L132, L140, L148) | |
| `failed_validation`     | Parsed segments rejected by validateSegmentConfig (defence-in-depth) | **Indirect** (see note) | Reachable in principle for any future engine-level rule; current parser pre-filters most config-validity failures inline, so this is the SHR-02 backstop rather than a primary failure mode |

**Why `failed_validation` is not directly triggered by a happy-path test:** The pre-filters in `decodeComposition` (zero-duration check, unknown-idx check, > 32 segments check) catch every failure mode that `validateSegmentConfig` currently rejects. The final `validateSegmentConfig({ segments })` call exists for **defence-in-depth (SHR-02)** — if a future engine-level rule lands (e.g. "at least one alarm segment required" or "total duration ≤ X"), the decoder routes through it without duplicating logic. Test coverage of this code path is the existence of the call (`grep "validateSegmentConfig({ segments })" src/lib/shareUrl.ts` returns 1 match). Documented per plan acceptance-criteria allowance ("`failed_validation` is the hardest to trigger because pre-filters catch most cases; document why if not covered").

### Prefix tolerance (caller can pass raw `location.hash`)

| Input                  | Behaviour                            |
|------------------------|--------------------------------------|
| `'#c=v1:60000-0'`      | Strips `#` then `c=` → decode `v1:60000-0` |
| `'c=v1:60000-0'`       | Strips `c=` → decode `v1:60000-0`    |
| `'v1:60000-0'`         | Decodes directly                     |

### Never-throws contract (SHR-03)

The full suite includes two `.not.toThrow()` assertions covering:
- Binary garbage: `'💀'`, `'\x00\x01\x02'`, 100-char repeated punctuation
- Extreme inputs: 500-segment noisy bodies past the 1024-char cap (proves the cap fires before iteration)
- Empty string

## Deviations from Plan

None — plan executed exactly as written, including the verbatim implementation from 09-RESEARCH.md Pattern 6 (lines 712-815) and the verbatim test idioms from validateSegmentConfig.test.ts:130-149 analog.

## TDD Gate Compliance

Plan-level TDD gate sequence honoured:

1. **RED commit** `d5b713c` — `test(09-01): add failing test for shareUrl encode/decode`
   - 28 tests written upfront; vitest fails at module-resolution (`Failed to resolve import "../shareUrl"`); no `shareUrl.ts` impl yet.
2. **GREEN commit** `77676b6` — `feat(09-01): implement shareUrl encode/decode with Result type`
   - shareUrl.ts impl satisfies all 28 tests; tsc clean; full 412-test suite green.

No `refactor()` commit was needed — the verbatim Pattern 6 implementation passed cleanly on first run.

## SEG-05 v1 Byte-Identical Floor

- `git diff --quiet src/engine/SegmentState.ts` exits 0 — engine file untouched
- `git diff --quiet src/engine/__tests__/validateSegmentConfig.test.ts` — also untouched (referenced as READ-ONLY analog only)
- Zero modifications to any of the 26 protected v1 paths
- Phase 9 floor preserved: no `Countdown.tsx`, `ProgressRing.tsx`, `useAlarm.ts`, `AlarmEngine.ts`, `useSegmentAlarm.ts`, `useActiveAlarm.ts`, `SegmentCountdown.tsx`, `SegmentProgressRing.tsx`, etc. touched

## Threat Model Coverage

All threats in plan frontmatter `<threat_model>` mitigated as designed:

| Threat ID | Mitigation in code |
|-----------|--------------------|
| T-09-01-01 (Tampering — decodeComposition) | Strict `/^\d+$/` integer parsing; Result-type return; final validateSegmentConfig pass |
| T-09-01-02 (DoS — pathological inputs)    | `s.length > MAX_HASH_LENGTH` (1024) AND `pairs.length > MAX_SEGMENTS` (32) reject before per-segment loop |
| T-09-01-03 (Tampering — future versions)  | `v1:` prefix gate; `/^v\d+:/` routes unknown versions to `wrong_version`; future `v2:` decoder is non-breaking by construction |
| T-09-01-04 (Information disclosure)       | Accepted — no PII in segments; URL hash is shareable by design |
| T-09-01-05 (Spoofing — crash via garbage) | NEVER-THROWS contract verified by `.not.toThrow()` tests on binary input |

## Verification — Plan Success Criteria

- [x] shareUrl.ts is a pure-TS library with zero React imports — `grep "react" src/lib/shareUrl.ts` returns 0
- [x] encodeComposition(WAKE_EASY_CONFIG) returns the exact `v1:240000-0,...` string locked in D-16
- [x] decodeComposition returns DecodeResult — never throws on any input (verified by `.not.toThrow()` on binary garbage, empty string, 500-segment noise)
- [x] All 5 reason values present in union; 4 directly reachable, `failed_validation` documented as defence-in-depth backstop
- [x] tsc + vitest clean for the new file pair
- [x] Engine layer untouched (git diff --quiet exits 0)

## Self-Check: PASSED

- `src/lib/shareUrl.ts` — FOUND
- `src/lib/__tests__/shareUrl.test.ts` — FOUND
- Commit `d5b713c` (RED test) — FOUND in git log
- Commit `77676b6` (GREEN impl) — FOUND in git log
- `npx tsc --noEmit` — exits 0
- `npx vitest run src/lib/__tests__/shareUrl.test.ts` — 28/28 passing
- `npx vitest run` (full suite) — 412/412 passing across 33 files
