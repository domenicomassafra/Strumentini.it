# 06 — Close Result v2 at 200/200 coverage

**What to build:** Add the generated contract/report and acceptance gate that proves every current catalog entry has an explicit Result v2 class or an approved no-change proof, then retire obsolete generic result fallbacks only after zero callers remain.

**Traces to:** US-EXP-01; AC-01.1, AC-01.2, AC-01.3; DEC-EXP-03; C-EXP-01, C-EXP-09

**Constraints:** Expand-contract finalization; this ticket cannot hide unmigrated tools by defaulting them to a generic class.

**Blocked by:** 02, 03, 04, 05, 83.

**Status:** completed

- [x] Coverage report equals 200/200 against the generated catalog.
- [x] Zero route relies on the legacy raw-object result path as its normal user presentation.
- [x] Old primitives/fallbacks are removed only when no live caller remains.

**Verification:** A CI gate fails if any catalog entry lacks a declared result contract; full test/check/build/certification suite remains green.

**Evidence:** the generated Result v2 inventory contains exactly 200 current catalog ids and all 200 are declared under exactly one migration owner. `result-v2:legacy-zero` reports 0 primary raw/generic/manual fallbacks while allowed secondary raw detail remains explicit. Result-v2 conformance passes all 9 semantic classes. The final integration suite is green: `npm run check` reports 0 Astro errors, `npm run build` builds/inspects all 220 pages with current certification, Vitest passes 90 files / 769 tests, the original-200 audit final gate passes 196 VERIFIED + 4 REFUSED, TypeScript passes and `git diff --check` is clean.
