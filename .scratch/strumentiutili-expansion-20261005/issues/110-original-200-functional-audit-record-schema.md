# 110 — Original-200 functional-audit record schema

**What to build:** Create the per-current-tool audit record separate from Result v2 status: UPGRADED, ALREADY_COMPLETE or REFUSED with rationale, evidence and child-ticket links.

**Traces to:** US-EXP-01; AC-01.1, AC-09.1; DEC-EXP-06, DEC-EXP-07

**Constraints:** C-EXP-01; visual migration alone cannot satisfy functional audit.

**Blocked by:** 82 — Renderer-seam migration ledger for all 200 tools.

**Status:** completed

**Suggested skills:** code-architecture-review → plan-tickets → code-tdd

- [x] Exactly one pending functional-audit assignment exists per current catalog id; the final gate separately requires one decided record for every assignment.
- [x] ALREADY_COMPLETE and REFUSED require evidence/rationale.
- [x] UPGRADED requires a targeted child ticket plus functional evidence; visual-only or Result v2-only evidence is rejected.

**Verification:** 200-parity generator plus missing/duplicate/visual-only sabotage.

**Implemented:** `src/quality/functional-audit.ts`, `scripts/functional-audit-200.ts`, `quality/functional-audit/schema.json`, `quality/functional-audit/assignment-index.schema.json` and `quality/functional-audit/original-200.assignments.json`. The generated index is exactly 200/200 with `status: "pending"` and `decision: null`; `audit:original-200:final` fails closed until every assignment has a final record. `tests/functional-audit.test.ts` covers missing, duplicate, stale and visual-only sabotage.
