MIGRATO su GitHub Issues il 17/10/2026: https://github.com/domenicomassafra/strumentini-it/issues?q=is%3Aissue. Non aggiornare più questo file.

# 13 — Stipendio netto annual calculator

**What to build:** Add an annual RAL-to-net salary estimator built on the year-scoped IRPEF/reference framework, with explicit employment assumptions, contribution inputs, monthly-payment convention and a transparent gross-to-net bridge.

**Traces to:** US-EXP-02, US-EXP-07; AC-02.1, AC-02.2, AC-03.2, AC-07.1; DEC-EXP-04; C-EXP-06

**Constraints:** Do not imply payroll-certificate accuracy; regional/municipal or contract-specific items outside supported scope must be disclosed; reuse IRPEF math rather than fork it.

**Blocked by:** 130.

**Status:** blocked

- [ ] Inputs state year, RAL, payment months and supported employment/contribution assumptions.
- [ ] Result shows annual net, indicative monthly net and each modeled deduction.
- [ ] Scope gaps are visible next to the answer, not buried in help copy.
- [ ] Changing payment months changes presentation, not annual tax logic.

**Verification:** Cross-check fixtures against hand-worked cases and official annual rules, boundary tests, deterministic monthly/annual reconciliation and mobile browser acceptance.

## 2026-10-10 owner planning reconciliation

**Original status and all historical acceptance criteria stay unchanged and OPEN.** New planning crosswalk: #399.

**Next actionable AC:** Inputs state year, RAL, payment months and supported employment/contribution assumptions.. The original acceptance cannot be transferred or marked implemented merely because a new child was planned. Verify actual current source, output, negative cases and physical device when required; retain all gates and source-year/fidelity/security limits.
