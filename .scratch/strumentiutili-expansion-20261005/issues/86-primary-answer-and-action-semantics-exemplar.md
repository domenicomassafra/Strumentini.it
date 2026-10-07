# 86 — Primary-answer and action-semantics exemplar

**What to build:** Create calculator, validator and transform exemplars proving the primary answer is the first reading target and the primary action is explicit in semantics, independent of CSS/button order.

**Traces to:** US-EXP-01; AC-01.2

**Constraints:** C-EXP-04, C-EXP-09; shared primitives only.

**Blocked by:** 74, 75, 85.

**Status:** completed

**Suggested skills:** interaction-design → inclusive-design → qa-browser

- [x] Answer precedes detail/provenance in reading order.
- [x] Primary action has stable accessible semantics.
- [x] Wrapping/reordering at 390px does not change semantics.

**Verification:** Keyboard and accessibility-tree browser fixture on desktop and 390px.

**Evidence:** tests/result-v2-exemplars.test.ts and acceptance:result-exemplars prove calculator/validator/transform answer-first reading order and explicit primary-action semantics independent of 390px wrapping.
