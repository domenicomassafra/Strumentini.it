# 141 — Safe scientific expression calculator

**What to build:** Implement a constrained parser for arithmetic, parentheses and documented functions/constants without eval/code execution.

**Traces to:** US-EXP-03; AC-03.2

**Constraints:** C-EXP-01, C-EXP-03, C-EXP-06; official/versioned inputs where rules can change; fail closed on unsupported scope.

**Blocked by:** 70 — Result declaration in Tool Manifest.

**Status:** completed

**Suggested skills:** code-module-design → security-audit → code-tdd

- [x] Operator precedence and function domains are deterministic.
- [x] No arbitrary identifier/property/code execution path exists.
- [x] NaN/infinity/domain errors become useful validation states.

**Verification:** Parser security corpus and independent arithmetic literals.

**Evidence:** `tests/calculator-math-core.test.ts` covers precedence, right-associative powers, documented functions/constants, property/constructor rejection, divide-by-zero, real-domain, non-finite and complexity bounds. `npx vitest run tests/calculator-math-core.test.ts tests/business-tools.test.ts` passed 37/37; `npm run catalog:check`, `npx astro check`, `npx astro build`, and Result v2 conformance/legacy-zero gates passed.
