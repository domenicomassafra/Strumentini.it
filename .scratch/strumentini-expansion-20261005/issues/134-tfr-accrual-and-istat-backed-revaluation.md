# 134 — TFR accrual and ISTAT-backed revaluation

**What to build:** Implement gross TFR accrual and revaluation with explicit historical input/data coverage and versioned reference indices where required.

**Traces to:** US-EXP-02, US-EXP-07; AC-02.2, AC-07.1

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** 117 — Italian fiscal annual source snapshots.

**Status:** blocked

**Suggested skills:** research-primary-sources → code-module-design → code-tdd

- [ ] Accrual and revaluation are separate visible components.
- [ ] Missing required historical index returns partial state.
- [ ] Monthly/year boundaries follow the declared model.

**Verification:** Worked accrual, year-boundary and missing-index fixtures.

## 2026-10-10 owner planning reconciliation

**Original status and all historical acceptance criteria stay unchanged and OPEN.** New planning crosswalk: #401.

**Next actionable AC:** Accrual and revaluation are separate visible components.. The original acceptance cannot be transferred or marked implemented merely because a new child was planned. Verify actual current source, output, negative cases and physical device when required; retain all gates and source-year/fidelity/security limits.
