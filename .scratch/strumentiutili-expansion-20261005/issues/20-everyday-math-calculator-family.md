# 20 — Everyday math calculator family

**What to build:** Add a bounded family of deterministic everyday math jobs from the benchmark: scientific expressions, descriptive statistics, fractions, equations, geometry and related helpers, prioritizing clear answers and shown formulas.

**Traces to:** US-EXP-03; AC-03.2; DEC-EXP-01, DEC-EXP-07; C-EXP-03

**Constraints:** Use a safe parser instead of eval; each job must earn a route by distinct intent; domain errors and undefined results must be explicit.

**Blocked by:** 141, 142, 143, 144.

**Status:** completed

- [x] Ticket 141 provides a constrained expression grammar with no `eval`/code execution.
- [x] Tickets 142–143 expose exact/intermediate arithmetic and descriptive-statistics values where they aid verification.
- [x] Ticket 144 labels/normalizes units through the shared unit engine and rejects invalid geometry/motion domains and cross-dimension inputs.
- [x] The implemented family is split only into distinct jobs (scientific expressions, fractions/integer toolkit, descriptive statistics/grades, geometry/equation/motion), with shared engines reused instead of route duplication.

**Verification:** `tests/calculator-math-core.test.ts`, `tests/business-math-expansion.test.ts` and the scoped 390px browser acceptance cover known answers, parser security, invalid domains, unit handling and route behavior.
