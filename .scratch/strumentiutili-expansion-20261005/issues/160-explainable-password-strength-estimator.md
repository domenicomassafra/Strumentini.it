# 160 — Explainable password-strength estimator

**What to build:** Add a deterministic offline strength estimator that reports concrete length/pattern observations and its limits without breach-database or absolute security claims.

**Traces to:** US-EXP-05, US-EXP-09; AC-09.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05; deterministic/local by default; extend existing engines/routes where the job is already present.

**Blocked by:** 70 — Result declaration in Tool Manifest.

**Status:** completed

**Suggested skills:** security-audit → code-tdd → inclusive-design

- [x] Repeated/common-pattern penalties and length effects are deterministic.
- [x] Result explains factors rather than only a score/color.
- [x] No network/breach-check wording is implied.

**Verification:** Worked literals and monotonic/property cases.

**Evidence (2026-10-06):** `tests/password-security-tools.test.ts` proves deterministic factor codes, repeated/common-pattern penalties and monotonic length cases; the Result v2 UI renders each factor plus explicit offline/no-breach-lookup limits. The manifest is `LOCAL` with network forbidden and binds Gold oracle `cand-225` / fixture family `password-security`.
