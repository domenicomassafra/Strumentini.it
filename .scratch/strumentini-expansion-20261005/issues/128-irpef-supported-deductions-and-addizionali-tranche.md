# 128 — IRPEF supported deductions and addizionali tranche

**What to build:** Add only specifically sourced deduction/regional/municipal components with declared locality/year coverage, returning partial rather than invented values when data is missing.

**Traces to:** US-EXP-02, US-EXP-07; AC-02.2, AC-07.1

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** 127 — IRPEF national annual core.

**Status:** blocked

**Suggested skills:** research-primary-sources → code-module-design → code-tdd

- [ ] Coverage matrix states supported deduction/locality/year combinations.
- [ ] Missing locality data yields partial state with national tax still intact.
- [ ] Each added component has independent source metadata and breakdown.

**Verification:** Supported/unsupported locality-year matrix and boundary fixtures.
