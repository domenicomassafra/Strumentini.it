# 166 — Structural JSON diff

**What to build:** Add stable-path JSON comparison distinguishing add/remove/type/value and meaningful array/order differences with bounded preview/export.

**Traces to:** US-EXP-05; AC-05.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; deterministic/local by default; extend existing engines/routes where the job is already present.

**Blocked by:** 77, 91.

**Status:** completed

**Suggested skills:** code-typescript → code-tdd → inclusive-design

- [x] Differences have stable JSON-Pointer-like paths.
- [x] Duplicate-key parse caveat is explicit.
- [x] Large diffs use bounded preview with complete downloadable result.

**Verification:** `tests/developer-structured-data.test.ts` covers escaped JSON Pointer paths, add/remove/type/order cases, duplicate-key warning, 200-entry preview bound and retention of the complete 250-entry result for the shared full-result download seam.
