# 72 — Result operation state model with partial and warning

**What to build:** Extend shared operation state to idle, running, success, warning, partial, error and cancelled/recovery behavior while preventing stale completions and preserving recoverable input.

**Traces to:** US-EXP-01; AC-01.3; DEC-EXP-03

**Constraints:** C-EXP-01, C-EXP-04, C-EXP-09; state semantics first, no redesign.

**Blocked by:** 70 — Result declaration in Tool Manifest.

**Status:** completed

**Suggested skills:** interaction-design → code-module-design → code-typescript → code-tdd

- [x] Transitions are explicit and impossible compound states are excluded.
- [x] Late completion cannot overwrite cancelled/replaced runs.
- [x] Existing success/error/cancel consumers remain compatible during migration.

**Verification:** Transition tests for double-submit, cancel→retry, stale completion, partial and warning.

**Evidence:** Shared useToolOperation exposes explicit idle/running/success/warning/partial/error/cancelled states; the 54-sample state matrix and controlled operation acceptance prove double-submit exclusion, cancel/retry and stale-completion suppression.
