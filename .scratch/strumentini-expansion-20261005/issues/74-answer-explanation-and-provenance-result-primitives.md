# 74 — Answer explanation and provenance result primitives

**What to build:** Add canonical primary-answer, interpretation, structured detail/breakdown, assumptions and provenance primitives inside the existing two-stylesheet design vocabulary.

**Traces to:** US-EXP-01; AC-01.2; DEC-EXP-03

**Constraints:** C-EXP-03, C-EXP-04, C-EXP-09; reuse existing tokens/styles; raw JSON stays fallback only.

**Blocked by:** 70 — Result declaration in Tool Manifest.

**Status:** completed

**Suggested skills:** design-system → design-impeccable → inclusive-design → code-tdd

- [x] Calculator/validator/reference exemplars need no bespoke visual system.
- [x] Primary answer is first in semantic reading order and works at 390px.
- [x] Provenance/assumptions remain visible but secondary.

**Verification:** Design-system tests plus desktop/mobile exemplar fixtures.

**Evidence:** Shared ResultPrimaryAnswer/Interpretation/Breakdown/Assumptions/Provenance primitives are covered by conformance and exemplar tests/browser; answer-first order and secondary provenance are asserted.
