# 108 — Machine-readable format-operation classification schema

**What to build:** Materialize docs/11 directional jobs into parseable rows carrying priority and IMPLEMENT, SPIKE or REFUSE state with ticket/evidence/reason links.

**Traces to:** US-EXP-04, US-EXP-10; AC-06.1, AC-10.1; DEC-EXP-05, DEC-EXP-07

**Constraints:** C-EXP-01, C-EXP-08; REFUSE is valid, silent omission is not.

**Blocked by:** None — can start immediately.

**Status:** completed

**Suggested skills:** code-architecture-review → plan-tickets → code-tdd

- [x] Every high-priority docs/11 row is parseable and uniquely identified.
- [x] Each row has a ticket/evidence path or explicit refusal reason.
- [x] Schema distinguishes direction-specific fidelity obligations.

**Verification:** Missing/duplicate/unclassified row sabotage test.

**Evidence (2026-10-06):** `quality/format-operations/registry.json` materializes the high-priority directional jobs from `docs/11-format-operation-matrix.md`; `src/quality/format-operations.ts` validates unique IDs, IMPLEMENT/SPIKE/REFUSE classification, input/output direction, fidelity text and ticket/evidence/refusal linkage. `tests/format-operation-registry.test.ts` passes 4/4 including missing, duplicate, unclassified and missing-refusal-reason sabotage; `npx tsc --noEmit` and scoped diff-check pass.
