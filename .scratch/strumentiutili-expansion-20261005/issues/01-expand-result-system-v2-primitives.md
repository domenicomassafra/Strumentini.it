# 01 — Expand Result System v2 primitives

**What to build:** Add an answer-first result contract beside the current result primitives so tools can declare semantic result classes (calculator, validator, text/code, table, file, image, PDF, batch, reference/network) and get coherent primary answer, detail, actions, states, and accessibility without breaking current routes.

**Traces to:** US-EXP-01, US-EXP-09; AC-01.2, AC-01.3, AC-04.1, AC-05.1; DEC-EXP-03; C-EXP-03, C-EXP-04, C-EXP-09

**Constraints:** Expand-contract only; preserve existing rendering until migrations land; no second design system; primary actions must be semantic rather than positional.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Shared result semantics cover all result classes named in the source spec.
- [ ] Copy/download/batch/provenance/before-after affordances are reusable and optional by capability.
- [ ] Idle/running/success/warning/partial/error states are keyboard/mobile/ARIA coherent.
- [ ] Existing tools continue passing current tests before any family migration.

**Verification:** Unit/design-system tests for every result class and state plus representative desktop/mobile browser fixtures with no regressions on existing tool routes.

