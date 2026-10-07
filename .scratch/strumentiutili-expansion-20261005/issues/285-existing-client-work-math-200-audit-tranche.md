# 285 — Existing client-work-math 200-audit tranche

**What to build:** Audit every original tool in category client-work-math (2 current catalog entries) against expected job functionality, options, preview/batch/error handling and current child tickets; populate the functional-audit record for each rather than treating Result v2 visuals as an upgrade.

**Traces to:** US-EXP-01; AC-01.1, AC-09.1; DEC-EXP-06, DEC-EXP-07

**Constraints:** C-EXP-01; audit actual current implementation and public job, not competitor feature count.

**Blocked by:** 110 — Original-200 functional-audit record schema.

**Status:** completed

**Suggested skills:** plan-tickets → code-architecture-review → code-tdd

- [x] Exactly 2/2 current client-work-math ids receive one audit record.
- [x] No missing behavior required by the current narrow public jobs was found; broader pricing/business work remains additive rather than being fabricated as an audit gap.
- [x] Both ALREADY_COMPLETE records carry tool-specific Gold, executable unit, browser-acceptance and oracle-registry evidence.

**Verification:** Category inventory parity, current tests/fixtures and audit-schema validator.

**Verified:** `margin-markup` and `rate-converter` both have Gold receipts under `quality/receipts/client-time-math`, executable exact-arithmetic/denominator tests in `tests/client-time-math-engine.test.ts` plus runtime/profile coverage, and committed browser acceptance covering keyboard, 390px layout, profile reuse and zero task-content network. The category-scoped final validator passes 2/2.
