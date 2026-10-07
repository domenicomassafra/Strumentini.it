# 290 — Existing files 200-audit tranche

**What to build:** Audit every original tool in category files (20 current catalog entries) against expected job functionality, options, preview/batch/error handling and current child tickets; populate the functional-audit record for each rather than treating Result v2 visuals as an upgrade.

**Traces to:** US-EXP-01; AC-01.1, AC-09.1; DEC-EXP-06, DEC-EXP-07

**Constraints:** C-EXP-01; audit actual current implementation and public job, not competitor feature count.

**Blocked by:** 110 — Original-200 functional-audit record schema.

**Status:** completed

**Suggested skills:** plan-tickets → code-architecture-review → code-tdd

- [x] Exactly 20/20 current files ids receive one audit record.
- [x] No missing behavior required by the current narrow public jobs was found; existing workflow/compression/extraction/privacy tickets remain additive rather than being fabricated as audit gaps.
- [x] All 20 ALREADY_COMPLETE records carry tool-specific Gold, executable unit/fixture, browser-acceptance and oracle-registry evidence.

**Verification:** Category inventory parity, current tests/fixtures and audit-schema validator.

**Verified:** 20/20 `files` records in `quality/functional-audit/records` validate as ALREADY_COMPLETE. Every route is Gold-certified and oracle-bound; `tests/file-privacy-engine.test.ts`, `tests/file-privacy-modules.test.ts`, `tests/file-hash-engine.test.ts` and `tests/local-jobs-fixtures.test.ts` pass 46/46. Browser evidence covers all 20 routes across the matching `expanded-local`, `local-jobs` and dedicated `file-hash` receipts. Existing tickets 197, 222, 224 and 326 describe richer exports/handoffs, DEFLATE, ZIP extraction and deeper privacy analysis beyond the current declared jobs, so no REFUSED/UPGRADED decision or new >=328 ticket is warranted. The category-scoped final validator passes 20/20 with no orphan, duplicate or missing record.
