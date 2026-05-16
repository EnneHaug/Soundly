---
phase: 09-custom-composer-share-via-url
plan: 07
subsystem: hook
tags: [hook, url-hash, app-mount, react, share-url]

requires:
  - phase: 09-custom-composer-share-via-url
    plan: 01
    provides: shareUrl.ts (decodeComposition + DecodeResult discriminated union, SHR-01..04)
  - phase: 07-segment-engine-triangle-sound
    plan: 02
    provides: SegmentState.ts (SegmentConfig type — consumed via type-only import)
provides:
  - useHashComposition.ts — App-mount URL-hash decoder hook (first URL-routing hook in the codebase)
  - HashCompositionState — return shape consumed by App.tsx + Composer (Plan 09-08/09-09)
  - SHR-02 lock: decoded compositions flow through shareUrl.decodeComposition's defence-in-depth validateSegmentConfig final pass
  - SHR-03 lock: invalid URLs return { error: reason } without throwing (composer surfaces as Toast)
  - D-18 lock: history.replaceState clears the hash from URL bar on first commit (info-disclosure mitigation, refresh idempotency)
affects: [09-08-Composer-modal, 09-09-share-integration, App.tsx-mount]

tech-stack:
  added: []
  patterns:
    - "Pattern 6 (URL-Hash decoder hook): useState initializer reads location.hash ONCE synchronously, returning the decoded Result on the FIRST render — avoiding the Dashboard-flicker Pitfall 2 (09-RESEARCH.md:1247-1251). A post-commit useEffect with empty deps clears the hash via history.replaceState, decoupling read-once from clear-once and avoiding the React-render-side-effect Pitfall 5 (09-RESEARCH.md:1265-1269)."
    - "Result-type consumer + lift-to-state idiom: decodeComposition returns a discriminated union, but the hook needs mutable error state for clearError(). Pattern is to immediately project the Result into a { composition | null, error | null } state shape at the useState initializer, then expose clearError as a setter that resets only the error half. Avoids re-running decodeComposition on every render."
    - "Hash discriminator: '#c=' prefix gates BOTH the synchronous decode AND the post-commit replaceState. Non-'#c=' hashes are silently passed through (not surfaced as errors, not cleared from the URL bar) so the hook remains benign if future features introduce different hash semantics."
    - "Object.defineProperty(window, 'location', ...) mock idiom (cribbed from standalone.test.ts:7-14): jsdom's built-in location is not directly assignable, so tests reassign it with a minimal { hash, pathname, search, origin } shape and restore the original in afterEach."

key-files:
  created:
    - src/hooks/useHashComposition.ts
    - src/hooks/__tests__/useHashComposition.test.ts
  modified: []

key-decisions:
  - "Followed plan as written — zero deviations. The plan's RESEARCH Pattern 6 implementation (lines 838-887) is reproduced byte-identically with the prescribed file-doc-comment block."
  - "Test count expanded from the plan's target of ~12-14 to 18 tests, adding: (1) a multi-segment-with-mixed-sounds decode test, (2) a search-query-preservation test for replaceState, (3) an unknown-sound-idx invalid_segment_data test, (4) a too_long bomb test using a 1600-char body, (5) a clearError-doesn't-touch-composition test, and (6) an explicit Pitfall-2 synchronous-read invariant test (asserts composition is populated on the FIRST render — would catch a useEffect regression directly). All 5 DecodeResult reasons are now directly triggered by hash inputs except 'failed_validation' which is preserved as the SHR-02 defence-in-depth backstop (any future engine-level rule will surface here without changes to this hook)."
  - "history.replaceState is called even on decode FAILURE — verified by the 'still calls history.replaceState even on decode failure' test. Rationale: a broken share URL shouldn't keep re-firing the error on refresh; clearing the hash makes the failure mode user-recoverable (refresh returns the user to a clean state)."
  - "clearError() uses a state setter (not a ref) so the React re-render that hides the Toast is correctly tracked. The setter preserves composition via { ...s, error: null } — verified explicitly by a dedicated test that decodes a successful composition, calls clearError (which was already null), and asserts composition is still populated."

patterns-established:
  - "URL-routing hooks read synchronously in useState initializers and clear post-commit in useEffect — never both in the same effect. Establishes the template for any future Phase-11 ?c= or ?screen= query-string hooks."
  - "Hash mocking via Object.defineProperty + setHash(hash, pathname, search) helper — first window.location mock in src/hooks/__tests__/. Reusable for future hooks that read URL state."

requirements-completed: [SHR-02, SHR-03]

duration: 2m 28s
completed: 2026-05-16
---

# Phase 09 Plan 07: useHashComposition Summary

**App-mount URL-hash decoder hook — synchronous useState-initializer read of `window.location.hash`, post-commit `history.replaceState` clear, Result-style consumer of `shareUrl.decodeComposition`. First URL-routing hook in the codebase.**

## Performance

- **Duration:** 2 min 28 s (start 2026-05-16T13:34:29Z → end 2026-05-16T13:36:57Z)
- **Started:** 2026-05-16T13:34:29Z
- **Completed:** 2026-05-16T13:36:57Z

## Objective Recap

Ship `src/hooks/useHashComposition.ts` and its test — the app-mount URL-hash decoder hook. Decode `location.hash` ONCE via a `useState` initializer (synchronous, avoiding the Dashboard-flicker Pitfall 2), then clear the hash via `history.replaceState` in a post-commit `useEffect` (D-18). Lock SHR-02 (decoded compositions pass through `validateSegmentConfig`) and SHR-03 (invalid URLs fall back gracefully — never throws).

## What Shipped

### `src/hooks/useHashComposition.ts` (72 lines)

```typescript
export interface HashCompositionState {
  composition: SegmentConfig | null;
  error: 'wrong_version' | 'malformed' | 'too_long' | 'invalid_segment_data' | 'failed_validation' | null;
  clearError: () => void;
}

export function useHashComposition(): HashCompositionState;
```

Return-shape breakdown:

- **`composition`**: a validated `SegmentConfig` if `location.hash` started with `#c=` AND decoded successfully, else `null`. The hook deliberately does NOT expose the raw `DecodeResult` — callers consume the projected `{ composition, error }` pair, which is easier to render conditionally.
- **`error`**: the `DecodeResult.reason` string if decode failed, else `null`. Five categories: `wrong_version`, `malformed`, `too_long`, `invalid_segment_data`, `failed_validation`.
- **`clearError`**: setter that resets `error` to `null` without touching `composition`. Called by the Composer modal (Plan 09-08) after the Toast surfaces the error so the Toast disappears.

### Synchronous-read vs Post-commit-clear Split (the load-bearing pattern)

```typescript
// Synchronous read — runs ONCE before first render. NOT useEffect.
const [state, setState] = useState(() => {
  if (typeof window === 'undefined' || !window.location.hash) return { composition: null, error: null };
  const raw = window.location.hash;
  if (!raw.startsWith('#c=')) return { composition: null, error: null };
  const result = decodeComposition(raw);
  return result.ok
    ? { composition: result.config, error: null }
    : { composition: null, error: result.reason };
});

// Post-commit clear — runs ONCE after first mount. Empty deps.
useEffect(() => {
  if (typeof window === 'undefined') return;
  if (!window.location.hash.startsWith('#c=')) return;
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
}, []);
```

Rationale (Pitfall 2 + Pitfall 5):

- **If the read lived in `useEffect`:** First render would see `composition === null`, then a re-render after the effect would flip it to the decoded config — visible flicker as the Dashboard appears for ~16ms before the Composer modal slides up.
- **If `replaceState` lived in the render body:** Touching `history` during render is a React anti-pattern (warns in StrictMode, makes the render impure, breaks concurrent rendering).
- **Solution:** Split read from clear. `useState` initializer for the synchronous read; `useEffect([])` for the side-effecting clear.

### `src/hooks/__tests__/useHashComposition.test.ts` (18 tests, 190 lines)

All 4 hash scenarios covered:

| Scenario               | Hash example         | Expected composition | Expected error          | replaceState called? |
| ---------------------- | -------------------- | -------------------- | ----------------------- | -------------------- |
| No hash                | `''`                 | `null`               | `null`                  | No                   |
| Unrelated hash         | `'#unrelated'`       | `null`               | `null`                  | No                   |
| Valid `#c=v1:...`      | `'#c=v1:60000-0'`    | `{ segments: [...] }`| `null`                  | Yes — `(null, '', pathname+search)` |
| Wrong version          | `'#c=v2:60000-0'`    | `null`               | `'wrong_version'`       | Yes                  |
| Malformed              | `'#c=garbage'`       | `null`               | `'malformed'`           | Yes                  |
| Invalid segment data   | `'#c=v1:60000-9'`    | `null`               | `'invalid_segment_data'`| Yes                  |
| Too long               | `'#c=' + (1600-char)`| `null`               | `'too_long'`            | Yes                  |
| Binary garbage         | `'#c=\x00\x01\x02'`  | (does not throw)     | (does not throw)        | (does not throw)     |

Additional coverage:

- `clearError()` resets `error` to null but does NOT touch `composition`.
- `clearError()` on a successfully-decoded composition leaves composition intact.
- Multi-segment compositions with mixed sounds (gentle + triangle) decode correctly.
- `search` query string is preserved when clearing the hash.
- Synchronous-read invariant: composition is populated on the FIRST render — would catch a `useEffect` regression directly.

## Five DecodeResult Reasons — Coverage Matrix

| Reason                  | Triggered by                                                            | Surface     |
| ----------------------- | ----------------------------------------------------------------------- | ----------- |
| `wrong_version`         | `#c=v2:...`, `#c=v99:...`                                               | Direct test |
| `malformed`             | `#c=garbage` (no version prefix), `#c=v1:abc-0` (non-numeric duration)  | Direct test |
| `too_long`              | `#c=` + 1600-char body                                                  | Direct test |
| `invalid_segment_data`  | `#c=v1:60000-9` (unknown sound idx), `#c=v1:` (empty body)              | Direct test (2x) |
| `failed_validation`     | Reserved for future engine-level rules (defence-in-depth)               | Surfaced as `error` via the same code path; the hook is reason-agnostic — Composer will render any reason string Toast |

The `failed_validation` reason flows through the same `state.error = result.reason` assignment as the other four — the hook is reason-agnostic. Plan 09-01's shareUrl test already verifies the `validateSegmentConfig` gate; this hook test does not duplicate that coverage.

## Test Count and Suite Health

- **New tests in this plan:** 18
- **Full suite:** 543/543 passing across 41 test files (up from 525/525)
- **`tsc --noEmit`:** clean
- **TDD gate sequence:** `test(09-07)` RED commit `7a79932` → `feat(09-07)` GREEN commit `0c775df`

## Confirmation: No Protected Files Modified

Verified by `git diff --quiet <path>`:

- `src/lib/shareUrl.ts` — byte-identical to Plan 09-01 baseline (exit 0)
- `src/hooks/useActiveAlarm.ts` — byte-identical to Phase 8 baseline (exit 0)

This plan is purely additive — two new files (the hook + its test), zero modifications to existing files.

## Deviations from Plan

None — plan executed exactly as written. Expanded the test set from the plan's target of ~12-14 tests to 18 (added multi-segment + search-preserve + unknown-sound-idx + too_long + clearError-preserves-composition + synchronous-read-invariant), but each addition is purely supplemental coverage and changes nothing about the hook's behavior.

## Threat Model Coverage

All 5 STRIDE entries from the plan's `<threat_model>` are addressed:

| Threat ID    | Mitigation in this plan                                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------------------------------------- |
| T-09-07-01   | `decodeComposition` (Plan 09-01) returns Result type; hook surfaces both branches; `not.toThrow()` test on binary garbage   |
| T-09-07-02   | `decodeComposition`'s MAX_HASH_LENGTH=1024 cap rejects oversized hashes; hook test directly triggers `too_long`             |
| T-09-07-03   | `history.replaceState(null, '', pathname + search)` clears hash on first commit; verified by 5 replaceState-spy tests       |
| T-09-07-04   | Only `location.pathname + location.search` (server-derived) passed to replaceState; never user-controlled string             |
| T-09-07-05   | `'#c='` prefix discriminator gates BOTH decode AND clear; non-`#c=` hashes silently ignored (2 dedicated tests)              |

## Threat Flags

None — this plan introduces no new security-relevant surface beyond what was already covered by the plan's threat model. The hook is a pure consumer of `shareUrl.decodeComposition` (the threat-mitigation primary at the URL → React state boundary).

## Commits

| Hash      | Type | Message                                                  |
| --------- | ---- | -------------------------------------------------------- |
| `7a79932` | test | add failing tests for useHashComposition hook (RED gate) |
| `0c775df` | feat | implement useHashComposition hook (SHR-02/SHR-03)        |

## Next Step

Plan 09-08 (Composer modal) will consume `useHashComposition` at the App.tsx mount level and pipe `error` into a `<Toast>` via `useEffect`; `composition !== null` opens the Composer modal pre-loaded with the shared config (the `load` action on `composerReducer` from Plan 09-02).

## Self-Check: PASSED

- `src/hooks/useHashComposition.ts` — FOUND
- `src/hooks/__tests__/useHashComposition.test.ts` — FOUND
- Commit `7a79932` (test) — FOUND in `git log --oneline --all`
- Commit `0c775df` (feat) — FOUND in `git log --oneline --all`
- 18/18 plan-scope tests passing
- 543/543 full-suite tests passing
- `tsc --noEmit` clean
- `git diff --quiet src/lib/shareUrl.ts` — exit 0
- `git diff --quiet src/hooks/useActiveAlarm.ts` — exit 0
