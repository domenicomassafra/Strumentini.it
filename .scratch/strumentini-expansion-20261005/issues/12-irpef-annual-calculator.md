# 12 — IRPEF annual calculator

**What to build:** Add a year-scoped Italian IRPEF calculator whose rates, brackets, supported deductions/addizionali and assumptions come from versioned official reference data and whose result shows a reproducible calculation breakdown.

**Traces to:** US-EXP-02, US-EXP-07; AC-02.1, AC-02.2, AC-07.1; DEC-EXP-04; C-EXP-03, C-EXP-06

**Constraints:** Never label an estimate as an official tax assessment; unsupported deductions/municipal rules must be explicit; no unexplained annual constants in code.

**Blocked by:** 127, 128.

**Status:** blocked

- [ ] Tax year is explicit and only supported versions are selectable.
- [ ] Each bracket boundary has a line-item calculation and provenance.
- [ ] Unsupported deductions/addizionali produce scoped warnings rather than silent omission.
- [ ] Result exposes gross tax, supported deductions/additions and final modeled tax.

**Verification:** Official-source fixture set around every threshold, deterministic formula tests, source metadata tests, Italian browser acceptance, and stale-year fail-closed proof.

## 2026-10-10 owner planning reconciliation

**Original status and all historical acceptance criteria stay unchanged and OPEN.** New planning crosswalk: #398.

**Next actionable AC:** Tax year is explicit and only supported versions are selectable.. The original acceptance cannot be transferred or marked implemented merely because a new child was planned. Verify actual current source, output, negative cases and physical device when required; retain all gates and source-year/fidelity/security limits.
