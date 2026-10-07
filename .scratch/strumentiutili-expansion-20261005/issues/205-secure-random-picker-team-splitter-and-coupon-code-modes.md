# 205 — Secure random picker team splitter and coupon-code modes

**What to build:** Build random number, picker/draw, balanced team split and coupon-code modes on the secure RNG seam, exposing secure-vs-seeded semantics and avoiding persistent task-manager scope.

**Traces to:** US-EXP-10

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; deterministic/local by default; extend existing engines/routes where the job is already present.

**Blocked by:** 159 — Secure password PIN and Italian passphrase generators.

**Status:** completed

**Suggested skills:** code-module-design → code-tdd → inclusive-design

- [x] Unseeded selection uses unbiased secure RNG.
- [x] Any reproducible seeded mode is explicitly non-secure.
- [x] Team/coupon modes define duplicate/constraint behavior deterministically.

**Verification:** Selection property tests and constraint edge cases.

**Evidence (2026-10-06):** `src/tools/random-picker-team-coupon-generator/module.ts` implements one local multi-mode route for inclusive random integers, list draws without replacement, balanced team splitting and unique coupon codes. Secure mode calls ticket 159's `unbiasedRandomIndex`, so every bounded unseeded choice uses WebCrypto plus uint32 rejection sampling; seeded mode feeds the same sampler from a deterministic PRNG and returns an explicit `secure: false` disclosure. Picker duplicate labels remain separate source tickets, team duplicate names are rejected after trim, and coupon alphabets/collisions have deterministic rules. `tests/random-utilities.test.ts` now passes 7 focused property/edge tests, including forced rejection-tail handling on number, picker, team and coupon secure paths, secure range/uniqueness loops, seeded reproducibility with `secure: false` on every seeded mode, duplicate-ticket draws, team balance/duplicate refusal and coupon uniqueness/space errors. Combined with `tests/password-security-tools.test.ts`, the shared ticket-159/205 seam is 13/13 green. `npx tsc --noEmit`, `python3 quality/oracles/validate.py`, backlog validation and `git diff --check` pass; oracle `cand-243` and fixture family `random-utilities` record the contract. A fresh registry read after concurrent work shows `cand-246` present with no collision. Current shared-tree `catalog:build/check` is blocked only by unrelated concurrent manifests: `audio-generator` still references missing `cand-248` / `browser-audio-utilities`, and `browser-text-to-speech` has a summary longer than the 160-character catalog limit; the random manifest itself is 140 characters and resolves `cand-243` plus `random-utilities` correctly.
