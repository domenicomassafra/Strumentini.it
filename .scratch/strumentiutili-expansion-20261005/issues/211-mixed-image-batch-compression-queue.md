# 211 — Mixed-image batch compression queue

**What to build:** Build a bounded mixed JPEG/PNG/WebP queue selecting the proper adapter per file with isolated failures, aggregate savings and download-all ZIP.

**Traces to:** US-EXP-04; AC-04.1, AC-06.1

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-05, C-EXP-08; local-first, bounded memory, verified output, lazy heavy dependencies.

**Blocked by:** 79, 207, 208, 210, 222.

**Status:** blocked

**Suggested skills:** code-module-design → code-tdd → qa-browser → browser-performance-benchmark

- [ ] One corrupt file never removes successful outputs.
- [ ] Concurrency stays within declared resource budget.
- [ ] Aggregate totals reconcile exactly to per-file bytes.

**Verification:** Mixed corpus, failure isolation, cancel, ZIP integrity and mobile run.
