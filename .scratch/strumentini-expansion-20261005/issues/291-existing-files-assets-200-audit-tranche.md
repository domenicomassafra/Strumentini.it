# 291 — Existing files-assets 200-audit tranche

**What to build:** Audit every original tool in category files-assets (15 current catalog entries) against expected job functionality, options, preview/batch/error handling and current child tickets; populate the functional-audit record for each rather than treating Result v2 visuals as an upgrade.

**Traces to:** US-EXP-01; AC-01.1, AC-09.1; DEC-EXP-06, DEC-EXP-07

**Constraints:** C-EXP-01; audit actual current implementation and public job, not competitor feature count.

**Blocked by:** 110 — Original-200 functional-audit record schema.

**Status:** completed

**Suggested skills:** plan-tickets → code-architecture-review → code-tdd

- [x] Exactly 15/15 current files-assets ids receive one audit record.
- [x] Each gap maps to an existing targeted ticket or creates one named child; no vague improve-everything item.
- [x] ALREADY_COMPLETE/REFUSED carries concrete evidence or reason.

**Verification:** Category inventory parity, current tests/fixtures and audit-schema validator.

**Evidence:** `quality/functional-audit/records/` now contains exactly 15 `files-assets` decisions. Fourteen current jobs are `ALREADY_COMPLETE`, each grounded in a tool-specific Gold receipt plus real-route browser evidence; future image tickets are treated as additive where they broaden controls/previews/formats rather than repair the declared job. `image-resize` is `REFUSED`: Chrome/Edge/WebKit and engine checks are green, but canonical `quality/receipts/image-resize/certification.json` remains `PARTIAL`/`goldEligible:false` because physical Android Chrome and iOS Safari receipts are missing. Existing tickets 277 and 278 own those proofs, and 279 owns the evidence-derived Gold re-evaluation, so no new >=328 ticket is needed. `tests/functional-audit-tranche-291.test.ts`, relevant image tests, the original-200 audit validator, TypeScript and diff checks pass.
