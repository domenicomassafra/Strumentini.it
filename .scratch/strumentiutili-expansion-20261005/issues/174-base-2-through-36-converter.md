# 174 — Base 2 through 36 converter

**What to build:** Add exact integer base conversion 2–36 with validation, sign policy and copyable machine/human representation using a bounded shared integer primitive.

**Traces to:** US-EXP-05

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; deterministic/local by default; extend existing engines/routes where the job is already present.

**Blocked by:** None — dependency 91 is completed.

**Status:** completed

**Suggested skills:** code-typescript → code-tdd

- [x] Round-trip across supported bases is exact within bounds.
- [x] Invalid digit/base is located precisely.
- [x] Large-value bound/error is explicit.

**Verification:** Property round trips and known literals.

**Evidence:** `parseBoundedRadixInteger` and `formatRadixInteger` use `bigint` positional arithmetic for every base 2–36 and enforce a documented 4096-digit local bound before repeated multiplication. The result exposes canonical input, exact decimal value, copyable human/machine forms and sign policy. Focused tests round-trip signed values across all 35 supported bases, include values far beyond IEEE-754 safe integers, locate invalid digits/bases with character/context diagnostics, and assert the large-input bound. The dedicated route reuses the shared local-only developer engine. Focused developer tests pass 39/39; `npx tsc --noEmit --pretty false`, `npm run catalog:check`, direct Astro build (223 pages), and `git diff --check` pass.
