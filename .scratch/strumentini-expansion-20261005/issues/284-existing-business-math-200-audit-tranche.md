# 284 — Existing business-math 200-audit tranche

**What to build:** Audit every original tool in category business-math (16 current catalog entries) against expected job functionality, options, preview/batch/error handling and current child tickets; populate the functional-audit record for each rather than treating Result v2 visuals as an upgrade.

**Traces to:** US-EXP-01; AC-01.1, AC-09.1; DEC-EXP-06, DEC-EXP-07

**Constraints:** C-EXP-01; audit actual current implementation and public job, not competitor feature count.

**Blocked by:** 110 — Original-200 functional-audit record schema.

**Status:** completed

**Suggested skills:** plan-tickets → code-architecture-review → code-tdd

- [x] Exactly 16/16 current business-math ids receive one audit record.
- [x] No missing behavior required by the current narrow public jobs was found; broader calculator/business enhancements remain separately scoped rather than being fabricated as audit gaps.
- [x] All 16 ALREADY_COMPLETE records carry tool-specific Gold, executable unit, browser-acceptance and oracle-registry evidence.

**Verification:** Category inventory parity, current tests/fixtures and audit-schema validator.

**Verified:** 16/16 records in `quality/functional-audit/records` validate as ALREADY_COMPLETE. Every route is Gold-certified under `quality/receipts/business-math`, `tests/business-tools.test.ts` passes the independent literal vectors, module behavior and typed error cases, and `quality/receipts/business-math/browser-acceptance.json` covers all 16 real routes with keyboard/mobile/locality evidence. The category-scoped final validator passes with no orphan, duplicate or missing record.
