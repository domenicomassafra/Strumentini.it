# 215 — Bounded lazy PDF page-thumbnail renderer

**What to build:** Create a reusable lazy/virtualized page-thumbnail interface with stable page identity and rotation state; the existing mutation engine remains authoritative.

**Traces to:** US-EXP-01, US-EXP-04; AC-04.1, AC-06.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 78, 100, 269.

**Status:** blocked

**Suggested skills:** pdf → code-module-design → code-tdd → qa-browser → browser-performance-benchmark

- [ ] A 200-page PDF is not eagerly rendered in full.
- [ ] Leaving/cancelling releases render resources.
- [ ] Page/document render failure is isolated and explained.

**Verification:** Page-count corpus, lazy/memory evidence, keyboard order and 390px browser QA.
