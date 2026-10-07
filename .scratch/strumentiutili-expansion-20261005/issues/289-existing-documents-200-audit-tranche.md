# 289 — Existing documents 200-audit tranche

**What to build:** Audit every original tool in category documents (20 current catalog entries) against expected job functionality, options, preview/batch/error handling and current child tickets; populate the functional-audit record for each rather than treating Result v2 visuals as an upgrade.

**Traces to:** US-EXP-01; AC-01.1, AC-09.1; DEC-EXP-06, DEC-EXP-07

**Constraints:** C-EXP-01; audit actual current implementation and public job, not competitor feature count.

**Blocked by:** 110 — Original-200 functional-audit record schema.

**Status:** completed

**Suggested skills:** plan-tickets → code-architecture-review → code-tdd

- [x] Exactly 20/20 current documents ids receive one audit record.
- [x] Each gap maps to an existing targeted ticket or creates one named child; no vague improve-everything item.
- [x] ALREADY_COMPLETE/REFUSED carries concrete evidence or reason.

**Verification:** Category inventory parity, current tests/fixtures and audit-schema validator.

**Evidence:** 20/20 `documents` records validate against the original-200 schema and are `ALREADY_COMPLETE` for the deliberately scoped public jobs. Each record is bound to its PDF Gold receipt, `tests/pdf-document-tools.test.ts` and real PDF browser acceptance. The audit treats declared limits as part of the contract rather than pretending full-PDF support: tests cover JPEG-only embedding/extraction, supported text/AcroForm structures, bounded page mutations, metadata/flatten/compression/compare behavior and explicit refusal to bypass encrypted PDFs. `tests/functional-audit-tranches-287-289.test.ts`, PDF engine/catalog tests and `scripts/functional-audit-200.ts --check` pass.
