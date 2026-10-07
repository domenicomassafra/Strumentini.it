# 293 — Existing marketing 200-audit tranche

**What to build:** Audit every original tool in category marketing (12 current catalog entries) against expected job functionality, options, preview/batch/error handling and current child tickets; populate the functional-audit record for each rather than treating Result v2 visuals as an upgrade.

**Traces to:** US-EXP-01; AC-01.1, AC-09.1; DEC-EXP-06, DEC-EXP-07

**Constraints:** C-EXP-01; audit actual current implementation and public job, not competitor feature count.

**Blocked by:** 110 — Original-200 functional-audit record schema.

**Status:** completed

**Suggested skills:** plan-tickets → code-architecture-review → code-tdd

- [x] Exactly 12/12 current marketing ids receive one audit record.
- [x] Known additive gaps are traced to existing targeted tickets 321, 322 and 325; tickets 323 and 324 were reviewed and correctly remain in the web-operations tranche rather than being duplicated here.
- [x] All 12 ALREADY_COMPLETE records carry tool-specific Gold, executable functional tests and real-route browser evidence; no Result v2-only evidence is used.

**Verification:** Category inventory parity, current tests/fixtures and audit-schema validator.

**Verified:** `tests/functional-audit-tranche-293.test.ts` proves exact marketing catalog parity, validates every record through the ticket-110 schema/gate, binds each Gold receipt to the same tool id and checks that the cited browser receipt names the route. Functional coverage passes in `tests/campaign-url-engine.test.ts`, `tests/url-marketing-tools.test.ts`, `tests/qr-local-engine.test.ts` and `tests/expanded-local-certification.test.ts`. Ticket 321 remains the owner for additive UTM builder/parser/cleaner bulk and round-trip deepening; 322 owns meta/Open Graph/social preview-preset deepening; 325 owns campaign-name/social-helper deepening. Those roadmap items are not claimed as shipped and do not make the current narrower public jobs incorrect. No scoped correctness blocker justified REFUSED, and no completed implementation child justified UPGRADED.
