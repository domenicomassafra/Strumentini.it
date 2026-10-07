# 287 — Existing date-time 200-audit tranche

**What to build:** Audit every original tool in category date-time (20 current catalog entries) against expected job functionality, options, preview/batch/error handling and current child tickets; populate the functional-audit record for each rather than treating Result v2 visuals as an upgrade.

**Traces to:** US-EXP-01; AC-01.1, AC-09.1; DEC-EXP-06, DEC-EXP-07

**Constraints:** C-EXP-01; audit actual current implementation and public job, not competitor feature count.

**Blocked by:** 110 — Original-200 functional-audit record schema.

**Status:** completed

**Suggested skills:** plan-tickets → code-architecture-review → code-tdd

- [x] Exactly 20/20 current date-time ids receive one audit record.
- [x] Each gap maps to an existing targeted ticket or creates one named child; no vague improve-everything item.
- [x] ALREADY_COMPLETE/REFUSED carries concrete evidence or reason.

**Verification:** Category inventory parity, current tests/fixtures and audit-schema validator.

**Evidence:** 20/20 `date-time` records under `quality/functional-audit/records/` validate against the original-200 schema. All 20 are `ALREADY_COMPLETE` against their explicitly declared public jobs, each bound to a tool-specific Gold receipt plus executable date/time tests and real browser acceptance (with the established business-day and timezone-overlap seams used where those routes live outside the shared date-time browser receipt). `tests/functional-audit-tranches-287-289.test.ts`, the date-time engine/module tests and `scripts/functional-audit-200.ts --check` pass.
