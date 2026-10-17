MIGRATO su GitHub Issues il 17/10/2026: https://github.com/domenicomassafra/strumentini-it/issues?q=is%3Aissue. Non aggiornare più questo file.

# 15 — TFR calculator

**What to build:** Add an Italian TFR calculator that separates accrual, eligible revaluation and indicative tax treatment, with year/source metadata and an explanation of what cannot be derived from the provided inputs.

**Traces to:** US-EXP-02, US-EXP-07; AC-02.1, AC-02.2, AC-07.1; DEC-EXP-04; C-EXP-06

**Constraints:** Do not claim payroll/legal finality; ISTAT-dependent or historical values must be versioned inputs/data, never fabricated.

**Blocked by:** 134, 135.

**Status:** blocked

- [ ] Accrued gross TFR and revaluation are separate result lines.
- [ ] Historical/year assumptions are visible and reproducible.
- [ ] Indicative taxation is clearly distinguished from employer/authority settlement.
- [ ] Missing historical information produces a scoped partial state.

**Verification:** Reference-year fixtures, revaluation boundary tests, reproducible sample cases, partial-state acceptance and mobile/browser coverage.

## 2026-10-10 owner planning reconciliation

**Original status and all historical acceptance criteria stay unchanged and OPEN.** New planning crosswalk: #401.

**Next actionable AC:** Accrued gross TFR and revaluation are separate result lines.. The original acceptance cannot be transferred or marked implemented merely because a new child was planned. Verify actual current source, output, negative cases and physical device when required; retain all gates and source-year/fidelity/security limits.
