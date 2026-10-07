# 125 — Percentage helper complete human modes

**What to build:** Extend existing percentage-helper beyond current add/reverse behavior with X% of Y, X is what percent of Y, increase/decrease, variation, reverse discount and cascading discounts where mathematically distinct.

**Traces to:** US-EXP-02, US-EXP-03; AC-03.2

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** 88 — Migrate BusinessMathTool renderer to Result v2.

**Status:** completed

**Suggested skills:** code-module-design → code-tdd

- [x] Modes share the existing exact rational decimal core rather than duplicate floating-point formulas.
- [x] Zero denominator, negatives and 100%+ cases are defined and covered by focused tests.
- [x] Italian comma input is parsed into the same exact rational representation; result formatting remains deterministic.

**Verification:** `tests/business-tools.test.ts` covers legacy add/reverse plus percent-of, what-percent, increase, decrease, variation, reverse-discount, cascading discounts, comma decimals and denominator/negative/100%+ edges.
