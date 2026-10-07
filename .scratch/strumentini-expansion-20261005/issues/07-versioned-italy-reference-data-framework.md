# 07 — Versioned Italy reference-data framework

**What to build:** Create the version/source/provenance contract for Italian fiscal and administrative datasets/rules so annual brackets, rates, coefficients, municipalities/codes, and source dates are testable data rather than unexplained constants.

**Traces to:** US-EXP-02, US-EXP-07, US-EXP-09; AC-02.2, AC-07.1, AC-07.2; DEC-EXP-04; C-EXP-01, C-EXP-03, C-EXP-06

**Constraints:** Official authorities only for normative values; every version carries checked-at/source/validity metadata; no live scraping is required for ordinary calculations.

**Blocked by:** None — can start immediately.

**Status:** completed

- [x] A fiscal/reference data version is addressable by year/effective interval.
- [x] Source metadata is available to tests and result UI.
- [x] Boundary fixtures can target each threshold/bracket/rate change.
- [x] A stale/unsupported year fails honestly instead of silently reusing the latest rules.

**Verification:** Unit tests for version selection, stale-year behavior, source metadata, and boundary fixture loading; no existing tool behavior changes.

**Evidence (2026-10-06):** `src/reference-data/italy/` defines the typed version, official-source provenance, effective-interval registry and boundary-fixture contract. `tests/italy-reference-data.test.ts` proves version/year/date selection, unsupported gaps/years, source metadata, fixture loading and invalid/ambiguous packs; the focused suite passes 5/5, `npx tsc --noEmit` passes and this foundation changes no existing tool engine behavior.
