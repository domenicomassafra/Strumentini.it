# 295 — Existing text 200-audit tranche

**What to build:** Audit every original tool in category text (21 current catalog entries) against expected job functionality, options, preview/batch/error handling and current child tickets; populate the functional-audit record for each rather than treating Result v2 visuals as an upgrade.

**Traces to:** US-EXP-01; AC-01.1, AC-09.1; DEC-EXP-06, DEC-EXP-07

**Constraints:** C-EXP-01; audit actual current implementation and public job, not competitor feature count.

**Blocked by:** 110 — Original-200 functional-audit record schema.

**Status:** completed

**Suggested skills:** plan-tickets → code-architecture-review → code-tdd

- [x] Exactly 21/21 current text ids receive one audit record.
- [x] No missing behavior required by the current narrow public jobs was found; broader backlog modes remain additive rather than being fabricated as audit gaps.
- [x] All 21 ALREADY_COMPLETE records carry tool-specific Gold, executable unit and browser evidence.

**Verification:** Category inventory parity, current tests/fixtures and audit-schema validator.

**Verified:** text-writing browser acceptance passes 15/15 routes and text-research acceptance passes its text routes; the four local-jobs text routes (`language-aware-text-statistics`, `lorem-sample-data-generator`, `reading-time-estimator`, `smart-quote-normalizer`) all passed their fresh browser cases before that broader family run later stopped on the out-of-scope `public-holiday-lookup` date-time assertion. Text engine/list/local-job fixture tests are green and all 21 records validate.
