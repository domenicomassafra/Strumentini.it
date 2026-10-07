# 296 — Existing web-operations 200-audit tranche

**What to build:** Audit every original tool in category web-operations (8 current catalog entries) against expected job functionality, options, preview/batch/error handling and current child tickets; populate the functional-audit record for each rather than treating Result v2 visuals as an upgrade.

**Traces to:** US-EXP-01; AC-01.1, AC-09.1; DEC-EXP-06, DEC-EXP-07

**Constraints:** C-EXP-01; audit actual current implementation and public job, not competitor feature count.

**Blocked by:** 110 — Original-200 functional-audit record schema.

**Status:** completed

**Suggested skills:** plan-tickets → code-architecture-review → code-tdd

- [x] Exactly 8/8 current web-operations ids receive one audit record.
- [x] No missing behavior required by the current narrow public jobs was found; planned live-network/deepening work remains separately scoped in existing tickets.
- [x] All 8 ALREADY_COMPLETE records carry tool-specific Gold, executable URL-engine tests and fresh browser evidence.

**Verification:** Category inventory parity, current tests/fixtures and audit-schema validator.

**Verified:** URL/marketing functional tests pass; fresh expanded-local browser acceptance covers the seven local web-operation routes, and direct fresh marketing/media browser acceptance covers `url-comparison`. All eight records validate against the current catalog and assignment owner.
