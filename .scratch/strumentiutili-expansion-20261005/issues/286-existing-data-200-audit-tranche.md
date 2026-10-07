# 286 — Existing data 200-audit tranche

**What to build:** Audit every original tool in category data (20 current catalog entries) against expected job functionality, options, preview/batch/error handling and current child tickets; populate the functional-audit record for each rather than treating Result v2 visuals as an upgrade.

**Traces to:** US-EXP-01; AC-01.1, AC-09.1; DEC-EXP-06, DEC-EXP-07

**Constraints:** C-EXP-01; audit actual current implementation and public job, not competitor feature count.

**Blocked by:** 110 — Original-200 functional-audit record schema.

**Status:** completed

**Suggested skills:** plan-tickets → code-architecture-review → code-tdd

- [x] Exactly 20/20 current data ids receive one audit record.
- [x] No missing behavior required by the current narrow public jobs was found; larger CSV/interchange enhancements remain separately scoped rather than being fabricated as audit gaps.
- [x] All 20 ALREADY_COMPLETE records carry tool-specific Gold, executable unit, browser-acceptance and oracle-registry evidence.

**Verification:** Category inventory parity, current tests/fixtures and audit-schema validator.

**Verified:** All 20 data records validate as ALREADY_COMPLETE. `tests/table-expansion.test.ts` passes the 20-tool functional matrix including parsing, transforms, joins, pivots, profiling, charting and safety/error cases; `tests/table-ops-handoff.test.ts` and `tests/catalog-performance.test.ts` cover the bespoke CSV paths. Gold evidence is tool-specific across `data-table`, `table-ops` and `csv-cleaner`; browser evidence comes from the matching family receipts. The category-scoped final validator passes 20/20.
