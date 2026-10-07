# 01 — Expand Result System v2 primitives

**What to build:** Add an answer-first result contract beside the current result primitives so tools can declare semantic result classes (calculator, validator, text/code, table, file, image, PDF, batch, reference/network) and get coherent primary answer, detail, actions, states, and accessibility without breaking current routes.

**Traces to:** US-EXP-01, US-EXP-09; AC-01.2, AC-01.3, AC-04.1, AC-05.1; DEC-EXP-03; C-EXP-03, C-EXP-04, C-EXP-09

**Constraints:** Expand-contract only; preserve existing rendering until migrations land; no second design system; primary actions must be semantic rather than positional.

**Blocked by:** 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87.

**Status:** completed

**Suggested skills:** code-architecture-review → code-module-design → design-system → inclusive-design → code-tdd → qa-browser

**Decomposition:** This is now the Result System v2 integration/closure gate. Implement the targeted child tickets above; do not re-implement their contracts, primitives or evidence paths here.

- [x] Shared result semantics cover all result classes named in the source spec.
- [x] Copy/download/batch/provenance/before-after affordances are reusable and optional by capability.
- [x] Idle/running/success/warning/partial/error states are keyboard/mobile/ARIA coherent.
- [x] Existing tools continue passing current tests before any family migration.

**Verification:** Unit/design-system tests for every result class and state plus representative desktop/mobile browser fixtures with no regressions on existing tool routes.

**Evidence:** all child tickets 70–87 are completed. The shared unit suite passes 70/70, semantic conformance covers all 9 classes, the state matrix covers 54 class/state samples, accessibility passes keyboard/recovery/reduced-motion/390px/200% zoom, and the controlled operation fixture proves cancel/retry/stale-run behavior.
