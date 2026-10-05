# 20 — Everyday math calculator family

**What to build:** Add a bounded family of deterministic everyday math jobs from the benchmark: scientific expressions, descriptive statistics, fractions, equations, geometry and related helpers, prioritizing clear answers and shown formulas.

**Traces to:** US-EXP-03; AC-03.2; DEC-EXP-01, DEC-EXP-07; C-EXP-03

**Constraints:** Use a safe parser instead of eval; each job must earn a route by distinct intent; domain errors and undefined results must be explicit.

**Blocked by:** 01 — Result System v2 primitives.

**Status:** blocked

- [ ] Expression evaluation has a constrained grammar and no code execution.
- [ ] Statistics/math tools show intermediate values where they aid verification.
- [ ] Geometry tools label units and reject incompatible inputs.
- [ ] The family backlog is pruned to distinct jobs before route creation.

**Verification:** Known-answer fixtures, parser security tests, domain/NaN boundaries, locale decimals and browser acceptance.
