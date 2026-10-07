# 288 — Existing developer 200-audit tranche

**What to build:** Audit every original tool in category developer (20 current catalog entries) against expected job functionality, options, preview/batch/error handling and current child tickets; populate the functional-audit record for each rather than treating Result v2 visuals as an upgrade.

**Traces to:** US-EXP-01; AC-01.1, AC-09.1; DEC-EXP-06, DEC-EXP-07

**Constraints:** C-EXP-01; audit actual current implementation and public job, not competitor feature count.

**Blocked by:** 110 — Original-200 functional-audit record schema.

**Status:** completed

**Suggested skills:** plan-tickets → code-architecture-review → code-tdd

- [x] Exactly 20/20 current developer ids receive one audit record.
- [x] Each gap maps to an existing targeted ticket or creates one named child; no vague improve-everything item.
- [x] ALREADY_COMPLETE/REFUSED carries concrete evidence or reason.

**Verification:** Category inventory parity, current tests/fixtures and audit-schema validator.

**Evidence:** 20/20 `developer` records validate against the original-200 schema with tool-specific Gold, developer-engine and real-route browser evidence. 18 remain `ALREADY_COMPLETE`; `regex-tester` and `uuid-generator` are now `UPGRADED` because tickets 178 and 179 closed their concrete audit gaps. Regex has worker isolation, hard timeout/cancellation and browser-observed ReDoS recovery; UUIDv7 reproduces the RFC 9562 Appendix A.6 vector and millisecond timestamp. `tests/functional-audit-tranches-287-289.test.ts`, focused developer/worker tests, browser acceptance and `gold:developer-web` pass.
