# 143 — Descriptive statistics grades and completion

**What to build:** Add mean/median/mode, population/sample variance+standard deviation, weighted average/grade and completion-percent modes from shared numeric parsing.

**Traces to:** US-EXP-03; AC-03.2

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** 70 — Result declaration in Tool Manifest.

**Status:** completed

**Suggested skills:** code-module-design → code-tdd

- [x] Population vs sample variance is explicit.
- [x] Empty/singleton/ties/zero-weight cases are defined.
- [x] Formula/intermediate counts are visible.

**Verification:** Independent statistical literals and weighted edge cases.

**Evidence:** Result breakdowns expose count, sum, mean/median/mode, population and sample variance/deviation plus formula/assumption blocks. Focused tests cover singleton sample semantics, no-mode and tied modes, weighted average, zero/mismatched weights and completion bounds. The 37-test focused+regression run, catalog check and Astro check/build passed.
