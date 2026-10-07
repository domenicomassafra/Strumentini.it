# 75 — Explicit Result v2 action contract

**What to build:** Create capability-driven actions for Copy, Download, Download all/ZIP, Retry, Reset, Reuse and Handoff. Primary action is explicit semantics, never inferred from position.

**Traces to:** US-EXP-01, US-EXP-09; AC-01.2; DEC-EXP-03

**Constraints:** C-EXP-04, C-EXP-09; unavailable actions are absent; preserve current CSV handoff.

**Blocked by:** 70, 72.

**Status:** completed

**Suggested skills:** interaction-design → inclusive-design → code-module-design → code-tdd

- [x] Actions derive from declared result/artifact capabilities.
- [x] Keyboard order and accessible names are layout-independent.
- [x] Binary handoff is not claimed before its runtime ticket lands.

**Verification:** Unit action-resolution tests plus keyboard/clipboard/download/retry browser paths.

**Evidence:** tests/result-actions.test.ts and 9-class browser conformance prove capability-driven actions, one explicit primary action and keyboard-accessible names; unavailable actions remain absent.
