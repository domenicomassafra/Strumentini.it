# 140 — Reference-size conversion helpers

**What to build:** Add ISO paper sizes, model scale and TV diagonal↔dimensions; shoe/clothing reference is included only if a bounded sourced region table can be maintained and is labelled reference-not-fit.

**Traces to:** US-EXP-03, US-EXP-10; AC-03.1

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** 136 — Unit engine tranche 1 basic dimensions.

**Status:** completed

**Suggested skills:** research-primary-sources → code-tdd

- [x] Paper/model/TV calculations are deterministic with required aspect/scale inputs.
- [x] Any clothing/shoe table declares region/source/coverage.
- [x] Unsourced fit claims are refused.

**Verification:** ISO paper/aspect/scale literals plus missing-source branch.

**Evidence:** Paper mode uses the bounded ISO 216:2007 A/B nominal millimetre table, model-scale mode requires a positive explicit 1:n denominator, and TV geometry requires explicit aspect input for diagonal→dimensions. No clothing/shoe table is shipped; unsupported fit modes fail with `UNSOURCED_REFERENCE_FIT`, satisfying the source-required branch without inventing fit claims. A4, 1:50 and 55-inch 16:9 literals are covered by focused tests.
