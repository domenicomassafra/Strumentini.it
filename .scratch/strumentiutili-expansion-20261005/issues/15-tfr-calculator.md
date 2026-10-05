# 15 — TFR calculator

**What to build:** Add an Italian TFR calculator that separates accrual, eligible revaluation and indicative tax treatment, with year/source metadata and an explanation of what cannot be derived from the provided inputs.

**Traces to:** US-EXP-02, US-EXP-07; AC-02.1, AC-02.2, AC-07.1; DEC-EXP-04; C-EXP-06

**Constraints:** Do not claim payroll/legal finality; ISTAT-dependent or historical values must be versioned inputs/data, never fabricated.

**Blocked by:** 01 — Result System v2 primitives; 07 — versioned Italy reference data.

**Status:** blocked

- [ ] Accrued gross TFR and revaluation are separate result lines.
- [ ] Historical/year assumptions are visible and reproducible.
- [ ] Indicative taxation is clearly distinguished from employer/authority settlement.
- [ ] Missing historical information produces a scoped partial state.

**Verification:** Reference-year fixtures, revaluation boundary tests, reproducible sample cases, partial-state acceptance and mobile/browser coverage.
