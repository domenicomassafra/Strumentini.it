MIGRATO su GitHub Issues il 17/10/2026: https://github.com/domenicomassafra/strumentini-it/issues?q=is%3Aissue. Non aggiornare più questo file.

# 11 — Upgrade IVA + percentage calculator

**What to build:** Upgrade the existing percentage/math capability into explicit human jobs for IVA add/scorporo and percentage modes: X% of Y, X is what % of Y, increase/decrease, variation, reverse discount, with an answer-first breakdown instead of a generic formula dump.

**Traces to:** US-EXP-02, US-EXP-03; AC-02.1, AC-03.2; DEC-EXP-01, DEC-EXP-03; C-EXP-03, C-EXP-06

**Constraints:** Do not duplicate engines for each mode; VAT presets and effective dates must be sourced/versioned; distinguish exact arithmetic from fiscal advice.

**Blocked by:** 125, 126.

**Status:** blocked

- [ ] All percentage modes have distinct labels, examples, formulas and reversible inputs.
- [ ] IVA add/scorporo exposes imponibile, aliquota, IVA and totale with source/year context.
- [ ] Existing percentage routes either migrate or redirect without duplicate low-value pages.
- [ ] Mobile result states explain the answer before the formula.

**Verification:** Exact arithmetic vectors including zero/negative/rounding boundaries, VAT preset fixtures, route/browser acceptance at 390px, and no regression of existing percentage helpers.

## 2026-10-10 owner planning reconciliation

**Original status and all historical acceptance criteria stay unchanged and OPEN.** New planning crosswalk: #398.

**Next actionable AC:** All percentage modes have distinct labels, examples, formulas and reversible inputs.. The original acceptance cannot be transferred or marked implemented merely because a new child was planned. Verify actual current source, output, negative cases and physical device when required; retain all gates and source-year/fidelity/security limits.
