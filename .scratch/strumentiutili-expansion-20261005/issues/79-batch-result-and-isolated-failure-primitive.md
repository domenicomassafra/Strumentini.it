# 79 — Batch result and isolated-failure primitive

**What to build:** Add shared batch result semantics with completed/failed totals, per-item status, retry failed and download-successes/ZIP capabilities so one bad input never erases successful outputs.

**Traces to:** US-EXP-04; AC-04.1, AC-06.1

**Constraints:** C-EXP-04, C-EXP-05, C-EXP-09; actions reflect actual produced artifacts.

**Blocked by:** 72, 76, 78.

**Status:** completed

**Suggested skills:** interaction-design → inclusive-design → code-module-design → qa-browser

- [x] Mixed failure preserves successful downloads.
- [x] Retry targets failed items without discarding successes.
- [x] Summary and per-item states are keyboard/screen-reader understandable.

**Verification:** Mixed valid/malformed/unsupported/cancelled corpus in unit and browser acceptance.

**Evidence:** tests/batch-result.test.ts proves mixed success/failure preservation, retry-failed isolation and unsupported/cancelled handling; batch conformance covers accessible summary/items/actions.
