# 210 — Image target-size search engine

**What to build:** Implement cancellable iterative ≤KB/MB solving over proven image codecs, with quality floor and optional dimension reduction as a separate user choice.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1, AC-06.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 207, 208.

**Status:** blocked

**Suggested skills:** code-module-design → code-tdd → browser-performance-benchmark

- [ ] Success is asserted only when final bytes meet target.
- [ ] Impossible target returns best effort plus limiting reason.
- [ ] Cancellation works between iterations without leaking resources.

**Verification:** Exact-byte boundary, nonmonotonic codec and cancellation/memory fixtures.
