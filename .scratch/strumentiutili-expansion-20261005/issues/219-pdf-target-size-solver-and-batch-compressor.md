# 219 — PDF target-size solver and batch compressor

**What to build:** Add ≤KB/MB best-effort iteration over proven PDF profiles plus a bounded multi-PDF queue with isolated failures and ZIP successes.

**Traces to:** US-EXP-04, US-EXP-10; AC-04.1, AC-06.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 79, 218, 222.

**Status:** blocked

**Suggested skills:** pdf → code-tdd → qa-browser → browser-performance-benchmark

- [ ] Target success comes only from final byte count.
- [ ] Impossible target names limiting content and suggests valid next actions.
- [ ] Batch failures isolate and successful outputs remain downloadable.

**Verification:** Target boundary, scan/text-heavy, cancel/memory and ZIP integrity fixtures.
