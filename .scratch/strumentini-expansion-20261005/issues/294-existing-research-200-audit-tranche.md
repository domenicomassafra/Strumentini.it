# 294 — Existing research 200-audit tranche

**What to build:** Audit every original tool in category research (21 current catalog entries) against expected job functionality, options, preview/batch/error handling and current child tickets; populate the functional-audit record for each rather than treating Result v2 visuals as an upgrade.

**Traces to:** US-EXP-01; AC-01.1, AC-09.1; DEC-EXP-06, DEC-EXP-07

**Constraints:** C-EXP-01; audit actual current implementation and public job, not competitor feature count.

**Blocked by:** 110 — Original-200 functional-audit record schema.

**Status:** completed

**Suggested skills:** plan-tickets → code-architecture-review → code-tdd

- [x] Exactly 21/21 current research ids receive one audit record.
- [x] The identified completeness gap was `ris-bibtex-converter`, mapped to ticket 276 and closed with authoritative oracle evidence; no vague improve-everything item is used.
- [x] All 20 ALREADY_COMPLETE records carry Gold/unit/browser evidence; the RIS/BibTeX UPGRADED record carries Gold/unit/browser/independent-oracle evidence and rationale.

**Verification:** Category inventory parity, current tests/fixtures and audit-schema validator.

**Verified:** 21 records in `quality/functional-audit/records` (20 ALREADY_COMPLETE, 1 UPGRADED). `tests/research-knowledge-engine.test.ts` + `tests/research-reference-engine.test.ts` pass; fresh research browser acceptance passes 14/14 routes; the independent RIS/BibTeX oracle passes 7 probes; canonical preflight and Gold certification pass with `cand-187` high-confidence and no open gap for the declared subset. Ticket 276 remains linked as the completed owner of that upgrade.
